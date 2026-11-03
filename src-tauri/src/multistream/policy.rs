//! Platform politika kuralları ve yayın öncesi kontrol listesi (saf).
//!
//! Kurallar resmi belgelerden alındı (tarih ve kaynak her bulguda taşınır); kural değerleri tek tabloda tutulur ki
//! platform değişikliği kod mantığına dokunmadan güncellenebilsin. Ayrıntı: `docs/PLATFORM_CAPABILITY_MATRIX.md`.

use serde::Serialize;

use super::config::Platform;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Level {
  Info,
  Warn,
  /// Bu hedef için GO LIVE engellenir (diğer hedefler etkilenmez)
  Block,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
  pub id: &'static str,
  pub level: Level,
  /// İlgili hedef kimliği (genel bulgularda yok)
  pub destination: Option<String>,
  pub message: String,
  pub source: &'static str,
  pub verified: &'static str,
}

/// OBS profilinden okunan kodlayıcı bilgisi (bilinmeyen alan `None`).
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EncoderInfo {
  /// "h264" | "hevc" | "av1"
  pub codec: Option<String>,
  pub bitrate_kbps: Option<u32>,
  /// "CBR" | "VBR" | "CQP" …
  pub rate_control: Option<String>,
  pub keyint_sec: Option<f64>,
  pub width: Option<u32>,
  pub height: Option<u32>,
  pub fps: Option<f64>,
}

