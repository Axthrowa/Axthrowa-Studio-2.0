//! Performans: yavaş işlem ölçümü (tracing span'leri) ve sistem sağlığı telemetrisi.
//!
//! Span: `tracing::info_span!("obs_baglan")` ya da `#[tracing::instrument(skip_all)]` ile sarılan iş
//! kapandığında süresi ölçülür; eşiği geçen `axthrowa.log`a "performans" hedefiyle uyarı olarak düşer.
//! Ayrı bir günlükçü kurulmaz: tracing olayları da (`log-always`) aynı dosyaya gider.

use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tracing::span::{Attributes, Id};
use tracing::Subscriber;
use tracing_subscriber::layer::{Context, Layer};
use tracing_subscriber::registry::LookupSpan;

/// Bu süreden uzun süren span günlüğe yazılır
const YAVAS_ESIGI: Duration = Duration::from_millis(1500);

struct Baslangic(Instant);

/// Span ömrünü (await'ler dahil, duvar saati) ölçen katman
pub struct YavasIslem {
  esik: Duration,
  bildir: fn(&str, Duration),
}

impl<S: Subscriber + for<'a> LookupSpan<'a>> Layer<S> for YavasIslem {
  fn on_new_span(&self, _: &Attributes<'_>, id: &Id, ctx: Context<'_, S>) {
    if let Some(span) = ctx.span(id) {
      span.extensions_mut().insert(Baslangic(Instant::now()));
    }
  }

  fn on_close(&self, id: Id, ctx: Context<'_, S>) {
    let Some(span) = ctx.span(&id) else { return };
    let Some(gecen) = span.extensions().get::<Baslangic>().map(|b| b.0.elapsed()) else { return };
    if gecen >= self.esik {
      (self.bildir)(span.name(), gecen);
    }
  }
}

fn gunluge_yaz(ad: &str, gecen: Duration) {
  log::warn!(target: "performans", "{ad} yavaş: {} ms", gecen.as_millis());
}

/// Uygulama açılışında bir kez
pub fn olcumu_kur() {
  use tracing_subscriber::prelude::*;
  let _ = tracing_subscriber::registry()
    .with(YavasIslem { esik: YAVAS_ESIGI, bildir: gunluge_yaz })
    .try_init();
}

/// Uygulamanın kendisi + alt süreçleri (WebView2, AxBoT botu, ffmpeg…) toplamı
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SistemSagligi {
  pub ram_mb: u64,
  /// Tüm çekirdeklerin yüzdesi olarak (0–100)
  pub cpu: f32,
  pub surec_sayisi: usize,
}

/// `kok` ve onun altındaki tüm süreçlerin kimlikleri (ebeveyn zinciriyle)
fn agac(kok: sysinfo::Pid, surecler: &std::collections::HashMap<sysinfo::Pid, sysinfo::Process>) -> Vec<sysinfo::Pid> {
  let mut sonuc = vec![kok];
  let mut i = 0;
  while i < sonuc.len() {
    let ust = sonuc[i];
    sonuc.extend(surecler.iter().filter(|(_, p)| p.parent() == Some(ust)).map(|(pid, _)| *pid));
    i += 1;
  }
  sonuc
}

/// 3 sn'de bir `sistem-sagligi` olayı. Pencere gizliyken (tepsi) ölçmez: süreç taraması da CPU yer.
pub async fn telemetri_dongusu(app: AppHandle) {
  use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};
  let Ok(kok) = sysinfo::get_current_pid() else { return };
  let cekirdek = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1) as f32;
  let Ok(mut sistem) = System::new() else { return };
  let tur = ProcessRefreshKind::nothing().with_cpu().with_memory();
  loop {
    tokio::time::sleep(Duration::from_secs(3)).await;
    let gorunur = app.get_webview_window("main").is_some_and(|w| w.is_visible().unwrap_or(false));
    if !gorunur {
      continue;
    }
    sistem.refresh_processes_specifics(ProcessesToUpdate::All, true, tur);
    let pidler = agac(kok, sistem.processes());
    let (bayt, cpu) = pidler
      .iter()
      .filter_map(|p| sistem.process(*p))
      .fold((0u64, 0f32), |(b, c), p| (b + p.memory(), c + p.cpu_usage()));
    let olcum = SistemSagligi {
      ram_mb: bayt / 1024 / 1024,
      cpu: (cpu / cekirdek).clamp(0.0, 100.0),
      surec_sayisi: pidler.len(),
    };
    let _ = app.emit("sistem-sagligi", &olcum);
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::Mutex;

  static GORULEN: Mutex<Vec<String>> = Mutex::new(Vec::new());

  fn kaydet(ad: &str, _: Duration) {
    GORULEN.lock().unwrap().push(ad.to_string());
  }

  #[test]
  fn yalniz_esigi_gecen_span_bildirilir() {
    use tracing_subscriber::prelude::*;
    let abone = tracing_subscriber::registry().with(YavasIslem { esik: Duration::from_millis(30), bildir: kaydet });
    tracing::subscriber::with_default(abone, || {
      drop(tracing::info_span!("hizli").entered());
      let s = tracing::info_span!("yavas").entered();
      std::thread::sleep(Duration::from_millis(40));
      drop(s);
    });
    assert_eq!(*GORULEN.lock().unwrap(), vec!["yavas".to_string()]);
  }
}
