//! Yalıtılmış yoklama: motor ikilisi `eklenti-yokla <dll> [veri]` kipinde AYRI bir süreçte başlatılır; tek eklentiyi
//! libobs'a yükler, sonucu JSON satırı olarak yazar ve çıkar. Eklenti çökerse yalnız o süreç düşer (çıkış kodu
//! NTSTATUS, ör. 0xC0000005); zaman aşımında süreç öldürülür.
//!
//! Bu bir sanal alan DEĞİLDİR: eklenti kodu kullanıcının yetkileriyle çalışır. Bu yüzden yalnız kullanıcının açık
//! onayıyla çağrılır (API katmanı onay ister).

use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

use super::kayit::simdi;
use super::uyumluluk::{KayitliTur, Yoklama};

pub const VARSAYILAN_SURE: Duration = Duration::from_secs(25);

/// Motor çıktısını (`{"libobs": "...", "yoklama": {...}}`) yoklama kaydına çevirir.
pub fn sonucu_oku(satir: &str) -> Option<Yoklama> {
  let v: Value = serde_json::from_str(satir.trim()).ok()?;
  let y = v.get("yoklama")?;
  let metin = |ad: &str| y.get(ad).and_then(Value::as_str).unwrap_or("").to_string();
  let turler = y
    .get("turler")
    .and_then(Value::as_array)
    .map(|a| {
      a.iter()
        .map(|t| KayitliTur {
          id: t.get("id").and_then(Value::as_str).unwrap_or("").to_string(),
          tur: t.get("tur").and_then(Value::as_str).unwrap_or("").to_string(),
          ad: t.get("ad").and_then(Value::as_str).unwrap_or("").to_string(),
        })
        .collect()
    })
    .unwrap_or_default();
  Some(Yoklama {
    sonuc: metin("sonuc"),
    api_surumu: y.get("apiSurumu").and_then(Value::as_u64).unwrap_or(0) as u32,
    turler,
    ad: metin("ad"),
    aciklama: metin("aciklama"),
    yazar: metin("yazar"),
    sure_ms: y.get("sureMs").and_then(Value::as_u64).unwrap_or(0),
    cikis_kodu: Some(0),
    ayrinti: String::new(),
    libobs: v.get("libobs").and_then(Value::as_str).unwrap_or("").to_string(),
    zaman: simdi(),
  })
}

fn son_satirlar(metin: &str, n: usize) -> String {
  let v: Vec<&str> = metin.lines().filter(|l| !l.trim().is_empty()).collect();
  v[v.len().saturating_sub(n)..].join("\n")
}

