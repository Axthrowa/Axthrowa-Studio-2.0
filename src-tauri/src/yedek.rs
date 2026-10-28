//! Otomatik yedekleme, geri yükleme ve eski klasörden ayar taşıma.
//!
//! Yedek: `data/yedekler/<zaman>/` altına ayar JSON'ları, `botaxt.db` (VACUUM INTO: açıkken tutarlı kopya)
//! ve gömülü StreamAxT veritabanı. Günde bir kendiliğinden alınır, son `SAKLA` yedek tutulur.
//! Geri yükleme / taşıma ANINDA yapılmaz: veritabanları açıkken üzerine yazılamaz. İstek bir işaret
//! dosyasına yazılır, uygulama bir sonraki açılışta (veritabanları açılmadan önce) uygular.

use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use sqlx::SqlitePool;

pub const SAKLA: usize = 7;
const ISARET: &str = "bekleyen-geri-yukleme.txt";
const BOT_DB: &str = "streamaxt.sqlite";

pub fn yedek_klasoru(data_dir: &Path) -> PathBuf {
  data_dir.join("yedekler")
}

/// Gömülü botun veri klasörü (exe yanındaki `streamaxt/data`)
pub fn bot_veri_klasoru() -> Option<PathBuf> {
  crate::streamaxt::find_dir().map(|d| d.join("data"))
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct YedekBilgisi {
  pub ad: String,
  pub zaman: i64,
  pub bayt: u64,
}

fn klasor_boyutu(p: &Path) -> u64 {
  std::fs::read_dir(p)
    .map(|it| {
      it.flatten()
        .map(|e| match e.metadata() {
          Ok(m) if m.is_dir() => klasor_boyutu(&e.path()),
          Ok(m) => m.len(),
          Err(_) => 0,
        })
        .sum()
    })
    .unwrap_or(0)
}

/// Yedekler, yeniden eskiye.
pub fn listele(data_dir: &Path) -> Vec<YedekBilgisi> {
  let mut v: Vec<YedekBilgisi> = std::fs::read_dir(yedek_klasoru(data_dir))
    .map(|it| {
      it.flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| {
          let zaman = e
            .metadata()
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
          YedekBilgisi { ad: e.file_name().to_string_lossy().to_string(), zaman, bayt: klasor_boyutu(&e.path()) }
        })
        .collect()
    })
    .unwrap_or_default();
  v.sort_by(|a, b| b.ad.cmp(&a.ad));
  v
}

/// Yedek adı yalnız bizim ürettiğimiz biçim (yol kaçışı olmasın)
pub fn ad_gecerli(ad: &str) -> bool {
  ad.len() == 15 && ad.chars().enumerate().all(|(i, c)| if i == 8 { c == '-' } else { c.is_ascii_digit() })
}

async fn vacuum_into(pool: &SqlitePool, hedef: &Path) -> Result<()> {
  let _ = std::fs::remove_file(hedef);
  sqlx::query("VACUUM INTO ?").bind(hedef.to_string_lossy().to_string()).execute(pool).await?;
  Ok(())
}

/// Şimdi yedek al; eski yedekleri `SAKLA` adede indir.
pub async fn yedekle(data_dir: &Path, pool: &SqlitePool) -> Result<YedekBilgisi> {
  let ad = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
  let hedef = yedek_klasoru(data_dir).join(&ad);
  let yya = hedef.join("yya");
  std::fs::create_dir_all(&yya).context("yedek klasörü")?;
  // Ayar dosyaları (küçük JSON'lar); medya/araç klasörleri yedeğe girmez
  for e in std::fs::read_dir(data_dir)?.flatten() {
    let p = e.path();
    if p.is_file() && p.extension().is_some_and(|x| x == "json") {
      std::fs::copy(&p, yya.join(e.file_name()))?;
    }
  }
  vacuum_into(pool, &yya.join("botaxt.db")).await.context("botaxt.db yedeği")?;
  // Bot veritabanı: ayrı, salt okunur bağlantıyla tutarlı kopya
  if let Some(bot) = bot_veri_klasoru() {
    let kaynak = bot.join(BOT_DB);
    if kaynak.exists() {
      let opts = sqlx::sqlite::SqliteConnectOptions::new().filename(&kaynak).read_only(true);
      if let Ok(bp) = sqlx::sqlite::SqlitePoolOptions::new().max_connections(1).connect_with(opts).await {
        std::fs::create_dir_all(hedef.join("bot"))?;
        let sonuc = vacuum_into(&bp, &hedef.join("bot").join(BOT_DB)).await;
        bp.close().await;
        sonuc.context("bot veritabanı yedeği")?;
      }
    }
  }
  for eski in listele(data_dir).into_iter().skip(SAKLA) {
    let _ = std::fs::remove_dir_all(yedek_klasoru(data_dir).join(eski.ad));
  }
  listele(data_dir).into_iter().find(|y| y.ad == ad).ok_or_else(|| anyhow!("yedek listelenemedi"))
}

