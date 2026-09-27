//! Kendi RTMP servis türümüz (`yym_rtmp`).
//!
//! OBS'in `rtmp-services` modülü yüklenirken obsproject.com'dan servis listesi güncellemesi indirir (modül yapılandırma
//! yolu boş olsa bile göreli bir önbellek yolu üretir). Motorun beklenmedik ağ isteği yapmaması için o modül hiç
//! yüklenmez; `rtmp_output` çıktısının ihtiyaç duyduğu sunucu + anahtar bilgisini bu küçük servis sağlar.

use std::ffi::{c_char, CStr, CString};

use crate::obs::{self, cs, Ptr, ServiceInfo};

pub const SERVIS_ID: &CStr = c"yym_rtmp";

struct ServisVerisi {
  sunucu: CString,
  anahtar: CString,
  kullanici: CString,
  parola: CString,
}

impl ServisVerisi {
  unsafe fn ayarlardan(ayarlar: Ptr) -> Self {
    let oku = |ad: &str| cs(&obs::cstr((obs::api().obs_data_get_string)(ayarlar, cs(ad).as_ptr())));
    ServisVerisi { sunucu: oku("server"), anahtar: oku("key"), kullanici: oku("username"), parola: oku("password") }
  }
}

/// Sunucu adresinin protokolü (`rtmp_output` yalnız RTMP/RTMPS kabul eder).
pub fn protokol(sunucu: &str) -> &'static CStr {
  if sunucu.trim_start().to_ascii_lowercase().starts_with("rtmps://") {
    c"RTMPS"
  } else {
    c"RTMP"
  }
}

unsafe extern "C" fn ad(_: Ptr) -> *const c_char {
  c"Yayın Motoru RTMP".as_ptr()
}

unsafe extern "C" fn olustur(ayarlar: Ptr, _servis: Ptr) -> Ptr {
  Box::into_raw(Box::new(ServisVerisi::ayarlardan(ayarlar))) as Ptr
}

unsafe extern "C" fn yok_et(veri: Ptr) {
  if !veri.is_null() {
    drop(Box::from_raw(veri as *mut ServisVerisi));
  }
}

unsafe extern "C" fn guncelle(veri: Ptr, ayarlar: Ptr) {
  if let Some(v) = (veri as *mut ServisVerisi).as_mut() {
    *v = ServisVerisi::ayarlardan(ayarlar);
  }
}

unsafe fn veri<'a>(p: Ptr) -> Option<&'a ServisVerisi> {
  (p as *const ServisVerisi).as_ref()
}

unsafe extern "C" fn sunucu(p: Ptr) -> *const c_char {
  veri(p).map_or(std::ptr::null(), |v| v.sunucu.as_ptr())
}

unsafe extern "C" fn anahtar(p: Ptr) -> *const c_char {
  veri(p).map_or(std::ptr::null(), |v| v.anahtar.as_ptr())
}

unsafe extern "C" fn baglanti_bilgisi(p: Ptr, tur: u32) -> *const c_char {
  let Some(v) = veri(p) else { return std::ptr::null() };
  let s = match tur {
    obs::CONNECT_INFO_SERVER_URL => &v.sunucu,
    obs::CONNECT_INFO_STREAM_KEY => &v.anahtar,
    obs::CONNECT_INFO_USERNAME => &v.kullanici,
    obs::CONNECT_INFO_PASSWORD => &v.parola,
    _ => return std::ptr::null(),
  };
  if s.as_bytes().is_empty() {
    std::ptr::null()
  } else {
    s.as_ptr()
  }
}

unsafe extern "C" fn protokol_c(p: Ptr) -> *const c_char {
  let sunucu = veri(p).map(|v| v.sunucu.to_string_lossy().into_owned()).unwrap_or_default();
  protokol(&sunucu).as_ptr()
}

unsafe extern "C" fn baglanabilir(p: Ptr) -> bool {
  veri(p).is_some_and(|v| !v.sunucu.as_bytes().is_empty())
}

unsafe extern "C" fn cikis_turu(_: Ptr) -> *const c_char {
  c"rtmp_output".as_ptr()
}

/// Servis türünü libobs'a kaydeder (`obs_startup`'tan sonra, servis oluşturmadan önce bir kez).
pub fn kaydet() {
  let bilgi = ServiceInfo {
    id: SERVIS_ID.as_ptr(),
    get_name: Some(ad),
    create: Some(olustur),
    destroy: Some(yok_et),
    activate: None,
    deactivate: None,
    update: Some(guncelle),
    get_defaults: None,
    get_properties: None,
    initialize: None,
    get_url: Some(sunucu),
    get_key: Some(anahtar),
    get_username: None,
    get_password: None,
    deprecated_1: None,
    apply_encoder_settings: None,
    type_data: std::ptr::null_mut(),
    free_type_data: None,
    get_output_type: Some(cikis_turu),
    get_supported_resolutions: None,
    get_max_fps: None,
    get_max_bitrate: None,
    get_supported_video_codecs: None,
    get_protocol: Some(protokol_c),
    get_supported_audio_codecs: None,
    get_connect_info: Some(baglanti_bilgisi),
    can_try_to_connect: Some(baglanabilir),
  };
  // libobs yapıyı kopyalar; `id` statik dize olduğu için kalıcıdır
  unsafe { (obs::api().obs_register_service_s)(&bilgi, std::mem::size_of::<ServiceInfo>()) };
}

#[cfg(test)]
mod tests {
  use super::protokol;

  #[test]
  fn protokol_adresten_secilir() {
    assert_eq!(protokol("rtmps://live.twitch.tv:443/app").to_str().unwrap(), "RTMPS");
    assert_eq!(protokol("RTMPS://x").to_str().unwrap(), "RTMPS");
    assert_eq!(protokol("rtmp://127.0.0.1:1935/live").to_str().unwrap(), "RTMP");
    assert_eq!(protokol("").to_str().unwrap(), "RTMP");
  }
}
