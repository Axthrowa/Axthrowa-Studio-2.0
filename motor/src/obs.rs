//! libobs'a ince FFI katmanı.
//!
//! libobs (`obs.dll`) kurulu OBS Studio'dan **çalışma anında** yüklenir; başlık dosyaları derlenmez. Yapı düzenleri OBS
//! 32.2.2 başlıklarıyla birebir eşlenmiştir (`libobs/obs.h`, `media-io/*.h`, `obs-service.h`, `callback/calldata.h`).
//! Sürüm farkı yapı düzenini bozabileceği için `Api::yukle` sürümü denetler ve bilinmeyen ana sürümü reddeder.

use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub type Ptr = *mut c_void;

/// `struct obs_video_info` (obs.h). C `enum` → `c_int`, `bool` → 1 bayt (MSVC).
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct VideoInfo {
  pub graphics_module: *const c_char,
  pub fps_num: u32,
  pub fps_den: u32,
  pub base_width: u32,
  pub base_height: u32,
  pub output_width: u32,
  pub output_height: u32,
  pub output_format: c_int,
  pub adapter: u32,
  pub gpu_conversion: bool,
  pub colorspace: c_int,
  pub range: c_int,
  pub scale_type: c_int,
}

/// `struct obs_audio_info`
#[repr(C)]
pub struct AudioInfo {
  pub samples_per_sec: u32,
  pub speakers: c_int,
}

/// `struct vec2` (birleşim: `{x, y}` / `ptr[2]`, 8 bayt)
#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vec2 {
  pub x: f32,
  pub y: f32,
}

/// `struct calldata`
#[repr(C)]
pub struct Calldata {
  stack: *mut u8,
  size: usize,
  capacity: usize,
  fixed: bool,
}

impl Calldata {
  /// Boş çağrı verisi (`calldata_init` ile aynı: sıfır).
  pub fn bos() -> Self {
    Calldata { stack: std::ptr::null_mut(), size: 0, capacity: 0, fixed: false }
  }
}

impl Drop for Calldata {
  /// `calldata_free`: libobs'un ayırdığı yığın `bfree` ile bırakılır.
  fn drop(&mut self) {
    if !self.fixed && !self.stack.is_null() {
      if let Some(a) = API.get() {
        unsafe { (a.bfree)(self.stack as Ptr) };
      }
    }
  }
}

pub const VIDEO_FORMAT_NV12: c_int = 2;
pub const VIDEO_CS_709: c_int = 2;
pub const VIDEO_RANGE_PARTIAL: c_int = 1;
pub const OBS_SCALE_BICUBIC: c_int = 2;
pub const SPEAKERS_STEREO: c_int = 2;
pub const OBS_VIDEO_SUCCESS: c_int = 0;
pub const MODULE_SUCCESS: c_int = 0;
/// obs-defs.h
pub const MODULE_ERROR: c_int = -1;
pub const MODULE_FAILED_TO_OPEN: c_int = -2;
pub const MODULE_MISSING_EXPORTS: c_int = -3;
pub const MODULE_INCOMPATIBLE_VER: c_int = -4;
pub const MODULE_HARDCODED_SKIP: c_int = -5;
/// obs-properties.h `enum obs_property_type`
pub const OBS_PROPERTY_BOOL: c_int = 1;
pub const OBS_PROPERTY_INT: c_int = 2;
pub const OBS_PROPERTY_FLOAT: c_int = 3;
pub const OBS_PROPERTY_TEXT: c_int = 4;
pub const OBS_PROPERTY_PATH: c_int = 5;
pub const OBS_PROPERTY_LIST: c_int = 6;
pub const OBS_PROPERTY_COLOR: c_int = 7;
pub const OBS_PROPERTY_BUTTON: c_int = 8;
pub const OBS_PROPERTY_FONT: c_int = 9;
pub const OBS_PROPERTY_EDITABLE_LIST: c_int = 10;
pub const OBS_PROPERTY_FRAME_RATE: c_int = 11;
pub const OBS_PROPERTY_GROUP: c_int = 12;
pub const OBS_PROPERTY_COLOR_ALPHA: c_int = 13;
pub const OBS_TEXT_PASSWORD: c_int = 1;
pub const OBS_COMBO_FORMAT_FLOAT: c_int = 2;
pub const OBS_COMBO_FORMAT_BOOL: c_int = 4;
pub const OBS_ENCODER_VIDEO: c_int = 1;
pub const OBS_BOUNDS_SCALE_INNER: c_int = 2;
pub const OBS_COMBO_FORMAT_INT: c_int = 1;
pub const OBS_COMBO_FORMAT_STRING: c_int = 3;
/// `enum obs_canvas_flags`
pub const CANVAS_ACTIVATE: u32 = 1 << 1;
#[allow(dead_code)] // ana tuvalin bayrağı; ek tuvaller sesi karıştırmaz
pub const CANVAS_MIX_AUDIO: u32 = 1 << 2;
pub const CANVAS_SCENE_REF: u32 = 1 << 3;
pub const CANVAS_EPHEMERAL: u32 = 1 << 4;
/// `enum obs_service_connect_info`
pub const CONNECT_INFO_SERVER_URL: u32 = 0;
pub const CONNECT_INFO_STREAM_KEY: u32 = 2;
pub const CONNECT_INFO_USERNAME: u32 = 4;
pub const CONNECT_INFO_PASSWORD: u32 = 6;

pub type SignalCb = unsafe extern "C" fn(data: Ptr, cd: *mut Calldata);
/// `obs_volmeter_updated_t`: dB değerleri, MAX_AUDIO_CHANNELS (8) kanal
pub type OlcerCb = unsafe extern "C" fn(param: Ptr, magnitude: *const f32, peak: *const f32, input_peak: *const f32);
/// `obs_enum_audio_device_cb`
pub type AygitCb = unsafe extern "C" fn(data: Ptr, ad: *const c_char, id: *const c_char) -> bool;
/// `obs_source_enum_proc_t`
pub type KaynakSayCb = unsafe extern "C" fn(ust: Ptr, cocuk: Ptr, param: Ptr);