#[derive(Clone, Debug, Default)]
pub struct Context {
  /// (hedef kimliği, platform, sunucu) — yalnız etkin hedefler
  pub destinations: Vec<(String, Platform, String)>,
  pub encoder: EncoderInfo,
  /// Yayına giren sohbet overlay'i birden çok platformun mesajını gösteriyor mu?
  pub combined_chat_overlay: bool,
  /// Çapraz sohbet aktarımı (AxBoT) açık mı?
  pub cross_chat_relay: bool,
  pub ffmpeg_found: bool,
  pub obs_connected: bool,
  /// Kullanıcının ölçüp girdiği yükleme hızı (Mbps). Yoksa yalnız gereksinim gösterilir — ölçülmemiş hız
  /// "yeterli" sayılmaz.
  pub upload_mbps: Option<f64>,
  /// Kayıt klasörlerinin birimleri: (etiket, birim, boş bayt). Okunamayan birim listeye girmez.
  pub disks: Vec<(&'static str, String, u64)>,
  /// OBS'te susturulmuş olan, ayarlarda mikrofon olarak seçili giriş
  pub muted_mic: Option<String>,
}

/// Bit hızı bilinmiyorsa kayıt alanı uyarısının eşiği
pub const DISK_ESIGI_BAYT: u64 = 10 * 1024 * 1024 * 1024;
/// Bit hızı biliniyorsa: bu kadar dakikalık kayıttan az yer kaldıysa uyarı
pub const DISK_ESIGI_DAKIKA: u64 = 120;

/// Boş alanın verilen video bit hızında (ses payıyla) kaç dakikalık kayda yettiği.
pub fn record_minutes(free_bytes: u64, video_kbps: u32) -> u64 {
  let bps = (video_kbps as u64 + VARSAYILAN_SES_KBPS as u64) * 1000;
  free_bytes.saturating_mul(8) / bps.max(1) / 60
}

/// Ses bit hızı OBS profilinden okunmuyorsa varsayılan (OBS'in yaygın AAC ayarı)
pub const VARSAYILAN_SES_KBPS: u32 = 160;
/// RTMP + TCP/IP başlık payı (yaklaşık)
pub const PROTOKOL_PAYI: f64 = 0.05;
/// Önerilen boşluk: ölçülen yükleme hızının en fazla %75'i kullanılmalı
pub const GUVENLI_KULLANIM: f64 = 0.75;

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bandwidth {
  pub destinations: usize,
  pub per_destination_kbps: u32,
  pub required_kbps: u32,
  pub recommended_kbps: u32,
}

/// Doğrudan çoklu yayının yükleme gereksinimi. Tek kodlama her hedefe ayrı gönderildiği için gereksinim hedef
/// sayısıyla doğrusal artar. Video bit hızı bilinmiyorsa `None` (tahmin uydurulmaz).
pub fn bandwidth(encoder: &EncoderInfo, destinations: usize) -> Option<Bandwidth> {
  let video = encoder.bitrate_kbps?;
  if destinations == 0 {
    return None;
  }
  let per = video + VARSAYILAN_SES_KBPS;
  let required = ((per as f64) * destinations as f64 * (1.0 + PROTOKOL_PAYI)).ceil() as u32;
  let recommended = ((required as f64) / GUVENLI_KULLANIM).ceil() as u32;
  Some(Bandwidth { destinations, per_destination_kbps: per, required_kbps: required, recommended_kbps: recommended })
}

fn mbps(kbps: u32) -> String {
  format!("{:.1}", kbps as f64 / 1000.0)
}

pub struct Limits {
  pub kick_max_kbps: u32,
  pub kick_max_w: u32,
  pub kick_max_h: u32,
  pub kick_max_fps: f64,
  pub youtube_max_keyint: f64,
}

/// Kural değerleri — tek yerde (Kick yardım merkezi ve YouTube kodlayıcı ayarları, 2026-09-25).
pub const LIMITS: Limits = Limits {
  kick_max_kbps: 8000,
  kick_max_w: 1920,
  kick_max_h: 1080,
  kick_max_fps: 60.0,
  youtube_max_keyint: 4.0,
};

pub const KICK_SRC: &str = "help.kick.com — How to stream on KICK.com";
pub const YT_SRC: &str = "support.google.com/youtube/answer/2853702";
const TW_SRC: &str = "help.twitch.tv — Simulcasting Guidelines (yazılı şartlar)";
pub const DOGRULAMA: &str = "2026-09-25";

fn f(id: &'static str, level: Level, dest: Option<&str>, msg: String, source: &'static str) -> Finding {
  Finding {
    id,
    level,
    destination: dest.map(str::to_string),
    message: msg,
    source,
    verified: DOGRULAMA,
  }
}

pub fn evaluate(ctx: &Context) -> Vec<Finding> {
  let mut out = Vec::new();
  let e = &ctx.encoder;

  if !ctx.ffmpeg_found {
    out.push(f(
      "system.ffmpeg",
      Level::Block,
      None,
      "FFmpeg bulunamadı; çoklu yayın yönlendiricisi çalışamaz (PATH'e ekleyin ya da uygulamanın indirmesine izin verin)".into(),
      "uygulama",
    ));
  }
  if !ctx.obs_connected {
    out.push(f("system.obs", Level::Warn, None, "OBS bağlı değil; kodlayıcı ayarları doğrulanamıyor".into(), "uygulama"));
  }
  if ctx.destinations.is_empty() {
    out.push(f("system.no_destinations", Level::Info, None, "Etkin hedef yok".into(), "uygulama"));
  }
  if let Some(b) = bandwidth(e, ctx.destinations.len()) {
    let gerek = format!(
      "{} hedef × {} kbps (video + {} kbps ses) + %{} protokol payı ≈ {} Mbps yükleme",
      b.destinations,
      b.per_destination_kbps,
      VARSAYILAN_SES_KBPS,
      (PROTOKOL_PAYI * 100.0) as u32,
      mbps(b.required_kbps)
    );
    match ctx.upload_mbps.filter(|u| *u > 0.0) {
      Some(u) if (b.required_kbps as f64) > u * 1000.0 => out.push(f(
        "network.bandwidth.exceeded",
        Level::Warn,
        None,
        format!("{gerek} gerekiyor, ölçtüğünüz yükleme hızı {u:.1} Mbps — hedefler kare düşürecek ya da kopacak. Hedef sayısını ya da bit hızını azaltın."),
        "hesap",
      )),
      Some(u) if (b.required_kbps as f64) > u * 1000.0 * GUVENLI_KULLANIM => out.push(f(
        "network.bandwidth.tight",
        Level::Warn,
        None,
        format!("{gerek} gerekiyor; ölçtüğünüz {u:.1} Mbps'in %{}'inden fazlası — ağ dalgalanmasında pay kalmıyor.", (GUVENLI_KULLANIM * 100.0) as u32),
        "hesap",
      )),
      Some(u) => out.push(f(
        "network.bandwidth.ok",
        Level::Info,
        None,
        format!("{gerek} gerekiyor; ölçtüğünüz {u:.1} Mbps yeterli pay bırakıyor."),
        "hesap",
      )),
      None => out.push(f(
        "network.bandwidth.unmeasured",
        Level::Info,
        None,
        format!("{gerek} gerekiyor (en az {} Mbps önerilir). Yükleme hızınızı ölçüp girerseniz karşılaştırılır.", mbps(b.recommended_kbps)),
        "hesap",
      )),
    }
  }

  let codec = e.codec.as_deref().map(str::to_ascii_lowercase);
  let mut has_twitch = false;

  for (id, platform, server) in &ctx.destinations {
    let id = Some(id.as_str());
    match platform {
      Platform::Kick => {
        if let Some(c) = &codec {
          if c != "h264" {
            out.push(f("kick.codec.h264", Level::Block, id, format!("Kick yalnız H.264 kabul eder; OBS kodlayıcısı {c}"), KICK_SRC));
          }
        }
        if let Some(b) = e.bitrate_kbps {
          if b > LIMITS.kick_max_kbps {
            out.push(f(
              "kick.bitrate.max",
              Level::Block,
              id,
              format!("Kick en fazla {} kbps kabul eder; OBS {b} kbps", LIMITS.kick_max_kbps),
              KICK_SRC,
            ));
          }
        }
        if let Some(rc) = &e.rate_control {
          if !rc.eq_ignore_ascii_case("CBR") {
            out.push(f("kick.ratecontrol.cbr", Level::Warn, id, format!("Kick CBR ister; OBS hız denetimi {rc}"), KICK_SRC));
          }
        }
        let asim = e.width.zip(e.height).map(|(w, h)| w > LIMITS.kick_max_w || h > LIMITS.kick_max_h).unwrap_or(false)
          || e.fps.map(|x| x > LIMITS.kick_max_fps + 0.01).unwrap_or(false);
        if asim {
          out.push(f("kick.resolution.max", Level::Warn, id, "Kick en fazla 1920×1080, 60 fps kabul eder".into(), KICK_SRC));
        }
        if !server.trim().to_ascii_lowercase().starts_with("rtmps://") {
          out.push(f("kick.protocol.rtmps", Level::Block, id, "Kick sunucu adresi rtmps:// olmalı".into(), KICK_SRC));
        }
      }
      Platform::Youtube => {
        if let Some(k) = e.keyint_sec {
          if k > LIMITS.youtube_max_keyint {
            out.push(f(
              "youtube.keyframe",
              Level::Warn,
              id,
              format!("YouTube anahtar kare aralığı en fazla 4 sn olmalı; OBS {k} sn"),
              YT_SRC,
            ));
          }
        }
      }
      Platform::Twitch => has_twitch = true,
      Platform::Custom => {}
    }
  }

  if let Some(k) = e.keyint_sec {
    if (k - 2.0).abs() > 0.01 && !ctx.destinations.is_empty() {
      out.push(f(
        "common.keyframe.2s",
        Level::Info,
        None,
        format!("Önerilen anahtar kare aralığı 2 sn; OBS {k} sn"),
        "Kick + YouTube önerisi",
      ));
    }
  }

  let others = ctx.destinations.iter().any(|(_, p, _)| *p != Platform::Twitch);
  if has_twitch && others {
    out.push(f(
      "twitch.simulcast.exclusive",
      Level::Info,
      None,
      "Twitch ile eşzamanlı yayın: özel (exclusivity) sözleşmesi olan yayıncılar eşzamanlı yayın yapamaz".into(),
      TW_SRC,
    ));
    out.push(f(
      "twitch.simulcast.quality_parity",
      Level::Info,
      None,
      "Twitch'teki kalite diğer platformlardan düşük olmamalı (tek kodlama tüm hedeflere aynı kaliteyi verir)".into(),
      TW_SRC,
    ));
    if ctx.combined_chat_overlay || ctx.cross_chat_relay {
      let neden = match (ctx.combined_chat_overlay, ctx.cross_chat_relay) {
        (true, true) => "birleşik sohbet overlay'i ve çapraz sohbet aktarımı açık",
        (true, false) => "birleşik (çok platformlu) sohbet overlay'i açık",
        _ => "çapraz sohbet aktarımı açık",
      };
      out.push(f(
        "twitch.simulcast.combined_activity",
        Level::Warn,
        None,
        format!(
          "Twitch'e eşzamanlı yayında diğer platformların birleşik etkinliği/sohbeti yayında gösterilemez; {neden}. Kural değişken — kaynağı kontrol edin."
        ),
        TW_SRC,
      ));
    }
  }

  for (etiket, birim, bos) in &ctx.disks {
    let gb = *bos as f64 / 1024f64.powi(3);
    let (dusuk, ayrinti) = match e.bitrate_kbps.filter(|k| *k > 0) {
      Some(k) => {
        let dk = record_minutes(*bos, k);
        (dk < DISK_ESIGI_DAKIKA, format!(" — {k} kbps ile yaklaşık {dk} dakikalık kayıt"))
      }
      None => (*bos < DISK_ESIGI_BAYT, String::new()),
    };
    if dusuk {
      out.push(f(
        "system.disk.low",
        Level::Warn,
        None,
        format!("{etiket} ({birim}) için {gb:.1} GB boş alan kaldı{ayrinti}. Yayın etkilenmez; kayıt yarıda kalabilir."),
        "uygulama",
      ));
    }
  }
  if let Some(mik) = &ctx.muted_mic {
    out.push(f(
      "audio.mic.muted",
      Level::Warn,
      None,
      format!("Mikrofon «{mik}» OBS'te susturulmuş; izleyiciler sesinizi duymayacak"),
      "uygulama",
    ));
  }

  out.sort_by_key(|x| std::cmp::Reverse(x.level));
  out
}

/// OBS'e giren sohbet overlay'inin kaç platformu birleştirdiği.
///
/// Paneldeki `chatHubConfig` (src/lib/chatHub.ts) ile aynı kural: kanal alanı boşsa ve otomatik algılama açıksa
/// Giriş ekranındaki sosyal hesap kullanılır; `enableX: false` yalnız açıkça kapatır.
pub fn chat_overlay_platforms(chat: &serde_json::Value, starting: &serde_json::Value) -> usize {
  let auto = chat.get("autoDetect").and_then(|v| v.as_bool()) != Some(false);
  let text = |v: Option<&serde_json::Value>| v.and_then(|x| x.as_str()).map(str::trim).unwrap_or("").to_string();
  let pick = |key: &str, social: &str| -> String {
    let direct = text(chat.get(key));
    if !direct.is_empty() || !auto {
      return direct;
    }
    text(starting.pointer(&format!("/socials/{social}/handle")))
  };
  let on = |key: &str| chat.get(key).and_then(|v| v.as_bool()) != Some(false);
  let kick = on("enableKick") && !pick("kickSlug", "kick").is_empty();
  let twitch = on("enableTwitch") && !pick("twitchChannel", "twitch").is_empty();
  let youtube = on("enableYoutube")
    && (!text(chat.get("youtubeVideoId")).is_empty() || !pick("youtubeChannel", "youtube").is_empty());
  [kick, twitch, youtube].iter().filter(|x| **x).count()
}

/// Bu hedef için GO LIVE engelli mi?
pub fn blocked(findings: &[Finding], destination: &str) -> bool {
  findings
    .iter()
    .any(|x| x.level == Level::Block && (x.destination.as_deref() == Some(destination) || x.destination.is_none()))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn ctx(dests: &[(&str, Platform, &str)], e: EncoderInfo) -> Context {
    Context {
      destinations: dests.iter().map(|(a, b, c)| (a.to_string(), *b, c.to_string())).collect(),
      encoder: e,
      ffmpeg_found: true,
      obs_connected: true,
      ..Default::default()
    }
  }

  fn ids(v: &[Finding]) -> Vec<&'static str> {
    v.iter().map(|x| x.id).collect()
  }

