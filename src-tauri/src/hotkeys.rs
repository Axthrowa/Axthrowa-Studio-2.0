//! Küresel kısayollar — pencere tepsideyken / gizliyken de çalışsın.
//!
//! Frontend kaydı WebView JS geri çağrısına bağlı; Windows WebView2 gizli
//! pencerede betiği dondurunca tetiklenmiyor. Bu yüzden OS kaydı ve OBS/müzik
//! eylemi burada, Rust tarafında yapılır.

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_global_shortcut::{
  Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

use obws::requests::inputs::InputId;

use crate::settings::ScreenKind;
use crate::AppState;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyBindingIn {
  pub id: String,
  pub spec: String,
  #[serde(default)]
  pub kind: String,
  #[serde(default)]
  pub scene: String,
  #[serde(default)]
  pub input: String,
  #[serde(default)]
  pub label: String,
  /// Kaynak adı — `srcToggle` (sahnedeki kaynak) ve `filter` (filtrenin sahibi).
  #[serde(default)]
  pub source: String,
  /// Filtre adı — `filter`.
  #[serde(default)]
  pub filter: String,
  /// Adlandırılmış geçiş — `studio.quickTransition`.
  #[serde(default)]
  pub transition: String,
  /// Serbest metin — `caption.send` (altyazı satırı).
  #[serde(default)]
  pub text: String,
  /// `record` için: toggle | start | stop | pause.
  #[serde(default)]
  pub mode: String,
  /// `volume` için dB farkı (+ artırır, − azaltır).
  #[serde(default)]
  pub delta: f64,
  /// `obsHotkey` için OBS kısayol adı (örn. "OBSBasic.StartReplayBuffer"); `action` için eylem kayıt defteri
  /// kimliği (örn. "destination.reconnect").
  #[serde(default)]
  pub name: String,
  /// `action` için çoklu yayın hedef kimliği.
  #[serde(default)]
  pub target: String,
  /// `action`: onay isteyen eylem (yayını başlatan/kesen) bu kısayolda onaysız çalışsın mı? Kullanıcı ayarda
  /// açıkça işaretlemezse böyle bir kısayol kaydedilmez.
  #[serde(default)]
  pub confirmed: bool,
}

/// Kayıt defteri eyleminin parametreleri — kısayol satırındaki alanlardan.
pub(crate) fn eylem_parametreleri(b: &HotkeyBindingIn) -> serde_json::Value {
  serde_json::json!({
    "scene": b.scene,
    "input": b.input,
    "source": b.source,
    "delta": b.delta,
    "id": b.target,
    "filter": b.filter,
    "transition": b.transition,
    "text": b.text,
  })
}

/// Basılı tutma eylemi mi (bas-konuş / bas-sustur): bırakma olayı da işlenir, tekrar-basış süzgeci uygulanmaz
pub(crate) fn basili_eylem(b: &HotkeyBindingIn) -> bool {
  b.kind == "action" && crate::actions::find(b.name.trim()).is_some_and(|a| crate::actions::BASILI_EYLEMLER.contains(&a.id))
}

/// `action` kısayolu kaydedilmeden önce: eylem var mı, parametreleri geçerli mi, onay gerekiyorsa verilmiş mi?
/// Her basışta hata vermek yerine sorun kayıt anında, satırın yanında görünür.
pub(crate) fn eylem_denetimi(b: &HotkeyBindingIn) -> Result<(), String> {
  let spec = crate::actions::find(b.name.trim()).ok_or_else(|| format!("bilinmeyen eylem: {}", b.name.trim()))?;
  if spec.confirm && !b.confirmed {
    return Err(format!("«{}» onay ister; kısayolda onaysız çalıştırma işaretli değil", spec.label));
  }
  crate::actions::parse(spec.id, &eylem_parametreleri(b)).map(|_| ())
}

struct LiveMap {
  /// HotKey id → binding
  by_id: HashMap<u32, HotkeyBindingIn>,
  registered: Vec<Shortcut>,
  last_fire: HashMap<u32, Instant>,
}

pub struct HotkeyHub {
  inner: RwLock<LiveMap>,
}

impl Default for HotkeyHub {
  fn default() -> Self {
    Self::new()
  }
}

impl HotkeyHub {
  pub fn new() -> Self {
    Self {
      inner: RwLock::new(LiveMap {
        by_id: HashMap::new(),
        registered: Vec::new(),
        last_fire: HashMap::new(),
      }),
    }
  }
}

/// `"Ctrl+F1"` / `"F4"` → Tauri `Shortcut`.
pub fn parse_shortcut(spec: &str) -> Option<Shortcut> {
  let parts: Vec<&str> = spec
    .split('+')
    .map(|p| p.trim())
    .filter(|p| !p.is_empty())
    .collect();
  if parts.is_empty() {
    return None;
  }
  let mut mods = Modifiers::empty();
  let mut key_raw: Option<&str> = None;
  for p in parts {
    let l = p.to_ascii_lowercase();
    match l.as_str() {
      "ctrl" | "control" => mods |= Modifiers::CONTROL,
      "alt" | "option" => mods |= Modifiers::ALT,
      "shift" => mods |= Modifiers::SHIFT,
      "win" | "super" | "meta" | "cmd" | "command" => mods |= Modifiers::SUPER,
      _ if key_raw.is_some() => return None,
      _ => key_raw = Some(p),
    }
  }
  let key = key_raw?;
  let code = code_from_key(key)?;
  Some(Shortcut::new(
    if mods.is_empty() { None } else { Some(mods) },
    code,
  ))
}

fn code_from_key(key: &str) -> Option<Code> {
  let l = key.to_ascii_lowercase();
  if let Some(rest) = l.strip_prefix('f') {
    if let Ok(n) = rest.parse::<u8>() {
      if (1..=24).contains(&n) {
        // F1..F24 as Code::F1 etc via FromStr "F1"
        return Code::from_str(&format!("F{n}")).ok();
      }
    }
  }
  if l.len() == 1 {
    let c = l.chars().next()?;
    if c.is_ascii_alphabetic() {
      return Code::from_str(&format!("Key{}", c.to_ascii_uppercase())).ok();
    }
    if c.is_ascii_digit() {
      return Code::from_str(&format!("Digit{c}")).ok();
    }
  }
  match l.as_str() {
    "space" | "spacebar" => Code::from_str("Space").ok(),
    "enter" | "return" => Code::from_str("Enter").ok(),
    "esc" | "escape" => Code::from_str("Escape").ok(),
    "tab" => Code::from_str("Tab").ok(),
    "backspace" => Code::from_str("Backspace").ok(),
    "delete" | "del" => Code::from_str("Delete").ok(),
    "up" | "arrowup" => Code::from_str("ArrowUp").ok(),
    "down" | "arrowdown" => Code::from_str("ArrowDown").ok(),
    "left" | "arrowleft" => Code::from_str("ArrowLeft").ok(),
    "right" | "arrowright" => Code::from_str("ArrowRight").ok(),
    other => Code::from_str(other).ok().or_else(|| {
      // "KeyA" / "Digit1" already
      Code::from_str(&key.to_ascii_uppercase()).ok()
    }),
  }
}

pub fn build_plugin<R: Runtime>(hub: Arc<HotkeyHub>) -> tauri_plugin_global_shortcut::Builder<R> {
  let hub_handler = hub.clone();
  tauri_plugin_global_shortcut::Builder::new().with_handler(move |app, shortcut, event| {
    let id = shortcut.id();
    if event.state != ShortcutState::Pressed {
      // Bırakma yalnız bas-konuş / bas-sustur eylemlerinde işlenir
      let b = hub_handler.inner.read().by_id.get(&id).cloned().filter(basili_eylem);
      if let Some(b) = b {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
          let state = app.state::<AppState>();
          let mut p = eylem_parametreleri(&b);
          p["durum"] = serde_json::json!("released");
          if let Err(e) = crate::server::kisayol_eylemi(state.inner(), b.name.trim(), p, b.confirmed).await {
            report_hotkey_error(&app, &b, &e);
          }
        });
      }
      return;
    }
    let binding = {
      let mut g = hub_handler.inner.write();
      let now = Instant::now();
      let basili = g.by_id.get(&id).is_some_and(basili_eylem);
      if let Some(prev) = g.last_fire.get(&id) {
        if !basili && now.duration_since(*prev) < Duration::from_millis(400) {
          return;
        }
      }
      g.last_fire.insert(id, now);
      g.by_id.get(&id).cloned()
    };
    let Some(binding) = binding else {
      studio_warn!("hotkey: kayıt yok id={id} {:?}", shortcut);
      return;
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
      let result = fire_binding(&app, &binding).await;
      if let Err(e) = &result {
        studio_warn!("hotkey {}: {e}", binding.id);
        // Yayın sürümünde uyarılar hiçbir yere yazılmıyor; kısayol hatası sessiz
        // kalıyordu. Panele olay olarak yolla ve dosyaya da yaz.
        report_hotkey_error(&app, &binding, e);
      }
      let _ = app.emit("hotkey-trigger", &binding.id);
    });
  })
}

