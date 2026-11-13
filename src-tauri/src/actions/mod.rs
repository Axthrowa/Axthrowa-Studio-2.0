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
  /// OBS kaynağındaki filtrenin adı
  Filter,
  /// OBS'teki adlandırılmış sahne geçişi
  Transition,
  /// Serbest metin (ör. altyazı satırı)
  Text,
  /// Yüzde (0…100), ör. müzik sesi
  Percent,
  /// İsteğe bağlı çalma listesi adı (boş = "AxthrowA Yayın")
  Playlist,
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
  AxBot,
  /// Spotify ya da YouTube Music Desktop bağlı olmalı
  Music,
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
const FILTRE: &[ParamSpec] = &[ParamSpec { name: "source", kind: ParamKind::Source }, ParamSpec { name: "filter", kind: ParamKind::Filter }];

/// Basılı tutma eylemleri: kısayol bırakılınca da çağrılır (`durum: "released"`)
pub const BASILI_EYLEMLER: [&str; 3] = ["audio.pushToTalk", "audio.pushToMute", "voice.pushToTalk"];

pub const ACTIONS: &[ActionSpec] = &[
  ActionSpec { id: "scene.switch", label: "Sahneye geç", category: "scene", perm: "scene.switch", confirm: false, requires: Requires::Obs, params: SAHNE },
  ActionSpec { id: "audio.mute", label: "Sustur", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.unmute", label: "Sesi aç", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.toggle", label: "Sustur / aç", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.volume", label: "Ses seviyesini değiştir", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: SEVIYE },
  ActionSpec { id: "source.show", label: "Kaynağı göster", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "source.hide", label: "Kaynağı gizle", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "source.toggle", label: "Kaynağı göster / gizle", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "source.lock", label: "Kaynağı kilitle", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "source.unlock", label: "Kaynağın kilidini aç", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: KAYNAK },
  ActionSpec { id: "record.start", label: "Kaydı başlat", category: "recording", perm: "broadcast.record", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "record.stop", label: "Kaydı durdur", category: "recording", perm: "broadcast.record", confirm: true, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "replay.save", label: "Tekrarı kaydet", category: "replay", perm: "broadcast.replay", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "stream.start", label: "OBS yayınını başlat", category: "stream", perm: "broadcast.stream", confirm: true, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "stream.stop", label: "OBS yayınını durdur", category: "stream", perm: "broadcast.stream", confirm: true, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "destination.start", label: "Hedefi başlat", category: "outputs", perm: "broadcast.outputs", confirm: false, requires: Requires::Multistream, params: HEDEF },
  ActionSpec { id: "destination.stop", label: "Hedefi durdur", category: "outputs", perm: "broadcast.outputs", confirm: true, requires: Requires::Multistream, params: HEDEF },
  ActionSpec { id: "destination.reconnect", label: "Hedefi yeniden bağla", category: "outputs", perm: "broadcast.outputs", confirm: true, requires: Requires::Multistream, params: HEDEF },
  ActionSpec { id: "destinations.stopAll", label: "Tüm hedefleri bitir", category: "outputs", perm: "broadcast.outputs", confirm: true, requires: Requires::Multistream, params: &[] },
  ActionSpec { id: "record.pause", label: "Kaydı duraklat", category: "recording", perm: "broadcast.record", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "record.resume", label: "Kaydı sürdür", category: "recording", perm: "broadcast.record", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "record.togglePause", label: "Kaydı duraklat / sürdür", category: "recording", perm: "broadcast.record", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "record.split", label: "Kayıt dosyasını böl", category: "recording", perm: "broadcast.record", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "virtualcam.start", label: "Sanal kamerayı başlat", category: "outputs", perm: "broadcast.outputs", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "virtualcam.stop", label: "Sanal kamerayı durdur", category: "outputs", perm: "broadcast.outputs", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "virtualcam.toggle", label: "Sanal kamerayı aç / kapat", category: "outputs", perm: "broadcast.outputs", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "filter.enable", label: "Filtreyi aç", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: FILTRE },
  ActionSpec { id: "filter.disable", label: "Filtreyi kapat", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: FILTRE },
  ActionSpec { id: "filter.toggle", label: "Filtreyi aç / kapat", category: "scene", perm: "scene.edit", confirm: false, requires: Requires::Obs, params: FILTRE },
  ActionSpec { id: "studio.transition", label: "Studio Mode geçişi (önizleme → program)", category: "scene", perm: "scene.switch", confirm: false, requires: Requires::Obs, params: &[] },
  ActionSpec { id: "studio.quickTransition", label: "Hızlı geçiş (Studio Mode, adlandırılmış geçişle)", category: "scene", perm: "scene.switch", confirm: false, requires: Requires::Obs, params: &[ParamSpec { name: "transition", kind: ParamKind::Transition }] },
  ActionSpec { id: "caption.send", label: "Altyazı gönder (CEA-608, yayına)", category: "stream", perm: "broadcast.stream", confirm: false, requires: Requires::Obs, params: &[ParamSpec { name: "text", kind: ParamKind::Text }] },
  ActionSpec { id: "audio.pushToTalk", label: "Bas-konuş (basılıyken ses açık)", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "audio.pushToMute", label: "Bas-sustur (basılıyken ses kapalı)", category: "audio", perm: "audio.control", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "media.restart", label: "Medyayı baştan oynat", category: "scene", perm: "scene.switch", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "media.playPause", label: "Medyayı oynat / duraklat", category: "scene", perm: "scene.switch", confirm: false, requires: Requires::Obs, params: GIRIS },
  ActionSpec { id: "voice.pushToTalk", label: "Sesli komut: bas-konuş (basılıyken dinler)", category: "voice", perm: "voice.control", confirm: false, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "alert.pause", label: "Uyarıları duraklat", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "alert.resume", label: "Uyarıları sürdür", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "alert.skip", label: "Uyarıyı atla", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "alert.mute", label: "Uyarı sesini kapat", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "alert.unmute", label: "Uyarı sesini aç", category: "alerts", perm: "alerts.control", confirm: false, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "alert.clear", label: "Bekleyen uyarıları temizle", category: "alerts", perm: "alerts.control", confirm: true, requires: Requires::AxBot, params: &[] },
  ActionSpec { id: "music.playPause", label: "Müziği oynat / duraklat", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[] },
  ActionSpec { id: "music.next", label: "Sonraki şarkı", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[] },
  ActionSpec { id: "music.previous", label: "Önceki şarkı", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[] },
  ActionSpec { id: "music.volume", label: "Müzik sesini ayarla", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[ParamSpec { name: "percent", kind: ParamKind::Percent }] },
  ActionSpec { id: "music.shuffle", label: "Karıştırmayı aç / kapat", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[] },
  ActionSpec { id: "music.repeat", label: "Tekrar kipini değiştir (kapalı → liste → şarkı)", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[] },
  ActionSpec { id: "music.like", label: "Çalan şarkıyı beğen (Spotify)", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[] },
  ActionSpec { id: "music.playlistAdd", label: "Çalan şarkıyı listeye ekle (Spotify)", category: "music", perm: "music.control", confirm: false, requires: Requires::Music, params: &[ParamSpec { name: "playlist", kind: ParamKind::Playlist }] },
];

pub fn find(id: &str) -> Option<&'static ActionSpec> {
  let id = eski_kimlik(id).unwrap_or(id);
  ACTIONS.iter().find(|a| a.id == id)
}