  #[test]
  fn disk_ve_mikrofon_on_kontrolu() {
    const GB: u64 = 1024 * 1024 * 1024;
    // 6000 kbps + 160 ses ≈ 46 MB/dk: 5 GiB ≈ 116 dk (< 120) uyarır, 20 GiB uyarmaz
    assert_eq!(record_minutes(5 * GB, 6000), 116);
    let e = EncoderInfo { bitrate_kbps: Some(6000), ..Default::default() };
    let mut c = ctx(&[], e.clone());
    c.disks = vec![("OBS kayıt klasörü", "C:".into(), 5 * GB), ("Motor kayıt klasörü", "D:".into(), 20 * GB)];
    c.muted_mic = Some("Mikrofon".into());
    let v = evaluate(&c);
    let disk: Vec<_> = v.iter().filter(|x| x.id == "system.disk.low").collect();
    assert_eq!(disk.len(), 1);
    assert!(disk[0].message.contains("C:") && disk[0].message.contains("116 dakika"), "{}", disk[0].message);
    assert_eq!(disk[0].level, Level::Warn, "disk yayını engellemez");
    assert!(ids(&v).contains(&"audio.mic.muted"));
    assert!(!blocked(&v, "x"));

    // Bit hızı bilinmiyorsa sabit eşik (10 GB)
    let mut c = ctx(&[], EncoderInfo::default());
    c.disks = vec![("OBS kayıt klasörü", "C:".into(), 9 * GB)];
    assert!(ids(&evaluate(&c)).contains(&"system.disk.low"));
    c.disks = vec![("OBS kayıt klasörü", "C:".into(), 11 * GB)];
    assert!(!ids(&evaluate(&c)).contains(&"system.disk.low"));
  }

