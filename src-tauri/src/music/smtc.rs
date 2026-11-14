//! R2: Windows medya oturumu (SMTC). Doğrudan bağlantısı olmayan oynatıcılar (Apple Music, Tidal, tarayıcı, VLC)
//! buradan okunur ve yönetilir. Spotify ve YTMD bağlıysa onların SMTC oturumu atlanır; doğrudan bağlantı önceliklidir.

use super::NowPlaying;

pub const SOURCE_SMTC: &str = "smtc";

/// Doğrudan bağlantısı kurulu oynatıcı SMTC'den ikinci kez okunmaz; kullanıcının yok saydığı uygulama da (R3,
/// uygulama kimliğinde geçen parça, büyük/küçük harf duyarsız).
pub fn atla(app: &str, spotify: bool, ytmd: bool, yoksay: &[String]) -> bool {
  let a = app.to_lowercase();
  (spotify && a.contains("spotify"))
    || (ytmd && (a.contains("youtube-music") || a.contains("ytmd")))
    || yoksay.iter().any(|y| !y.is_empty() && a.contains(&y.to_lowercase()))
}

/// R2b: kapak en çok bu boyutta okunur (data URL olarak her `now-playing` yayınına girer)
pub const KAPAK_EN_COK: u64 = 512 * 1024;

/// Kapak baytları → `<img>` için data URL; resim olmayan tür JPEG sayılır
pub fn kapak_adresi(tur: &str, bayt: &[u8]) -> String {
  use base64::Engine;
  let tur = if tur.starts_with("image/") { tur } else { "image/jpeg" };
  format!("data:{tur};base64,{}", base64::engine::general_purpose::STANDARD.encode(bayt))
}

/// SMTC zaman çizelgesi son güncellemedeki konumu verir; çalarken aradan geçen süre eklenir. Girdi 100 ns, çıktı ms.
pub fn ilerleme_ms(konum: i64, son: i64, guncellenme: i64, simdi: i64, caliyor: bool) -> i64 {
  let mut p = konum;
  if caliyor && guncellenme > 0 && simdi > guncellenme {
    p += simdi - guncellenme;
  }
  if son > 0 {
    p = p.min(son);
  }
  p.max(0) / 10_000
}

