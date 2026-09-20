//! Points shop — `!buy <item_id|name>`.

use anyhow::Result;
use serde_json::{json, Value};

use crate::db::botaxt_api::shop_buy;
use crate::db::chrono_now;
use crate::AppState;

use super::integrations::ChatInbound;

fn split_cmd(text: &str, prefix: &str) -> Option<(String, Vec<String>)> {
  let t = text.trim();
  if !t.starts_with(prefix) {
    return None;
  }
  let rest = t[prefix.len()..].trim();
  let mut parts = rest.split_whitespace();
  let name = parts.next()?.to_ascii_lowercase();
  let args = parts.map(|s| s.to_string()).collect();
  Some((name, args))
}

/// `Some(reply)` işlendiyse; tetikleyici overlay/OBS için broadcast yapılır.
pub async fn try_handle_shop(
  state: &AppState,
  msg: &ChatInbound,
  prefix: &str,
) -> Result<Option<String>> {
  let Some((cmd, args)) = split_cmd(&msg.text, prefix) else {
    return Ok(None);
  };
  if cmd != "buy" && cmd != "satin" && cmd != "redeem" {
    return Ok(None);
  }
  let item_ref = args.join(" ");
  if item_ref.trim().is_empty() {
    return Ok(Some("Kullanım: !buy <öğe>".into()));
  }

  match shop_buy(&state.db, &msg.user_key, &msg.user_name, &item_ref).await {
    Ok((item, sale)) => {
      fire_shop_trigger(state, &item.trigger_kind, &item.trigger_json, &msg.user_name).await;
      if item.alert != 0 {
        state.broadcast_json(&json!({
          "type": "trigger_alert",
          "data": {
            "id": sale.id,
            "kind": "redeem",
            "user": msg.user_name,
            "message": item.name,
            "amount": item.cost.to_string(),
            "platform": msg.platform,
            "t": chrono_now(),
          }
        }));
      }
      let reply = if item.response.trim().is_empty() {
        format!("{} aldı: {} (−{})", msg.user_name, item.name, item.cost)
      } else {
        item
          .response
          .replace("{user}", &msg.user_name)
          .replace("{item}", &item.name)
          .replace("{cost}", &item.cost.to_string())
      };
      Ok(Some(reply))
    }
    Err(e) => Ok(Some(format!("Mağaza: {e:#}"))),
  }
}

async fn fire_shop_trigger(state: &AppState, kind: &str, trigger_json: &str, user: &str) {
  let trig: Value = serde_json::from_str(trigger_json).unwrap_or(json!({}));
  match kind {
    "sfx" | "sound" | "soundboard" => {
      let path = trig
        .get("path")
        .or_else(|| trig.get("file"))
        .or_else(|| trig.get("media_path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
      let volume = trig.get("volume").and_then(|v| v.as_f64()).unwrap_or(1.0);
      let id = uuid::Uuid::new_v4().to_string();
      // SfxPage `sfx-play` dinler
      state.broadcast_json(&json!({
        "type": "sfx-play",
        "id": id,
        "file": path,
        "volume": volume,
        "user": user,
        "t": chrono_now(),
      }));
      state.broadcast_json(&json!({
        "type": "shop-sfx",
        "path": path,
        "volume": volume,
        "user": user,
        "t": chrono_now(),
      }));
      state.broadcast_json(&json!({
        "type": "settings",
        "screen": "panel",
        "data": {
          "_sfxCue": { "id": id, "file": path, "volume": volume },
          "_shopSfx": { "path": path, "volume": volume, "user": user, "t": chrono_now() }
        }
      }));
    }
    "obs_scene" | "obs" => {
      let scene = trig
        .get("scene")
        .or_else(|| trig.get("sceneName"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
      state.broadcast_json(&json!({
        "type": "shop-obs-scene",
        "scene": scene,
        "user": user,
        "t": chrono_now(),
      }));
      state.broadcast_json(&json!({
        "type": "settings",
        "screen": "panel",
        "data": {
          "_shopObsScene": { "scene": scene, "user": user, "t": chrono_now() }
        }
      }));
      // Rust tarafı da doğrudan OBS'e bağlanmayı dener (panel kapalıysa)
      if !scene.is_empty() {
        let st = state.clone();
        let scene2 = scene.clone();
        tokio::spawn(async move {
          if let Err(e) = crate::hotkeys::switch_obs_scene(&st, &scene2).await {
            yya_warn!("[shop/obs] {e}");
          }
        });
      }
    }
    _ => {
      // chat-only / none
    }
  }
}
