//! Y2: işaretin tekrar dosyasından 9:16 dikey klip (yerel ffmpeg). Kaynak dosya yalnız işaret kaydından gelir;
//! uç dosya yolu almaz (rastgele dosya okutulamaz, rastgele yere yazdırılamaz). Çıktı kaynağın yanına yazılır.
use serde::Deserialize;
use std::path::{Path, PathBuf};

/// Karedeki bölge, 0–1 oranıyla (sol üst köşe + genişlik/yükseklik)
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct Bolge {
  pub x: f64,
  pub y: f64,
  pub w: f64,
  pub h: f64,
}

impl Bolge {
  fn gecerli(&self) -> bool {
    [self.x, self.y, self.w, self.h].iter().all(|v| v.is_finite())
      && self.x >= 0.0
      && self.y >= 0.0
      && self.w >= 0.05
      && self.h >= 0.05
      && self.x + self.w <= 1.0001
      && self.y + self.h <= 1.0001
  }

  fn kirp(&self) -> String {
    format!("crop=iw*{:.4}:ih*{:.4}:iw*{:.4}:ih*{:.4}", self.w, self.h, self.x, self.y)
  }
}

/// 1080×1920 filtre: tek bölge tüm ekranı doldurur; kamera verilirse kamera üstte (640), oyun altta (1280)
pub fn dikey_filtre(oyun: Bolge, kamera: Option<Bolge>) -> Result<String, String> {
  if !oyun.gecerli() || kamera.map(|k| !k.gecerli()).unwrap_or(false) {
    return Err("Kırpma bölgesi karenin dışında ya da çok küçük".into());
  }
  let sigdir = |w: u32, h: u32| format!("scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}");
  Ok(match kamera {
    None => format!("[0:v]{},{},setsar=1[v]", oyun.kirp(), sigdir(1080, 1920)),
    Some(k) => format!(
      "[0:v]split=2[a][b];[a]{},{}[k];[b]{},{}[o];[k][o]vstack=inputs=2,setsar=1[v]",
      k.kirp(),
      sigdir(1080, 640),
      oyun.kirp(),
      sigdir(1080, 1280)
    ),
  })
}

/// Kaynağın yanına `<ad>-dikey.mp4`; varsa `-dikey-2.mp4`…
pub fn cikti_yolu(kaynak: &Path) -> PathBuf {
  let kok = kaynak.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "klip".into());
  let dizin = kaynak.parent().unwrap_or(Path::new("."));
  let mut yol = dizin.join(format!("{kok}-dikey.mp4"));
  let mut n = 2;
  while yol.exists() {
    yol = dizin.join(format!("{kok}-dikey-{n}.mp4"));
    n += 1;
  }
  yol
}

fn komut(ffmpeg: &Path) -> tokio::process::Command {
  let mut c = tokio::process::Command::new(ffmpeg);
  c.kill_on_drop(true).stdin(std::process::Stdio::null());
  #[cfg(windows)]
  c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
  c
}

/// Dikey klibi yazar; `sure` saniye verilirse baştan o kadar
pub async fn dikey_yap(ffmpeg: &Path, kaynak: &Path, filtre: &str, sure: Option<f64>) -> Result<PathBuf, String> {
  let cikti = cikti_yolu(kaynak);
  let mut c = komut(ffmpeg);
  c.args(["-y", "-hide_banner", "-loglevel", "error", "-i"]).arg(kaynak);
  if let Some(s) = sure.filter(|s| s.is_finite() && *s > 0.0) {
    c.args(["-t", &format!("{s:.2}")]);
  }
  c.args(["-filter_complex", filtre, "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"])
    .arg(&cikti);
  let o = c.output().await.map_err(|e| format!("ffmpeg çalıştırılamadı: {e}"))?;
  if !o.status.success() {
    let _ = std::fs::remove_file(&cikti);
    return Err(format!("ffmpeg: {}", String::from_utf8_lossy(&o.stderr).trim().chars().take(300).collect::<String>()));
  }
  Ok(cikti)
}

