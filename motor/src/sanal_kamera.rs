//! Sanal kamera: tuvalin program görüntüsü kurulu OBS'in sanal kamera sürücüsüne (win-dshow modülünün
//! `virtualcam_output` çıktısı; sürücü OBS kurulumunda kayıtlıdır) verilir. Görüntülü görüşme uygulamaları bunu
//! "OBS Virtual Camera" aygıtı olarak görür. Sürücü tek üretici kabul eder: başka bir uygulama (ör. kullanıcının
//! kendi OBS'i) sanal kamerayı açmışsa paylaşılan bellek zaten vardır ve başlatma reddedilir — onun görüntüsü bozulmaz.

use crate::motor::Motor;
use crate::obs::{api, cs, Veri};

pub const CIKIS_ID: &str = "sanal-kamera";
const TUR: &std::ffi::CStr = c"virtualcam_output";

/// Sanal kameranın paylaşılan belleği başka bir üretici tarafından açılmış mı
#[cfg(windows)]
pub fn baska_uretici_var() -> bool {
  #[link(name = "kernel32")]
  extern "system" {
    fn OpenFileMappingW(access: u32, inherit: i32, name: *const u16) -> *mut std::ffi::c_void;
    fn CloseHandle(h: *mut std::ffi::c_void) -> i32;
  }
  const FILE_MAP_READ: u32 = 0x0004;
  let ad: Vec<u16> = "OBSVirtualCamVideo".encode_utf16().chain(std::iter::once(0)).collect();
  unsafe {
    let h = OpenFileMappingW(FILE_MAP_READ, 0, ad.as_ptr());
    if h.is_null() {
      false
    } else {
      CloseHandle(h);
      true
    }
  }
}

#[cfg(not(windows))]
pub fn baska_uretici_var() -> bool {
  false
}

impl Motor {
  /// Sanal kamerayı verilen tuvalle başlatır (çıktı yoksa oluşturur).
  pub fn sanal_kamera_baslat(&mut self, tuval: &str) -> Result<(), String> {
    if self.cikis_etkin(CIKIS_ID) {
      return Ok(());
    }
    if baska_uretici_var() {
      return Err("sanal kamera başka bir uygulamada açık (ör. OBS Studio); önce orada kapatın".into());
    }
    self.modulleri_yukle(&["win-dshow"])?;
    if !crate::eklenti::kayitli_turler("cikis").iter().any(|t| t == "virtualcam_output") {
      return Err("sanal kamera bu kurulumda yok (OBS'in win-dshow modülü/sürücüsü bulunamadı)".into());
    }
    // Hedef (OBS 30+ "Output Type"): program tuvali, Studio Mode önizlemesi (`studyo-<tuval>`) ya da bir sahnenin
    // projektör tuvali (`kaynak-<sahne>`; panel önce açar)
    let video = if let Some(t) = tuval.strip_prefix("studyo-") {
      self.studyo.get(t).ok_or("Studio Mode kapalı")?.kanvas.video()
    } else if let Some(k) = tuval.strip_prefix(crate::multiview::KAYNAK_ONEK) {
      self.kaynak_tuvalleri.get(k).ok_or("sahne tuvali açık değil")?.video()
    } else {
      self.kanvaslar.get(tuval).ok_or_else(|| format!("tuval yok: {tuval}"))?.video()
    };
    if self.cikislar_var(CIKIS_ID) {
      self.cikis_sil(CIKIS_ID)?;
    }
    let bos = Veri::yeni();
    let ad = cs(CIKIS_ID);
    let ptr = unsafe { (api().obs_output_create)(TUR.as_ptr(), ad.as_ptr(), bos.0, std::ptr::null_mut()) };
    if ptr.is_null() {
      return Err("sanal kamera çıktısı oluşturulamadı".into());
    }
    unsafe { (api().obs_output_set_media)(ptr, video, (api().obs_get_audio)()) };
    self.cikis_kaydet(CIKIS_ID, ptr, "sanal_kamera");
    self.sanal_kamera_kaynagi = Some(tuval.to_string());
    self.cikis_baslat(CIKIS_ID)
  }

  /// Görüntü aldığı tuval kapanacaksa sanal kamera önce durdurulur (çıktı yok olmuş videoya bağlı kalmasın)
  pub(crate) fn sanal_kamera_tuvali_kapaniyor(&mut self, tuval: &str) {
    if self.sanal_kamera_kaynagi.as_deref() == Some(tuval) {
      let _ = self.sanal_kamera_durdur();
    }
  }

  pub fn sanal_kamera_durdur(&mut self) -> Result<(), String> {
    self.sanal_kamera_kaynagi = None;
    if self.cikislar_var(CIKIS_ID) {
      self.cikis_sil(CIKIS_ID)?;
    }
    Ok(())
  }
}
