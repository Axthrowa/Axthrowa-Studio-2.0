//! FLV etiket ayrıştırıcı / yazıcı (saf).
//!
//! Alıcı FFmpeg, OBS'ten gelen RTMP akışını yeniden kodlamadan FLV olarak verir; çoğaltıcı bu akışı etiketlere
//! böler, dizi başlıklarını önbelleğe alır ve her hedefe anahtar kareden başlayarak yazar.
//!
//! Biçim: 9 baytlık başlık + 4 bayt `PreviousTagSize0`, ardından her etiket:
//! `tür(1) boyut(3) zaman(3) zaman_uzantısı(1) akış_kimliği(3) veri(boyut) önceki_etiket_boyutu(4)`.
//! Enhanced RTMP (HEVC / AV1) video etiketlerinde ilk baytın en üst biti `ExVideoTagHeader` işaretidir.

use std::sync::Arc;

pub const TAG_AUDIO: u8 = 8;
pub const TAG_VIDEO: u8 = 9;
pub const TAG_SCRIPT: u8 = 18;

/// Tek bir FLV etiketi. Veri paylaşımlı: aynı etiket birden çok hedefe kopyalanmadan gider.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Tag {
  pub kind: u8,
  /// Milisaniye (24 bit + 8 bit uzantı)
  pub ts: u32,
  pub data: Arc<[u8]>,
}

impl Tag {
  pub fn new(kind: u8, ts: u32, data: impl Into<Arc<[u8]>>) -> Self {
    Self { kind, ts, data: data.into() }
  }

  /// Görüntü anahtar karesi mi (klasik AVC ve Enhanced RTMP)?
  pub fn is_keyframe(&self) -> bool {
    if self.kind != TAG_VIDEO || self.data.is_empty() {
      return false;
    }
    let b = self.data[0];
    if b & 0x80 != 0 {
      // ExVideoTagHeader: frameType = bit 4-6, packetType = alt 4 bit
      let frame_type = (b >> 4) & 0x07;
      let packet_type = b & 0x0F;
      return frame_type == 1 && (packet_type == 1 || packet_type == 3);
    }
    let frame_type = b >> 4;
    let codec = b & 0x0F;
    // AVC (7): AVCPacketType 1 = NALU; diğer eski kodekler için yalnız frameType
    if codec == 7 {
      return frame_type == 1 && self.data.get(1) == Some(&1);
    }
    frame_type == 1
  }

  /// Kodlayıcı yapılandırması (dizi başlığı) mı? Geç katılan hedef bunlar olmadan çözemez.
  pub fn is_sequence_header(&self) -> bool {
    if self.data.is_empty() {
      return false;
    }
    let b = self.data[0];
    match self.kind {
      TAG_VIDEO => {
        if b & 0x80 != 0 {
          (b & 0x0F) == 0 // PacketTypeSequenceStart
        } else {
          (b & 0x0F) == 7 && self.data.get(1) == Some(&0)
        }
      }
      // AAC (10): AACPacketType 0 = AudioSpecificConfig
      TAG_AUDIO => (b >> 4) == 10 && self.data.get(1) == Some(&0),
      _ => false,
    }
  }

  /// Etiketi (arkasındaki `PreviousTagSize` ile) verilen zaman damgasıyla yazar.
  pub fn encode_with_ts(&self, ts: u32, out: &mut Vec<u8>) {
    let len = self.data.len() as u32;
    out.push(self.kind);
    out.extend_from_slice(&len.to_be_bytes()[1..]);
    out.extend_from_slice(&ts.to_be_bytes()[1..]);
    out.push((ts >> 24) as u8);
    out.extend_from_slice(&[0, 0, 0]);
    out.extend_from_slice(&self.data);
    out.extend_from_slice(&(11 + len).to_be_bytes());
  }
}

/// Varsayılan FLV başlığı (ses + görüntü) — alıcıdan başlık gelmeden hedef açılırsa.
pub const DEFAULT_HEADER: [u8; 9] = [b'F', b'L', b'V', 1, 0x05, 0, 0, 0, 9];