/// Kısayol hatasını panele (`hotkey-error`) bildirir ve `data/hotkey-hatalari.log`'a
/// ekler (en son ~200 satır tutulur).
fn report_hotkey_error<R: Runtime>(app: &AppHandle<R>, b: &HotkeyBindingIn, msg: &str) {
  let _ = app.emit(
    "hotkey-error",
    serde_json::json!({ "id": b.id, "kind": b.kind, "message": msg }),
  );
  let state = app.state::<AppState>();
  let path = state.data_dir.join("hotkey-hatalari.log");
  let line = format_hotkey_error_line(now_unix(), &b.id, &b.kind, msg);
  let mut lines: Vec<String> = std::fs::read_to_string(&path)
    .map(|t| t.lines().map(|l| l.to_string()).collect())
    .unwrap_or_default();
  lines.push(line);
  if lines.len() > 200 {
    let cut = lines.len() - 200;
    lines.drain(0..cut);
  }
  let _ = std::fs::write(&path, lines.join("\n") + "\n");
}

fn now_unix() -> u64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0)
}

/// Günlük satırı: tek satır, satır sonu içeren hata metni düzleştirilir.
pub(crate) fn format_hotkey_error_line(ts: u64, id: &str, kind: &str, msg: &str) -> String {
  let flat: String = msg.chars().map(|c| if c == '\n' || c == '\r' { ' ' } else { c }).collect();
  format!("{ts}\t{id}\t{kind}\t{flat}")
}

async fn fire_binding<R: Runtime>(app: &AppHandle<R>, b: &HotkeyBindingIn) -> Result<(), String> {
  let state = app.state::<AppState>();
  let kind = if !b.kind.is_empty() {
    b.kind.as_str()
  } else if b.id.starts_with("srcMute:") {
    "srcMute"
  } else if matches!(b.id.as_str(), "mic" | "muteAll" | "music") {
    b.id.as_str()
  } else {
    "scene"
  };

  match kind {
    "music" => {
      state
        .music
        .command("muteToggle", None)
        .await
        .map_err(|e| e.to_string())?;
    }
    // Ses paneli / chat temizle: yalnızca frontend `hotkey-trigger` dinler.
    "sfx" | "clearChat" | "sfxStop" => {}
    "mic" | "srcMute" | "muteAll" | "scene" | "srcToggle" | "volume" | "record" | "filter"
    | "obsHotkey" | "sceneNext" | "scenePrev" => {
      let sonuc = run_obs_action(state.inner(), b, kind).await;
      let obs = obs_cfg_from_settings(state.inner()).3;
      let (eylem, params) = kayit_karsiligi(kind, b, &obs);
      crate::server::kisayol_kaydi(state.inner(), &eylem, params, &sonuc).await;
      sonuc?;
    }
    // Eylem kayıt defteri: Kontrol Merkezi, deste ve uzak arayüzle aynı yol (kullanılabilirlik + denetim kaydı)
    "action" => {
      crate::server::kisayol_eylemi(state.inner(), b.name.trim(), eylem_parametreleri(b), b.confirmed).await?;
    }
    _ if b.id.starts_with("sfx:") || b.id == "clearChat" || b.id == "sfxStop" => {}
    _ => {
      let sonuc = run_obs_action(state.inner(), b, "scene").await;
      let obs = obs_cfg_from_settings(state.inner()).3;
      let (eylem, params) = kayit_karsiligi("scene", b, &obs);
      crate::server::kisayol_kaydi(state.inner(), &eylem, params, &sonuc).await;
      sonuc?;
    }
  }
  Ok(())
}

