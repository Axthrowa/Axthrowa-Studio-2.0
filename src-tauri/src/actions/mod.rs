//! Eylem kayıt defteri — "tek eylem, çok denetleyici".
//!
//! Kontrol Merkezi, kısayollar, ileride Stream Deck / uzak / otomasyon aynı eylemi aynı kimlikle çağırır; her çağrı
//! tek yoldan geçer: tanım → parametre doğrulama → izin (`control_plane::authorize`) → onay → yürütme → denetim
//! günlüğü. Bu modül saftır (Tauri/HTTP yok); yürütme `server/actions_api.rs`'te.

use serde::Serialize;
use serde_json::Value;

/// Eylemin ne istediği (arayüz formu ve doğrulama için).
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ParamKind {
  /// OBS sahne adı (ana tuval)
  Scene,
  /// OBS ses girişi adı
  Input,
  /// Çoklu yayın hedef kimliği
  Destination,
  /// OBS sahnesindeki kaynak adı
  Source,
  /// İsteğe bağlı OBS sahne adı (boş = yayındaki sahne)
  OptionalScene,
  /// Ses seviyesi farkı, dB (−30…+30, sıfır olamaz)
  Db,
  /// Yerel yayın çekirdeğindeki kaynak (ad ya da kimlik)
  EngineSource,
  /// Yerel yayın çekirdeğindeki sahne (ad ya da kimlik)
  EngineScene,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParamSpec {
  pub name: &'static str,
  pub kind: ParamKind,
}

/// Eylemin yürütülmesi için gereken dış bileşen (kullanılabilirlik denetimi).
#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Requires {
  Obs,
  Multistream,
  StreamAxt,
  /// Yerel yayın çekirdeği (motor) çalışıyor olmalı
  Motor,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionSpec {
  pub id: &'static str,
  pub label: &'static str,
  pub category: &'static str,
  /// Uzak kullanıcıda gereken izin (yerel yayıncı sahiptir)
  pub perm: &'static str,
  /// Yayını ya da kaydı kesen / başlatan eylemler açık onay ister (§87)
  pub confirm: bool,
  pub requires: Requires,
  pub params: &'static [ParamSpec],
}

const SAHNE: &[ParamSpec] = &[ParamSpec { name: "scene", kind: ParamKind::Scene }];
const GIRIS: &[ParamSpec] = &[ParamSpec { name: "input", kind: ParamKind::Input }];
const HEDEF: &[ParamSpec] = &[ParamSpec { name: "id", kind: ParamKind::Destination }];
const KAYNAK: &[ParamSpec] = &[
  ParamSpec { name: "scene", kind: ParamKind::OptionalScene },
  ParamSpec { name: "source", kind: ParamKind::Source },
];
const SEVIYE: &[ParamSpec] = &[ParamSpec { name: "input", kind: ParamKind::Input }, ParamSpec { name: "delta", kind: ParamKind::Db }];
const MOTOR_KAYNAK: &[ParamSpec] = &[ParamSpec { name: "source", kind: ParamKind::EngineSource }];
const MOTOR_SAHNE: &[ParamSpec] = &[ParamSpec { name: "scene", kind: ParamKind::EngineScene }];

/// Basılı tutma eylemleri: kısayol bırakılınca da çağrılır (`durum: "released"`)
pub const BASILI_EYLEMLER: [&str; 2] = ["engine.audio.pushToTalk", "engine.audio.pushToMute"];

pub const ACTIONS: &[ActionSpec] = &[
  ActionSpec { id: "scene.switch", label: "Sahneye geç", category: "scene", perm: "scene.switch", confirm: false, requires: Requires::Obs, params: SAHNE },
  ActionSpec { id: "audio.mute", label: "Sustur", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.unmute", label: "Sesi aç", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.toggle", label: "Sustur / aç", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.volume", label: "Ses seviyesini değiştir", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: SEVIYE },
  ActionSpec { id: "source.show", label: "Kaynağı göster", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "source.hide", label: "Kaynağı gizle", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "source.toggle", label: "Kaynağı göster / gizle", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "record.start", label: "Kaydı başlat", category: "recording", perm: "broadcast.record", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "record.stop", label: "Kaydı durdur", category: "recording", perm: "broadcast.record", confirm: true, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "replay.save", label: "Tekrarı kaydet", category: "replay", perm: "broadcast.replay", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "stream.start", label: "OBS yayınını başlat", category: "stream", perm: "broadcast.stream", confirm: true, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "stream.stop", label: "OBS yayınını durdur", category: "stream", perm: "broadcast.stream", confirm: true, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "destination.start", label: "Hedefi başlat", category: "outputs", perm: "broadcast.outputs", confirm: false, requires: Requires::Multistream, params: HEDEF },
  ActionSpec { id: "destination.stop", label: "Hedefi durdur", category: "outputs", perm: "broadcast.outputs", confirm: true, requires: Requires::Multistream, params: HEDEF },
  ActionSpec { id: "destination.reconnect", label: "Hedefi yeniden bağla", category: "outputs", perm: "broadcast.outputs", confirm: true, requires: Requires::Multistream, params: HEDEF },
  ActionSpec { id: "destinations.stopAll", label: "Tüm hedefleri bitir", category: "outputs", perm: "broadcast.outputs", confirm: true, requires: Requires::Multistream, params: &[] },
  ActionSpec { id: "engine.goLive", label: "Motor: tüm hedeflerde yayına geç", category: "engine", perm: "broadcast.stream", confirm: true, requires: Requires::Motor, params: &[] },
  ActionSpec { id: "engine.stopAll", label: "Motor: yayını bitir", category: "engine", perm: "broadcast.stream", confirm: true, requires: Requires::Motor, params: &[] },
  ActionSpec { id: "engine.record.start", label: "Motor: kaydı başlat", category: "engine", perm: "broadcast.record", confirm: false, requires: Requires::Motor, params: &[] },
  ActionSpec { id: "engine.record.stop", label: "Motor: kaydı durdur", category: "engine", perm: "broadcast.record", confirm: true, requires: Requires::Motor, params: &[] },
  ActionSpec { id: "engine.replay.save", label: "Motor: tekrarı kaydet", category: "engine", perm: "broadcast.replay", confirm: false, requires: Requires::Motor, params: &[] },
  ActionSpec { id: "engine.source.show", label: "Motor: kaynağı göster", category: "engine", perm: "scene.edit", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.source.hide", label: "Motor: kaynağı gizle", category: "engine", perm: "scene.edit", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.source.toggle", label: "Motor: kaynağı göster / gizle", category: "engine", perm: "scene.edit", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.scene.switch", label: "Motor: sahneye geç (Studio Mode'da önizlemeye)", category: "engine", perm: "scene.switch", confirm: false, requires: Requires::Motor, params: MOTOR_SAHNE },
  ActionSpec { id: "engine.studio.transition", label: "Motor: Studio Mode geçişi (önizleme → program)", category: "engine", perm: "scene.switch", confirm: false, requires: Requires::Motor, params: &[] },
  ActionSpec { id: "engine.audio.mute", label: "Motor: sesi kapat", category: "engine", perm: "audio.control", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.audio.unmute", label: "Motor: sesi aç", category: "engine", perm: "audio.control", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.audio.toggle", label: "Motor: sesi aç / kapat", category: "engine", perm: "audio.control", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.audio.pushToTalk", label: "Motor: bas-konuş (basılıyken ses açık)", category: "engine", perm: "audio.control", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.audio.pushToMute", label: "Motor: bas-sustur (basılıyken ses kapalı)", category: "engine", perm: "audio.control", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.media.restart", label: "Motor: medyayı baştan oynat", category: "engine", perm: "scene.switch", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "engine.media.playPause", label: "Motor: medyayı oynat / duraklat", category: "engine", perm: "scene.switch", confirm: false, requires: Requires::Motor, params: MOTOR_KAYNAK },
  ActionSpec { id: "alert.pause", label: "Uyarıları duraklat", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::StreamAxt, params: &[] },
  ActionSpec { id: "alert.resume", label: "Uyarıları sürdür", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::StreamAxt, params: &[] },
  ActionSpec { id: "alert.skip", label: "Uyarıyı atla", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::StreamAxt, params: &[] },
  ActionSpec { id: "alert.mute", label: "Uyarı sesini kapat", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::StreamAxt, params: &[] },
  ActionSpec { id: "alert.unmute", label: "Uyarı sesini aç", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::StreamAxt, params: &[] },
  ActionSpec { id: "alert.clear", label: "Bekleyen uyarıları temizle", category: "alerts", perm: "alerts.control", confirm: true, requires: Requires::StreamAxt, params: &[] },
];

pub fn find(id: &str) -> Option<&'static ActionSpec> {
  ACTIONS.iter().find(|a| a.id == id)
}

/// Doğrulanmış, yürütülmeye hazır eylem.
#[derive(Clone, Debug, PartialEq)]
pub enum Action {
  SceneSwitch { scene: String },
  /// `muted: None` = değiştir
  AudioMute { input: String, muted: Option<bool> },
  RecordStart,
  RecordStop,
  ReplaySave,
  StreamStart,
  StreamStop,
  DestinationStart { id: String },
  DestinationStop { id: String },
  DestinationReconnect { id: String },
  DestinationsStopAll,
  /// `mode`: show | hide | toggle (hotkeys::source_enabled_after sözleşmesi)
  SourceVisibility { scene: Option<String>, source: String, mode: &'static str },
  AudioVolume { input: String, delta_db: f64 },
  EngineGoLive,
  EngineStopAll,
  EngineRecord { start: bool },
  EngineReplaySave,
  EngineSourceVisibility { source: String, mode: &'static str },
  EngineSceneSwitch { scene: String },
  EngineStudioTransition,
  /// `muted: None` = değiştir
  EngineAudioMute { source: String, muted: Option<bool> },
  /// Bas-konuş (`konus`) / bas-sustur; `basili`: tuş basıldı mı bırakıldı mı
  EngineHold { source: String, konus: bool, basili: bool },
  EngineMedia { source: String, eylem: &'static str },
  /// StreamAxT uyarı kuyruğu denetimine iletilecek eylem adı
  Alert { action: &'static str },
}

const AD_SINIRI: usize = 256;

fn metin(params: &Value, ad: &str) -> Result<String, String> {
  let v = params
    .get(ad)
    .and_then(|v| v.as_str())
    .map(str::trim)
    .unwrap_or("");
  if v.is_empty() {
    return Err(format!("'{ad}' gerekli"));
  }
  if v.chars().count() > AD_SINIRI || v.chars().any(char::is_control) {
    return Err(format!("'{ad}' geçersiz"));
  }
  Ok(v.to_string())
}

fn istege_bagli(params: &Value, ad: &str) -> Result<Option<String>, String> {
  match params.get(ad).and_then(|v| v.as_str()).map(str::trim) {
    None | Some("") => Ok(None),
    Some(_) => metin(params, ad).map(Some),
  }
}

/// Ses seviyesi farkı: sonlu, sıfırdan farklı, en çok ±30 dB (tek basışta kulak zedeleyecek sıçrama olmasın).
/// Sayı ya da sayı metni kabul edilir (deste düğmeleri parametreleri metin olarak saklar; ondalık virgül olabilir).
fn db_farki(params: &Value) -> Result<f64, String> {
  let v = params
    .get("delta")
    .and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.trim().replace(',', ".").parse::<f64>().ok())))
    .ok_or("'delta' gerekli (dB)")?;
  if !v.is_finite() || v == 0.0 || v.abs() > 30.0 {
    return Err("'delta' −30…+30 dB arasında ve sıfırdan farklı olmalı".into());
  }
  Ok(v)
}

/// Kimlik + parametrelerden eylemi kurar. Bilinmeyen kimlik ya da eksik/geçersiz parametre hata döner — hiçbir
/// eylem yarım parametreyle yürütülmez.
pub fn parse(id: &str, params: &Value) -> Result<Action, String> {
  let spec = find(id).ok_or_else(|| format!("Bilinmeyen eylem: {id}"))?;
  let hedef = || -> Result<String, String> {
    let v = metin(params, "id")?;
    if !crate::multistream::config::is_valid_id(&v) {
      return Err("'id' geçersiz".into());
    }
    Ok(v)
  };
  Ok(match spec.id {
    "scene.switch" => Action::SceneSwitch { scene: metin(params, "scene")? },
    "audio.mute" => Action::AudioMute { input: metin(params, "input")?, muted: Some(true) },
    "audio.unmute" => Action::AudioMute { input: metin(params, "input")?, muted: Some(false) },
    "audio.toggle" => Action::AudioMute { input: metin(params, "input")?, muted: None },
    "record.start" => Action::RecordStart,
    "record.stop" => Action::RecordStop,
    "replay.save" => Action::ReplaySave,
    "stream.start" => Action::StreamStart,
    "stream.stop" => Action::StreamStop,
    "destination.start" => Action::DestinationStart { id: hedef()? },
    "destination.stop" => Action::DestinationStop { id: hedef()? },
    "destination.reconnect" => Action::DestinationReconnect { id: hedef()? },
    "destinations.stopAll" => Action::DestinationsStopAll,
    "audio.volume" => Action::AudioVolume { input: metin(params, "input")?, delta_db: db_farki(params)? },
    "source.show" | "source.hide" | "source.toggle" => Action::SourceVisibility {
      scene: istege_bagli(params, "scene")?,
      source: metin(params, "source")?,
      mode: gorunurluk_kipi(spec.id),
    },
    "engine.goLive" => Action::EngineGoLive,
    "engine.stopAll" => Action::EngineStopAll,
    "engine.record.start" => Action::EngineRecord { start: true },
    "engine.record.stop" => Action::EngineRecord { start: false },
    "engine.replay.save" => Action::EngineReplaySave,
    "engine.scene.switch" => Action::EngineSceneSwitch { scene: metin(params, "scene")? },
    "engine.studio.transition" => Action::EngineStudioTransition,
    "engine.audio.mute" => Action::EngineAudioMute { source: metin(params, "source")?, muted: Some(true) },
    "engine.audio.unmute" => Action::EngineAudioMute { source: metin(params, "source")?, muted: Some(false) },
    "engine.audio.toggle" => Action::EngineAudioMute { source: metin(params, "source")?, muted: None },
    "engine.audio.pushToTalk" | "engine.audio.pushToMute" => Action::EngineHold {
      source: metin(params, "source")?,
      konus: spec.id == "engine.audio.pushToTalk",
      basili: params.get("durum").and_then(|v| v.as_str()) != Some("released"),
    },
    "engine.media.restart" => Action::EngineMedia { source: metin(params, "source")?, eylem: "yeniden" },
    "engine.media.playPause" => Action::EngineMedia { source: metin(params, "source")?, eylem: "degistir" },
    "engine.source.show" | "engine.source.hide" | "engine.source.toggle" => {
      Action::EngineSourceVisibility { source: metin(params, "source")?, mode: gorunurluk_kipi(spec.id) }
    }
    "alert.pause" => Action::Alert { action: "pause" },
    "alert.resume" => Action::Alert { action: "resume" },
    "alert.skip" => Action::Alert { action: "skip" },
    "alert.mute" => Action::Alert { action: "mute" },
    "alert.unmute" => Action::Alert { action: "unmute" },
    "alert.clear" => Action::Alert { action: "clear" },
    other => return Err(format!("Eylem tanımlı ama yürütücüsü yok: {other}")),
  })
}

fn gorunurluk_kipi(id: &str) -> &'static str {
  if id.ends_with(".show") {
    "show"
  } else if id.ends_with(".hide") {
    "hide"
  } else {
    "toggle"
  }
}

/// Denetim günlüğüne yazılacak özet: yalnız tanımlı parametreler (sır taşıyabilecek başka alan yazılmaz).
pub fn audit_detail(spec: &ActionSpec, params: &Value) -> Value {
  let mut m = serde_json::Map::new();
  m.insert("id".into(), Value::String(spec.id.into()));
  for p in spec.params {
    match params.get(p.name) {
      Some(Value::String(v)) => {
        m.insert(p.name.into(), Value::String(v.chars().take(80).collect()));
      }
      Some(Value::Number(n)) if p.kind == ParamKind::Db => {
        m.insert(p.name.into(), Value::Number(n.clone()));
      }
      _ => {}
    }
  }
  Value::Object(m)
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn her_tanimli_eylemin_yurutucusu_var_ve_kimlikler_tekil() {
    let mut gorulen = std::collections::HashSet::new();
    for a in ACTIONS {
      assert!(gorulen.insert(a.id), "yinelenen kimlik: {}", a.id);
      let ornek = json!({"scene": "Oyun", "input": "Mikrofon", "id": "hedef-1", "source": "Kamera", "delta": -3});
      assert!(parse(a.id, &ornek).is_ok(), "yürütücüsüz eylem: {}", a.id);
      assert!(!a.perm.is_empty() && a.perm.contains('.'), "izin adı: {}", a.id);
    }
  }

  #[test]
  fn yayini_ya_da_kaydi_kesen_eylemler_onay_ister() {
    for id in [
      "stream.start",
      "stream.stop",
      "record.stop",
      "destination.stop",
      "destination.reconnect",
      "destinations.stopAll",
      "alert.clear",
      "engine.goLive",
      "engine.stopAll",
      "engine.record.stop",
    ] {
      assert!(find(id).unwrap().confirm, "{id} onay istemeli");
    }
    for id in ["scene.switch", "audio.toggle", "replay.save", "alert.pause", "source.toggle", "audio.volume", "engine.replay.save", "engine.source.toggle"] {
      assert!(!find(id).unwrap().confirm, "{id} tek dokunuş olmalı");
    }
  }

  #[test]
  fn eksik_ya_da_gecersiz_parametre_reddedilir() {
    assert!(parse("scene.switch", &json!({})).unwrap_err().contains("scene"));
    assert!(parse("scene.switch", &json!({"scene": "   "})).is_err());
    assert!(parse("scene.switch", &json!({"scene": "a\u{0007}b"})).is_err());
    assert!(parse("scene.switch", &json!({"scene": "x".repeat(300)})).is_err());
    assert!(parse("audio.mute", &json!({"input": 5})).is_err());
    assert!(parse("destination.stop", &json!({"id": "../etc"})).unwrap_err().contains("geçersiz"));
    assert!(parse("uydurma.eylem", &json!({})).unwrap_err().contains("Bilinmeyen"));
    assert!(parse("audio.volume", &json!({"input": "Müzik"})).unwrap_err().contains("delta"));
    for kotu in [json!(0), json!(31), json!(-45.5), json!("beş"), json!("NaN"), json!(true)] {
      assert!(parse("audio.volume", &json!({"input": "Müzik", "delta": kotu})).is_err(), "{kotu}");
    }
    assert!(parse("source.toggle", &json!({"scene": "Oyun"})).unwrap_err().contains("source"));
    assert!(parse("engine.source.hide", &json!({"source": "a\nb"})).is_err());
  }

  #[test]
  fn gorunurluk_ve_seviye_eylemleri() {
    assert_eq!(
      parse("source.hide", &json!({"scene": "  ", "source": "Kamera"})).unwrap(),
      Action::SourceVisibility { scene: None, source: "Kamera".into(), mode: "hide" }
    );
    assert_eq!(
      parse("source.toggle", &json!({"scene": "Oyun", "source": "Kamera"})).unwrap(),
      Action::SourceVisibility { scene: Some("Oyun".into()), source: "Kamera".into(), mode: "toggle" }
    );
    assert_eq!(
      parse("engine.source.show", &json!({"source": "Başlık"})).unwrap(),
      Action::EngineSourceVisibility { source: "Başlık".into(), mode: "show" }
    );
    assert_eq!(
      parse("audio.volume", &json!({"input": "Müzik", "delta": -3})).unwrap(),
      Action::AudioVolume { input: "Müzik".into(), delta_db: -3.0 }
    );
    assert_eq!(
      parse("audio.volume", &json!({"input": "Müzik", "delta": " -2,5 "})).unwrap(),
      Action::AudioVolume { input: "Müzik".into(), delta_db: -2.5 }
    );
    let d = audit_detail(find("audio.volume").unwrap(), &json!({"input": "Müzik", "delta": -3, "key": "x"}));
    assert_eq!(d, json!({"id": "audio.volume", "input": "Müzik", "delta": -3}));
  }

  #[test]
  fn parametreler_dogru_eyleme_donusur() {
    assert_eq!(parse("scene.switch", &json!({"scene": " Oyun "})).unwrap(), Action::SceneSwitch { scene: "Oyun".into() });
    assert_eq!(
      parse("audio.toggle", &json!({"input": "Mik"})).unwrap(),
      Action::AudioMute { input: "Mik".into(), muted: None }
    );
    assert_eq!(parse("alert.skip", &json!({})).unwrap(), Action::Alert { action: "skip" });
    assert_eq!(parse("destination.start", &json!({"id": "abc_1"})).unwrap(), Action::DestinationStart { id: "abc_1".into() });
  }

  #[test]
  fn denetim_ozeti_yalniz_tanimli_parametreleri_tasir() {
    let spec = find("scene.switch").unwrap();
    let d = audit_detail(spec, &json!({"scene": "Oyun", "password": "gizli", "token": "t"}));
    assert_eq!(d, json!({"id": "scene.switch", "scene": "Oyun"}));
  }

  #[test]
  fn motor_ses_ve_basili_eylemler() {
    assert_eq!(parse("engine.audio.toggle", &json!({"source": "Mikrofon"})).unwrap(), Action::EngineAudioMute { source: "Mikrofon".into(), muted: None });
    assert_eq!(
      parse("engine.audio.pushToTalk", &json!({"source": "Mikrofon"})).unwrap(),
      Action::EngineHold { source: "Mikrofon".into(), konus: true, basili: true }
    );
    assert_eq!(
      parse("engine.audio.pushToMute", &json!({"source": "Mikrofon", "durum": "released"})).unwrap(),
      Action::EngineHold { source: "Mikrofon".into(), konus: false, basili: false }
    );
    assert!(parse("engine.scene.switch", &json!({})).is_err());
    assert_eq!(parse("engine.studio.transition", &json!({})).unwrap(), Action::EngineStudioTransition);
    assert!(BASILI_EYLEMLER.iter().all(|id| find(id).is_some()));
  }

}