  #[test]
  fn bant_genisligi_hedef_sayisiyla_dogrusal_ve_olculmeden_yeterli_denmez() {
    let e = EncoderInfo { bitrate_kbps: Some(6000), ..Default::default() };
    let b = bandwidth(&e, 3).unwrap();
    assert_eq!(b.per_destination_kbps, 6160);
    assert_eq!(b.required_kbps, 19404); // 3 × 6160 × 1.05
    assert_eq!(b.recommended_kbps, 25872); // /0.75
    assert!(bandwidth(&EncoderInfo::default(), 3).is_none(), "bit hızı bilinmeden tahmin uydurulmamalı");
    assert!(bandwidth(&e, 0).is_none());

    let hedefler = [("a", Platform::Twitch, "rtmps://x/app"), ("b", Platform::Kick, "rtmps://y/app"), ("c", Platform::Youtube, "rtmps://z/live2")];
    let mut c = ctx(&hedefler, e.clone());
    assert!(ids(&evaluate(&c)).contains(&"network.bandwidth.unmeasured"));
    c.upload_mbps = Some(15.0);
    assert!(ids(&evaluate(&c)).contains(&"network.bandwidth.exceeded"));
    c.upload_mbps = Some(22.0);
    assert!(ids(&evaluate(&c)).contains(&"network.bandwidth.tight"));
    c.upload_mbps = Some(40.0);
    let v = evaluate(&c);
    assert!(ids(&v).contains(&"network.bandwidth.ok"));
    assert!(!v.iter().any(|x| x.id.starts_with("network.") && x.level == Level::Block), "bant uyarısı yayını engellememeli");
  }