/// Eski tür kısayolun denetim kaydındaki eylem kimliği ve parametreleri (eylem kayıt defteriyle aynı adlar).
/// Kayıt defterinde karşılığı olmayanlar (`muteAll`, `sceneNext`, `obsHotkey`…) `hotkey.<tür>` olarak yazılır.
pub(crate) fn kayit_karsiligi(kind: &str, b: &HotkeyBindingIn, obs: &serde_json::Value) -> (String, serde_json::Value) {
  use serde_json::json;
  let mik = || {
    if b.input.trim().is_empty() {
      obs.get("micInput").and_then(|v| v.as_str()).unwrap_or("").to_string()
    } else {
      b.input.trim().to_string()
    }
  };
  let (id, params) = match kind {
    "scene" => {
      let sahne = if b.scene.trim().is_empty() { resolve_scene(obs, &b.id) } else { b.scene.trim().to_string() };
      ("scene.switch", json!({ "scene": sahne }))
    }
    "mic" => ("audio.toggle", json!({ "input": mik() })),
    "srcMute" => ("audio.toggle", json!({ "input": b.input.trim() })),
    "srcToggle" => (
      match b.mode.trim().to_ascii_lowercase().as_str() {
        "show" => "source.show",
        "hide" => "source.hide",
        _ => "source.toggle",
      },
      json!({ "scene": b.scene.trim(), "source": b.source.trim() }),
    ),
    "volume" => ("audio.volume", json!({ "input": b.input.trim(), "delta": b.delta })),
    "filter" => ("filter.toggle", json!({ "source": b.source.trim(), "filter": b.filter.trim() })),
    "record" => match record_mode(&b.mode) {
      "start" => ("record.start", json!({})),
      "stop" => ("record.stop", json!({})),
      "pause" => ("record.togglePause", json!({})),
      _ => return ("hotkey.record".into(), json!({})),
    },
    _ => return (format!("hotkey.{kind}"), json!({})),
  };
  (id.into(), params)
}

/// Kaynak görünürlüğü kısayolunun yeni durumu: `show`/`hide` sabit yapar (yayın
/// sırasında "kesin aç" / "kesin kapat" için tersleme belirsizliği olmasın),
/// diğer her değer (`toggle`, boş) tersler.
pub(crate) fn source_enabled_after(mode: &str, currently_enabled: bool) -> bool {
  match mode.trim().to_ascii_lowercase().as_str() {
    "show" => true,
    "hide" => false,
    _ => !currently_enabled,
  }
}


/// Bağlantı bilgisini (host/port/password) `panel`'den, diğer alanları
/// (`micInput`, `sceneMap`, `muteAllExceptMic`…) ekran ayarlarındaki `obs`
/// diliminden birleştirir.
///
/// Eskiden ilk dolu `obs` nesnesi olduğu gibi kullanılıyordu: bağlantı `panel`'den
/// geliyor ama `micInput` ekran diliminde durduğu için "mikrofon kaynağı seçilmemiş"
/// hatasıyla mikrofon/tüm-sesler kısayolları sessizce düşüyordu.
pub(crate) fn merge_obs_config(panel: Option<&serde_json::Value>, slices: &[serde_json::Value]) -> serde_json::Value {
  let mut out = serde_json::Map::new();
  // Alanlar: ilk dolu dilim kazanır (boş metin/null dolu sayılmaz).
  for sl in slices {
    if let Some(m) = sl.as_object() {
      for (k, v) in m {
        let empty = v.is_null() || v.as_str().map(|t| t.trim().is_empty()).unwrap_or(false);
        if empty {
          continue;
        }
        out.entry(k.clone()).or_insert_with(|| v.clone());
      }
    }
  }
  // Bağlantı: `panel` (Bağlantılar kartı) varsa o kazanır.
  if let Some(pm) = panel.and_then(|p| p.as_object()) {
    let host_ok = pm.get("host").and_then(|v| v.as_str()).map(|h| !h.trim().is_empty()).unwrap_or(false);
    if host_ok {
      for k in ["host", "port"] {
        if let Some(v) = pm.get(k) {
          out.insert(k.to_string(), v.clone());
        } else {
          out.remove(k);
        }
      }
      // Şifre ayrı ele alınır: panel dilimindeki şifre BOŞ ise AYNI adresi
      // taşıyan ekran dilimindeki şifre korunur (eskiden boş panel şifresi
      // doluyu eziyordu, açılışta el sıkışma düşüyordu). Başka bir makinenin
      // şifresi ise asla sızmaz: adres farklıysa şifre düşer.
      let panel_pw = pm.get("password").and_then(|v| v.as_str()).unwrap_or("");
      if !panel_pw.trim().is_empty() {
        out.insert("password".to_string(), pm["password"].clone());
      } else {
        let panel_host = pm.get("host").and_then(|v| v.as_str()).unwrap_or("").trim();
        let same_host_pw = slices.iter().find_map(|sl| {
          let m = sl.as_object()?;
          let h = m.get("host").and_then(|v| v.as_str()).unwrap_or("").trim();
          let pw = m.get("password").and_then(|v| v.as_str()).unwrap_or("");
          (h == panel_host && !pw.trim().is_empty()).then(|| m["password"].clone())
        });
        match same_host_pw {
          Some(v) => {
            out.insert("password".to_string(), v);
          }
          None => {
            out.remove("password");
          }
        }
      }
    }
    // Panel'de bulunan diğer alanlar dilimde yoksa tamamlansın.
    for (k, v) in pm {
      if !["host", "port", "password"].contains(&k.as_str()) {
        out.entry(k.clone()).or_insert_with(|| v.clone());
      }
    }
  }
  serde_json::Value::Object(out)
}

