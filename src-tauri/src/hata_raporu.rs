//! Çökme raporları (Sentry). İki koşulla gönderilir:
//! 1. Derleme sırasında `SENTRY_DSN` ortam değişkeni verilmiş olmalı (yoksa Sentry hiç kurulmaz);
//! 2. Kullanıcı Ayarlar'dan izin vermiş olmalı (panel ayarı `hataRaporuIzni`, varsayılan kapalı).
//!
//! Gönderilmeden önce hata metinleri günlükteki gizleyiciden geçer (belirteç, RTMP yolu, kullanıcı klasörü);
//! bilgisayar adı ve kullanıcı bilgisi çıkarılır. Paniklerde Sentry raporu gönderip bekler, sonra
//! `cokme-gunlugu.log` kancası çalışır (panic = "abort" olsa da rapor kaybolmaz).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::json;
use tauri::State;

use crate::settings::ScreenKind;
use crate::AppState;

const DSN: Option<&str> = option_env!("SENTRY_DSN");
static IZIN: AtomicBool = AtomicBool::new(false);

fn dsn() -> Option<&'static str> {
  DSN.map(str::trim).filter(|d| !d.is_empty())
}

/// `run()` başında, panik kancasından SONRA çağrılır (Sentry kancası onu sarar). Dönen bekçi uygulama
/// kapanana dek tutulmalı.
pub fn kur() -> Option<sentry::ClientInitGuard> {
  let dsn = dsn()?;
  let kullanici = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")).ok().filter(|k| k.len() > 3);
  // ClientOptions dışarıdan alan listesiyle kurulamıyor (non_exhaustive)
  let mut ayar = sentry::ClientOptions::default();
  ayar.release = sentry::release_name!();
  ayar.environment = Some(if cfg!(debug_assertions) { "development" } else { "production" }.into());
  ayar.send_default_pii = false;
  ayar.before_send = Some(Arc::new(move |mut olay| {
    if !IZIN.load(Ordering::Relaxed) {
      return None;
    }
    temizle(&mut olay, kullanici.clone());
    Some(olay)
  }));
  Some(sentry::init((dsn, ayar)))
}

fn temizle(olay: &mut sentry::protocol::Event<'static>, kullanici: Option<String>) {
  let mut g = crate::destek::Gizleyici::new(Vec::new(), kullanici);
  olay.server_name = None;
  olay.user = None;
  if let Some(m) = olay.message.as_mut() {
    *m = g.metin(m);
  }
  if let Some(l) = olay.logentry.as_mut() {
    l.message = g.metin(&l.message);
  }
  for istisna in olay.exception.values.iter_mut() {
    if let Some(v) = istisna.value.as_mut() {
      *v = g.metin(v);
    }
  }
}

/// Açılışta kayıtlı ayardan
pub fn izni_yukle(state: &AppState) {
  let izin = state.settings.read().get(ScreenKind::Panel).get("hataRaporuIzni").and_then(|v| v.as_bool()) == Some(true);
  IZIN.store(izin, Ordering::Relaxed);
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HataRaporuDurumu {
  /// Bu derlemede Sentry var mı (DSN verilmiş mi)
  kullanilabilir: bool,
  izin: bool,
}

#[tauri::command]
pub fn hata_raporu_durumu() -> HataRaporuDurumu {
  HataRaporuDurumu { kullanilabilir: dsn().is_some(), izin: IZIN.load(Ordering::Relaxed) }
}

#[tauri::command]
pub async fn hata_raporu_izni(state: State<'_, AppState>, acik: bool) -> Result<(), String> {
  IZIN.store(acik, Ordering::Relaxed);
  let mut s = state.settings.write();
  let birlesik = crate::settings::deep_merge(s.get(ScreenKind::Panel).clone(), json!({ "hataRaporuIzni": acik }));
  s.set(ScreenKind::Panel, birlesik.clone());
  s.save_one(&state.data_dir, ScreenKind::Panel).map_err(|e| format!("ayar diske yazılamadı: {e}"))?;
  // Studio'nun ortak ayar deposu (TEK-3) soketten güncellenir
  state.broadcast_json(&json!({ "type": "settings", "screen": "panel", "data": birlesik }));
  log::info!(target: "hata_raporu", "çökme raporu izni: {acik}");
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rapor_kisisel_bilgiden_arindirilir() {
    let mut olay = sentry::protocol::Event {
      server_name: Some("AXTHROWA-PC".into()),
      message: Some(r"C:\Users\Ayse\AppData\x.log açılamadı".into()),
      ..Default::default()
    };
    temizle(&mut olay, Some(r"C:\Users\Ayse".into()));
    assert_eq!(olay.server_name, None);
    let m = olay.message.unwrap();
    assert!(!m.contains("Ayse"), "{m}");
  }
}