/// `struct obs_sceneitem_crop` (obs.h)
#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Kirp {
  pub sol: i32,
  pub ust: i32,
  pub sag: i32,
  pub alt: i32,
}

pub const OBS_SOURCE_AUDIO: u32 = 1 << 1;
pub const OBS_SOURCE_VIDEO: u32 = 1 << 0;
pub const OBS_SOURCE_FLAG_FORCE_MONO: u32 = 1 << 1;
/// `enum obs_fader_type`
pub const OBS_FADER_LOG: c_int = 2;
/// `enum obs_transition_mode`
pub const OBS_TRANSITION_MODE_AUTO: c_int = 0;
pub const OBS_TRANSITION_MODE_MANUAL: c_int = 1;
/// `enum obs_scene_duplicate_type`: REFS, COPY, PRIVATE_REFS, PRIVATE_COPY
pub const OBS_SCENE_DUP_PRIVATE_REFS: c_int = 2;
pub const OBS_SCENE_DUP_PRIVATE_COPY: c_int = 3;
pub const OBS_ALIGN_LEFT: u32 = 1;
pub const OBS_ALIGN_TOP: u32 = 4;
/// `enum obs_canvas_flags` PREVIEW ön ayarı (= EPHEMERAL): kaynakları etkinleştirmez, sesi karıştırmaz
pub const CANVAS_PREVIEW: u32 = 1 << 4;
pub const MAX_AUDIO_CHANNELS: usize = 8;
pub type SahneOgeCb = unsafe extern "C" fn(scene: Ptr, item: Ptr, param: Ptr) -> bool;
pub type LogHandler = unsafe extern "C" fn(lvl: c_int, msg: *const c_char, args: Ptr, p: Ptr);

/// `struct obs_service_info` (obs-service.h) — kendi RTMP servisimizi kaydetmek için. Sıra ve alanlar başlıkla aynı;
/// kullanmadığımız alanlar `None` (NULL) kalır.
#[repr(C)]
pub struct ServiceInfo {
  pub id: *const c_char,
  pub get_name: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub create: Option<unsafe extern "C" fn(settings: Ptr, service: Ptr) -> Ptr>,
  pub destroy: Option<unsafe extern "C" fn(Ptr)>,
  pub activate: Option<unsafe extern "C" fn(Ptr, Ptr)>,
  pub deactivate: Option<unsafe extern "C" fn(Ptr)>,
  pub update: Option<unsafe extern "C" fn(Ptr, Ptr)>,
  pub get_defaults: Option<unsafe extern "C" fn(Ptr)>,
  pub get_properties: Option<unsafe extern "C" fn(Ptr) -> Ptr>,
  pub initialize: Option<unsafe extern "C" fn(Ptr, Ptr) -> bool>,
  pub get_url: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub get_key: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub get_username: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub get_password: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub deprecated_1: Option<unsafe extern "C" fn() -> bool>,
  pub apply_encoder_settings: Option<unsafe extern "C" fn(Ptr, Ptr, Ptr)>,
  pub type_data: Ptr,
  pub free_type_data: Option<unsafe extern "C" fn(Ptr)>,
  pub get_output_type: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub get_supported_resolutions: Option<unsafe extern "C" fn(Ptr, *mut Ptr, *mut usize)>,
  pub get_max_fps: Option<unsafe extern "C" fn(Ptr, *mut c_int)>,
  pub get_max_bitrate: Option<unsafe extern "C" fn(Ptr, *mut c_int, *mut c_int)>,
  pub get_supported_video_codecs: Option<unsafe extern "C" fn(Ptr) -> *const *const c_char>,
  pub get_protocol: Option<unsafe extern "C" fn(Ptr) -> *const c_char>,
  pub get_supported_audio_codecs: Option<unsafe extern "C" fn(Ptr) -> *const *const c_char>,
  pub get_connect_info: Option<unsafe extern "C" fn(Ptr, u32) -> *const c_char>,
  pub can_try_to_connect: Option<unsafe extern "C" fn(Ptr) -> bool>,
}

macro_rules! obs_api {
  ($( fn $ad:ident($($arg:ty),*) $(-> $don:ty)?; )*) => {
    /// libobs dışa aktarımları (fonksiyon göstericileri kitaplıkla birlikte yaşar). Bazıları ileride kullanılmak üzere
    /// yüklenir (ör. başlatılmış mı sorgusu); eksik dışa aktarım yüklemede hemen hata verir.
    #[allow(non_snake_case, dead_code)]
    pub struct Api {
      $( pub $ad: unsafe extern "C" fn($($arg),*) $(-> $don)?, )*
      _kitaplik: libloading::Library,
    }

    impl Api {
      unsafe fn baglan(kitaplik: libloading::Library) -> Result<Self, String> {
        $(
          let $ad = *kitaplik
            .get::<unsafe extern "C" fn($($arg),*) $(-> $don)?>(concat!(stringify!($ad), "\0").as_bytes())
            .map_err(|e| format!("libobs dışa aktarımı yok: {} ({e})", stringify!($ad)))?;
        )*
        Ok(Api { $($ad,)* _kitaplik: kitaplik })
      }
    }
  };
}