pub(crate) fn obs_cfg_from_settings(state: &AppState) -> (String, u16, String, serde_json::Value) {
  let s = state.settings.read();
  let panel = s.get(ScreenKind::Panel).get("obs").cloned();
  let slices: Vec<serde_json::Value> = [ScreenKind::Starting, ScreenKind::Brb, ScreenKind::Ending, ScreenKind::Chat]
    .into_iter()
    .filter_map(|k| s.get(k).get("obs").cloned())
    .collect();
  let obs = merge_obs_config(panel.as_ref(), &slices);
  let host = obs
    .get("host")
    .and_then(|v| v.as_str())
    .filter(|h| !h.trim().is_empty())
    .unwrap_or("127.0.0.1")
    .to_string();
  let port = obs.get("port").and_then(|v| v.as_u64()).unwrap_or(4455) as u16;
  let password = obs
    .get("password")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();
  (host, port, password, obs)
}

pub async fn switch_obs_scene(state: &AppState, scene: &str) -> Result<(), String> {
  if scene.trim().is_empty() {
    return Err("sahne boş".into());
  }
  let b = HotkeyBindingIn {
    id: "shop".into(),
    kind: "scene".into(),
    scene: scene.to_string(),
    ..Default::default()
  };
  run_obs_action(state, &b, "scene").await
}

pub(crate) async fn run_obs_action(state: &AppState, b: &HotkeyBindingIn, kind: &str) -> Result<(), String> {
  let (host, port, password, obs) = obs_cfg_from_settings(state);
  // Kalıcı bağlantıyı paylaş (her tuşta yeni el sıkışma yok). Bağlantı kopmuşsa
  // ağ hatasında bir kez yeniden bağlanıp tekrar dene.
  for attempt in 0..2 {
    let client = state
      .obs
      .ensure_connected(&host, port, &password)
      .await
      .map_err(|e| format!("OBS bağlantı: {e}"))?;
    match run_with_client(&client, &obs, b, kind).await {
      Ok(()) => return Ok(()),
      Err(e) if attempt == 0 && crate::obs_client::is_transport_error(&e) => {
        state.obs.disconnect();
        continue;
      }
      Err(e) => return Err(e),
    }
  }
  Err("OBS bağlantısı kurulamadı".into())
}

async fn run_with_client(
  client: &obws::Client,
  obs: &serde_json::Value,
  b: &HotkeyBindingIn,
  kind: &str,
) -> Result<(), String> {
  match kind {
    "scene" => {
      let scene = if !b.scene.is_empty() {
        b.scene.clone()
      } else {
        resolve_scene(obs, &b.id)
      };
      if scene.is_empty() {
        return Err("sahne atanmamış".into());
      }
      client
        .scenes()
        .set_current_program_scene(scene.as_str())
        .await
        .map_err(|e| format!("sahne: {e}"))?;
    }
    "mic" => {
      // Önce kısayolun taşıdığı ad (panel plana yazıyor), yoksa ayardan.
      let input = if !b.input.trim().is_empty() {
        b.input.trim().to_string()
      } else {
        obs
          .get("micInput")
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .to_string()
      };
      if input.is_empty() {
        return Err("mikrofon kaynağı seçilmemiş".into());
      }
      toggle_input_mute(client, input.as_str()).await?;
    }
    "srcMute" => {
      let input = b.input.trim();
      if input.is_empty() {
        return Err("kaynak seçilmemiş".into());
      }
      toggle_input_mute(client, input).await?;
    }
    "muteAll" => {
      let except_mic = obs
        .get("muteAllExceptMic")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
      let mic = obs
        .get("micInput")
        .and_then(|v| v.as_str())
        .unwrap_or("");
      toggle_all_except(client, if except_mic { mic } else { "" }).await?;
    }

    /* ---- yeni aksiyonlar ---- */
    // Sahnedeki bir kaynağı aç/kapa. Sahne boşsa şu an yayındaki sahne.
    "srcToggle" => {
      let source = b.source.trim();
      if source.is_empty() {
        return Err("kaynak seçilmemiş".into());
      }
      let scene = if b.scene.trim().is_empty() {
        client
          .scenes()
          .current_program_scene()
          .await
          .map_err(|e| format!("aktif sahne: {e}"))?
          .id
          .name
      } else {
        b.scene.trim().to_string()
      };
      let items = client
        .scene_items()
        .list(obws::requests::scenes::SceneId::Name(scene.as_str()))
        .await
        .map_err(|e| format!("kaynaklar: {e}"))?;
      let item = items
        .into_iter()
        .find(|i| i.source_name.eq_ignore_ascii_case(source))
        .ok_or_else(|| format!("«{source}» «{scene}» sahnesinde yok"))?;
      let now = client
        .scene_items()
        .enabled(obws::requests::scenes::SceneId::Name(scene.as_str()), item.id)
        .await
        .map_err(|e| format!("kaynak durumu: {e}"))?;
      client
        .scene_items()
        .set_enabled(obws::requests::scene_items::SetEnabled {
          scene: obws::requests::scenes::SceneId::Name(scene.as_str()),
          item_id: item.id,
          enabled: source_enabled_after(&b.mode, now),
        })
        .await
        .map_err(|e| format!("kaynak değiştirilemedi: {e}"))?;
    }
    "volume" => {
      let input = b.input.trim();
      if input.is_empty() {
        return Err("ses girişi seçilmemiş".into());
      }
      let id = InputId::Name(input);
      let cur = client
        .inputs()
        .volume(id)
        .await
        .map_err(|e| format!("ses seviyesi okunamadı: {e}"))?;
      let next = next_volume_db(cur.db as f64, b.delta);
      client
        .inputs()
        .set_volume(InputId::Name(input), obws::requests::inputs::Volume::Db(next as f32))
        .await
        .map_err(|e| format!("ses seviyesi ayarlanamadı: {e}"))?;
    }
    "record" => match record_mode(&b.mode) {
      "start" => client.recording().start().await.map_err(|e| format!("kayıt: {e}"))?,
      "stop" => {
        client.recording().stop().await.map_err(|e| format!("kayıt: {e}"))?;
      }
      "pause" => {
        client.recording().toggle_pause().await.map_err(|e| format!("kayıt: {e}"))?;
      }
      _ => {
        client.recording().toggle().await.map_err(|e| format!("kayıt: {e}"))?;
      }
    },
    "filter" => {
      let source = b.source.trim();
      let filter = b.filter.trim();
      if source.is_empty() || filter.is_empty() {
        return Err("kaynak veya filtre seçilmemiş".into());
      }
      let cur = client
        .filters()
        .get(obws::requests::sources::SourceId::Name(source), filter)
        .await
        .map_err(|e| format!("filtre okunamadı: {e}"))?;
      client
        .filters()
        .set_enabled(obws::requests::filters::SetEnabled {
          source: obws::requests::sources::SourceId::Name(source),
          filter,
          enabled: !cur.enabled,
        })
        .await
        .map_err(|e| format!("filtre değiştirilemedi: {e}"))?;
    }
    // OBS'in kendi kısayollarından herhangi birini adıyla tetikler: bu tek
    // aksiyon, yukarıda olmayan her şeyi (tekrar arabelleği, sanal kamera,
    // stüdyo modu…) kapsıyor.
    "obsHotkey" => {
      let name = b.name.trim();
      if name.is_empty() {
        return Err("OBS kısayol adı boş".into());
      }
      // Aynı isim birçok kaynakta tekrarlanır (libobs.mute her ses kaynağı için,
      // ObsBrowser.Refresh her tarayıcı kaynağı için, OBSBasic.SelectScene her
      // sahne için): hangisinin kastedildiği bağlam adıyla söylenir.
      let context = b.source.trim();
      client
        .hotkeys()
        .trigger_by_name(name, Some(context).filter(|c| !c.is_empty()))
        .await
        .map_err(|e| format!("OBS kısayolu: {e}"))?;
    }
    "sceneNext" | "scenePrev" => {
      let list = client.scenes().list().await.map_err(|e| format!("sahneler: {e}"))?;
      let names: Vec<String> = list.scenes.iter().map(|sc| sc.id.name.clone()).collect();
      let cur = list.current_program_scene.as_ref().map(|c| c.name.clone());
      let idx = cur.and_then(|c| names.iter().position(|n| *n == c));
      let Some(next) = cycle_index(names.len(), idx, kind == "sceneNext") else {
        return Err("OBS'te sahne yok".into());
      };
      client
        .scenes()
        .set_current_program_scene(names[next].as_str())
        .await
        .map_err(|e| format!("sahne: {e}"))?;
    }
    _ => {}
  }
  Ok(())
}

