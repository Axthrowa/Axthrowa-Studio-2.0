//! Destek paketi — sorun bildirirken paylaşılacak, sırları ayıklanmış tek JSON dosyası (saf kısım).
//!
//! Üç katman gizleme, hepsi paket yazılmadan önce bellekte:
//! 1. **Alan adı:** parola/token/anahtar/çerez/oturum benzeri her alanın değeri `[gizli]` olur (her derinlikte).
//! 2. **Bilinen sırlar:** yayın anahtarları ve OBS parolası çağırandan gelir; her metinde geçtiği yer `***` olur
//!    (günlük satırları dahil — FFmpeg/libobs hata satırı tam yayın adresini içerebilir).
//! 3. **Biçim:** `rtmp(s)://` adreslerinin yolu (anahtar orada durur) atılır, belirteç görünümlü uzun dizgiler
//!    `[gizli?]` olur, kullanıcı klasörü `%USERPROFILE%` ile değiştirilir.
//!
//! Hiçbir katman "yeterli" sayılmaz; üçü birlikte uygulanır. Paket kullanıcının diskine yazılır, hiçbir yere
//! gönderilmez.

use serde_json::Value;

/// Değeri gizlenecek alan adları (küçük harfe çevrilmiş adın içinde aranır).
const GIZLI_PARCALAR: &[&str] = &[
  "password", "passwd", "parola", "sifre", "şifre", "token", "secret", "apikey", "api_key", "streamkey",
  "stream_key", "anahtar", "cookie", "session", "credential", "webhook", "authorization", "bearer", "private",
];

pub fn gizli_alan_mi(ad: &str) -> bool {
  let k = ad.to_lowercase();
  if GIZLI_PARCALAR.iter().any(|p| k.contains(p)) {
    return true;
  }
  // "key"/"keys" ile biten alanlar (kickStreamKey, clientKey…) — kısayol alanları hariç
  (k == "key" || k.ends_with("key") || k.ends_with("keys")) && !k.ends_with("hotkey") && !k.ends_with("hotkeys")
}

/// Belirteç görünümlü dizgi: boşluksuz, en az 32 karakter, yalnız belirteç alfabesi, hem harf hem rakam.
fn belirtec_gibi(s: &str) -> bool {
  s.len() >= 32
    && s.chars().all(|c| c.is_ascii_alphanumeric() || "-_.=/+".contains(c))
    && s.chars().any(|c| c.is_ascii_digit())
    && s.chars().any(|c| c.is_ascii_alphabetic())
}

/// `rtmp://sunucu/uygulama/ANAHTAR` → `rtmp://sunucu/…` (yol anahtar taşıyabilir).
fn rtmp_yolunu_at(s: &str) -> String {
  let mut out = String::with_capacity(s.len());
  let mut kalan = s;
  while let Some(i) = kalan.find("rtmp") {
    out.push_str(&kalan[..i]);
    let parca = &kalan[i..];
    let sema = if parca.starts_with("rtmps://") {
      "rtmps://"
    } else if parca.starts_with("rtmp://") {
      "rtmp://"
    } else {
      out.push_str("rtmp");
      kalan = &parca[4..];
      continue;
    };
    let govde = &parca[sema.len()..];
    let son = govde.find(|c: char| c.is_whitespace() || c == '"' || c == '\'').unwrap_or(govde.len());
    let adres = &govde[..son];
    let host = adres.split('/').next().unwrap_or("");
    out.push_str(sema);
    out.push_str(host);
    if adres.len() > host.len() {
      out.push_str("/…");
    }
    kalan = &govde[son..];
  }
  out.push_str(kalan);
  out
}

pub struct Gizleyici {
  sirlar: Vec<String>,
  kullanici_klasoru: Option<String>,
  /// Gizlenen değer sayısı (pakete yazılır: kullanıcı ne kadar şeyin ayıklandığını görür)
  pub sayac: usize,
}