obs_api! {
  fn obs_startup(*const c_char, *const c_char, Ptr) -> bool;
  fn obs_shutdown();
  fn obs_initialized() -> bool;
  fn obs_get_version_string() -> *const c_char;
  fn obs_reset_video(*mut VideoInfo) -> c_int;
  fn obs_reset_audio(*const AudioInfo) -> bool;
  fn obs_open_module(*mut Ptr, *const c_char, *const c_char) -> c_int;
  fn obs_init_module(Ptr) -> bool;
  fn obs_post_load_modules();
  fn obs_enum_encoder_types(usize, *mut *const c_char) -> bool;
  fn obs_enum_input_types(usize, *mut *const c_char) -> bool;
  fn obs_enum_output_types(usize, *mut *const c_char) -> bool;
  fn obs_get_encoder_type(*const c_char) -> c_int;
  fn obs_get_encoder_codec(*const c_char) -> *const c_char;
  fn obs_encoder_get_display_name(*const c_char) -> *const c_char;
  fn obs_get_audio() -> Ptr;
  fn obs_get_video() -> Ptr;
  fn obs_set_output_source(u32, Ptr);
  fn obs_get_active_fps() -> f64;
  fn obs_get_average_frame_time_ns() -> u64;
  fn obs_get_total_frames() -> u32;
  fn obs_get_lagged_frames() -> u32;
  fn obs_canvas_create(*const c_char, *mut VideoInfo, u32) -> Ptr;
  fn obs_canvas_remove(Ptr);
  fn obs_canvas_release(Ptr);
  fn obs_canvas_set_channel(Ptr, u32, Ptr);
  fn obs_canvas_scene_create(Ptr, *const c_char) -> Ptr;
  fn obs_canvas_get_video(Ptr) -> Ptr;
  fn obs_register_output_s(Ptr, usize);
  fn obs_output_set_media(Ptr, Ptr, Ptr);
  fn obs_output_output_caption_text2(Ptr, *const c_char, f64);
  fn obs_output_set_video_conversion(Ptr, Ptr);
  fn obs_output_begin_data_capture(Ptr, u32) -> bool;
  fn obs_output_end_data_capture(Ptr);
  fn obs_source_create(*const c_char, *const c_char, Ptr, Ptr) -> Ptr;
  fn obs_source_release(Ptr);
  fn obs_source_get_ref(Ptr) -> Ptr;
  fn obs_source_remove(Ptr);
  fn obs_source_update(Ptr, Ptr);
  fn obs_source_get_width(Ptr) -> u32;
  fn obs_source_active(Ptr) -> bool;
  fn obs_source_showing(Ptr) -> bool;
  fn obs_source_get_height(Ptr) -> u32;
  fn obs_source_set_muted(Ptr, bool);
  fn obs_source_set_volume(Ptr, f32);
  fn obs_source_set_audio_mixers(Ptr, u32);
  fn obs_scene_create(*const c_char) -> Ptr;
  fn obs_scene_create_private(*const c_char) -> Ptr;
  fn obs_scene_release(Ptr);
  fn obs_scene_from_source(Ptr) -> Ptr;
  fn obs_scene_duplicate(Ptr, *const c_char, c_int) -> Ptr;
  fn obs_scene_get_source(Ptr) -> Ptr;
  fn obs_scene_add(Ptr, Ptr) -> Ptr;
  fn obs_sceneitem_remove(Ptr);
  fn obs_scene_enum_items(Ptr, SahneOgeCb, Ptr);
  fn obs_sceneitem_get_source(Ptr) -> Ptr;
  fn obs_sceneitem_get_pos(Ptr, *mut Vec2);
  fn obs_sceneitem_get_scale(Ptr, *mut Vec2);
  fn obs_sceneitem_get_bounds(Ptr, *mut Vec2);
  fn obs_sceneitem_get_bounds_type(Ptr) -> c_int;
  fn obs_sceneitem_visible(Ptr) -> bool;
  fn obs_sceneitem_set_order(Ptr, c_int);
  fn obs_sceneitem_set_order_position(Ptr, c_int);
  fn obs_get_source_properties(*const c_char) -> Ptr;
  fn obs_get_source_defaults(*const c_char) -> Ptr;
  fn obs_properties_get(Ptr, *const c_char) -> Ptr;
  fn obs_properties_destroy(Ptr);
  fn obs_property_list_format(Ptr) -> c_int;
  fn obs_property_list_item_count(Ptr) -> usize;
  fn obs_property_list_item_name(Ptr, usize) -> *const c_char;
  fn obs_property_list_item_string(Ptr, usize) -> *const c_char;
  fn obs_property_list_item_int(Ptr, usize) -> i64;
  fn obs_output_get_proc_handler(Ptr) -> Ptr;
  fn proc_handler_call(Ptr, *const c_char, *mut Calldata) -> bool;
  fn calldata_get_string(*const Calldata, *const c_char, *mut *const c_char) -> bool;
  fn bfree(Ptr);
  fn obs_source_get_audio_mixers(Ptr) -> u32;
  fn obs_source_get_id(Ptr) -> *const c_char;
  fn obs_sceneitem_set_pos(Ptr, *const Vec2);
  fn obs_sceneitem_set_scale(Ptr, *const Vec2);
  fn obs_sceneitem_set_rot(Ptr, f32);
  fn obs_sceneitem_set_bounds_type(Ptr, c_int);
  fn obs_sceneitem_set_bounds(Ptr, *const Vec2);
  fn obs_sceneitem_set_visible(Ptr, bool) -> bool;
  fn obs_data_create() -> Ptr;
  fn obs_source_reset_settings(Ptr, Ptr);
  fn obs_data_release(Ptr);
  fn obs_data_set_string(Ptr, *const c_char, *const c_char);
  fn obs_data_set_int(Ptr, *const c_char, i64);
  fn obs_data_set_bool(Ptr, *const c_char, bool);
  fn obs_data_set_double(Ptr, *const c_char, f64);
  fn obs_data_get_string(Ptr, *const c_char) -> *const c_char;
  fn obs_video_encoder_create(*const c_char, *const c_char, Ptr, Ptr) -> Ptr;
  fn obs_audio_encoder_create(*const c_char, *const c_char, Ptr, usize, Ptr) -> Ptr;
  fn obs_encoder_release(Ptr);
  fn obs_encoder_set_video(Ptr, Ptr);
  fn obs_encoder_set_audio(Ptr, Ptr);
  fn obs_encoder_active(Ptr) -> bool;
  fn obs_output_create(*const c_char, *const c_char, Ptr, Ptr) -> Ptr;
  fn obs_output_release(Ptr);
  fn obs_output_set_video_encoder(Ptr, Ptr);
  fn obs_output_set_audio_encoder(Ptr, Ptr, usize);
  fn obs_output_set_service(Ptr, Ptr);
  fn obs_output_set_reconnect_settings(Ptr, c_int, c_int);
  fn obs_output_start(Ptr) -> bool;
  fn obs_output_stop(Ptr);
  fn obs_output_force_stop(Ptr);
  fn obs_output_active(Ptr) -> bool;
  fn obs_output_reconnecting(Ptr) -> bool;
  fn obs_output_get_last_error(Ptr) -> *const c_char;
  fn obs_output_get_total_bytes(Ptr) -> u64;
  fn obs_output_get_frames_dropped(Ptr) -> c_int;
  fn obs_output_get_total_frames(Ptr) -> c_int;
  fn obs_output_get_connect_time_ms(Ptr) -> c_int;
  fn obs_output_get_signal_handler(Ptr) -> Ptr;
  fn obs_output_pause(Ptr, bool) -> bool;
  fn obs_output_get_video_encoder(Ptr) -> Ptr;
  fn obs_output_get_audio_encoder(Ptr, usize) -> Ptr;
  fn obs_set_ui_task_handler(Option<crate::ui_gorev::Isleyici>);
  fn obs_output_paused(Ptr) -> bool;
  fn obs_output_can_pause(Ptr) -> bool;
  fn obs_service_create(*const c_char, *const c_char, Ptr, Ptr) -> Ptr;
  fn obs_service_release(Ptr);
  fn obs_register_service_s(*const ServiceInfo, usize);
  fn signal_handler_connect(Ptr, *const c_char, SignalCb, Ptr);
  fn signal_handler_disconnect(Ptr, *const c_char, SignalCb, Ptr);
  fn calldata_get_data(*const Calldata, *const c_char, Ptr, usize) -> bool;
  fn base_set_log_handler(LogHandler, Ptr);
  fn obs_enum_filter_types(usize, *mut *const c_char) -> bool;
  fn obs_enum_transition_types(usize, *mut *const c_char) -> bool;
  fn obs_enum_service_types(usize, *mut *const c_char) -> bool;
  fn obs_source_get_display_name(*const c_char) -> *const c_char;
  fn obs_output_get_display_name(*const c_char) -> *const c_char;
  fn obs_service_get_display_name(*const c_char) -> *const c_char;
  fn obs_get_module_lib(Ptr) -> Ptr;
  fn obs_get_module_name(Ptr) -> *const c_char;
  fn obs_get_module_description(Ptr) -> *const c_char;
  fn obs_get_module_author(Ptr) -> *const c_char;
  fn obs_source_properties(Ptr) -> Ptr;
  fn obs_properties_first(Ptr) -> Ptr;
  fn obs_property_next(*mut Ptr) -> bool;
  fn obs_property_name(Ptr) -> *const c_char;
  fn obs_property_description(Ptr) -> *const c_char;
  fn obs_property_long_description(Ptr) -> *const c_char;
  fn obs_property_get_type(Ptr) -> c_int;
  fn obs_property_enabled(Ptr) -> bool;
  fn obs_property_visible(Ptr) -> bool;
  fn obs_property_int_min(Ptr) -> c_int;
  fn obs_property_int_max(Ptr) -> c_int;
  fn obs_property_int_step(Ptr) -> c_int;
  fn obs_property_int_suffix(Ptr) -> *const c_char;
  fn obs_property_float_min(Ptr) -> f64;
  fn obs_property_float_max(Ptr) -> f64;
  fn obs_property_float_step(Ptr) -> f64;
  fn obs_property_float_suffix(Ptr) -> *const c_char;
  fn obs_property_text_type(Ptr) -> c_int;
  fn obs_property_path_type(Ptr) -> c_int;
  fn obs_property_list_type(Ptr) -> c_int;
  fn obs_property_list_item_disabled(Ptr, usize) -> bool;
  fn obs_property_list_item_float(Ptr, usize) -> f64;
  fn obs_property_list_item_bool(Ptr, usize) -> bool;
  fn obs_property_group_content(Ptr) -> Ptr;
  fn obs_properties_apply_settings(Ptr, Ptr);
  fn obs_source_get_settings(Ptr) -> Ptr;
  fn obs_data_get_json(Ptr) -> *const c_char;
  fn obs_data_get_json_with_defaults(Ptr) -> *const c_char;
  fn obs_data_create_from_json(*const c_char) -> Ptr;
  fn obs_source_set_name(Ptr, *const c_char);
  fn obs_source_get_name(Ptr) -> *const c_char;
  fn obs_source_duplicate(Ptr, *const c_char, bool) -> Ptr;
  fn obs_source_get_output_flags(Ptr) -> u32;
  fn obs_sceneitem_get_rot(Ptr) -> f32;
  fn obs_sceneitem_get_alignment(Ptr) -> u32;
  fn obs_sceneitem_set_alignment(Ptr, u32);
  fn obs_sceneitem_get_bounds_alignment(Ptr) -> u32;
  fn obs_sceneitem_set_bounds_alignment(Ptr, u32);
  fn obs_sceneitem_set_crop(Ptr, *const Kirp);
  fn obs_sceneitem_get_crop(Ptr, *mut Kirp);
  fn obs_sceneitem_set_locked(Ptr, bool) -> bool;
  fn obs_sceneitem_locked(Ptr) -> bool;
  fn obs_sceneitem_set_scale_filter(Ptr, c_int);
  fn obs_sceneitem_get_scale_filter(Ptr) -> c_int;
  fn obs_sceneitem_set_blending_mode(Ptr, c_int);
  fn obs_sceneitem_get_blending_mode(Ptr) -> c_int;
  fn obs_sceneitem_set_blending_method(Ptr, c_int);
  fn obs_sceneitem_get_blending_method(Ptr) -> c_int;
  fn obs_source_set_deinterlace_mode(Ptr, c_int);
  fn obs_source_get_deinterlace_mode(Ptr) -> c_int;
  fn obs_source_set_deinterlace_field_order(Ptr, c_int);
  fn obs_source_get_deinterlace_field_order(Ptr) -> c_int;
  fn obs_scene_add_group2(Ptr, *const c_char, bool) -> Ptr;
  fn obs_sceneitem_is_group(Ptr) -> bool;
  fn obs_sceneitem_group_add_item(Ptr, Ptr);
  fn obs_sceneitem_group_remove_item(Ptr, Ptr);
  fn obs_sceneitem_group_ungroup2(Ptr, bool);
  fn obs_sceneitem_group_enum_items(Ptr, SahneOgeCb, Ptr);
  fn obs_sceneitem_group_get_scene(Ptr) -> Ptr;
  fn obs_sceneitem_get_group(Ptr, Ptr) -> Ptr;
  fn obs_source_create_private(*const c_char, *const c_char, Ptr) -> Ptr;
  fn obs_transition_set(Ptr, Ptr);
  fn obs_transition_start(Ptr, c_int, u32, Ptr) -> bool;
  fn obs_transition_get_active_source(Ptr) -> Ptr;
  fn obs_transition_set_size(Ptr, u32, u32);
  fn obs_transition_set_alignment(Ptr, u32);
  fn obs_transition_force_stop(Ptr);
  fn obs_transition_set_manual_time(Ptr, f32);
  fn obs_transition_fixed(Ptr) -> bool;
  fn obs_canvas_create_private(*const c_char, *mut VideoInfo, u32) -> Ptr;
  fn obs_get_source_output_flags(*const c_char) -> u32;
  fn obs_source_filter_add(Ptr, Ptr);
  fn obs_source_filter_remove(Ptr, Ptr);
  fn obs_source_filter_set_order(Ptr, Ptr, c_int);
  fn obs_source_enum_filters(Ptr, KaynakSayCb, Ptr);
  fn obs_source_set_enabled(Ptr, bool);
  fn obs_source_enabled(Ptr) -> bool;
  fn obs_volmeter_create(c_int) -> Ptr;
  fn obs_volmeter_set_peak_meter_type(Ptr, c_int);
  fn obs_volmeter_destroy(Ptr);
  fn obs_volmeter_attach_source(Ptr, Ptr) -> bool;
  fn obs_volmeter_detach_source(Ptr);
  fn obs_volmeter_add_callback(Ptr, OlcerCb, Ptr);
  fn obs_volmeter_remove_callback(Ptr, OlcerCb, Ptr);
  fn obs_source_set_balance_value(Ptr, f32);
  fn obs_source_get_balance_value(Ptr) -> f32;
  fn obs_source_set_sync_offset(Ptr, i64);
  fn obs_source_get_sync_offset(Ptr) -> i64;
  fn obs_source_set_monitoring_type(Ptr, c_int);
  fn obs_source_get_monitoring_type(Ptr) -> c_int;
  fn obs_set_audio_monitoring_device(*const c_char, *const c_char) -> bool;
  fn obs_get_audio_monitoring_device(*mut *const c_char, *mut *const c_char);
  fn obs_enum_audio_monitoring_devices(AygitCb, Ptr);
  fn obs_source_set_flags(Ptr, u32);
  fn obs_source_get_flags(Ptr) -> u32;
  fn obs_source_get_volume(Ptr) -> f32;
  fn obs_source_muted(Ptr) -> bool;
  fn obs_source_media_play_pause(Ptr, bool);
  fn obs_source_media_restart(Ptr);
  fn obs_source_media_stop(Ptr);
  fn obs_source_media_get_state(Ptr) -> c_int;
  fn obs_source_media_get_duration(Ptr) -> i64;
  fn obs_source_media_get_time(Ptr) -> i64;
  fn os_cpu_usage_info_start() -> Ptr;
  fn os_cpu_usage_info_query(Ptr) -> f64;
  fn os_cpu_usage_info_destroy(Ptr);
  fn os_get_proc_resident_size() -> u64;
  fn video_output_get_skipped_frames(Ptr) -> u32;
  fn video_output_get_total_frames(Ptr) -> u32;
  fn obs_get_encoder_properties(*const c_char) -> Ptr;
  fn obs_encoder_defaults(*const c_char) -> Ptr;
  fn obs_encoder_update(Ptr, Ptr);
  fn obs_encoder_get_settings(Ptr) -> Ptr;
  // Etkileşim (obs.h / obs-interaction.h)
  fn obs_source_send_mouse_click(Ptr, *const FareOlayi, i32, bool, u32);
  fn obs_source_send_mouse_move(Ptr, *const FareOlayi, bool);
  fn obs_source_send_mouse_wheel(Ptr, *const FareOlayi, c_int, c_int);
  fn obs_source_send_focus(Ptr, bool);
  fn obs_source_send_key_click(Ptr, *const TusOlayi, bool);
  // Sahne öğesi gösterme/gizleme geçişleri (OBS 27+)
  fn obs_sceneitem_set_transition(Ptr, bool, Ptr);
  fn obs_sceneitem_get_transition(Ptr, bool) -> Ptr;
  fn obs_sceneitem_set_transition_duration(Ptr, bool, u32);
  fn obs_sceneitem_get_transition_duration(Ptr, bool) -> u32;
  fn obs_output_defaults(*const c_char) -> Ptr;
  fn obs_get_output_properties(*const c_char) -> Ptr;
}

