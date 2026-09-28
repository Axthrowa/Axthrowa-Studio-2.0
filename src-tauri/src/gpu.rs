//! GPU kullanımı (İstatistikler / durum çubuğu). libobs GPU kullanımını bildirmez; Windows'un performans sayaçları
//! okunur: `\GPU Engine(*engtype_3D)\Utilization Percentage` (Görev Yöneticisi'nin "3D" motoru). Örnek adları
//! `pid_<süreç>_luid_…_engtype_3D` biçimindedir → sistem toplamı ve istenen sürecin payı ayrı hesaplanır.
//!
//! Örnekleyici ilk istekte başlar ve saniyede bir ölçer (PDH oran sayaçları iki örnek ister). Sayaç yoksa (sanal
//! makine, eski sürücü) değer `null` kalır — uydurulmaz.

use std::sync::{Mutex, OnceLock};

#[derive(Clone, Debug, Default, serde::Serialize, PartialEq)]
pub struct GpuOrnegi {
  /// Tüm süreçlerin 3D motor kullanımı (%, adaptör başına toplam; 100'e kırpılır)
  pub sistem: f64,
  /// Süreç kimliği → o sürecin 3D kullanımı (%)
  #[serde(skip)]
  pub surecler: std::collections::HashMap<u32, f64>,
}

static SON: OnceLock<Mutex<Option<GpuOrnegi>>> = OnceLock::new();

/// Örnek adından süreç kimliği: `pid_1234_luid_0x…_engtype_3D` → 1234
pub fn pid_ayikla(ad: &str) -> Option<u32> {
  ad.strip_prefix("pid_")?.split('_').next()?.parse().ok()
}

/// Örnekleri toplar: sistem toplamı (100'e kırpılır) ve süreç başına toplam
pub fn topla<'a>(ornekler: impl Iterator<Item = (&'a str, f64)>) -> GpuOrnegi {
  let mut o = GpuOrnegi::default();
  for (ad, deger) in ornekler {
    if !deger.is_finite() || deger < 0.0 {
      continue;
    }
    o.sistem += deger;
    if let Some(pid) = pid_ayikla(ad) {
      *o.surecler.entry(pid).or_insert(0.0) += deger;
    }
  }
  o.sistem = o.sistem.min(100.0);
  for v in o.surecler.values_mut() {
    *v = v.min(100.0);
  }
  o
}

#[cfg(windows)]
fn ornekleyici() {
  use windows::core::{w, PCWSTR, PWSTR};
  use windows::Win32::System::Performance::*;
  let mut sorgu = PDH_HQUERY::default();
  let mut sayac = PDH_HCOUNTER::default();
  unsafe {
    if PdhOpenQueryW(PCWSTR::null(), 0, &mut sorgu) != 0 {
      return;
    }
    if PdhAddEnglishCounterW(sorgu, w!("\\GPU Engine(*engtype_3D)\\Utilization Percentage"), 0, &mut sayac) != 0 {
      let _ = PdhCloseQuery(sorgu);
      return;
    }
    let _ = PdhCollectQueryData(sorgu);
  }
  loop {
    std::thread::sleep(std::time::Duration::from_secs(1));
    let ornek = unsafe {
      if PdhCollectQueryData(sorgu) != 0 {
        continue;
      }
      let (mut boyut, mut adet) = (0u32, 0u32);
      let r = PdhGetFormattedCounterArrayW(sayac, PDH_FMT_DOUBLE, &mut boyut, &mut adet, None);
      if r != PDH_MORE_DATA || boyut == 0 {
        continue;
      }
      // Tampon: öğe dizisi + ad dizeleri (bayt cinsinden boyut); 8 bayt hizalı
      let mut tampon: Vec<u64> = vec![0; (boyut as usize).div_ceil(8)];
      let ogeler = tampon.as_mut_ptr() as *mut PDH_FMT_COUNTERVALUE_ITEM_W;
      if PdhGetFormattedCounterArrayW(sayac, PDH_FMT_DOUBLE, &mut boyut, &mut adet, Some(ogeler)) != 0 {
        continue;
      }
      let dilim = std::slice::from_raw_parts(ogeler, adet as usize);
      let adlar: Vec<(String, f64)> = dilim
        .iter()
        .map(|o| {
          let ad = if o.szName.is_null() { String::new() } else { PWSTR(o.szName.0).to_string().unwrap_or_default() };
          // CStatus 0 = geçerli veri
          let deger = if o.FmtValue.CStatus == 0 { o.FmtValue.Anonymous.doubleValue } else { f64::NAN };
          (ad, deger)
        })
        .collect();
      topla(adlar.iter().map(|(a, d)| (a.as_str(), *d)))
    };
    if let Some(m) = SON.get() {
      *m.lock().unwrap_or_else(|e| e.into_inner()) = Some(ornek);
    }
  }
}

#[cfg(not(windows))]
fn ornekleyici() {}

/// Son ölçüm: `{sistem, motor}` (%); ölçüm yoksa `null`. İlk çağrı örnekleyiciyi başlatır.
pub fn kullanim(motor_pid: Option<u32>) -> serde_json::Value {
  let mut basladi = false;
  let m = SON.get_or_init(|| {
    basladi = true;
    Mutex::new(None)
  });
  if basladi {
    let _ = std::thread::Builder::new().name("gpu-olcer".into()).spawn(ornekleyici);
  }
  match m.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
    Some(o) => serde_json::json!({
      "sistem": (o.sistem * 10.0).round() / 10.0,
      "motor": motor_pid.map(|p| (o.surecler.get(&p).copied().unwrap_or(0.0) * 10.0).round() / 10.0),
    }),
    None => serde_json::Value::Null,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ornek_adlari_ve_toplama() {
    assert_eq!(pid_ayikla("pid_1234_luid_0x00000000_0x0000D1C6_phys_0_eng_0_engtype_3D"), Some(1234));
    assert_eq!(pid_ayikla("_Total"), None);
    let o = topla(
      [
        ("pid_10_luid_0x0_0x1_phys_0_eng_0_engtype_3D", 12.5),
        ("pid_10_luid_0x0_0x1_phys_0_eng_1_engtype_3D", 2.5),
        ("pid_20_luid_0x0_0x1_phys_0_eng_0_engtype_3D", 30.0),
        ("pid_30_luid_0x0_0x1_phys_0_eng_0_engtype_3D", f64::NAN),
      ]
      .into_iter(),
    );
    assert_eq!(o.sistem, 45.0);
    assert_eq!(o.surecler.get(&10), Some(&15.0));
    assert_eq!(o.surecler.get(&30), None);
    let doygun = topla([("pid_1_x", 80.0), ("pid_2_x", 70.0)].into_iter());
    assert_eq!(doygun.sistem, 100.0);
  }

  /// Gerçek sayaç (Windows): örnekleyici birkaç saniyede değer üretmeli; sayaç yoksa null kalır (uydurulmaz)
  #[cfg(windows)]
  #[test]
  fn gercek_sayac_okunur_ya_da_null() {
    let _ = kullanim(None);
    std::thread::sleep(std::time::Duration::from_millis(3500));
    let v = kullanim(Some(std::process::id()));
    eprintln!("gpu ölçümü: {v}");
    if !v.is_null() {
      let s = v["sistem"].as_f64().unwrap();
      assert!((0.0..=100.0).contains(&s), "{v}");
      assert!(v["motor"].as_f64().is_some_and(|m| (0.0..=100.0).contains(&m)), "{v}");
    }
  }
}
