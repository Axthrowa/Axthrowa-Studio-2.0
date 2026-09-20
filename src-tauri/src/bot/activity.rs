//! Bot aktivite konsolu — chat inbound / reply ring buffer + WS broadcast.

use std::collections::VecDeque;
use std::sync::Arc;

use parking_lot::RwLock;
use serde_json::{json, Value};

use crate::AppState;

const MAX_LINES: usize = 250;

#[derive(Clone, Default)]
pub struct BotActivityLog {
  lines: Arc<RwLock<VecDeque<Value>>>,
}

impl BotActivityLog {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn push(&self, state: &AppState, entry: Value) {
    {
      let mut q = self.lines.write();
      q.push_back(entry.clone());
      while q.len() > MAX_LINES {
        q.pop_front();
      }
    }
    state.broadcast_json(&json!({
      "type": "bot-console",
      "entry": entry,
    }));
  }

  pub fn snapshot(&self, limit: usize) -> Vec<Value> {
    let q = self.lines.read();
    let n = limit.clamp(1, MAX_LINES);
    q.iter().rev().take(n).cloned().collect::<Vec<_>>().into_iter().rev().collect()
  }
}

pub fn log_chat(state: &AppState, platform: &str, user: &str, text: &str) {
  state.bot_activity.push(
    state,
    json!({
      "t": chrono_now_ms(),
      "kind": "in",
      "platform": platform,
      "user": user,
      "text": text,
    }),
  );
}

pub fn log_reply(state: &AppState, platform: &str, text: &str) {
  state.bot_activity.push(
    state,
    json!({
      "t": chrono_now_ms(),
      "kind": "out",
      "platform": platform,
      "user": "BOT",
      "text": text,
    }),
  );
}

fn chrono_now_ms() -> i64 {
  crate::db::chrono_now()
}