/// `struct obs_mouse_event` (obs-interaction.h)
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct FareOlayi {
  pub modifiers: u32,
  pub x: i32,
  pub y: i32,
}

/// `struct obs_key_event` (obs-interaction.h). `text` UTF-8, NUL sonlu; libobs kopyalamaz, çağrı süresince yaşamalı.
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct TusOlayi {
  pub modifiers: u32,
  pub text: *const c_char,
  pub native_modifiers: u32,
  pub native_scancode: u32,
  pub native_vkey: u32,
}

/// `enum obs_interaction_flags`
pub const INTERACT_SHIFT_KEY: u32 = 1 << 1;
pub const INTERACT_CONTROL_KEY: u32 = 1 << 2;
pub const INTERACT_ALT_KEY: u32 = 1 << 3;
pub const INTERACT_MOUSE_LEFT: u32 = 1 << 4;
pub const INTERACT_MOUSE_MIDDLE: u32 = 1 << 5;
pub const INTERACT_MOUSE_RIGHT: u32 = 1 << 6;
/// `OBS_SOURCE_INTERACTION` çıktı bayrağı: kaynak fare/klavye olayı alır
pub const OBS_SOURCE_INTERACTION: u32 = 1 << 5;

// SAFETY: libobs fonksiyonları iş parçacığı güvenlidir (libobs kendi kilitlerini tutar); tablo değişmez.
unsafe impl Send for Api {}
unsafe impl Sync for Api {}