/// Son yedek `aralik_ms`'den eskiyse yedek al
pub async fn gerekirse_yedekle(data_dir: &Path, pool: &SqlitePool, aralik_ms: i64) -> Result<Option<YedekBilgisi>> {
  let simdi = chrono::Utc::now().timestamp_millis();
  if listele(data_dir).first().is_some_and(|y| simdi - y.zaman < aralik_ms) {
    return Ok(None);
  }
  yedekle(data_dir, pool).await.map(Some)
}

/// Bekleyen işlem: `yedek:<ad>` ya da `tasi:<eski kök klasör>`
pub fn isaretle(data_dir: &Path, istek: &str) -> Result<()> {
  std::fs::write(data_dir.join(ISARET), istek).context("işaret yazılamadı")
}

pub fn bekleyen(data_dir: &Path) -> Option<String> {
  std::fs::read_to_string(data_dir.join(ISARET)).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

pub fn iptal(data_dir: &Path) {
  let _ = std::fs::remove_file(data_dir.join(ISARET));
}

/// Eski kurulum klasörü mü (taşıma kaynağı): `data/` içinde ayar ya da veritabanı olmalı
pub fn eski_kurulum_mu(kok: &Path) -> bool {
  let d = kok.join("data");
  d.join("botaxt.db").exists() || d.join("settings-panel.json").exists()
}

fn dosya_kopyala(kaynak: &Path, hedef: &Path) -> Result<()> {
  if let Some(ust) = hedef.parent() {
    std::fs::create_dir_all(ust)?;
  }
  std::fs::copy(kaynak, hedef).with_context(|| format!("{} kopyalanamadı", kaynak.display()))?;
  Ok(())
}

fn klasor_kopyala(kaynak: &Path, hedef: &Path, atla: &[&str]) -> Result<()> {
  std::fs::create_dir_all(hedef)?;
  for e in std::fs::read_dir(kaynak)?.flatten() {
    let ad = e.file_name();
    if atla.iter().any(|a| ad.to_string_lossy().eq_ignore_ascii_case(a)) {
      continue;
    }
    let p = e.path();
    if p.is_dir() {
      klasor_kopyala(&p, &hedef.join(&ad), atla)?;
    } else {
      dosya_kopyala(&p, &hedef.join(&ad))?;
    }
  }
  Ok(())
}

/// SQLite yan dosyaları: eski -wal/-shm yeni veritabanına karışmasın
fn yan_dosyalari_sil(db: &Path) {
  for ek in ["-wal", "-shm"] {
    let _ = std::fs::remove_file(PathBuf::from(format!("{}{ek}", db.display())));
  }
}

/// Açılışta, veritabanları açılmadan ÖNCE çağrılır. Uygulanan işlemi döndürür.
pub fn bekleyeni_uygula(data_dir: &Path, bot_veri: Option<&Path>, assets: &Path) -> Result<Option<String>> {
  let Some(istek) = bekleyen(data_dir) else { return Ok(None) };
  iptal(data_dir);
  if let Some(ad) = istek.strip_prefix("yedek:") {
    if !ad_gecerli(ad) {
      return Err(anyhow!("geçersiz yedek adı"));
    }
    let kok = yedek_klasoru(data_dir).join(ad);
    let yya = kok.join("yya");
    if !yya.join("botaxt.db").exists() {
      return Err(anyhow!("yedek eksik: {ad}"));
    }
    yan_dosyalari_sil(&data_dir.join("botaxt.db"));
    klasor_kopyala(&yya, data_dir, &[])?;
    if let (Some(bot), true) = (bot_veri, kok.join("bot").join(BOT_DB).exists()) {
      yan_dosyalari_sil(&bot.join(BOT_DB));
      dosya_kopyala(&kok.join("bot").join(BOT_DB), &bot.join(BOT_DB))?;
    }
    return Ok(Some(format!("Yedek geri yüklendi: {ad}")));
  }
  if let Some(eski) = istek.strip_prefix("tasi:") {
    let eski = PathBuf::from(eski);
    if !eski_kurulum_mu(&eski) {
      return Err(anyhow!("eski kurulum bulunamadı: {}", eski.display()));
    }
    // Ayarlar + veritabanı (yedekler ve indirilen araçlar taşınmaz)
    yan_dosyalari_sil(&data_dir.join("botaxt.db"));
    klasor_kopyala(&eski.join("data"), data_dir, &["yedekler", "tools", "botaxt.db-wal", "botaxt.db-shm"])?;
    // Kullanıcının kütüphanesi (logo, video, müzik…)
    if eski.join("assets").is_dir() {
      klasor_kopyala(&eski.join("assets"), assets, &[])?;
    }
    // Bot verisi
    if let Some(bot) = bot_veri {
      let eski_bot = eski.join("streamaxt").join("data");
      if eski_bot.is_dir() {
        yan_dosyalari_sil(&bot.join(BOT_DB));
        klasor_kopyala(&eski_bot, bot, &[])?;
      }
    }
    return Ok(Some(format!("Eski kurulumdan taşındı: {}", eski.display())));
  }
  Err(anyhow!("bilinmeyen bekleyen işlem"))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn gecici(ad: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("yya-yedek-{ad}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&d).unwrap();
    d
  }

  #[test]
  fn yedek_adi_yalniz_zaman_bicimi() {
    assert!(ad_gecerli("20261028-143000"));
    assert!(!ad_gecerli("../../etc"));
    assert!(!ad_gecerli("20261028_143000"));
  }

  #[tokio::test]
  async fn yedekle_ve_bir_sonraki_acilista_geri_yukle() {
    let data = gecici("data");
    std::fs::write(data.join("settings-panel.json"), "{\"a\":1}").unwrap();
    let pool = crate::db::open_connected(&data).await.unwrap();
    sqlx::query("CREATE TABLE t (x INTEGER)").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO t VALUES (7)").execute(&pool).await.unwrap();
    let y = yedekle(&data, &pool).await.unwrap();
    assert!(ad_gecerli(&y.ad));
    // Yedekten sonra değişiklik; geri yükleme eski hâle dönmeli
    sqlx::query("INSERT INTO t VALUES (8)").execute(&pool).await.unwrap();
    std::fs::write(data.join("settings-panel.json"), "{\"a\":2}").unwrap();
    pool.close().await;
    isaretle(&data, &format!("yedek:{}", y.ad)).unwrap();
    let mesaj = bekleyeni_uygula(&data, None, &data.join("assets")).unwrap();
    assert!(mesaj.unwrap().contains(&y.ad));
    assert_eq!(std::fs::read_to_string(data.join("settings-panel.json")).unwrap(), "{\"a\":1}");
    let pool = crate::db::open_connected(&data).await.unwrap();
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM t").fetch_one(&pool).await.unwrap();
    assert_eq!(n, 1);
    pool.close().await;
    assert!(bekleyen(&data).is_none());
    let _ = std::fs::remove_dir_all(&data);
  }

  #[test]
  fn eski_kurulumdan_tasima() {
    let eski = gecici("eski");
    std::fs::create_dir_all(eski.join("data").join("tools")).unwrap();
    std::fs::write(eski.join("data").join("settings-panel.json"), "eski").unwrap();
    std::fs::write(eski.join("data").join("tools").join("ffmpeg.exe"), "x").unwrap();
    std::fs::create_dir_all(eski.join("assets").join("logos")).unwrap();
    std::fs::write(eski.join("assets").join("logos").join("l.png"), "png").unwrap();
    let yeni = gecici("yeni");
    let data = yeni.join("data");
    std::fs::create_dir_all(&data).unwrap();
    isaretle(&data, &format!("tasi:{}", eski.display())).unwrap();
    bekleyeni_uygula(&data, None, &yeni.join("assets")).unwrap();
    assert_eq!(std::fs::read_to_string(data.join("settings-panel.json")).unwrap(), "eski");
    assert!(!data.join("tools").exists());
    assert!(yeni.join("assets").join("logos").join("l.png").exists());
    let _ = std::fs::remove_dir_all(&eski);
    let _ = std::fs::remove_dir_all(&yeni);
  }
}