/// Akış ayrıştırıcı: parça parça gelen baytlardan tam etiketleri çıkarır.
#[derive(Default)]
pub struct Parser {
  buf: Vec<u8>,
  header: Option<[u8; 9]>,
  header_done: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ParseError {
  NotFlv,
  TagTooLarge(u32),
}

/// Tek etiket için üst sınır (bozuk akışın belleği şişirmesini önler).
const MAX_TAG: u32 = 8 * 1024 * 1024;

impl Parser {
  pub fn header(&self) -> Option<[u8; 9]> {
    self.header
  }

  /// Yeni baytları ekler ve tamamlanan etiketleri döndürür.
  pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<Tag>, ParseError> {
    self.buf.extend_from_slice(bytes);
    let mut out = Vec::new();
    let mut pos = 0usize;
    if !self.header_done {
      if self.buf.len() < 13 {
        return Ok(out);
      }
      if &self.buf[0..3] != b"FLV" {
        return Err(ParseError::NotFlv);
      }
      let mut h = [0u8; 9];
      h.copy_from_slice(&self.buf[0..9]);
      let data_offset = u32::from_be_bytes([h[5], h[6], h[7], h[8]]) as usize;
      // Başlık uzunluğu (normalde 9) + PreviousTagSize0
      let skip = data_offset.max(9) + 4;
      if self.buf.len() < skip {
        return Ok(out);
      }
      self.header = Some(h);
      self.header_done = true;
      pos = skip;
    }
    loop {
      if self.buf.len() < pos + 11 {
        break;
      }
      let b = &self.buf[pos..];
      let kind = b[0] & 0x1F;
      let len = u32::from_be_bytes([0, b[1], b[2], b[3]]);
      if len > MAX_TAG {
        return Err(ParseError::TagTooLarge(len));
      }
      let ts = u32::from_be_bytes([b[7], b[4], b[5], b[6]]);
      let total = 11 + len as usize + 4;
      if b.len() < total {
        break;
      }
      let data: Arc<[u8]> = Arc::from(&b[11..11 + len as usize]);
      out.push(Tag { kind, ts, data });
      pos += total;
    }
    self.buf.drain(..pos);
    Ok(out)
  }
}

/// Hedef başına zaman tabanı: ilk anahtar kare 0 olur; yeni alıcı oturumunda (OBS yeniden bağlandı) kaldığı
/// yerden devam eder, böylece yayıncıya giden zaman damgaları geri gitmez.
#[derive(Clone, Debug, Default)]
pub struct Timeline {
  base: Option<u32>,
  offset: u32,
  last_out: u32,
}

impl Timeline {
  /// Yeni kaynak oturumu: bir sonraki anahtar kare son yazılan zamanın hemen ardına yerleşir.
  pub fn resume(&mut self) {
    if self.base.is_some() {
      self.offset = self.last_out.saturating_add(40);
    }
    self.base = None;
  }

  pub fn is_anchored(&self) -> bool {
    self.base.is_some()
  }

  /// Anahtar karede tabanı sabitler.
  pub fn anchor(&mut self, ts: u32) {
    self.base = Some(ts);
  }