static API: OnceLock<Api> = OnceLock::new();

/// Yüklü API (yükleme `Api::yukle` ile bir kez yapılır).
pub fn api() -> &'static Api {
  API.get().expect("libobs yüklenmedi")
}

/// Kurulu OBS'in yerleşimi.
#[derive(Clone, Debug)]
pub struct ObsKurulumu {
  pub bin: PathBuf,
  pub eklentiler: PathBuf,
  pub veri: PathBuf,
}

impl ObsKurulumu {
  /// Varsayılan konum; `YYA_OBS_DIR` ile değiştirilebilir (taşınabilir OBS için).
  pub fn bul() -> Result<Self, String> {
    let kok = std::env::var_os("YYA_OBS_DIR")
      .map(PathBuf::from)
      .unwrap_or_else(|| PathBuf::from(r"C:\Program Files\obs-studio"));
    let k = ObsKurulumu {
      bin: kok.join("bin").join("64bit"),
      eklentiler: kok.join("obs-plugins").join("64bit"),
      veri: kok.join("data"),
    };
    if !k.bin.join("obs.dll").is_file() {
      return Err(format!("OBS Studio bulunamadı: {}", k.bin.join("obs.dll").display()));
    }
    Ok(k)
  }
}

/// Desteklenen libobs ana sürümü: yapı düzenleri bu sürümün başlıklarından alındı.
pub const DESTEKLENEN_ANA_SURUM: u32 = 32;