#[cfg(windows)]
mod win {
  use super::*;
  use anyhow::{anyhow, bail, Result};
  use std::sync::Mutex;
  use windows::Media::Control::GlobalSystemMediaTransportControlsSessionMediaProperties as Ozellikler;
  use windows::Storage::Streams::DataReader;
  use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Oturum, GlobalSystemMediaTransportControlsSessionManager as Yonetici,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Durum,
  };

  fn oturumlar() -> windows::core::Result<Vec<Oturum>> {
    // Tokio'nun engelleyen iş parçacığı COM'a hazır olmayabilir; ikinci çağrı S_FALSE döner, zararsız
    unsafe {
      let _ = windows::Win32::System::Com::CoInitializeEx(None, windows::Win32::System::Com::COINIT_MULTITHREADED);
    }
    let y = Yonetici::RequestAsync()?.get()?;
    Ok(y.GetSessions()?.into_iter().collect())
  }

  fn uygulama(o: &Oturum) -> String {
    o.SourceAppUserModelId().map(|s| s.to_string()).unwrap_or_default()
  }

  /// Çalan ilk oturum; yoksa başlığı olan ilk duraklamış oturum. Engelleyen çağrı (spawn_blocking içinde).
  pub fn oku(spotify: bool, ytmd: bool, yoksay: &[String]) -> Option<NowPlaying> {
    let mut aday = None;
    for o in oturumlar().ok()? {
      let app = uygulama(&o);
      if atla(&app, spotify, ytmd, yoksay) {
        continue;
      }
      let Some(np) = parca(&o, app) else { continue };
      if np.is_playing {
        return Some(np);
      }
      aday.get_or_insert(np);
    }
    aday
  }

  /// Son okunan kapak (uygulama|başlık|sanatçı → data URL): saniyelik yoklamada aynı parça yeniden okunmaz
  static KAPAK: Mutex<Option<(String, String)>> = Mutex::new(None);

  fn kapak(m: &Ozellikler, anahtar: String) -> String {
    if let Some((k, adres)) = KAPAK.lock().ok().and_then(|g| g.clone()) {
      if k == anahtar {
        return adres;
      }
    }
    let adres = kapak_oku(m).unwrap_or_default();
    if let Ok(mut g) = KAPAK.lock() {
      *g = Some((anahtar, adres.clone()));
    }
    adres
  }

  fn kapak_oku(m: &Ozellikler) -> Option<String> {
    let akis = m.Thumbnail().ok()?.OpenReadAsync().ok()?.get().ok()?;
    let boyut = akis.Size().ok()?;
    if boyut == 0 || boyut > KAPAK_EN_COK {
      return None;
    }
    let tur = akis.ContentType().map(|t| t.to_string()).unwrap_or_default();
    let okuyucu = DataReader::CreateDataReader(&akis).ok()?;
    let n = okuyucu.LoadAsync(boyut as u32).ok()?.get().ok()?;
    let mut bayt = vec![0u8; n as usize];
    okuyucu.ReadBytes(&mut bayt).ok()?;
    Some(kapak_adresi(&tur, &bayt))
  }

  fn parca(o: &Oturum, app: String) -> Option<NowPlaying> {
    let m = o.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
    let title = m.Title().ok()?.to_string();
    if title.trim().is_empty() {
      return None;
    }
    let caliyor = o.GetPlaybackInfo().and_then(|p| p.PlaybackStatus()).map(|d| d == Durum::Playing).unwrap_or(false);
    let (konum, son, guncel) = o
      .GetTimelineProperties()
      .map(|t| {
        (
          t.Position().map(|x| x.Duration).unwrap_or(0),
          t.EndTime().map(|x| x.Duration).unwrap_or(0),
          t.LastUpdatedTime().map(|x| x.UniversalTime).unwrap_or(0),
        )
      })
      .unwrap_or_default();
    // DateTime.UniversalTime: 1601'den beri 100 ns
    let simdi = (super::super::now_ms() + 11_644_473_600_000) * 10_000;
    let artist = m.Artist().map(|s| s.to_string()).unwrap_or_default();
    let album_art = kapak(&m, format!("{app}|{title}|{artist}"));
    Some(NowPlaying {
      title,
      artist,
      album_art,
      album: m.AlbumTitle().map(|s| s.to_string()).unwrap_or_default(),
      is_playing: caliyor,
      progress: ilerleme_ms(konum, son, guncel, simdi, caliyor),
      duration: son.max(0) / 10_000,
      source: SOURCE_SMTC.into(),
      app,
      ..Default::default()
    })
  }

  /// play | pause | playPause | next | previous; oturum uygulama kimliğiyle yeniden bulunur.
  pub fn komut(app: &str, eylem: &str) -> Result<()> {
    let o = oturumlar()?.into_iter().find(|o| uygulama(o) == app).ok_or_else(|| anyhow!("Oynatıcı kapanmış"))?;
    let op = match eylem {
      "play" => o.TryPlayAsync()?,
      "pause" => o.TryPauseAsync()?,
      "playPause" => o.TryTogglePlayPauseAsync()?,
      "next" => o.TrySkipNextAsync()?,
      "previous" => o.TrySkipPreviousAsync()?,
      d => bail!("Bu oynatıcıda desteklenmiyor: {d}"),
    };
    if op.get()? {
      Ok(())
    } else {
      bail!("Oynatıcı komutu reddetti")
    }
  }
}

#[cfg(windows)]
pub use win::{komut, oku};

#[cfg(not(windows))]
pub fn oku(_spotify: bool, _ytmd: bool, _yoksay: &[String]) -> Option<NowPlaying> {
  None
}

#[cfg(not(windows))]
pub fn komut(_app: &str, _eylem: &str) -> anyhow::Result<()> {
  anyhow::bail!("Windows medya oturumu yalnız Windows'ta")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn dogrudan_bagli_oynatici_atlanir() {
    assert!(atla("Spotify.exe", true, false, &[]));
    assert!(!atla("Spotify.exe", false, false, &[]));
    assert!(atla("com.github.th-ch.youtube-music", false, true, &[]));
    assert!(!atla("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App", true, true, &[]));
    let yoksay = vec!["brave".to_string(), String::new()];
    assert!(atla("Brave", false, false, &yoksay));
    assert!(!atla("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App", false, false, &yoksay));
  }

  #[test]
  fn kapak_data_url() {
    assert_eq!(kapak_adresi("image/png", b"ab"), "data:image/png;base64,YWI=");
    assert_eq!(kapak_adresi("application/octet-stream", b"ab"), "data:image/jpeg;base64,YWI=");
  }

  #[test]
  fn ilerleme_gecen_sureyi_ekler_ve_sonda_durur() {
    // 10 sn konum, 2 sn önce güncellenmiş, çalıyor → 12 sn
    assert_eq!(ilerleme_ms(100_000_000, 2_000_000_000, 1_000, 1_000 + 20_000_000, true), 12_000);
    assert_eq!(ilerleme_ms(100_000_000, 2_000_000_000, 1_000, 1_000 + 20_000_000, false), 10_000);
    assert_eq!(ilerleme_ms(100_000_000, 110_000_000, 1, 1_000_000_000, true), 11_000);
  }
}