/// Kırpma düzenleyicisi için tek kare (JPEG, 640 px genişlik)
pub async fn kare(ffmpeg: &Path, kaynak: &Path) -> Result<Vec<u8>, String> {
  // Kısa dosyada 1. saniye olmayabilir: önce 1 sn, olmazsa baştan
  for ss in ["1", "0"] {
    let o = komut(ffmpeg)
      .args(["-hide_banner", "-loglevel", "error", "-ss", ss, "-i"])
      .arg(kaynak)
      .args(["-frames:v", "1", "-vf", "scale=640:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "-"])
      .output()
      .await
      .map_err(|e| format!("ffmpeg çalıştırılamadı: {e}"))?;
    if o.status.success() && !o.stdout.is_empty() {
      return Ok(o.stdout);
    }
  }
  Err("Kare okunamadı".into())
}

#[cfg(test)]
mod tests {
  use super::*;

  const TAM: Bolge = Bolge { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };

  #[test]
  fn filtre_tek_bolge_ve_kamera_ust() {
    let f = dikey_filtre(Bolge { x: 0.25, y: 0.0, w: 0.5, h: 1.0 }, None).unwrap();
    assert!(f.starts_with("[0:v]crop=iw*0.5000:ih*1.0000:iw*0.2500:ih*0.0000,scale=1080:1920"));
    let f = dikey_filtre(TAM, Some(Bolge { x: 0.0, y: 0.0, w: 0.25, h: 0.25 })).unwrap();
    assert!(f.contains("crop=1080:640[k]") && f.contains("crop=1080:1280[o]") && f.contains("vstack"));
  }

  #[test]
  fn kare_disindaki_bolge_reddedilir() {
    assert!(dikey_filtre(Bolge { x: 0.6, y: 0.0, w: 0.5, h: 1.0 }, None).is_err());
    assert!(dikey_filtre(TAM, Some(Bolge { x: 0.0, y: 0.0, w: 0.01, h: 0.5 })).is_err());
    assert!(dikey_filtre(Bolge { x: f64::NAN, y: 0.0, w: 0.5, h: 0.5 }, None).is_err());
  }

  /// ffmpeg varsa sentetik 2 sn'lik 1920×1080 videodan gerçek dikey klip üretir
  #[tokio::test]
  async fn sentetik_videodan_1080x1920_klip() {
    let Some(ffmpeg) = crate::ytdl::ffmpeg_yolu(Path::new("bulunmayan-klasor")) else {
      eprintln!("ffmpeg yok, atlandı");
      return;
    };
    let dizin = std::env::temp_dir().join(format!("studio-klip-testi-{}", std::process::id()));
    std::fs::create_dir_all(&dizin).unwrap();
    let kaynak = dizin.join("tekrar.mkv");
    let o = std::process::Command::new(&ffmpeg)
      .args(["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=30:duration=2", "-f", "lavfi", "-i", "sine=duration=2", "-c:v", "libx264", "-c:a", "aac"])
      .arg(&kaynak)
      .output()
      .unwrap();
    assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr));
    let f = dikey_filtre(Bolge { x: 0.2, y: 0.3, w: 0.6, h: 0.7 }, Some(Bolge { x: 0.0, y: 0.0, w: 0.3, h: 0.3 })).unwrap();
    let cikti = dikey_yap(&ffmpeg, &kaynak, &f, Some(1.0)).await.unwrap();
    assert!(cikti.ends_with("tekrar-dikey.mp4"));
    let jpeg = kare(&ffmpeg, &kaynak).await.unwrap();
    assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
    let ffprobe = ffmpeg.with_file_name("ffprobe.exe");
    if ffprobe.exists() {
      let p = std::process::Command::new(ffprobe)
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0"])
        .arg(&cikti)
        .output()
        .unwrap();
      assert_eq!(String::from_utf8_lossy(&p.stdout).trim(), "1080,1920");
    }
    assert_eq!(cikti_yolu(&kaynak).file_name().unwrap(), "tekrar-dikey-2.mp4");
    let _ = std::fs::remove_dir_all(&dizin);
  }
}