impl Api {
  /// `obs.dll`'yi yükler ve ana sürümü denetler.
  pub fn yukle(kurulum: &ObsKurulumu) -> Result<&'static Api, String> {
    if let Some(a) = API.get() {
      return Ok(a);
    }
    // Bağımlı DLL'ler (w32-pthreads, avcodec…) OBS'in bin klasöründe: yükleme öncesi arama yoluna eklenir
    dll_klasoru_ekle(&kurulum.bin)?;
    let yol = kurulum.bin.join("obs.dll");
    let kitaplik = unsafe { libloading::Library::new(&yol) }.map_err(|e| format!("obs.dll yüklenemedi: {e}"))?;
    let yuklenen = unsafe { Api::baglan(kitaplik)? };
    let surum = unsafe { cstr((yuklenen.obs_get_version_string)()) };
    let ana: u32 = surum.split('.').next().and_then(|s| s.parse().ok()).unwrap_or(0);
    if ana != DESTEKLENEN_ANA_SURUM {
      return Err(format!(
        "libobs {surum} desteklenmiyor (yapı düzenleri {DESTEKLENEN_ANA_SURUM}.x için doğrulandı)"
      ));
    }
    let _ = API.set(yuklenen);
    Ok(api())
  }
}

#[cfg(windows)]
pub fn dll_klasoru_ekle(klasor: &Path) -> Result<(), String> {
  use std::os::windows::ffi::OsStrExt;
  #[link(name = "kernel32")]
  extern "system" {
    fn SetDllDirectoryW(path: *const u16) -> i32;
    fn AddDllDirectory(path: *const u16) -> Ptr;
  }
  let genis: Vec<u16> = klasor.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
  if unsafe { SetDllDirectoryW(genis.as_ptr()) } == 0 {
    return Err("DLL arama yolu ayarlanamadı".into());
  }
  // libobs modülleri LoadLibraryExW(LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS) ile açar;
  // bu bayraklarla SetDllDirectory yok sayılır. OBS'te "uygulama klasörü" bin\64bit'tir (Qt, FFmpeg…); bizde exe
  // başka yerde durduğu için aynı klasör AddDllDirectory ile varsayılan arama dizinlerine eklenir.
  if unsafe { AddDllDirectory(genis.as_ptr()) }.is_null() {
    return Err("DLL arama dizini eklenemedi".into());
  }
  Ok(())
}

#[cfg(not(windows))]
pub fn dll_klasoru_ekle(_klasor: &Path) -> Result<(), String> {
  Err("yalnız Windows destekleniyor".into())
}

