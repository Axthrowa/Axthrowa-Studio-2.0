//! OBS eklenti uyumluluk katmanı (panel tarafı).
//!
//! - `pe`, `win`, `cozumleme`: dosyayı YÜKLEMEDEN statik çözümleme (mimari, dışa/içe aktarımlar, imza, sürüm, bağımlılık)
//! - `uyumluluk`: statik + yoklama sonucundan durum sınıflandırması
//!
//! Eklenti kodu yalnız iki yerde çalışır ve ikisi de kullanıcının açık eylemiyle olur: yalıtılmış yoklama süreci
//! (motorun `eklenti-yokla` kipi) ve etkinleştirilmiş eklentinin motor sürecine yüklenmesi. İkisi de sanal alan
//! (sandbox) DEĞİLDİR: eklenti kullanıcının yetkileriyle çalışır. Ayrıntı: docs/OBS_PLUGIN_SECURITY_MODEL.md.

pub mod cozumleme;
pub mod hizmet;
pub mod kayit;
pub mod kesif;
pub mod paket;
pub mod pe;
pub mod uyumluluk;
pub mod win;
pub mod yoklama;
pub mod zip;
