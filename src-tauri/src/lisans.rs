//! Premium lisans. Anahtar `scripts/lisans-uret.mjs` ile geliştiricinin özel anahtarıyla (Ed25519) imzalanır;
//! uygulama yalnız açık anahtarı taşır ve sunucuya sormadan doğrular. Geçerli anahtar Windows Kimlik Bilgisi
//! Yöneticisi'nde (`secret_store`, DPAPI ile kullanıcıya bağlı) saklanır, diske düz yazılmaz.
//!
//! Not: uygulama GPL-2.0-or-later; lisans denetimi teknik bir kilit değil, destekçiyi tanımanın yoludur.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use chrono::NaiveDate;
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::secret_store;

/// `node scripts/lisans-uret.mjs acik` çıktısı
const ACIK_ANAHTAR: &str = "sKmIND32FaHW3OtFc47r3qHdP2LZuZ1Vn6UrWSGlxGA";
const ON_EK: &str = "AXT1-";
const DEPO_ADI: &str = "lisans.anahtar";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Lisans {
  pub kime: String,
  pub plan: String,
  pub verildi: String,
  /// YYYY-AA-GG; yoksa süresiz
  pub bitis: Option<String>,
}

fn coz(anahtar: &str, acik: &str, bugun: NaiveDate) -> Result<Lisans, String> {
  let govde = anahtar.trim().strip_prefix(ON_EK).ok_or("Lisans anahtarı AXT1- ile başlamalı")?;
  let (yuk, imza) = govde.split_once('.').ok_or("Lisans anahtarı eksik")?;
  let yuk = B64.decode(yuk).map_err(|_| "Lisans anahtarı bozuk")?;
  let imza = B64.decode(imza).ok().and_then(|b| Signature::from_slice(&b).ok()).ok_or("Lisans anahtarı bozuk")?;
  let acik: [u8; 32] = B64.decode(acik).ok().and_then(|b| b.try_into().ok()).ok_or("Uygulamanın açık anahtarı bozuk")?;
  VerifyingKey::from_bytes(&acik)
    .map_err(|_| "Uygulamanın açık anahtarı bozuk")?
    .verify_strict(&yuk, &imza)
    .map_err(|_| "Lisans anahtarı geçersiz")?;
  let lisans: Lisans = serde_json::from_slice(&yuk).map_err(|_| "Lisans anahtarı bozuk")?;
  if let Some(bitis) = &lisans.bitis {
    let gun = NaiveDate::parse_from_str(bitis, "%Y-%m-%d").map_err(|_| "Lisans bitiş tarihi bozuk")?;
    if gun < bugun {
      return Err(format!("Lisansın süresi {bitis} tarihinde doldu"));
    }
  }
  Ok(lisans)
}

fn dogrula(anahtar: &str) -> Result<Lisans, String> {
  coz(anahtar, ACIK_ANAHTAR, chrono::Local::now().date_naive())
}

/// Kayıtlı lisans: yoksa `None`; kayıtlı ama geçersizse (süresi dolmuş) hata
#[tauri::command]
pub async fn lisans_durumu() -> Result<Option<Lisans>, String> {
  match secret_store::get_secret(DEPO_ADI) {
    Some(anahtar) => dogrula(&anahtar).map(Some),
    None => Ok(None),
  }
}

#[tauri::command]
pub async fn lisans_etkinlestir(anahtar: String) -> Result<Lisans, String> {
  let lisans = dogrula(&anahtar)?;
  if !secret_store::set_secret(DEPO_ADI, anahtar.trim()) {
    return Err("Lisans güvenli depoya yazılamadı".into());
  }
  // Anahtar ve kişi adı günlüğe yazılmaz
  log::info!(target: "lisans", "lisans etkinleştirildi ({})", lisans.plan);
  Ok(lisans)
}

#[tauri::command]
pub async fn lisans_kaldir() {
  secret_store::delete_secret(DEPO_ADI);
  log::info!(target: "lisans", "lisans kaldırıldı");
}