/// Süreçteki devralınabilir **soket** tanıtıcılarını devralınamaz yapar; kaç tanesinin değiştiğini döndürür.
///
/// Neden: OBS'in librtmp'si soketi `socket()` ile açar (Windows'ta varsayılan devralınabilir). Kayıt çıktısı
/// (`ffmpeg_muxer`) `obs-ffmpeg-mux.exe` alt sürecini devralmalı tanıtıcılarla başlatır; alt süreç o anda açık RTMP
/// soketlerinin kopyasını alır. Sonra bir hedef durdurulduğunda `closesocket` bağlantıyı kapatamaz — alıcı taraf
/// bağlantıyı açık görür (sınamada ölçüldü: B durduktan 1 sn sonra ESTABLISHED; kayıt yokken 0). Gerçek platformda bu,
/// durdurulan hedefin bağlantısının kayıt bitene kadar açık kalması demektir.
///
/// Yöntem: tanıtıcı değerleri taranır; yalnız geçerli + devralınabilir olanlar `getsockopt(SO_TYPE)` ile sınanır ve
/// soket olanların devralma bayrağı kaldırılır. Boru/dosya tanıtıcılarına dokunulmaz (alt süreç boruları etkilenmez).
#[cfg(windows)]
pub fn soketleri_devralinamaz_yap() -> usize {
  #[link(name = "kernel32")]
  extern "system" {
    fn GetHandleInformation(h: isize, flags: *mut u32) -> i32;
    fn SetHandleInformation(h: isize, mask: u32, flags: u32) -> i32;
  }
  #[link(name = "ws2_32")]
  extern "system" {
    fn getsockopt(s: usize, level: i32, optname: i32, optval: *mut c_char, optlen: *mut i32) -> i32;
  }
  const HANDLE_FLAG_INHERIT: u32 = 1;
  const SOL_SOCKET: i32 = 0xffff;
  const SO_TYPE: i32 = 0x1008;
  let mut degisen = 0;
  for h in (4..=0x10_0000usize).step_by(4) {
    let mut bayrak = 0u32;
    if unsafe { GetHandleInformation(h as isize, &mut bayrak) } == 0 || bayrak & HANDLE_FLAG_INHERIT == 0 {
      continue;
    }
    let mut tur: i32 = 0;
    let mut uzunluk: i32 = std::mem::size_of::<i32>() as i32;
    let soket = unsafe { getsockopt(h, SOL_SOCKET, SO_TYPE, &mut tur as *mut i32 as *mut c_char, &mut uzunluk) } == 0;
    if soket && unsafe { SetHandleInformation(h as isize, HANDLE_FLAG_INHERIT, 0) } != 0 {
      degisen += 1;
    }
  }
  degisen
}

#[cfg(not(windows))]
pub fn soketleri_devralinamaz_yap() -> usize {
  0
}

/// C dizesini (NULL olabilir) Rust dizesine çevirir.
///
/// # Safety
/// `p` NULL ya da geçerli, NUL sonlu bir dize olmalı.
pub unsafe fn cstr(p: *const c_char) -> String {
  if p.is_null() {
    String::new()
  } else {
    CStr::from_ptr(p).to_string_lossy().into_owned()
  }
}

/// Rust dizesini C dizesine çevirir (iç NUL karakterleri atılır — libobs'a bozuk dize gitmez).
pub fn cs(s: &str) -> CString {
  CString::new(s.replace('\0', "")).expect("NUL temizlendi")
}

/// `obs_data_t` sahipli sarmalayıcı.
pub struct Veri(pub Ptr);

impl Veri {
  pub fn yeni() -> Self {
    Veri(unsafe { (api().obs_data_create)() })
  }
  pub fn yazi(self, ad: &str, deger: &str) -> Self {
    unsafe { (api().obs_data_set_string)(self.0, cs(ad).as_ptr(), cs(deger).as_ptr()) };
    self
  }
  pub fn tamsayi(self, ad: &str, deger: i64) -> Self {
    unsafe { (api().obs_data_set_int)(self.0, cs(ad).as_ptr(), deger) };
    self
  }
  pub fn mantiksal(self, ad: &str, deger: bool) -> Self {
    unsafe { (api().obs_data_set_bool)(self.0, cs(ad).as_ptr(), deger) };
    self
  }
  pub fn ondalik(self, ad: &str, deger: f64) -> Self {
    unsafe { (api().obs_data_set_double)(self.0, cs(ad).as_ptr(), deger) };
    self
  }
  /// JSON nesnesindeki basit alanları ekler (dize, sayı, mantıksal). İç içe nesneler yok sayılır.
  pub fn json(mut self, nesne: &serde_json::Map<String, serde_json::Value>) -> Self {
    for (ad, deger) in nesne {
      self = match deger {
        serde_json::Value::String(s) => self.yazi(ad, s),
        serde_json::Value::Bool(b) => self.mantiksal(ad, *b),
        serde_json::Value::Number(n) if n.is_i64() => self.tamsayi(ad, n.as_i64().unwrap_or(0)),
        serde_json::Value::Number(n) => self.ondalik(ad, n.as_f64().unwrap_or(0.0)),
        _ => self,
      };
    }
    self
  }
}

impl Drop for Veri {
  fn drop(&mut self) {
    if !self.0.is_null() {
      unsafe { (api().obs_data_release)(self.0) };
    }
  }
}

/// Sinyal verisinden tamsayı (`long long`) okur.
///
/// # Safety
/// `cd` libobs'un geri çağrıya verdiği geçerli çağrı verisi olmalı.
pub unsafe fn calldata_int(cd: *mut Calldata, ad: &str) -> Option<i64> {
  let mut deger: i64 = 0;
  let ad = cs(ad);
  (api().calldata_get_data)(cd, ad.as_ptr(), &mut deger as *mut i64 as Ptr, std::mem::size_of::<i64>()).then_some(deger)
}

// ─── Günlük ────────────────────────────────────────────────────────────────

extern "C" {
  /// UCRT biçimlendiricisi (`vsnprintf` satır içi tanımının hedefi).
  fn __stdio_common_vsprintf(options: u64, buffer: *mut c_char, count: usize, format: *const c_char, locale: Ptr, args: Ptr)
    -> c_int;
}

