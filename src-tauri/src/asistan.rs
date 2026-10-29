//! Yerel komut asistanı: Türkçe metni ("sahneyi Oyun yap", "mikrofonu kapat", "chat'i temizle") eylem kayıt
//! defterindeki bir eyleme çevirir. Kural tabanlı ve tamamen yerel: model indirmez, ağ kullanmaz, milisaniyede
//! çalışır. Konuşmadan çevrilmiş (speech-to-text) metne dayanıklı olsun diye büyük/küçük harf, Türkçe harfler
//! (ı/i, ş/s…) ve noktalama yok sayılır; sahne ve ses girişi adları OBS'teki gerçek adlarla eşleştirilir.
//!
//! Yürütme burada değil: `server::asistan_api` çözülen eylemi kayıt defterinin tek yürütme yolundan geçirir
//! (izin, onay, denetim günlüğü).

use serde_json::{json, Value};

#[derive(Debug, Clone, PartialEq)]
pub enum Niyet {
  /// Kayıt defterindeki eylem (`actions::find(id)`) ve parametreleri
  Eylem { id: &'static str, params: Value },
  /// Kick/Twitch sohbetini platformda temizler: kayıt defterinde yok, her zaman onay ister
  SohbetiTemizle,
}

/// OBS'teki adlar (bağlı değilse boş)
#[derive(Debug, Default)]
pub struct Baglam {
  pub sahneler: Vec<String>,
  pub girisler: Vec<String>,
}

/// Küçük harf (Türkçe kuralıyla) + Türkçe harfleri sadeleştir + noktalamayı boşluğa çevir
pub fn sadelestir(s: &str) -> String {
  let mut o = String::with_capacity(s.len());
  for c in s.chars() {
    let d = match c {
      'İ' | 'I' | 'ı' | 'i' => 'i',
      'Ş' | 'ş' => 's',
      'Ğ' | 'ğ' => 'g',
      'Ü' | 'ü' => 'u',
      'Ö' | 'ö' => 'o',
      'Ç' | 'ç' => 'c',
      c if c.is_alphanumeric() => c.to_lowercase().next().unwrap_or(c),
      _ => ' ',
    };
    o.push(d);
  }
  o.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn kelime_var(metin: &str, kokler: &[&str]) -> bool {
  metin.split(' ').any(|k| kokler.iter().any(|r| k.starts_with(r)))
}

/// Metinde adı geçen en uzun aday (ör. "Oyun" ve "Oyun Sonu" varsa "oyun sonuna geç" → "Oyun Sonu")
fn ad_bul<'a>(metin: &str, adaylar: &'a [String]) -> Option<&'a String> {
  let m = format!(" {metin} ");
  adaylar
    .iter()
    .filter(|a| {
      let s = sadelestir(a);
      // Ad ekiyle de geçebilir: "oyuna", "oyun'a" → kelime başı eşleşmesi yeter; ünsüz yumuşamasıyla da
      // ("müzik" → "müziği", "kitap" → "kitabı")
      !s.is_empty() && (m.contains(&format!(" {s}")) || m.contains(&format!(" {}", yumusat(&s))))
    })
    .max_by_key(|a| sadelestir(a).len())
}

/// Son ünsüzün ek alınca yumuşamış biçimi (sadeleştirilmiş: ğ→g): k→g, p→b, t→d, ç→c
fn yumusat(s: &str) -> String {
  let mut v: Vec<char> = s.chars().collect();
  if let Some(son) = v.last_mut() {
    *son = match *son {
      'k' => 'g',
      'p' => 'b',
      't' => 'd',
      c => c,
    };
  }
  v.into_iter().collect()
}

const BASLAT: &[&str] = &["baslat", "ac"];
const DURDUR: &[&str] = &["durdur", "bitir", "kapat", "sonlandir"];

