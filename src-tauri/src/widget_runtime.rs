//! Widget runtime state — anket / çekiliş / song request (AppState).

use std::collections::{HashMap, HashSet};

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PollState {
  pub active: bool,
  pub question: String,
  pub options: Vec<String>,
  pub command: String,
  /// option index (1-based) → votes
  pub votes: HashMap<u32, u32>,
  pub voters: HashSet<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RaffleState {
  pub active: bool,
  pub join_command: String,
  pub duration_sec: u32,
  pub entrants: Vec<String>,
  pub winner: Option<String>,
  pub ends_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongQueueItem {
  pub id: String,
  pub title: String,
  pub by: String,
  pub video_id: Option<String>,
  pub url: Option<String>,
  pub requested_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SongQueueState {
  pub queue: Vec<SongQueueItem>,
  pub current: Option<SongQueueItem>,
  pub playing: bool,
}

#[derive(Debug, Default)]
pub struct WidgetRuntime {
  pub poll: RwLock<PollState>,
  pub raffle: RwLock<RaffleState>,
  pub songs: RwLock<SongQueueState>,
}

impl WidgetRuntime {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn poll_json(&self) -> Value {
    json!(*self.poll.read())
  }

  pub fn raffle_json(&self) -> Value {
    json!(*self.raffle.read())
  }

  pub fn songs_json(&self) -> Value {
    json!(*self.songs.read())
  }
}

/// Chat metninden YouTube video id çıkar (regex yok).
pub fn extract_youtube_id(text: &str) -> Option<String> {
  let t = text.trim();
  for marker in ["v=", "youtu.be/", "shorts/"] {
    if let Some(i) = t.find(marker) {
      let rest = &t[i + marker.len()..];
      let id: String = rest
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
      if id.len() >= 6 {
        return Some(id);
      }
    }
  }
  if t.len() == 11 && t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
    return Some(t.to_string());
  }
  None
}