static GUNLUK: OnceLock<std::sync::Mutex<Box<dyn std::io::Write + Send>>> = OnceLock::new();

/// libobs günlüğünü dosyaya yönlendirir. Varsayılan işleyici stdout'a yazar; stdout protokol kanalı olduğu için
/// bu çağrı `obs_startup`'tan ÖNCE yapılmalıdır.
pub fn gunlugu_yonlendir(api: &Api, hedef: Box<dyn std::io::Write + Send>) {
  let _ = GUNLUK.set(std::sync::Mutex::new(hedef));
  unsafe { (api.base_set_log_handler)(gunluk_isleyici, std::ptr::null_mut()) };
}

/// libobs'a verilecek dosya yolu: libobs modül adını yalnız `/` ile ayırır (`obs_open_module` → `get_module_name`);
/// `\` içeren yol verilirse modül adı tam yol olur ve `obs_module_config_path` ile ada göre arama bozulur.
pub fn obs_yolu(yol: &str) -> String {
  yol.replace('\\', "/")
}

/// Günlüğe doğrudan satır yazar (çökme kaydı için: kilit alınamıyorsa beklemeden vazgeçer).
pub fn gunluge_yaz(satir: &str) {
  if let Some(g) = GUNLUK.get() {
    if let Ok(mut w) = g.try_lock() {
      let _ = writeln!(w, "{satir}");
      let _ = w.flush();
    }
  }
}

unsafe extern "C" fn gunluk_isleyici(duzey: c_int, bicim: *const c_char, args: Ptr, _p: Ptr) {
  let mut tampon = [0 as c_char; 4096];
  // _CRT_INTERNAL_PRINTF_STANDARD_SNPRINTF_BEHAVIOR = 2
  let n = __stdio_common_vsprintf(2, tampon.as_mut_ptr(), tampon.len(), bicim, std::ptr::null_mut(), args);
  if n < 0 {
    return;
  }
  let metin = CStr::from_ptr(tampon.as_ptr()).to_string_lossy();
  let etiket = match duzey {
    ..=100 => "HATA",
    101..=200 => "UYARI",
    201..=300 => "bilgi",
    _ => "ayrıntı",
  };
  if duzey > 300 {
    return; // hata ayıklama düzeyi gürültüsü
  }
  if let Some(g) = GUNLUK.get() {
    if let Ok(mut w) = g.lock() {
      let _ = writeln!(w, "[{etiket}] {}", gizle(&metin));
      let _ = w.flush();
    }
  }
}

use std::io::Write as _;

/// Günlük satırlarında yayın anahtarı olabilecek adres parçalarını maskeler (libobs bazı hatalarda tam adresi yazar).
pub fn gizle(metin: &str) -> String {
  let mut out = String::with_capacity(metin.len());
  for (i, parca) in metin.split("rtmp").enumerate() {
    if i == 0 {
      out.push_str(parca);
      continue;
    }
    out.push_str("rtmp");
    // "…://sunucu/uygulama/ANAHTAR" → son yol parçası maskelenir
    let bitis = parca.find(|c: char| c.is_whitespace() || c == '"' || c == '\'').unwrap_or(parca.len());
    let (adres, kalan) = parca.split_at(bitis);
    match adres.rfind('/') {
      Some(p) if adres[..p].matches('/').count() >= 3 => {
        out.push_str(&adres[..=p]);
        out.push_str("***");
      }
      _ => out.push_str(adres),
    }
    out.push_str(kalan);
  }
  out
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn yapi_boyutlari_basliklarla_uyumlu() {
    // obs_video_info: gösterici(8) + 6×u32 + enum + u32 + bool(+3 dolgu) + 3×enum = 8+24+4+4+4+12 = 56
    assert_eq!(std::mem::size_of::<VideoInfo>(), 56);
    assert_eq!(std::mem::size_of::<AudioInfo>(), 8);
    assert_eq!(std::mem::size_of::<Vec2>(), 8);
    // obs_service_info: 1 kimlik + 25 fonksiyon göstericisi + type_data = 27 × 8
    assert_eq!(std::mem::size_of::<ServiceInfo>(), 27 * 8);
    assert_eq!(std::mem::size_of::<Calldata>(), 32);
    // obs_mouse_event: 3 × 32 bit; obs_key_event: u32 (+4 dolgu) + gösterici + 3 × u32 (+4 dolgu)
    assert_eq!(std::mem::size_of::<FareOlayi>(), 12);
    assert_eq!(std::mem::size_of::<TusOlayi>(), 32);
    assert_eq!(std::mem::offset_of!(TusOlayi, text), 8);
    assert_eq!(std::mem::offset_of!(TusOlayi, native_vkey), 24);
  }

  #[test]
  fn gunlukte_anahtar_maskelenir() {
    let m = gizle("bağlanılıyor: rtmp://127.0.0.1:1935/live/GIZLI_ANAHTAR sonra");
    assert!(!m.contains("GIZLI_ANAHTAR"), "{m}");
    assert!(m.contains("rtmp://127.0.0.1:1935/live/***"));
    // Anahtarsız sunucu adresi olduğu gibi kalır
    assert_eq!(gizle("sunucu rtmps://live.twitch.tv:443/app"), "sunucu rtmps://live.twitch.tv:443/app");
    assert_eq!(gizle("rtmp çıkışı başladı"), "rtmp çıkışı başladı");
  }

  #[test]
  fn obs_yolu_ters_bolu_donusturur() {
    let yol = r"C:\Program Files\obs-studio\obs-plugins\64bit\obs-browser.dll";
    assert_eq!(obs_yolu(yol), "C:/Program Files/obs-studio/obs-plugins/64bit/obs-browser.dll");
  }
}