impl Gizleyici {
  pub fn new(sirlar: Vec<String>, kullanici_klasoru: Option<String>) -> Self {
    let mut sirlar: Vec<String> = sirlar.into_iter().map(|s| s.trim().to_string()).filter(|s| s.len() >= 4).collect();
    // Uzun sır önce: kısa olan uzunun parçasıysa yarım maske kalmasın
    sirlar.sort_by_key(|s| std::cmp::Reverse(s.len()));
    sirlar.dedup();
    Self { sirlar, kullanici_klasoru: kullanici_klasoru.filter(|k| k.len() >= 4), sayac: 0 }
  }

  pub fn metin(&mut self, s: &str) -> String {
    let mut out = s.to_string();
    for sir in &self.sirlar {
      if out.contains(sir.as_str()) {
        out = out.replace(sir.as_str(), "***");
        self.sayac += 1;
      }
    }
    let rt = rtmp_yolunu_at(&out);
    if rt != out {
      self.sayac += 1;
      out = rt;
    }
    if let Some(k) = &self.kullanici_klasoru {
      // Windows yolları büyük/küçük harf duyarsız; kullanıcı adı raporda görünmesin. `to_lowercase` bazı
      // harflerde bayt uzunluğunu değiştirir (İ), o yüzden özgün metin üzerinde karakter karakter karşılaştırılır.
      let n = k.len();
      let mut sonuc = String::with_capacity(out.len());
      let mut i = 0;
      while i < out.len() {
        if out.get(i..i + n).is_some_and(|p| p.eq_ignore_ascii_case(k)) {
          sonuc.push_str("%USERPROFILE%");
          i += n;
        } else {
          let c = out[i..].chars().next().unwrap_or(' ');
          sonuc.push(c);
          i += c.len_utf8();
        }
      }
      out = sonuc;
    }
    let parcali: Vec<String> = out
      .split(' ')
      .map(|p| {
        if belirtec_gibi(p) {
          self.sayac += 1;
          "[gizli?]".to_string()
        } else {
          p.to_string()
        }
      })
      .collect();
    parcali.join(" ")
  }

  pub fn deger(&mut self, v: &mut Value) {
    match v {
      Value::Object(m) => {
        for (k, x) in m.iter_mut() {
          if gizli_alan_mi(k) {
            let dolu = match x {
              // Mantıksal değer sır olamaz; "anahtar var mı" gibi bilgi teşhiste gerekir
              Value::Null | Value::Bool(_) => false,
              Value::String(s) => !s.is_empty(),
              Value::Array(a) => !a.is_empty(),
              Value::Object(o) => !o.is_empty(),
              _ => true,
            };
            if dolu {
              *x = Value::String("[gizli]".into());
              self.sayac += 1;
            }
          } else {
            self.deger(x);
          }
        }
      }
      Value::Array(a) => a.iter_mut().for_each(|x| self.deger(x)),
      Value::String(s) => *s = self.metin(s),
      _ => {}
    }
  }
}

