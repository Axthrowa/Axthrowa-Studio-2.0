//! OBS profilinden kodlayıcı bilgisi (salt-okunur).
//!
//! obs-websocket kodlayıcının hız denetimini ve anahtar kare aralığını vermiyor (`streamEncoder.json`'da duruyor);
//! yayın öncesi kontrol listesi bunlara ihtiyaç duyduğu için etkin profilin dosyaları okunur.
//! `service.json` (yayın anahtarını taşır) BİLEREK okunmaz.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use super::policy::EncoderInfo;

/// Basit INI ayrıştırıcı: `(bölüm, anahtar) → değer`; BOM ve yorumlar atlanır.
pub fn parse_ini(text: &str) -> HashMap<(String, String), String> {
  let mut out = HashMap::new();
  let mut section = String::new();
  for raw in text.trim_start_matches('\u{feff}').lines() {
    let line = raw.trim();
    if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
      continue;
    }
    if line.starts_with('[') && line.ends_with(']') {
      section = line[1..line.len() - 1].trim().to_string();
      continue;
    }
    if let Some((k, v)) = line.split_once('=') {
      out.insert((section.clone(), k.trim().to_string()), v.trim().to_string());
    }
  }
  out
}

fn get<'a>(ini: &'a HashMap<(String, String), String>, s: &str, k: &str) -> Option<&'a str> {
  ini.get(&(s.to_string(), k.to_string())).map(String::as_str)
}

/// Kodlayıcı kimliğinden kodek: `obs_nvenc_hevc_tex`, `nvenc_hevc`, `h265_texture_amf` → hevc …
pub fn codec_of(encoder_id: &str) -> &'static str {
  let e = encoder_id.to_ascii_lowercase();
  if e.contains("av1") {
    "av1"
  } else if e.contains("hevc") || e.contains("h265") || e.contains("265") {
    "hevc"
  } else {
    "h264"
  }
}

fn fps_of(ini: &HashMap<(String, String), String>) -> Option<f64> {
  match get(ini, "Video", "FPSType").unwrap_or("0") {
    "1" => get(ini, "Video", "FPSInt")?.parse().ok(),
    "2" => {
      let n: f64 = get(ini, "Video", "FPSNum")?.parse().ok()?;
      let d: f64 = get(ini, "Video", "FPSDen")?.parse().ok()?;
      (d > 0.0).then_some(n / d)
    }
    _ => get(ini, "Video", "FPSCommon")?.parse().ok(),
  }
}

/// `basic.ini` + `streamEncoder.json` içeriğinden kodlayıcı bilgisi.
pub fn encoder_info(basic_ini: &str, stream_encoder_json: Option<&str>) -> EncoderInfo {
  let ini = parse_ini(basic_ini);
  let advanced = get(&ini, "Output", "Mode").map(|m| m.eq_ignore_ascii_case("Advanced")).unwrap_or(false);
  let enc: serde_json::Value = stream_encoder_json
    .and_then(|s| serde_json::from_str(s.trim_start_matches('\u{feff}')).ok())
    .unwrap_or(serde_json::Value::Null);

  let mut info = EncoderInfo {
    width: get(&ini, "Video", "OutputCX").and_then(|v| v.parse().ok()),
    height: get(&ini, "Video", "OutputCY").and_then(|v| v.parse().ok()),
    fps: fps_of(&ini),
    ..Default::default()
  };
  if advanced {
    info.codec = get(&ini, "AdvOut", "Encoder").map(|e| codec_of(e).to_string());
    info.bitrate_kbps = enc.get("bitrate").and_then(|v| v.as_u64()).map(|v| v as u32);
    info.rate_control = enc
      .get("rate_control")
      .and_then(|v| v.as_str())
      .map(str::to_string)
      // Kodlayıcı ayarı hiç değiştirilmemişse dosyada yok: OBS'in NVENC/x264 varsayılanı CBR
      .or_else(|| Some("CBR".to_string()));
    info.keyint_sec = enc.get("keyint_sec").and_then(|v| v.as_f64());
  } else {
    info.codec = get(&ini, "SimpleOutput", "StreamEncoder").map(|e| codec_of(e).to_string());
    info.bitrate_kbps = get(&ini, "SimpleOutput", "VBitrate").and_then(|v| v.parse().ok());
    // Basit kip yayında CBR ve 2 sn anahtar kare kullanır
    info.rate_control = Some("CBR".into());
    info.keyint_sec = Some(2.0);
  }
  info
}

/// Kayıt klasörü: gelişmiş kipte `[AdvOut] RecFilePath`, basit kipte `[SimpleOutput] FilePath`
/// (anahtarlar OBS 32.2.2 `frontend/settings/OBSBasicSettings.cpp` ile aynı).
pub fn record_dir(basic_ini: &str) -> Option<String> {
  let ini = parse_ini(basic_ini);
  let advanced = get(&ini, "Output", "Mode").map(|m| m.eq_ignore_ascii_case("Advanced")).unwrap_or(false);
  let v = if advanced { get(&ini, "AdvOut", "RecFilePath") } else { get(&ini, "SimpleOutput", "FilePath") };
  v.map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
}

