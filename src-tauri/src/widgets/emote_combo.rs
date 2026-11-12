//! Emote Combo — aynı emote art arda gelince sayaç + overlay broadcast.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::AppState;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EmoteComboState {
  pub emote_id: String,
  pub emote_url: String,
  pub count: u32,
  pub is_active: bool,
}

impl EmoteComboState {
  pub fn new() -> Self {
    Self {
      emote_id: String::new(),
      emote_url: String::new(),
      count: 0,
      is_active: false,
    }
  }
}

impl Default for EmoteComboState {
  fn default() -> Self {
    Self::new()
  }
}

/// Kombo durumu + botun son gönderdiği metinler (bot yayıncı hesabından yazınca adıyla ayırt edilemiyor)
pub struct ComboMemory(pub Mutex<EmoteComboState>, Mutex<Vec<(String, std::time::Instant)>>);

impl ComboMemory {
  pub fn new() -> Self {
    Self(Mutex::new(EmoteComboState::new()), Mutex::new(Vec::new()))
  }

  /// Botun sohbete yazdığı metin: 30 sn içinde sohbetten geri okunursa bot iletisi sayılır.
  pub fn bot_gonderdi(&self, metin: &str) {
    let t = metin.trim();
    if t.is_empty() {
      return;
    }
    let mut l = self.1.lock();
    l.retain(|(_, z)| z.elapsed().as_secs() < 30);
    if l.len() >= 100 {
      l.remove(0);
    }
    l.push((t.chars().take(500).collect(), std::time::Instant::now()));
  }

  pub fn bot_metni_mi(&self, metin: &str) -> bool {
    let t: String = metin.trim().chars().take(500).collect();
    let mut l = self.1.lock();
    l.retain(|(_, z)| z.elapsed().as_secs() < 30);
    l.iter().any(|(m, _)| *m == t)
  }
}

impl Default for ComboMemory {
  fn default() -> Self {
    Self::new()
  }
}

/// Mesaj metninden ilk emote kimliğini / görsel URL'ini çıkar.
/// Kick: `[emote:12345:KEKW]` · Twitch/emoji: `:pog:` · unicode emoji.
pub fn extract_first_emote(text: &str) -> Option<(String, String)> {
  let t = text.trim();
  if t.is_empty() {
    return None;
  }

  // Kick nested emote: [emote:ID:NAME]
  if let Some(caps) = regex_kick_emote(t) {
    let (id, name) = caps;
    let url = format!("https://files.kick.com/emotes/{id}/fullsize");
    return Some((format!("kick:{id}:{name}"), url));
  }

  // :emote_name:
  if let Some(start) = t.find(':') {
    if let Some(end) = t[start + 1..].find(':') {
      let name = &t[start + 1..start + 1 + end];
      if !name.is_empty()
        && name
          .chars()
          .all(|c| c.is_ascii_alphanumeric() || c == '_')
      {
        return Some((format!("colon:{name}"), String::new()));
      }
    }
  }

  // Tek token büyük harf emote (KEKW, OMEGALUL…) — yalnız mesaj neredeyse o ise
  let words: Vec<&str> = t.split_whitespace().collect();
  if words.len() == 1 {
    let w = words[0];
    if w.len() >= 2
      && w.len() <= 24
      && w.chars().all(|c| c.is_ascii_alphanumeric())
      && w.chars().any(|c| c.is_ascii_uppercase())
    {
      return Some((format!("token:{w}"), String::new()));
    }
  }

  // Unicode emoji (ilk grapheme-ish)
  for ch in t.chars() {
    if is_emoji_char(ch) {
      return Some((format!("emoji:{ch}"), String::new()));
    }
  }

  None
}

fn regex_kick_emote(text: &str) -> Option<(String, String)> {
  // [emote:12345:KEKW] veya [emote:12345:KEKW:scale]
  let lower = text;
  let marker = "[emote:";
  let i = lower.find(marker)?;
  let rest = &lower[i + marker.len()..];
  let end = rest.find(']')?;
  let inner = &rest[..end];
  let mut parts = inner.split(':');
  let id = parts.next()?.trim();
  let name = parts.next().unwrap_or("emote").trim();
  if id.is_empty() {
    return None;
  }
  Some((id.to_string(), name.to_string()))
}