  /// Giriş zamanını çıkış zamanına çevirir (taban yoksa `None`).
  pub fn map(&mut self, ts: u32) -> Option<u32> {
    let base = self.base?;
    let out = self.offset.saturating_add(ts.saturating_sub(base));
    self.last_out = self.last_out.max(out);
    Some(out)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn flv(tags: &[Tag]) -> Vec<u8> {
    let mut v = DEFAULT_HEADER.to_vec();
    v.extend_from_slice(&[0, 0, 0, 0]);
    for t in tags {
      t.encode_with_ts(t.ts, &mut v);
    }
    v
  }

  fn avc(frame: u8, packet: u8, ts: u32) -> Tag {
    Tag::new(TAG_VIDEO, ts, vec![(frame << 4) | 7, packet, 0, 0, 0, 0xAB])
  }

  #[test]
  fn parcali_gelen_akistan_etiketleri_cikarir() {
    let tags = vec![
      Tag::new(TAG_SCRIPT, 0, vec![2, 0, 10]),
      avc(1, 0, 0),
      Tag::new(TAG_AUDIO, 0, vec![0xAF, 0, 0x12, 0x10]),
      avc(1, 1, 33),
      avc(2, 1, 66),
      Tag::new(TAG_VIDEO, 0x0100_0000 + 5, vec![0x27, 1, 0]),
    ];
    let bytes = flv(&tags);
    let mut p = Parser::default();
    let mut got = Vec::new();
    for chunk in bytes.chunks(7) {
      got.extend(p.push(chunk).unwrap());
    }
    assert_eq!(got, tags);
    assert_eq!(p.header(), Some(DEFAULT_HEADER));
    // 24 bitten büyük zaman damgası uzantı baytıyla korunur
    assert_eq!(got[5].ts, 0x0100_0005);
  }

  #[test]
  fn flv_olmayan_akisi_reddeder() {
    let mut p = Parser::default();
    assert_eq!(p.push(b"RIFF0000000000000"), Err(ParseError::NotFlv));
  }

  #[test]
  fn asiri_buyuk_etiketi_reddeder() {
    let mut v = DEFAULT_HEADER.to_vec();
    v.extend_from_slice(&[0, 0, 0, 0]);
    v.extend_from_slice(&[9, 0xFF, 0xFF, 0xFF, 0, 0, 0, 0, 0, 0, 0]);
    let mut p = Parser::default();
    assert!(matches!(p.push(&v), Err(ParseError::TagTooLarge(_))));
  }

  #[test]
  fn avc_anahtar_kare_ve_dizi_basligi() {
    assert!(avc(1, 1, 0).is_keyframe());
    assert!(!avc(2, 1, 0).is_keyframe());
    assert!(!avc(1, 0, 0).is_keyframe(), "dizi başlığı anahtar kare sayılmaz");
    assert!(avc(1, 0, 0).is_sequence_header());
    assert!(Tag::new(TAG_AUDIO, 0, vec![0xAF, 0]).is_sequence_header());
    assert!(!Tag::new(TAG_AUDIO, 0, vec![0xAF, 1]).is_sequence_header());
  }

  #[test]
  fn enhanced_rtmp_hevc_av1() {
    // 0x80 | frameType(1)<<4 | packetType
    let seq = Tag::new(TAG_VIDEO, 0, vec![0x80 | 0x10, b'h', b'v', b'c', b'1']);
    let key = Tag::new(TAG_VIDEO, 0, vec![0x80 | 0x10 | 1, b'a', b'v', b'0', b'1']);
    let keyx = Tag::new(TAG_VIDEO, 0, vec![0x80 | 0x10 | 3, b'h', b'v', b'c', b'1']);
    let inter = Tag::new(TAG_VIDEO, 0, vec![0x80 | 0x20 | 1, b'h', b'v', b'c', b'1']);
    assert!(seq.is_sequence_header() && !seq.is_keyframe());
    assert!(key.is_keyframe() && keyx.is_keyframe());
    assert!(!inter.is_keyframe());
  }

  #[test]
  fn zaman_tabani_gec_katilma_ve_yeniden_baglanma() {
    let mut t = Timeline::default();
    assert_eq!(t.map(500), None, "anahtar kareden önce yazılmaz");
    t.anchor(3000);
    assert_eq!(t.map(3000), Some(0));
    assert_eq!(t.map(3033), Some(33));
    // OBS yeniden bağlandı: kaynak zamanı sıfırdan başlıyor
    t.resume();
    assert!(!t.is_anchored());
    t.anchor(0);
    let ilk = t.map(0).unwrap();
    assert!(ilk > 33, "zaman geri gitmemeli: {ilk}");
  }
}