/// Dosyanın son `n` satırı (her satır en çok 500 karakter). Dosya yoksa boş.
pub fn son_satirlar(yol: &std::path::Path, n: usize) -> Vec<String> {
  let Ok(bayt) = std::fs::read(yol) else { return Vec::new() };
  // PS 5.1 / libobs günlükleri UTF-16 ya da bozuk UTF-8 olabilir: kayıpsız değil ama okunur
  let metin = if bayt.starts_with(&[0xFF, 0xFE]) {
    let u16s: Vec<u16> = bayt[2..].as_chunks::<2>().0.iter().map(|c| u16::from_le_bytes(*c)).collect();
    String::from_utf16_lossy(&u16s)
  } else {
    String::from_utf8_lossy(&bayt).into_owned()
  };
  let satirlar: Vec<&str> = metin.lines().collect();
  satirlar[satirlar.len().saturating_sub(n)..].iter().map(|s| s.chars().take(500).collect()).collect()
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn alan_adi_kurallari() {
    for g in ["password", "obsPassword", "accessToken", "kickStreamKey", "key", "apiKeys", "Cookie", "sessionId", "yayinAnahtari"] {
      assert!(gizli_alan_mi(g), "{g}");
    }
    for a in ["hotkey", "hotkeys", "sfxHotkey", "keyint_sec", "title", "scene", "monitor"] {
      assert!(!gizli_alan_mi(a), "{a}");
    }
  }

  #[test]
  fn her_derinlikte_ve_her_katmanda_gizler() {
    let anahtar = "live_123456789_abcdefghijklmnopqrstuvwx";
    let mut g = Gizleyici::new(vec![anahtar.into(), "obs-parola-1".into()], Some(r"C:\Users\Ali".into()));
    let mut v = json!({
      "starting": {"obs": {"password": "obs-parola-1", "host": "127.0.0.1"}, "title": "Merhaba"},
      "panel": {"hotkeys": {"mic": "F5"}, "twitchToken": "abc", "bos": "", "hasKey": true},
      "hedefler": [{"server": "rtmp://live.twitch.tv/app/", "not": format!("rtmp://a.b/app/{anahtar} hata")}],
      "gunluk": [format!("bağlanılamadı: {anahtar}"), r"kayıt: C:\users\ali\Videos\x.mkv".to_string()],
      "kimlik": "0123456789abcdef0123456789abcdef01",
    });
    g.deger(&mut v);
    let s = v.to_string();
    assert!(!s.contains(anahtar) && !s.contains("obs-parola-1") && !s.contains("abc\""), "{s}");
    assert_eq!(v["starting"]["obs"]["password"], "[gizli]");
    assert_eq!(v["starting"]["obs"]["host"], "127.0.0.1");
    assert_eq!(v["panel"]["hotkeys"]["mic"], "F5");
    assert_eq!(v["panel"]["twitchToken"], "[gizli]");
    assert_eq!(v["panel"]["bos"], "", "boş alan boş kalır (varlığı teşhis bilgisi)");
    assert_eq!(v["panel"]["hasKey"], true);
    assert_eq!(v["hedefler"][0]["server"], "rtmp://live.twitch.tv/…");
    assert_eq!(v["hedefler"][0]["not"], "rtmp://a.b/… hata");
    assert_eq!(v["gunluk"][0], "bağlanılamadı: ***");
    assert_eq!(v["gunluk"][1], r"kayıt: %USERPROFILE%\Videos\x.mkv");
    assert_eq!(v["kimlik"], "[gizli?]");
    assert!(g.sayac >= 7);
  }

  #[test]
  fn kisa_ya_da_bos_sir_metni_bozmaz() {
    let mut g = Gizleyici::new(vec!["".into(), "ab".into()], None);
    assert_eq!(g.metin("abc ab rtmp dosyası"), "abc ab rtmp dosyası");
    assert_eq!(g.sayac, 0);
  }

  #[test]
  fn son_satirlar_utf16_ve_sinir() {
    let d = std::env::temp_dir().join(format!("yya-destek-{}", std::process::id()));
    std::fs::create_dir_all(&d).unwrap();
    let u8y = d.join("a.log");
    std::fs::write(&u8y, "1\n2\n3\n4\n").unwrap();
    assert_eq!(son_satirlar(&u8y, 2), ["3", "4"]);
    let u16y = d.join("b.log");
    let mut b = vec![0xFF, 0xFE];
    for c in "ş\nç\n".encode_utf16() {
      b.extend_from_slice(&c.to_le_bytes());
    }
    std::fs::write(&u16y, b).unwrap();
    assert_eq!(son_satirlar(&u16y, 5), ["ş", "ç"]);
    assert!(son_satirlar(&d.join("yok.log"), 5).is_empty());
    let _ = std::fs::remove_dir_all(&d);
  }
}