pub async fn yokla(exe: &Path, dll: &Path, veri: Option<&Path>, sure: Duration) -> Yoklama {
  let bas = Instant::now();
  let mut komut = Command::new(exe);
  komut.arg("eklenti-yokla").arg(dll);
  if let Some(v) = veri {
    komut.arg(v);
  }
  komut.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
  #[cfg(windows)]
  {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    komut.creation_flags(CREATE_NO_WINDOW);
  }
  let hata = |sonuc: &str, ayrinti: String, kod: Option<i64>| Yoklama {
    sonuc: sonuc.into(),
    ayrinti,
    cikis_kodu: kod,
    sure_ms: bas.elapsed().as_millis() as u64,
    zaman: simdi(),
    ..Default::default()
  };
  let mut cocuk = match komut.spawn() {
    Ok(c) => c,
    Err(e) => return hata("hata", format!("yoklama süreci başlatılamadı: {e}"), None),
  };
  let mut cikti = cocuk.stdout.take();
  let mut hata_akisi = cocuk.stderr.take();
  let oku = async {
    // İki akış EŞZAMANLI okunur: sırayla okunsaydı dolan stderr tamponu süreci (ve bizi) kilitlerdi
    let o_f = async {
      let mut b = Vec::new();
      if let Some(c) = cikti.as_mut() {
        let _ = c.read_to_end(&mut b).await;
      }
      String::from_utf8_lossy(&b).into_owned()
    };
    let h_f = async {
      let mut b = Vec::new();
      if let Some(c) = hata_akisi.as_mut() {
        let _ = c.read_to_end(&mut b).await;
      }
      String::from_utf8_lossy(&b).into_owned()
    };
    let (o, h) = tokio::join!(o_f, h_f);
    let durum = cocuk.wait().await;
    (o, h, durum)
  };
  let (o, h, durum) = match tokio::time::timeout(sure, oku).await {
    Ok(x) => x,
    Err(_) => {
      // `oku` düştü; kill_on_drop süreci öldürür
      return hata("zaman_asimi", format!("{} sn içinde bitmedi", sure.as_secs()), None);
    }
  };
  // Günlük satırları yerel yollar içerebilir: kullanıcı klasörü maskelenir
  let mut gizleyici = crate::destek::Gizleyici::new(Vec::new(), std::env::var("USERPROFILE").ok());
  let gunluk = gizleyici.metin(&son_satirlar(&h, 12));
  let kod = durum.ok().and_then(|d| d.code()).map(|k| k as u32 as i64);
  match o.lines().rev().find(|l| l.trim_start().starts_with('{')).and_then(sonucu_oku) {
    Some(mut y) => {
      y.cikis_kodu = kod;
      if y.sonuc != "yuklendi" {
        y.ayrinti = gunluk;
      }
      y
    }
    // JSON yok: süreç yazamadan düştü
    None if kod.is_some_and(|k| k != 0) => {
      let mut y = hata("cokme", gunluk, kod);
      if o.contains("\"hata\"") {
        y.sonuc = "hata".into();
        y.ayrinti = o.chars().take(300).collect();
      }
      y
    }
    None => hata("hata", format!("yoklama sonucu okunamadı: {}", o.chars().take(200).collect::<String>()), kod),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn motor_cikti_bicimi_okunur() {
    let s = r#"{"libobs":"32.2.2","yoklama":{"aciklama":"d","ad":"A","apiSurumu":536870912,"id":"yoklama","kod":0,"sonuc":"yuklendi","sureMs":3,"turler":[{"ad":"X","id":"x","tur":"kaynak"}],"yazar":"Y"}}"#;
    let y = sonucu_oku(s).unwrap();
    assert_eq!((y.sonuc.as_str(), y.api_surumu, y.libobs.as_str()), ("yuklendi", 32 << 24, "32.2.2"));
    assert_eq!(y.turler[0].tur, "kaynak");
    assert!(sonucu_oku("{bozuk").is_none());
    assert!(sonucu_oku(r#"{"hata":"x"}"#).is_none());
  }

  /// Gerçek motor + kendi test eklentilerimiz (derlenmişse): yüklendi / açılamadı / sürüm / çökme.
  #[tokio::test]
  async fn gercek_yoklama_test_eklentileriyle() {
    let Some(exe) = crate::motor_kopru::exe_yolu() else { return };
    let kok = Path::new(env!("CARGO_MANIFEST_DIR")).join("../motor/test-eklentileri/target/release");
    if !kok.join("yym_test_kaynak.dll").is_file() || !Path::new(r"C:\Program Files\obs-studio\bin\64bit\obs.dll").is_file() {
      return;
    }
    let y = yokla(&exe, &kok.join("yym_test_kaynak.dll"), None, VARSAYILAN_SURE).await;
    assert_eq!(y.sonuc, "yuklendi", "{y:?}");
    assert!(y.turler.iter().any(|t| t.id == "yym_test_desen" && t.tur == "kaynak"));
    assert!(y.turler.iter().any(|t| t.id == "yym_test_filtre" && t.tur == "filtre"));
    assert_eq!(yokla(&exe, &kok.join("yym_test_eksik_bagimlilik.dll"), None, VARSAYILAN_SURE).await.sonuc, "acilamadi");
    let s = yokla(&exe, &kok.join("yym_test_yeni_surum.dll"), None, VARSAYILAN_SURE).await;
    assert_eq!((s.sonuc.as_str(), s.api_surumu >> 24), ("surum", 99));
    let c = yokla(&exe, &kok.join("yym_test_cokme.dll"), None, VARSAYILAN_SURE).await;
    assert_eq!(c.sonuc, "cokme", "{c:?}");
    assert_eq!(c.cikis_kodu, Some(0xC000_0005));
  }
}