/// OBS ses seviyesi sınırları (dB). OBS -100 dB'yi "sessiz" sayar, üstte +26.
const VOLUME_MIN_DB: f64 = -100.0;
const VOLUME_MAX_DB: f64 = 26.0;

/// Mevcut seviyeye `delta` dB ekler ve OBS'in kabul ettiği aralığa sıkıştırır.
///
/// OBS tam sessizken `-inf` dB bildirebiliyor; ondan sonra "+5" dendiğinde
/// sonsuz değerle işlem yapmamak için önce alt sınıra çekiyoruz.
pub(crate) fn next_volume_db(current_db: f64, delta_db: f64) -> f64 {
  let cur = if current_db.is_finite() { current_db } else { VOLUME_MIN_DB };
  (cur + delta_db).clamp(VOLUME_MIN_DB, VOLUME_MAX_DB)
}

/// Sahne listesinde bir sonraki/önceki indeks; uçlarda başa/sona sarar.
///
/// Mevcut sahne listede yoksa (silinmiş/yeniden adlandırılmış) ileri için
/// ilk, geri için son sahneye gidilir. Liste boşsa `None`.
pub(crate) fn cycle_index(len: usize, current: Option<usize>, forward: bool) -> Option<usize> {
  if len == 0 {
    return None;
  }
  Some(match (current, forward) {
    (Some(i), true) => (i + 1) % len,
    (Some(i), false) => (i + len - 1) % len,
    (None, true) => 0,
    (None, false) => len - 1,
  })
}

/// Kayıt kipini normalize eder. Bilinmeyen değer güvenli varsayılana (toggle) düşer.
pub(crate) fn record_mode(raw: &str) -> &'static str {
  match raw.trim().to_ascii_lowercase().as_str() {
    "start" => "start",
    "stop" => "stop",
    "pause" => "pause",
    _ => "toggle",
  }
}

fn resolve_scene(obs: &serde_json::Value, id: &str) -> String {
  let map = obs.get("sceneMap").cloned().unwrap_or(serde_json::json!({}));
  let from_map = map.get(id).and_then(|v| v.as_str()).unwrap_or("");
  if !from_map.is_empty() {
    return from_map.to_string();
  }
  match id {
    "starting" => obs
      .get("startingScene")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string(),
    "ending" => obs
      .get("endingScene")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string(),
    "brb" => obs
      .get("brbScene")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string(),
    "game" => obs
      .get("sceneOnEnd")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string(),
    _ => String::new(),
  }
}

async fn toggle_input_mute(client: &obws::Client, input: &str) -> Result<(), String> {
  client
    .inputs()
    .toggle_mute(obws::requests::inputs::InputId::Name(input))
    .await
    .map_err(|e| format!("mute: {e}"))?;
  Ok(())
}