  #[test]
  fn kick_kurallari() {
    let e = EncoderInfo {
      codec: Some("hevc".into()),
      bitrate_kbps: Some(12000),
      rate_control: Some("VBR".into()),
      keyint_sec: Some(2.0),
      width: Some(2560),
      height: Some(1440),
      fps: Some(60.0),
    };
    let r = evaluate(&ctx(&[("k", Platform::Kick, "rtmp://x/app")], e));
    let i = ids(&r);
    for beklenen in ["kick.codec.h264", "kick.bitrate.max", "kick.ratecontrol.cbr", "kick.resolution.max", "kick.protocol.rtmps"] {
      assert!(i.contains(&beklenen), "{beklenen} yok: {i:?}");
    }
    assert!(blocked(&r, "k"));
    // Engel önce sıralanır
    assert_eq!(r[0].level, Level::Block);
  }

  #[test]
  fn uygun_kick_ayarinda_bulgu_yok() {
    let e = EncoderInfo {
      codec: Some("h264".into()),
      bitrate_kbps: Some(6000),
      rate_control: Some("CBR".into()),
      keyint_sec: Some(2.0),
      width: Some(1920),
      height: Some(1080),
      fps: Some(60.0),
    };
    let r = evaluate(&ctx(&[("k", Platform::Kick, "rtmps://x/app")], e));
    // Sorun yok: yalnız bilgi düzeyinde bant gereksinimi notu (ölçülmemiş yükleme hızı)
    assert_eq!(ids(&r), vec!["network.bandwidth.unmeasured"], "{r:?}");
    assert!(r.iter().all(|x| x.level == Level::Info));
  }