/// Bu makinedeki OBS'in etkin profilindeki kayıt klasörü.
pub fn current_record_dir() -> Option<PathBuf> {
  let appdata = std::env::var_os("APPDATA")?;
  let dir = current_profile_dir(&Path::new(&appdata).join("obs-studio"))?;
  let basic = std::fs::read_to_string(dir.join("basic.ini")).ok()?;
  record_dir(&basic).map(PathBuf::from)
}

/// Etkin profil dizini: `%APPDATA%\obs-studio\user.ini` (OBS 31+) ya da `global.ini` → `[Basic] ProfileDir`.
pub fn current_profile_dir(obs_config: &Path) -> Option<PathBuf> {
  for f in ["user.ini", "global.ini"] {
    if let Ok(t) = std::fs::read_to_string(obs_config.join(f)) {
      let ini = parse_ini(&t);
      if let Some(d) = get(&ini, "Basic", "ProfileDir") {
        let p = obs_config.join("basic").join("profiles").join(d);
        if p.is_dir() {
          return Some(p);
        }
      }
    }
  }
  None
}

/// Bu makinedeki OBS'in etkin profilinden kodlayıcı bilgisi.
pub fn read_current() -> Option<EncoderInfo> {
  let appdata = std::env::var_os("APPDATA")?;
  let dir = current_profile_dir(&Path::new(&appdata).join("obs-studio"))?;
  let basic = std::fs::read_to_string(dir.join("basic.ini")).ok()?;
  let enc = std::fs::read_to_string(dir.join("streamEncoder.json")).ok();
  Some(encoder_info(&basic, enc.as_deref()))
}

#[cfg(test)]
mod tests {
  use super::*;

  const GELISMIS: &str = "\u{feff}[General]\nName=Başlıksız\n\n[AdvOut]\nEncoder=obs_nvenc_h264_tex\n\n[Output]\nMode=Advanced\n\n[Video]\nOutputCX=1920\nOutputCY=1080\nFPSType=0\nFPSCommon=60\n";

  #[test]
  fn gelismis_kip() {
    let e = encoder_info(GELISMIS, Some(r#"{"rate_control":"CBR","keyint_sec":2,"bitrate":8000,"preset":"p6"}"#));
    assert_eq!(e.codec.as_deref(), Some("h264"));
    assert_eq!(e.bitrate_kbps, Some(8000));
    assert_eq!(e.rate_control.as_deref(), Some("CBR"));
    assert_eq!(e.keyint_sec, Some(2.0));
    assert_eq!((e.width, e.height), (Some(1920), Some(1080)));
    assert_eq!(e.fps, Some(60.0));
  }

  #[test]
  fn basit_kip_ve_kesirli_fps() {
    let ini = "[Output]\nMode=Simple\n[SimpleOutput]\nStreamEncoder=nvenc_hevc\nVBitrate=6000\n[Video]\nOutputCX=1280\nOutputCY=720\nFPSType=2\nFPSNum=60000\nFPSDen=1001\n";
    let e = encoder_info(ini, None);
    assert_eq!(e.codec.as_deref(), Some("hevc"));
    assert_eq!(e.bitrate_kbps, Some(6000));
    assert_eq!(e.rate_control.as_deref(), Some("CBR"));
    assert!((e.fps.unwrap() - 59.94).abs() < 0.01);
  }

  #[test]
  fn kodek_eslemesi() {
    assert_eq!(codec_of("obs_nvenc_av1_tex"), "av1");
    assert_eq!(codec_of("h265_texture_amf"), "hevc");
    assert_eq!(codec_of("obs_x264"), "h264");
    assert_eq!(codec_of("obs_qsv11_v2"), "h264");
  }

  #[test]
  fn kayit_klasoru_kipe_gore() {
    let adv = "[Output]\nMode=Advanced\n[AdvOut]\nRecFilePath=D:\\Kayit\n[SimpleOutput]\nFilePath=C:\\Basit\n";
    assert_eq!(record_dir(adv).as_deref(), Some("D:\\Kayit"));
    let basit = "[Output]\nMode=Simple\n[SimpleOutput]\nFilePath=C:\\Basit\n";
    assert_eq!(record_dir(basit).as_deref(), Some("C:\\Basit"));
    assert_eq!(record_dir("[Output]\nMode=Simple\n"), None);
  }

  #[test]
  fn bozuk_json_guvenli() {
    let e = encoder_info(GELISMIS, Some("{bozuk"));
    assert_eq!(e.bitrate_kbps, None);
    assert_eq!(e.rate_control.as_deref(), Some("CBR"));
  }
}