async fn toggle_all_except(client: &obws::Client, except: &str) -> Result<(), String> {
  let list = client
    .inputs()
    .list(None)
    .await
    .map_err(|e| format!("input list: {e}"))?;
  let mut any_unmuted = false;
  let mut targets: Vec<String> = Vec::new();
  for i in list {
    let name = i.id.name;
    if !except.is_empty() && name == except {
      continue;
    }
    // Ses benzeri kaynaklar — hepsini dene; hata olursa atla.
    targets.push(name);
  }
  for name in &targets {
    let id = obws::requests::inputs::InputId::Name(name.as_str());
    if let Ok(false) = client.inputs().muted(id).await {
      any_unmuted = true;
      break;
    }
  }
  let muted = any_unmuted;
  for name in &targets {
    let id = obws::requests::inputs::InputId::Name(name.as_str());
    let _ = client.inputs().set_muted(id, muted).await;
  }
  Ok(())
}

/// Kayıt sonucunda ön yüze dönen bilgi.
///
/// Eskiden yalnız başarılı **spec metinleri** dönüyordu; iki binding aynı tuşu
/// paylaşınca ön yüz hangisinin kazandığını bilemiyor, kaydedilmemiş bir ses
/// kısayolunu "kayıtlı" gösteriyordu. Artık **binding kimliği** dönüyor ve
/// başarısızlıklar da sebebiyle birlikte geliyor.
#[derive(Debug, Clone, Default, serde::Serialize)]
pub struct HotkeySyncResult {
  /// Gerçekten kaydedilen binding id'leri
  pub ok: Vec<String>,
  pub failed: Vec<HotkeyFailure>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct HotkeyFailure {
  pub id: String,
  pub spec: String,
  pub reason: String,
}

/// Hangi binding'in hangi kısayola gideceğini belirler — Tauri'siz, saf.
///
/// Kayıt işlemini yapmaz; yalnız planı ve çakışmaları çıkarır. Böylece
/// test edilebiliyor.
pub fn plan_bindings(
  bindings: Vec<HotkeyBindingIn>,
) -> (Vec<(Shortcut, HotkeyBindingIn)>, Vec<HotkeyFailure>) {
  let mut plan: Vec<(Shortcut, HotkeyBindingIn)> = Vec::new();
  let mut failed: Vec<HotkeyFailure> = Vec::new();
  let mut sahip: std::collections::HashMap<u32, String> = std::collections::HashMap::new();

  for b in bindings {
    if b.spec.trim().is_empty() {
      continue; // boş = kısayol yok, hata değil
    }
    let Some(sc) = parse_shortcut(&b.spec) else {
      failed.push(HotkeyFailure {
        id: b.id.clone(),
        spec: b.spec.clone(),
        reason: "tuş anlaşılamadı".into(),
      });
      continue;
    };
    if b.kind == "action" {
      if let Err(reason) = eylem_denetimi(&b) {
        failed.push(HotkeyFailure { id: b.id.clone(), spec: b.spec.clone(), reason });
        continue;
      }
    }
    let key = sc.id();
    if let Some(kazanan) = sahip.get(&key) {
      // Eskiden sessizce düşüyordu; kullanıcı neden çalışmadığını göremiyordu.
      failed.push(HotkeyFailure {
        id: b.id.clone(),
        spec: b.spec.clone(),
        reason: format!("aynı tuş zaten «{kazanan}» için kullanılıyor"),
      });
      continue;
    }
    sahip.insert(key, b.id.clone());
    plan.push((sc, b));
  }

  (plan, failed)
}

pub fn sync_bindings<R: Runtime>(
  app: &AppHandle<R>,
  hub: &HotkeyHub,
  bindings: Vec<HotkeyBindingIn>,
) -> Result<HotkeySyncResult, String> {
  let (plan, mut failed) = plan_bindings(bindings);

  let mut g = hub.inner.write();
  // Eski kayıtları kaldır
  for sc in g.registered.drain(..) {
    let _ = app.global_shortcut().unregister(sc);
  }
  g.by_id.clear();

  let mut ok = Vec::new();
  for (sc, b) in plan {
    match app.global_shortcut().register(sc) {
      Ok(()) => {
        ok.push(b.id.clone());
        g.by_id.insert(sc.id(), b);
        g.registered.push(sc);
      }
      Err(e) => failed.push(HotkeyFailure {
        id: b.id.clone(),
        spec: b.spec.clone(),
        reason: format!("{e}"),
      }),
    }
  }

  // Kısmi başarısızlıklar artık yutulmuyor: sonuç nesnesiyle geri gidiyor.
  Ok(HotkeySyncResult { ok, failed })
}

#[cfg(test)]
mod plan_testleri {
  use super::*;

  fn b(id: &str, spec: &str) -> HotkeyBindingIn {
    HotkeyBindingIn { id: id.into(), spec: spec.into(), ..Default::default() }
  }

  #[test]
  fn eski_kisayol_denetim_kaydinda_kayit_defteri_adiyla() {
    let obs = serde_json::json!({ "brbScene": "Mola", "micInput": "Mik" });
    assert_eq!(kayit_karsiligi("scene", &b("brb", "F3"), &obs), ("scene.switch".into(), serde_json::json!({ "scene": "Mola" })));
    assert_eq!(kayit_karsiligi("mic", &b("mic", "F4"), &obs).1["input"], "Mik");
    let gizle = HotkeyBindingIn { source: "Kamera".into(), mode: "hide".into(), ..b("k", "F5") };
    assert_eq!(kayit_karsiligi("srcToggle", &gizle, &obs).0, "source.hide");
    let kayit = HotkeyBindingIn { mode: "stop".into(), ..b("r", "F6") };
    assert_eq!(kayit_karsiligi("record", &kayit, &obs).0, "record.stop");
    assert_eq!(kayit_karsiligi("record", &b("r", "F6"), &obs).0, "hotkey.record");
    assert_eq!(kayit_karsiligi("sceneNext", &b("n", "F7"), &obs).0, "hotkey.sceneNext");
  }

  #[test]
  fn bos_spec_hata_degil_sessizce_atlanir() {
    let (plan, failed) = plan_bindings(vec![b("mic", ""), b("brb", "F3")]);
    assert_eq!(plan.len(), 1);
    assert_eq!(plan[0].1.id, "brb");
    assert!(failed.is_empty());
  }