  #[test]
  fn twitch_esazamanli_birlesik_sohbet_uyarisi() {
    let mut c = ctx(
      &[("t", Platform::Twitch, "rtmps://live.twitch.tv/app"), ("y", Platform::Youtube, "rtmps://a/live2")],
      EncoderInfo::default(),
    );
    assert!(!ids(&evaluate(&c)).contains(&"twitch.simulcast.combined_activity"));
    c.combined_chat_overlay = true;
    let r = evaluate(&c);
    assert!(ids(&r).contains(&"twitch.simulcast.combined_activity"));
    // Uyarı yayını engellemez
    assert!(!blocked(&r, "t"));
  }

  #[test]
  fn yalniz_twitch_ise_esazamanli_kural_yok() {
    let mut c = ctx(&[("t", Platform::Twitch, "rtmps://live.twitch.tv/app")], EncoderInfo::default());
    c.combined_chat_overlay = true;
    assert!(evaluate(&c).iter().all(|x| !x.id.starts_with("twitch.simulcast")));
  }

  #[test]
  fn ffmpeg_yoksa_hepsi_engelli() {
    let mut c = ctx(&[("t", Platform::Twitch, "rtmps://a/app")], EncoderInfo::default());
    c.ffmpeg_found = false;
    let r = evaluate(&c);
    assert!(blocked(&r, "t"));
  }

  #[test]
  fn sohbet_overlay_platform_sayimi() {
    use serde_json::json;
    let bos = json!({});
    // Açık kanal alanları
    assert_eq!(chat_overlay_platforms(&json!({"kickSlug": "a", "twitchChannel": "b"}), &bos), 2);
    // Kapatılan platform sayılmaz
    assert_eq!(chat_overlay_platforms(&json!({"kickSlug": "a", "twitchChannel": "b", "enableTwitch": false}), &bos), 1);
    // Boş alan + otomatik algılama → Giriş ekranı sosyal hesapları
    let giris = json!({"socials": {"youtube": {"handle": "@kanal"}, "kick": {"handle": "k"}}});
    assert_eq!(chat_overlay_platforms(&json!({}), &giris), 2);
    assert_eq!(chat_overlay_platforms(&json!({"autoDetect": false}), &giris), 0);
    assert_eq!(chat_overlay_platforms(&json!({"youtubeVideoId": "abc"}), &bos), 1);
  }

  #[test]
  fn youtube_anahtar_kare() {
    let e = EncoderInfo { keyint_sec: Some(6.0), ..Default::default() };
    let r = evaluate(&ctx(&[("y", Platform::Youtube, "rtmps://a/live2")], e));
    assert!(ids(&r).contains(&"youtube.keyframe"));
    assert!(ids(&r).contains(&"common.keyframe.2s"));
  }
}
