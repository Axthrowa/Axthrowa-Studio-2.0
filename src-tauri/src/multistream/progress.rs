//! FFmpeg `-progress pipe:1` çıktısı ayrıştırıcısı (saf).
//!
//! Çıktı `anahtar=değer` satırlarından oluşan bloklardır; her blok `progress=continue|end` ile biter.

use serde::Serialize;

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
  pub frames: u64,
  pub fps: f64,
  pub bitrate_kbps: Option<f64>,
  pub total_bytes: u64,
  pub out_time_ms: u64,
  pub speed: Option<f64>,
  pub ended: bool,
}

/// Blok birikimcisi: satır satır beslenir, blok tamamlanınca `Some` döner.
#[derive(Default)]
pub struct ProgressReader {
  cur: Progress,
}

fn sayi(s: &str) -> Option<f64> {
  let t = s.trim();
  if t.eq_ignore_ascii_case("n/a") {
    return None;
  }
  t.parse::<f64>().ok().filter(|v| v.is_finite())
}

impl ProgressReader {
  pub fn feed(&mut self, line: &str) -> Option<Progress> {
    let (k, v) = line.trim().split_once('=')?;
    let v = v.trim();
    match k.trim() {
      "frame" => self.cur.frames = v.parse().unwrap_or(self.cur.frames),
      "fps" => self.cur.fps = sayi(v).unwrap_or(0.0),
      "bitrate" => self.cur.bitrate_kbps = sayi(v.trim_end_matches("kbits/s")),
      "total_size" => self.cur.total_bytes = v.parse().unwrap_or(self.cur.total_bytes),
      "out_time_us" | "out_time_ms" => {
        // FFmpeg geçmişte out_time_ms'i de mikro saniye yazıyordu; ikisi de µs kabul edilir
        if let Ok(us) = v.parse::<i64>() {
          self.cur.out_time_ms = (us.max(0) / 1000) as u64;
        }
      }
      "speed" => self.cur.speed = sayi(v.trim_end_matches('x')),
      "progress" => {
        self.cur.ended = v == "end";
        return Some(self.cur.clone());
      }
      _ => {}
    }
    None
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn blok_okur() {
    let mut r = ProgressReader::default();
    let blok = "frame=240\nfps=30.02\nstream_0_0_q=-1.0\nbitrate=1234.5kbits/s\ntotal_size=880000\nout_time_us=8000000\nout_time_ms=8000000\ndup_frames=0\nspeed=1.01x\nprogress=continue\n";
    let mut son = None;
    for l in blok.lines() {
      if let Some(p) = r.feed(l) {
        son = Some(p);
      }
    }
    let p = son.unwrap();
    assert_eq!(p.frames, 240);
    assert_eq!(p.bitrate_kbps, Some(1234.5));
    assert_eq!(p.speed, Some(1.01));
    assert_eq!(p.out_time_ms, 8000);
    assert!(!p.ended);
  }

  #[test]
  fn bilinmeyen_degerler_ve_son() {
    let mut r = ProgressReader::default();
    assert_eq!(r.feed("bitrate=N/A"), None);
    assert_eq!(r.feed("speed=N/A"), None);
    assert_eq!(r.feed("çöp satır"), None);
    let p = r.feed("progress=end").unwrap();
    assert!(p.ended);
    assert_eq!(p.bitrate_kbps, None);
    assert_eq!(p.speed, None);
  }
}