  #[test]
  fn ayni_tus_ikinciyi_sebebiyle_birlikte_dusurur() {
    // Eskiden sessizce düşüyordu; kullanıcı neden çalışmadığını göremiyordu.
    let (plan, failed) = plan_bindings(vec![b("brb", "F3"), b("sfx:pad1", "F3")]);
    assert_eq!(plan.len(), 1);
    assert_eq!(plan[0].1.id, "brb");
    assert_eq!(failed.len(), 1);
    assert_eq!(failed[0].id, "sfx:pad1");
    assert!(failed[0].reason.contains("brb"), "{}", failed[0].reason);
  }

  #[test]
  fn buyuk_kucuk_harf_farki_ayni_tus_sayilir() {
    // Diskte "CTRL+F1", arayüzde "Ctrl+F1" yazıyordu.
    let (plan, failed) = plan_bindings(vec![b("starting", "CTRL+F1"), b("mic", "Ctrl+F1")]);
    assert_eq!(plan.len(), 1);
    assert_eq!(failed.len(), 1);
    assert_eq!(failed[0].id, "mic");
  }

  #[test]
  fn anlasilamayan_tus_raporlanir() {
    let (plan, failed) = plan_bindings(vec![b("x", "Ctrl+")]);
    assert!(plan.is_empty());
    assert_eq!(failed.len(), 1);
    assert!(failed[0].reason.contains("anlaşılamadı"));
  }

  #[test]
  fn farkli_tuslar_hepsi_planlanir() {
    let (plan, failed) = plan_bindings(vec![b("a", "F1"), b("b", "F2"), b("c", "Ctrl+Alt+X")]);
    assert_eq!(plan.len(), 3);
    assert!(failed.is_empty());
  }

  fn eylem(id: &str, spec: &str, eylem: &str) -> HotkeyBindingIn {
    HotkeyBindingIn { kind: "action".into(), name: eylem.into(), ..b(id, spec) }
  }

  #[test]
  fn kayit_defteri_eylemi_kayit_aninda_denetlenir() {
    let mut hedef = eylem("act:3", "F8", "destination.reconnect");
    hedef.target = "hedef-1".into();
    let mut onayli = hedef.clone();
    onayli.id = "act:4".into();
    onayli.spec = "F9".into();
    onayli.confirmed = true;
    let mut ses = eylem("act:5", "F10", "audio.volume");
    ses.input = "Müzik".into();
    ses.delta = -3.0;
    let (plan, failed) = plan_bindings(vec![
      eylem("act:1", "F6", "uydurma.eylem"),
      eylem("act:2", "F7", "source.toggle"),
      hedef,
      onayli,
      ses,
      eylem("act:6", "F11", "engine.replay.save"),
    ]);
    let neden = |id: &str| failed.iter().find(|f| f.id == id).map(|f| f.reason.clone()).unwrap_or_default();
    assert!(neden("act:1").contains("bilinmeyen"), "{}", neden("act:1"));
    assert!(neden("act:2").contains("source"), "{}", neden("act:2"));
    // Yayını kesen eylem kullanıcı açıkça işaretlemeden kısayola bağlanmaz
    assert!(neden("act:3").contains("onay"), "{}", neden("act:3"));
    let planlanan: Vec<_> = plan.iter().map(|(_, b)| b.id.as_str()).collect();
    assert_eq!(planlanan, ["act:4", "act:5", "act:6"]);
  }
}

#[cfg(test)]
mod obs_merge_testleri {
  use super::merge_obs_config;
  use serde_json::json;

  #[test]
  fn panel_sifresi_bossa_dilim_sifresi_korunur() {
    // Panel kartı adresi verir ama şifre kutusu boş kaldıysa (eski kayıtlarda
    // olan durum) ekran dilimindeki şifre kullanılmalı.
    let panel = json!({"host": "192.168.1.5", "port": 4455, "password": ""});
    let dilim = json!({"host": "192.168.1.5", "password": "gercek-sifre"});
    let out = merge_obs_config(Some(&panel), &[dilim]);
    assert_eq!(out["password"], json!("gercek-sifre"));
    assert_eq!(out["host"], json!("192.168.1.5"));
  }

  #[test]
  fn panel_sifresi_doluysa_o_kazanir() {
    let panel = json!({"host": "10.0.0.2", "password": "yeni"});
    let dilim = json!({"host": "10.0.0.9", "password": "eski"});
    let out = merge_obs_config(Some(&panel), &[dilim]);
    assert_eq!(out["password"], json!("yeni"));
    assert_eq!(out["host"], json!("10.0.0.2"));
  }

  #[test]
  fn baglanti_panelden_mikrofon_dilimden_gelir() {
    // Gerçek durum: panel = doğru adres + şifre; dilim = eski adres, şifresiz, micInput dolu.
    let panel = json!({"host":"192.168.1.109","port":4455,"password":"gizli"});
    let dilim = json!({"host":"192.168.1.100","port":4455,"micInput":"Mic/Aux","muteAllExceptMic":true});
    let m = merge_obs_config(Some(&panel), &[dilim]);
    assert_eq!(m["host"], "192.168.1.109");
    assert_eq!(m["password"], "gizli");
    assert_eq!(m["micInput"], "Mic/Aux");
    assert_eq!(m["muteAllExceptMic"], true);
  }

  #[test]
  fn dilimin_eski_sifresi_paneldeki_adrese_karismaz() {
    let panel = json!({"host":"10.0.0.2","port":4455});
    let dilim = json!({"host":"10.0.0.1","password":"baska-makine"});
    let m = merge_obs_config(Some(&panel), &[dilim]);
    assert_eq!(m["host"], "10.0.0.2");
    assert!(m.get("password").is_none(), "başka makinenin şifresi sızmamalı");
  }

  #[test]
  fn panel_yoksa_ilk_dolu_dilim_kazanir_bos_alanlar_atlanir() {
    let a = json!({"host":"","micInput":"","sceneMap":{"brb":"Mola"}});
    let b = json!({"host":"1.2.3.4","micInput":"Mikrofon"});
    let m = merge_obs_config(None, &[a, b]);
    assert_eq!(m["host"], "1.2.3.4");
    assert_eq!(m["micInput"], "Mikrofon");
    assert_eq!(m["sceneMap"]["brb"], "Mola");
  }