/// Tanıtım sitesi (derlemede `AXTHROWA_SITE_URL`, ör. https://axthrowa.com). Yoksa Discord bağlama görünmez.
const SITE: Option<&str> = option_env!("AXTHROWA_SITE_URL");

fn site() -> Option<&'static str> {
  SITE.map(|s| s.trim().trim_end_matches('/')).filter(|s| s.starts_with("https://"))
}

#[tauri::command]
pub fn discord_kullanilabilir() -> bool {
  site().is_some()
}

/// Sitenin Discord sayfasını varsayılan tarayıcıda açar. Anahtar adresin # kısmında gider: sunucuya ve
/// günlüklere ulaşmaz, arayüze (webview) de hiç verilmez.
#[tauri::command]
pub async fn discord_bagla() -> Result<(), String> {
  let site = site().ok_or("Bu derlemede site adresi yok")?;
  let anahtar = secret_store::get_secret(DEPO_ADI).ok_or("Önce Premium lisansı etkinleştirin")?;
  dogrula(&anahtar)?;
  crate::open_external_url(&format!("{site}/discord#anahtar={anahtar}"))
}

#[cfg(test)]
mod tests {
  use super::*;

  // Yalnız sınama için atılmış bir anahtar çiftiyle `lisans-uret.mjs`in ürettiği anahtarlar (Node ↔ Rust uyumu)
  const TEST_ACIK: &str = "7V4ku_NZQX0HXupMS4CgftTV4WYEINapXce17QANYwg";
  const SURESIZ: &str = "AXT1-eyJraW1lIjoiRGVuZW1lIEt1bGxhbsSxY8SxIiwicGxhbiI6InByZW1pdW0iLCJ2ZXJpbGRpIjoiMjAyNi0xMC0yOSIsImJpdGlzIjpudWxsfQ.nCOdSTUJHbtxYcgyinqrR40m7g-aAibGRQ90q_4O7QZhkSQJjOB1JAsGZ2o2nRkzaH5QGQrXqOzAqF-EQGxSBg";
  const SURELI: &str = "AXT1-eyJraW1lIjoiU8O8cmVsaSIsInBsYW4iOiJwcmVtaXVtIiwidmVyaWxkaSI6IjIwMjYtMTAtMjkiLCJiaXRpcyI6IjIwMjAtMDEtMDEifQ.dIQJt6et178HhiOfEhGierDHdpFNlWckIu7XTXn8XYY4wT3biw9X6WMdZ8OBlMEd8Ddv_sITQ7cDQwBp3ryCCg";

  fn gun(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
  }

  #[test]
  fn gecerli_anahtar_cozulur() {
    let l = coz(SURESIZ, TEST_ACIK, gun("2030-01-01")).unwrap();
    assert_eq!(l.kime, "Deneme Kullanıcı");
    assert_eq!(l.plan, "premium");
    assert_eq!(l.bitis, None);
  }

  #[test]
  fn suresi_dolan_reddedilir_dolmadan_kabul() {
    assert!(coz(SURELI, TEST_ACIK, gun("2020-01-01")).is_ok());
    assert!(coz(SURELI, TEST_ACIK, gun("2020-01-02")).unwrap_err().contains("doldu"));
  }

  #[test]
  fn degistirilen_ya_da_baska_anahtarla_imzalanan_reddedilir() {
    // Yükte tek bayt değişirse imza tutmaz
    let mut bozuk = SURESIZ.to_string();
    bozuk.replace_range(10..11, if &SURESIZ[10..11] == "A" { "B" } else { "A" });
    assert!(coz(&bozuk, TEST_ACIK, gun("2030-01-01")).is_err());
    // Gerçek açık anahtar sınama anahtarını tanımaz
    assert_eq!(coz(SURESIZ, ACIK_ANAHTAR, gun("2030-01-01")).unwrap_err(), "Lisans anahtarı geçersiz");
    assert!(coz("rastgele", TEST_ACIK, gun("2030-01-01")).is_err());
    assert!(coz("AXT1-abc", TEST_ACIK, gun("2030-01-01")).is_err());
  }
}
