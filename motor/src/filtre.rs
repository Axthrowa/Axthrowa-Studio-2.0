//! Kaynak filtreleri (ses ve video). Türler çalışma anında libobs'tan listelenir: sabit liste yoktur, yüklü
//! modüllerin (obs-filters, nv-filters, eklentiler) kaydettiği her filtre kullanılabilir.

use serde::Serialize;
use serde_json::{Map, Value};

use crate::motor::{gecerli_kimlik, Motor};
use crate::obs::{self, api, cs, cstr, Ptr, Veri};

pub struct Filtre {
  pub kaynak: String,
  pub ptr: Ptr,
  pub tur: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct FiltreTuru {
  pub id: String,
  pub ad: String,
  pub ses: bool,
  pub video: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct FiltreBilgisi {
  pub id: String,
  pub tur: String,
  pub ad: String,
  pub etkin: bool,
}

pub fn filtre_turleri() -> Vec<FiltreTuru> {
  let a = api();
  let mut v = Vec::new();
  for i in 0.. {
    let mut id: *const std::ffi::c_char = std::ptr::null();
    if !unsafe { (a.obs_enum_filter_types)(i, &mut id) } || id.is_null() {
      break;
    }
    let bayrak = unsafe { (a.obs_get_source_output_flags)(id) };
    let kimlik = unsafe { cstr(id) };
    // Kullanımdan kalkmış sürümler ("_v2"lerin öncülleri) de kayıtlıdır ama yeni filtre olarak sunulmaz
    // OBS_SOURCE_DEPRECATED (1<<8) ve OBS_SOURCE_CAP_DISABLED (1<<10): OBS'in kendi listesi de göstermez
    if bayrak & ((1 << 8) | (1 << 10)) != 0 {
      continue;
    }
    v.push(FiltreTuru {
      ad: unsafe { cstr((a.obs_source_get_display_name)(id)) },
      id: kimlik,
      ses: bayrak & obs::OBS_SOURCE_AUDIO != 0,
      video: bayrak & obs::OBS_SOURCE_VIDEO != 0,
    });
  }
  v
}

unsafe extern "C" fn topla(_ust: Ptr, cocuk: Ptr, param: Ptr) {
  if let Some(v) = (param as *mut Vec<Ptr>).as_mut() {
    v.push(cocuk);
  }
}

impl Motor {
  fn filtre_ptr(&self, id: &str) -> Result<Ptr, String> {
    self.filtreler.get(id).map(|f| f.ptr).ok_or_else(|| format!("filtre yok: {id}"))
  }

  pub fn filtre_ekle(&mut self, kaynak: &str, id: &str, tur: &str, ad: &str, ayarlar: &Map<String, Value>) -> Result<(), String> {
    gecerli_kimlik(id)?;
    if self.filtreler.contains_key(id) {
      return Err(format!("filtre zaten var: {id}"));
    }
    let k = *self.kaynaklar.get(kaynak).ok_or_else(|| format!("kaynak yok: {kaynak}"))?;
    if !filtre_turleri().iter().any(|t| t.id == tur) {
      return Err(format!("filtre türü yok: {tur}"));
    }
    let veri = Veri::yeni().json(ayarlar);
    let (tur_c, ad_c) = (cs(tur), cs(ad));
    let f = unsafe { (api().obs_source_create)(tur_c.as_ptr(), ad_c.as_ptr(), veri.0, std::ptr::null_mut()) };
    if f.is_null() {
      return Err(format!("filtre oluşturulamadı: {tur}"));
    }
    unsafe { (api().obs_source_filter_add)(k, f) };
    self.filtreler.insert(id.into(), Filtre { kaynak: kaynak.into(), ptr: f, tur: tur.into() });
    Ok(())
  }

  pub fn filtre_sil(&mut self, id: &str) -> Result<(), String> {
    let f = self.filtreler.remove(id).ok_or_else(|| format!("filtre yok: {id}"))?;
    if let Some(k) = self.kaynaklar.get(&f.kaynak) {
      unsafe { (api().obs_source_filter_remove)(*k, f.ptr) };
    }
    unsafe { (api().obs_source_release)(f.ptr) };
    Ok(())
  }

  /// `yukari`, `asagi`, `en_ust`, `en_alt` (libobs sırası: ilk filtre kaynağa en yakın olandır)
  pub fn filtre_sira(&mut self, id: &str, yon: &str) -> Result<(), String> {
    let f = self.filtreler.get(id).ok_or_else(|| format!("filtre yok: {id}"))?;
    let k = *self.kaynaklar.get(&f.kaynak).ok_or("kaynak yok")?;
    let hareket = match yon {
      "yukari" => 0,
      "asagi" => 1,
      "en_ust" => 2,
      "en_alt" => 3,
      _ => return Err(format!("geçersiz yön: {yon}")),
    };
    unsafe { (api().obs_source_filter_set_order)(k, f.ptr, hareket) };
    Ok(())
  }

  pub fn filtre_etkin(&mut self, id: &str, acik: bool) -> Result<(), String> {
    let f = self.filtre_ptr(id)?;
    unsafe { (api().obs_source_set_enabled)(f, acik) };
    Ok(())
  }

  pub fn filtre_adlandir(&mut self, id: &str, ad: &str) -> Result<(), String> {
    let f = self.filtre_ptr(id)?;
    unsafe { (api().obs_source_set_name)(f, cs(ad).as_ptr()) };
    Ok(())
  }

  /// Kaynağın filtreleri libobs sırasıyla (yalnız bu motorun eklediği filtreler).
  pub fn filtre_listesi(&self, kaynak: &str) -> Result<Vec<FiltreBilgisi>, String> {
    let k = *self.kaynaklar.get(kaynak).ok_or_else(|| format!("kaynak yok: {kaynak}"))?;
    let mut ptrler: Vec<Ptr> = Vec::new();
    unsafe { (api().obs_source_enum_filters)(k, topla, &mut ptrler as *mut Vec<Ptr> as Ptr) };
    Ok(
      ptrler
        .into_iter()
        .filter_map(|p| {
          let (id, f) = self.filtreler.iter().find(|(_, f)| f.ptr == p)?;
          Some(FiltreBilgisi {
            id: id.clone(),
            tur: f.tur.clone(),
            ad: unsafe { cstr((api().obs_source_get_name)(p)) },
            etkin: unsafe { (api().obs_source_enabled)(p) },
          })
        })
        .collect(),
    )
  }

  pub fn filtre_ozellikleri(&self, id: &str) -> Result<Value, String> {
    crate::eklenti::ozellikler(self.filtre_ptr(id)?)
  }

  pub fn filtre_guncelle(&self, id: &str, ayarlar: &Map<String, Value>) -> Result<(), String> {
    crate::eklenti::guncelle(self.filtre_ptr(id)?, ayarlar)
  }

  /// Kaynak silinirken ya da kapanışta: filtreler kaynaktan çıkarılıp bırakılır.
  pub(crate) fn kaynak_filtrelerini_birak(&mut self, kaynak: Option<&str>) {
    let ids: Vec<String> =
      self.filtreler.iter().filter(|(_, f)| kaynak.is_none_or(|k| f.kaynak == k)).map(|(id, _)| id.clone()).collect();
    for id in ids {
      let _ = self.filtre_sil(&id);
    }
  }
}
