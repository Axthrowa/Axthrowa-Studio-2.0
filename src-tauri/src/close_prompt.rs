//! Pencerenin X düğmesi: doğrudan tepsiye atmak yerine ne yapılacağını sor.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Listener};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult};

const LABEL_TRAY: &str = "Sistem tepsisine küçült";
const LABEL_QUIT: &str = "Uygulamayı kapat";
const LABEL_CANCEL: &str = "Vazgeç";

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum CloseChoice {
  Tray,
  Quit,
  Cancel,
}

/// Diyalogdan dönen düğmeyi seçime çevirir (özel etiket ya da Yes/No/Cancel).
pub fn choice_from_label(label: &str) -> CloseChoice {
  match label {
    LABEL_TRAY | "Yes" => CloseChoice::Tray,
    LABEL_QUIT | "No" => CloseChoice::Quit,
    _ => CloseChoice::Cancel,
  }
}

fn choice_from_result(res: MessageDialogResult) -> CloseChoice {
  match res {
    MessageDialogResult::Yes => CloseChoice::Tray,
    MessageDialogResult::No => CloseChoice::Quit,
    MessageDialogResult::Custom(s) => choice_from_label(&s),
    _ => CloseChoice::Cancel,
  }
}

/// Aynı anda tek istek: X'e art arda basınca üst üste pencere açılmasın.
static OPEN: AtomicBool = AtomicBool::new(false);
/// Arayüz küçük sorma kutusunu gösterdiğinde `close-ack` ile işaretlenir.
static ACKED: AtomicBool = AtomicBool::new(false);

/// Seçimi uygular; sorma kutusu (arayüz ya da yerel diyalog) kapanınca çağrılır.
fn apply(app: &AppHandle, choice: CloseChoice) {
  OPEN.store(false, Ordering::SeqCst);
  match choice {
    CloseChoice::Tray => crate::pencereyi_gizle(app),
    CloseChoice::Quit => {
      // Tepsideki "Çıkış" ile aynı: axum + tokio görevlerini zorla sonlandır.
      yya_log!("[pencere] Kapat — process::exit(0)");
      crate::streamaxt::shutdown();
      std::process::exit(0);
    }
    CloseChoice::Cancel => {}
  }
}

/// Arayüzden gelen `close-choice` olayı ("tray" | "quit" | "cancel").
pub fn choice_from_payload(payload: &str) -> CloseChoice {
  match serde_json::from_str::<String>(payload).as_deref() {
    Ok("tray") => CloseChoice::Tray,
    Ok("quit") => CloseChoice::Quit,
    _ => CloseChoice::Cancel,
  }
}

/// Olay dinleyicilerini kur (uygulama açılışında bir kez).
pub fn install(app: &AppHandle) {
  app.listen("close-ack", |_| ACKED.store(true, Ordering::SeqCst));
  let handle = app.clone();
  app.listen("close-choice", move |ev| {
    apply(&handle, choice_from_payload(ev.payload()));
  });
}

/// X'e basıldı: önce arayüzdeki küçük kutuyu iste, gelmezse yerel diyalog.
pub fn request(app: &AppHandle) {
  if OPEN.swap(true, Ordering::SeqCst) {
    // Kutu zaten açıksa (ya da sayfa yenilenip kaybolduysa) yeniden göster.
    if ACKED.load(Ordering::SeqCst) {
      let _ = app.emit_to("main", "close-requested", ());
    }
    return;
  }
  ACKED.store(false, Ordering::SeqCst);
  let _ = app.emit_to("main", "close-requested", ());
  let handle = app.clone();
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    if !ACKED.load(Ordering::SeqCst) {
      // Arayüz yanıt vermedi (yüklenmemiş / hata sayfası): X yine de çalışsın.
      native_dialog(&handle);
    }
  });
}

fn native_dialog(app: &AppHandle) {
  let handle = app.clone();
  app
    .dialog()
    .message("StreamAxT kapatılırken ne yapılsın?

Tepsiye küçültürsen bot, sunucu ve kısayollar çalışmaya devam eder.")
    .title("StreamAxT")
    .kind(MessageDialogKind::Info)
    .buttons(MessageDialogButtons::YesNoCancelCustom(
      LABEL_TRAY.into(),
      LABEL_QUIT.into(),
      LABEL_CANCEL.into(),
    ))
    .show_with_result(move |res| apply(&handle, choice_from_result(res)));
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn etiketler_dogru_secime_gider() {
    assert_eq!(choice_from_label(LABEL_TRAY), CloseChoice::Tray);
    assert_eq!(choice_from_label(LABEL_QUIT), CloseChoice::Quit);
    assert_eq!(choice_from_label(LABEL_CANCEL), CloseChoice::Cancel);
  }

  #[test]
  fn arayuz_olayi_dogru_secime_gider() {
    assert_eq!(choice_from_payload("\"tray\""), CloseChoice::Tray);
    assert_eq!(choice_from_payload("\"quit\""), CloseChoice::Quit);
    assert_eq!(choice_from_payload("\"cancel\""), CloseChoice::Cancel);
    // Bozuk / beklenmeyen yük asla uygulamayı kapatmamalı.
    assert_eq!(choice_from_payload("null"), CloseChoice::Cancel);
    assert_eq!(choice_from_payload("tray"), CloseChoice::Cancel);
  }

  #[test]
  fn bilinmeyen_ya_da_pencere_kapatma_vazgecdir() {
    // Diyalog başlığından X'e basmak da uygulamayı kapatmamalı.
    assert_eq!(choice_from_label(""), CloseChoice::Cancel);
    assert_eq!(choice_from_label("Cancel"), CloseChoice::Cancel);
  }
}