fn is_emoji_char(c: char) -> bool {
  matches!(c as u32, 0x1F300..=0x1FAFF | 0x2600..=0x27BF)
}

/// Combo sayacını güncelle; count ≥ 2 ise overlay-sync'e yayınla.
/// OBS Browser Source Tauri IPC bilmez → `broadcast_json` kullanırız.
pub fn handle_combo_logic(
  state: &AppState,
  combo_memory: &ComboMemory,
  incoming_emote_id: &str,
  incoming_emote_url: &str,
) {
  if incoming_emote_id.is_empty() {
    return;
  }

  let snapshot = {
    let mut s = combo_memory.0.lock();
    if incoming_emote_id == s.emote_id && !incoming_emote_id.is_empty() {
      s.count = s.count.saturating_add(1);
      if !incoming_emote_url.is_empty() {
        s.emote_url = incoming_emote_url.to_string();
      }
      s.is_active = true;
    } else {
      s.emote_id = incoming_emote_id.to_string();
      s.emote_url = incoming_emote_url.to_string();
      s.count = 1;
      s.is_active = false;
    }
    if s.count >= 2 {
      s.is_active = true;
    }
    s.clone()
  };

  if snapshot.count >= 2 && snapshot.is_active {
    let display = display_label(&snapshot.emote_id);
    state.broadcast_json(&json!({
      "type": "emote_combo_updated",
      "emoteId": snapshot.emote_id,
      "emote_id": snapshot.emote_id,
      "emoteUrl": snapshot.emote_url,
      "emote_url": snapshot.emote_url,
      "count": snapshot.count,
      "isActive": snapshot.is_active,
      "is_active": snapshot.is_active,
      "label": display,
      "kind": "emotecombo",
      "t": crate::db::chrono_now(),
    }));
    state.obs.trigger_from_settings(
      &state.settings,
      crate::obs_client::ObsAutomationEvent::Combo(snapshot.count),
    );
  }
}

fn display_label(emote_id: &str) -> String {
  if let Some(rest) = emote_id.strip_prefix("kick:") {
    // kick:ID:NAME
    return rest
      .split(':')
      .nth(1)
      .unwrap_or(rest)
      .to_string();
  }
  if let Some(name) = emote_id.strip_prefix("colon:") {
    return format!(":{name}:");
  }
  if let Some(name) = emote_id.strip_prefix("token:") {
    return name.to_string();
  }
  if let Some(e) = emote_id.strip_prefix("emoji:") {
    return e.to_string();
  }
  emote_id.to_string()
}

/// Sohbet botunun kendi iletisi kombo sayacına girmez.
pub fn bot_sohbeti(user: &str) -> bool {
  let u = user.trim().trim_start_matches('@').to_lowercase();
  matches!(u.as_str(), "botaxt" | "sesbot" | "bot axt" | "axbot")
}

/// Chat mesajından emote çıkar → combo motoru.
/// Botun kendi iletisi mi: bilinen bot adı ya da botun az önce gönderdiği metin.
pub fn bot_iletisi_mi(state: &AppState, user: &str, text: &str) -> bool {
  bot_sohbeti(user) || state.emote_combo.bot_metni_mi(text)
}

pub fn handle_combo_on_chat(state: &AppState, user: &str, text: &str) {
  if bot_iletisi_mi(state, user, text) || text.trim_start().starts_with('!') {
    return;
  }
  if let Some((id, url)) = extract_first_emote(text) {
    handle_combo_logic(state, &state.emote_combo, &id, &url);
  }
}

#[cfg(test)]
mod tests {
  use super::{bot_sohbeti, ComboMemory};

  #[test]
  fn bot_gonderdigi_metin_otuz_sn_taninir() {
    let m = ComboMemory::new();
    m.bot_gonderdi("  KEKW KEKW ");
    assert!(m.bot_metni_mi("KEKW KEKW"));
    assert!(!m.bot_metni_mi("KEKW"));
  }

  #[test]
  fn bot_adi_komboya_girmez() {
    assert!(bot_sohbeti("BotAxT"));
    assert!(bot_sohbeti("@axbot"));
    assert!(!bot_sohbeti("izleyici"));
  }
}