/// Eski yerel yayın motoru eylemleri (`engine.*`) artık OBS'te aynı işi yapan eyleme gider; kayıtlı deste
/// düğmeleri ve kısayollar bozulmasın.
fn eski_kimlik(id: &str) -> Option<&'static str> {
  Some(match id {
    "engine.goLive" => "stream.start",
    "engine.stopAll" => "stream.stop",
    "engine.record.start" => "record.start",
    "engine.record.stop" => "record.stop",
    "engine.replay.save" => "replay.save",
    "engine.record.pause" => "record.pause",
    "engine.record.resume" => "record.resume",
    "engine.record.togglePause" => "record.togglePause",
    "engine.record.split" => "record.split",
    "engine.virtualcam.start" => "virtualcam.start",
    "engine.virtualcam.stop" => "virtualcam.stop",
    "engine.virtualcam.toggle" => "virtualcam.toggle",
    "engine.filter.enable" => "filter.enable",
    "engine.filter.disable" => "filter.disable",
    "engine.filter.toggle" => "filter.toggle",
    "engine.source.show" => "source.show",
    "engine.source.hide" => "source.hide",
    "engine.source.toggle" => "source.toggle",
    "engine.scene.switch" => "scene.switch",
    "engine.studio.transition" => "studio.transition",
    "engine.studio.quickTransition" => "studio.quickTransition",
    "engine.caption.send" => "caption.send",
    "engine.audio.mute" => "audio.mute",
    "engine.audio.unmute" => "audio.unmute",
    "engine.audio.toggle" => "audio.toggle",
    "engine.audio.pushToTalk" => "audio.pushToTalk",
    "engine.audio.pushToMute" => "audio.pushToMute",
    "engine.media.restart" => "media.restart",
    "engine.media.playPause" => "media.playPause",
    _ => return None,
  })
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
  /// K5: katman kilidi; `scene` boşsa geçerli sahne
  SourceLock { scene: Option<String>, source: String, locked: bool },
  AudioVolume { input: String, delta_db: f64 },
  /// `Some(true)` duraklat, `Some(false)` sürdür, `None` değiştir
  RecordPause { pause: Option<bool> },
  RecordSplit,
  /// `Some(true)` başlat, `Some(false)` durdur, `None` değiştir
  VirtualCam { on: Option<bool> },
  /// `acik`: `None` = değiştir
  Filter { source: String, filter: String, acik: Option<bool> },
  /// `transition`: verilirse önce o geçiş seçilir (hızlı geçiş)
  StudioTransition { transition: Option<String> },
  Caption { text: String },
  /// Bas-konuş (`konus`) / bas-sustur; `basili`: tuş basıldı mı bırakıldı mı
  Hold { input: String, konus: bool, basili: bool },
  /// `eylem`: `yeniden` | `degistir`
  Media { input: String, eylem: &'static str },
  /// AxBoT uyarı kuyruğu denetimine iletilecek eylem adı
  Alert { action: &'static str },
  /// AxBoT sesli komut dinleyicisinin bas-konuş tuşu (panel gizli dinleyici çerçevesine iletir)
  SesliBasKonus { basili: bool },
  /// Müzik oynatıcı komutu (`music::MusicHost::command` sözleşmesi); `liste` yalnız playlistAdd'de
  Muzik { komut: String, liste: Option<String> },
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
/// Yüzde: 0…100 tamsayı; sayı ya da sayı metni.
fn yuzde(params: &Value) -> Result<u8, String> {
  let v = params
    .get("percent")
    .and_then(|v| v.as_f64().or_else(|| v.as_str().and_then(|s| s.trim().parse::<f64>().ok())))
    .ok_or("'percent' gerekli (0…100)")?;
  if !v.is_finite() || !(0.0..=100.0).contains(&v) {
    return Err("'percent' 0…100 arasında olmalı".into());
  }
  Ok(v.round() as u8)
}

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
  // Eski `engine.*` ses/medya eylemleri girişi `source` adıyla taşırdı
  let giris = || metin(params, "input").or_else(|e| metin(params, "source").map_err(|_| e));
  Ok(match spec.id {
    "scene.switch" => Action::SceneSwitch { scene: metin(params, "scene")? },
    "audio.mute" => Action::AudioMute { input: giris()?, muted: Some(true) },
    "audio.unmute" => Action::AudioMute { input: giris()?, muted: Some(false) },
    "audio.toggle" => Action::AudioMute { input: giris()?, muted: None },
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
    "source.lock" | "source.unlock" => Action::SourceLock {
      scene: istege_bagli(params, "scene")?,
      source: metin(params, "source")?,
      locked: spec.id == "source.lock",
    },
    "record.pause" => Action::RecordPause { pause: Some(true) },
    "record.resume" => Action::RecordPause { pause: Some(false) },
    "record.togglePause" => Action::RecordPause { pause: None },
    "record.split" => Action::RecordSplit,
    "virtualcam.start" => Action::VirtualCam { on: Some(true) },
    "virtualcam.stop" => Action::VirtualCam { on: Some(false) },
    "virtualcam.toggle" => Action::VirtualCam { on: None },
    "filter.enable" | "filter.disable" | "filter.toggle" => Action::Filter {
      source: metin(params, "source")?,
      filter: metin(params, "filter")?,
      acik: match spec.id {
        "filter.enable" => Some(true),
        "filter.disable" => Some(false),
        _ => None,
      },
    },
    "studio.transition" => Action::StudioTransition { transition: None },
    "studio.quickTransition" => Action::StudioTransition { transition: Some(metin(params, "transition")?) },
    "caption.send" => Action::Caption { text: metin(params, "text")? },
    "audio.pushToTalk" | "audio.pushToMute" => Action::Hold {
      input: giris()?,
      konus: spec.id == "audio.pushToTalk",
      basili: params.get("durum").and_then(|v| v.as_str()) != Some("released"),
    },
    "voice.pushToTalk" => Action::SesliBasKonus { basili: params.get("durum").and_then(|v| v.as_str()) != Some("released") },
    "media.restart" => Action::Media { input: giris()?, eylem: "yeniden" },
    "media.playPause" => Action::Media { input: giris()?, eylem: "degistir" },
    "alert.pause" => Action::Alert { action: "pause" },
    "alert.resume" => Action::Alert { action: "resume" },
    "alert.skip" => Action::Alert { action: "skip" },
    "alert.mute" => Action::Alert { action: "mute" },
    "alert.unmute" => Action::Alert { action: "unmute" },
    "alert.clear" => Action::Alert { action: "clear" },
    "music.playPause" | "music.next" | "music.previous" | "music.shuffle" | "music.repeat" | "music.like" => {
      Action::Muzik { komut: spec.id.trim_start_matches("music.").into(), liste: None }
    }
    "music.volume" => Action::Muzik { komut: format!("volume:{}", yuzde(params)?), liste: None },
    "music.playlistAdd" => Action::Muzik { komut: "playlistAdd".into(), liste: istege_bagli(params, "playlist")? },
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
      Some(Value::Number(n)) if matches!(p.kind, ParamKind::Db | ParamKind::Percent) => {
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
      let ornek = json!({"scene": "Oyun", "input": "Mikrofon", "id": "hedef-1", "source": "Kamera", "delta": -3, "filter": "Renk", "transition": "Kes", "text": "Merhaba", "percent": 40});
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
    ] {
      assert!(find(id).unwrap().confirm, "{id} onay istemeli");
    }
    for id in ["scene.switch", "audio.toggle", "replay.save", "alert.pause", "source.toggle", "audio.volume", "record.togglePause", "virtualcam.toggle"] {
      assert!(!find(id).unwrap().confirm, "{id} tek dokunuş olmalı");
    }
  }

  #[test]
  fn sesli_bas_konus_basilir_ve_birakilir() {
    assert!(BASILI_EYLEMLER.contains(&"voice.pushToTalk"));
    assert_eq!(parse("voice.pushToTalk", &json!({})).unwrap(), Action::SesliBasKonus { basili: true });
    assert_eq!(parse("voice.pushToTalk", &json!({"durum": "released"})).unwrap(), Action::SesliBasKonus { basili: false });
    assert!(!find("voice.pushToTalk").unwrap().confirm);
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
    assert!(parse("filter.toggle", &json!({"source": "a\nb", "filter": "Renk"})).is_err());
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
      parse("source.lock", &json!({"source": "Kamera"})).unwrap(),
      Action::SourceLock { scene: None, source: "Kamera".into(), locked: true }
    );
    assert_eq!(
      parse("source.unlock", &json!({"scene": "Oyun", "source": "Kamera"})).unwrap(),
      Action::SourceLock { scene: Some("Oyun".into()), source: "Kamera".into(), locked: false }
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
  fn basili_ve_studio_eylemleri() {
    assert_eq!(
      parse("audio.pushToTalk", &json!({"input": "Mikrofon"})).unwrap(),
      Action::Hold { input: "Mikrofon".into(), konus: true, basili: true }
    );
    assert_eq!(
      parse("audio.pushToMute", &json!({"input": "Mikrofon", "durum": "released"})).unwrap(),
      Action::Hold { input: "Mikrofon".into(), konus: false, basili: false }
    );
    assert_eq!(parse("studio.transition", &json!({})).unwrap(), Action::StudioTransition { transition: None });
    assert!(parse("studio.quickTransition", &json!({})).is_err());
    assert!(BASILI_EYLEMLER.iter().all(|id| find(id).is_some()));
  }

  #[test]
  fn muzik_eylemleri() {
    assert_eq!(parse("music.next", &json!({})).unwrap(), Action::Muzik { komut: "next".into(), liste: None });
    assert_eq!(parse("music.volume", &json!({"percent": "35"})).unwrap(), Action::Muzik { komut: "volume:35".into(), liste: None });
    assert_eq!(parse("music.volume", &json!({"percent": 0})).unwrap(), Action::Muzik { komut: "volume:0".into(), liste: None });
    for kotu in [json!(101), json!(-1), json!("çok"), json!(null)] {
      assert!(parse("music.volume", &json!({"percent": kotu})).is_err(), "{kotu}");
    }
    assert_eq!(parse("music.playlistAdd", &json!({"playlist": "  "})).unwrap(), Action::Muzik { komut: "playlistAdd".into(), liste: None });
    assert_eq!(
      parse("music.playlistAdd", &json!({"playlist": " Gece "})).unwrap(),
      Action::Muzik { komut: "playlistAdd".into(), liste: Some("Gece".into()) }
    );
    assert!(parse("music.playlistAdd", &json!({"playlist": "a\u{0007}b"})).is_err());
    assert!(ACTIONS.iter().filter(|a| a.category == "music").all(|a| a.requires == Requires::Music && !a.confirm));
  }

  #[test]
  fn eski_motor_eylemleri_obs_eylemine_gider() {
    assert_eq!(find("engine.record.togglePause").unwrap().id, "record.togglePause");
    assert_eq!(find("engine.goLive").unwrap().id, "stream.start");
    assert!(find("engine.goLive").unwrap().confirm);
    // Eski ses eylemleri girişi `source` alanında taşırdı
    assert_eq!(
      parse("engine.audio.toggle", &json!({"source": "Mikrofon"})).unwrap(),
      Action::AudioMute { input: "Mikrofon".into(), muted: None }
    );
    assert_eq!(
      parse("engine.media.restart", &json!({"source": "Klip"})).unwrap(),
      Action::Media { input: "Klip".into(), eylem: "yeniden" }
    );
    assert!(find("engine.yok").is_none());
  }
}