  #[test]
  fn panelde_host_bossa_baglanti_dilimden_alinir() {
    let panel = json!({"host":"  ","password":"x"});
    let dilim = json!({"host":"5.5.5.5","password":"d"});
    let m = merge_obs_config(Some(&panel), &[dilim]);
    assert_eq!(m["host"], "5.5.5.5");
    assert_eq!(m["password"], "d");
  }

  #[test]
  fn hicbir_kaynak_yoksa_bos_nesne() {
    assert_eq!(merge_obs_config(None, &[]), json!({}));
  }
}

#[cfg(test)]
mod kaynak_kipi_testleri {
  use super::source_enabled_after;

  #[test]
  fn show_ve_hide_sabitler_toggle_tersler() {
    assert!(source_enabled_after("show", true));
    assert!(source_enabled_after("show", false));
    assert!(!source_enabled_after("hide", true));
    assert!(!source_enabled_after("hide", false));
    assert!(!source_enabled_after("toggle", true));
    assert!(source_enabled_after("toggle", false));
  }

  #[test]
  fn bos_ya_da_bilinmeyen_kip_tersler_buyuk_kucuk_harf_onemsiz() {
    assert!(source_enabled_after("", false));
    assert!(!source_enabled_after("bilinmiyor", true));
    assert!(source_enabled_after("  SHOW ", false));
    assert!(!source_enabled_after("Hide", true));
  }
}

#[cfg(test)]
mod hata_gunlugu_testleri {
  use super::format_hotkey_error_line;

  #[test]
  fn satir_sekmeyle_ayrilir_ve_tek_satirdir() {
    let l = format_hotkey_error_line(1700000000, "mic", "mic", "OBS bağlantı: reddedildi\nikinci satır");
    assert_eq!(l, "1700000000\tmic\tmic\tOBS bağlantı: reddedildi ikinci satır");
    assert!(!l.contains('\n'));
  }

  #[test]
  fn bos_tur_ve_karisik_satir_sonlari_duzlesir() {
    let l = format_hotkey_error_line(1, "act:1", "", "a\r\nb");
    assert_eq!(l, "1\tact:1\t\ta  b");
  }
}

#[cfg(test)]
mod obs_aksiyon_testleri {
  use super::*;

  #[test]
  fn ses_farki_sinirlar_icinde_kalir() {
    assert_eq!(next_volume_db(-20.0, 5.0), -15.0);
    assert_eq!(next_volume_db(-20.0, -5.0), -25.0);
    // OBS üst sınırı +26 dB
    assert_eq!(next_volume_db(24.0, 10.0), 26.0);
    // alt sınır -100 dB (OBS'in "sessiz"i)
    assert_eq!(next_volume_db(-98.0, -10.0), -100.0);
  }

  #[test]
  fn tam_sessizden_artirma_sonsuzla_islem_yapmaz() {
    // OBS tam sessizken -inf bildirebiliyor; +5 dendiğinde NaN/inf üretmemeli.
    assert_eq!(next_volume_db(f64::NEG_INFINITY, 5.0), -95.0);
    assert!(next_volume_db(f64::NAN, 3.0).is_finite());
  }

  #[test]
  fn sahne_dongusu_uclarda_sarar() {
    assert_eq!(cycle_index(3, Some(0), true), Some(1));
    assert_eq!(cycle_index(3, Some(2), true), Some(0), "sondan başa");
    assert_eq!(cycle_index(3, Some(0), false), Some(2), "baştan sona");
    assert_eq!(cycle_index(3, Some(2), false), Some(1));
  }

  #[test]
  fn silinmis_sahnede_ileri_ilk_geri_son_sahneye_gider() {
    assert_eq!(cycle_index(4, None, true), Some(0));
    assert_eq!(cycle_index(4, None, false), Some(3));
  }

  #[test]
  fn bos_liste_sahne_dondurmez() {
    assert_eq!(cycle_index(0, None, true), None);
    assert_eq!(cycle_index(0, Some(0), false), None);
  }

  #[test]
  fn tek_sahnede_kendine_doner() {
    assert_eq!(cycle_index(1, Some(0), true), Some(0));
    assert_eq!(cycle_index(1, Some(0), false), Some(0));
  }

  #[test]
  fn kayit_kipi_bilinmeyende_toggle() {
    assert_eq!(record_mode("start"), "start");
    assert_eq!(record_mode(" STOP "), "stop");
    assert_eq!(record_mode("pause"), "pause");
    assert_eq!(record_mode(""), "toggle");
    assert_eq!(record_mode("uydurma"), "toggle");
  }

  #[test]
  fn yeni_alanlar_eski_kayitlarda_yoksa_varsayilana_duser() {
    // Eski ayar dosyaları yeni alanları hiç içermiyor: serde varsayılanı
    // devreye girmeli, yoksa mevcut kısayollar yüklenemezdi.
    let b: HotkeyBindingIn =
      serde_json::from_str(r#"{"id":"starting","spec":"F1","kind":"scene"}"#).unwrap();
    assert_eq!(b.source, "");
    assert_eq!(b.filter, "");
    assert_eq!(b.mode, "");
    assert_eq!(b.name, "");
    assert_eq!(b.delta, 0.0);
  }

  #[test]
  fn yeni_alanlar_camel_case_ile_okunur() {
    let b: HotkeyBindingIn = serde_json::from_str(
      r#"{"id":"a","spec":"F2","kind":"volume","input":"Müzik","delta":-3.5,"source":"Kamera","filter":"Bulanık","mode":"stop","name":"OBSBasic.X"}"#,
    )
    .unwrap();
    assert_eq!((b.kind.as_str(), b.input.as_str(), b.delta), ("volume", "Müzik", -3.5));
    assert_eq!((b.source.as_str(), b.filter.as_str()), ("Kamera", "Bulanık"));
    assert_eq!((b.mode.as_str(), b.name.as_str()), ("stop", "OBSBasic.X"));
  }
}