pub fn coz(metin: &str, b: &Baglam) -> Result<Niyet, String> {
  let m = sadelestir(metin);
  if m.is_empty() {
    return Err("Komut boş".into());
  }
  let eylem = |id: &'static str, params: Value| Ok(Niyet::Eylem { id, params });

  if kelime_var(&m, &["chat", "sohbet"]) && kelime_var(&m, &["temizle", "sil"]) {
    return Ok(Niyet::SohbetiTemizle);
  }

  // Sahne: "sahne" geçiyorsa ya da OBS'teki bir sahnenin adı + geçiş fiili
  let sahne_fiili = kelime_var(&m, &["gec", "degistir", "yap", "ac", "goster"]);
  if kelime_var(&m, &["sahne"]) || sahne_fiili {
    if let Some(s) = ad_bul(&m, &b.sahneler) {
      return eylem("scene.switch", json!({ "scene": s }));
    }
    if kelime_var(&m, &["sahne"]) {
      return Err(if b.sahneler.is_empty() {
        "Sahne bulunamadı: OBS bağlı değil".into()
      } else {
        format!("Sahne bulunamadı. OBS'teki sahneler: {}", b.sahneler.join(", "))
      });
    }
  }

  if kelime_var(&m, &["tekrar", "replay", "klip"]) && kelime_var(&m, &["kaydet", "al"]) {
    return eylem("replay.save", json!({}));
  }

  if kelime_var(&m, &["kayd", "kayit"]) {
    if kelime_var(&m, &["duraklat"]) {
      return eylem("record.pause", json!({}));
    }
    if kelime_var(&m, &["devam", "surdur"]) {
      return eylem("record.resume", json!({}));
    }
    if kelime_var(&m, DURDUR) {
      return eylem("record.stop", json!({}));
    }
    if kelime_var(&m, BASLAT) {
      return eylem("record.start", json!({}));
    }
  }

  if kelime_var(&m, &["yayin"]) {
    if kelime_var(&m, DURDUR) {
      return eylem("stream.stop", json!({}));
    }
    if kelime_var(&m, BASLAT) {
      return eylem("stream.start", json!({}));
    }
  }

  if kelime_var(&m, &["uyari", "alert"]) {
    if kelime_var(&m, &["gec", "atla"]) {
      return eylem("alert.skip", json!({}));
    }
    if kelime_var(&m, &["devam", "surdur"]) {
      return eylem("alert.resume", json!({}));
    }
    if kelime_var(&m, &["durdur", "duraklat", "beklet"]) {
      return eylem("alert.pause", json!({}));
    }
  }

  // Ses: "mikrofonu kapat", "müziği aç", "Desktop Audio sustur"
  let kapat = kelime_var(&m, &["kapat", "sustur", "kis"]);
  let ac = kelime_var(&m, &["ac"]);
  if kapat || ac {
    let giris = ad_bul(&m, &b.girisler).or_else(|| {
      // "mikrofon" dendiyse adında mik/mic geçen ilk giriş
      kelime_var(&m, &["mikrofon", "mik", "mic"])
        .then(|| b.girisler.iter().find(|g| ["mik", "mic"].iter().any(|k| sadelestir(g).contains(k))))
        .flatten()
    });
    if let Some(g) = giris {
      return eylem(if kapat { "audio.mute" } else { "audio.unmute" }, json!({ "input": g }));
    }
    if kelime_var(&m, &["mikrofon", "mik", "mic", "ses"]) {
      return Err("Ses girişi bulunamadı: OBS'teki giriş adını söyleyin".into());
    }
  }

  Err(format!("Anlaşılamadı: \"{}\"", metin.trim()))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn baglam() -> Baglam {
    Baglam {
      sahneler: vec!["Oyun".into(), "Oyun Sonu".into(), "Sohbet".into(), "Başlıyoruz".into()],
      girisler: vec!["Mic/Aux".into(), "Masaüstü Sesi".into(), "Müzik".into()],
    }
  }

  fn eylem(m: &str) -> (&'static str, Value) {
    match coz(m, &baglam()) {
      Ok(Niyet::Eylem { id, params }) => (id, params),
      x => panic!("{m}: {x:?}"),
    }
  }

  #[test]
  fn sahne_gecisi_gercek_adla_ve_ekle() {
    assert_eq!(eylem("Sahneyi Oyun olarak değiştir"), ("scene.switch", json!({ "scene": "Oyun" })));
    assert_eq!(eylem("oyun sonuna geç"), ("scene.switch", json!({ "scene": "Oyun Sonu" })));
    // Konuşmadan çevrilmiş, Türkçe harfsiz ve büyük harfli
    assert_eq!(eylem("BASLIYORUZ SAHNESINI AC"), ("scene.switch", json!({ "scene": "Başlıyoruz" })));
    assert!(coz("sahneyi uzay yap", &baglam()).unwrap_err().contains("Oyun, Oyun Sonu"));
  }

  #[test]
  fn ses_kayit_yayin_uyari() {
    assert_eq!(eylem("mikrofonu kapat"), ("audio.mute", json!({ "input": "Mic/Aux" })));
    assert_eq!(eylem("müziği aç"), ("audio.unmute", json!({ "input": "Müzik" })));
    assert_eq!(eylem("kaydı başlat").0, "record.start");
    assert_eq!(eylem("kaydı durdur").0, "record.stop");
    assert_eq!(eylem("yayını bitir").0, "stream.stop");
    assert_eq!(eylem("tekrarı kaydet").0, "replay.save");
    assert_eq!(eylem("uyarıyı geç").0, "alert.skip");
    assert_eq!(eylem("uyarıları durdur").0, "alert.pause");
  }

  #[test]
  fn sohbet_temizleme_ayrı_niyet() {
    assert_eq!(coz("Chat'i temizle", &baglam()), Ok(Niyet::SohbetiTemizle));
    // "Sohbet" bir sahne adı da olsa temizleme önce gelir; sahneye geçiş ayrı söylenir
    assert_eq!(eylem("sohbet sahnesine geç"), ("scene.switch", json!({ "scene": "Sohbet" })));
  }

  #[test]
  fn anlasilmayan_ve_bos() {
    assert!(coz("bugün hava güzel", &baglam()).is_err());
    assert!(coz("  ", &baglam()).is_err());
  }

  #[test]
  fn her_cozulen_eylem_kayit_defterinde_var() {
    for m in ["kaydı başlat", "kaydı duraklat", "kayda devam", "yayını başlat", "uyarılara devam"] {
      let (id, _) = eylem(m);
      assert!(crate::actions::find(id).is_some(), "{id}");
    }
  }
}
