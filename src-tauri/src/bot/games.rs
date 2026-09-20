//! Minigames — `!heist` / `!roulette` / `!duel` chat komutları.
//!
//! ## Heist (bloklamayan toplanma)
//! ```text
//! pipeline (chat loop)
//!   └─ heist_start + heist_join
//!   └─ tokio::spawn {
//!         sleep(gather_sec)   // executor'a yield — chat dinleyici bloklanmaz
//!         heist_settle()
//!         announce
//!      }
//! ```

use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use anyhow::Result;
use serde_json::json;

use crate::db::botaxt_api::{
  duel, game_cfg_section, get_game_settings, heist_join, heist_settle, heist_start, roulette,
};
use crate::db::{chrono_now, default_channel_id};
use crate::AppState;

use super::integrations::ChatInbound;
use super::pipeline::send_reply;

struct PendingDuel {
  challenger_key: String,
  challenger_name: String,
  amount: i64,
  expires_at: i64,
}

fn heist_scheduled() -> &'static Mutex<HashSet<String>> {
  static S: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
  S.get_or_init(|| Mutex::new(HashSet::new()))
}

fn pending_duels() -> &'static Mutex<HashMap<String, PendingDuel>> {
  static S: OnceLock<Mutex<HashMap<String, PendingDuel>>> = OnceLock::new();
  S.get_or_init(|| Mutex::new(HashMap::new()))
}

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

fn enabled(section: &serde_json::Value) -> bool {
  section
    .get("enabled")
    .and_then(|v| v.as_bool())
    .unwrap_or(true)
}

/// Builtin oyun komutu. `Some(reply)` = işlendi; `None` = oyun değil.
pub async fn try_handle_game(
  state: &AppState,
  msg: &ChatInbound,
  prefix: &str,
) -> Result<Option<String>> {
  let Some((cmd, args)) = split_cmd(&msg.text, prefix) else {
    return Ok(None);
  };

  match cmd.as_str() {
    "heist" | "soygun" => Ok(Some(handle_heist(state, msg, &args).await?)),
    "roulette" | "rulet" => Ok(Some(handle_roulette(state, msg, &args).await?)),
    "duel" | "duello" => Ok(Some(handle_duel(state, msg, &args).await?)),
    "accept" | "kabul" => Ok(Some(handle_duel_accept(state, msg).await?)),
    _ => Ok(None),
  }
}

async fn handle_heist(state: &AppState, msg: &ChatInbound, args: &[String]) -> Result<String> {
  let gs = get_game_settings(&state.db).await?;
  let heist = game_cfg_section(&gs.config_json, "heist");
  if !enabled(&heist) {
    return Ok("Heist kapalı.".into());
  }

  let amount: i64 = args.first().and_then(|s| s.parse().ok()).unwrap_or(0);
  let min_bet = heist.get("min_bet").and_then(|v| v.as_i64()).unwrap_or(10);
  let max_bet = heist.get("max_bet").and_then(|v| v.as_i64()).unwrap_or(5000);
  if amount < min_bet {
    return Ok(format!("Kullanım: !heist <puan> (min {min_bet})"));
  }
  if amount > max_bet {
    return Ok(format!("Maks bahis {max_bet}."));
  }

  let channel_id = default_channel_id(&state.db).await?;
  let existing = sqlx::query_as::<_, (String, String)>(
    "SELECT id, config_json FROM game_rounds
     WHERE channel_id = ? AND game = 'heist' AND status = 'open'
     ORDER BY started_at DESC LIMIT 1",
  )
  .bind(&channel_id)
  .fetch_optional(&state.db)
  .await?;

  let (round_id, started_new, gather_sec) = if let Some((id, cfg_json)) = existing {
    let ends = serde_json::from_str::<serde_json::Value>(&cfg_json)
      .ok()
      .and_then(|v| v.get("ends_at").and_then(|x| x.as_i64()))
      .unwrap_or(0);
    if chrono_now() > ends {
      let _ = heist_settle(&state.db).await;
      let round = heist_start(&state.db).await?;
      let gather = heist
        .get("gather_sec")
        .and_then(|v| v.as_i64())
        .unwrap_or(120);
      (round.id, true, gather)
    } else {
      let left = ((ends - chrono_now()).max(0) / 1000).max(1);
      (id, false, left)
    }
  } else {
    let round = heist_start(&state.db).await?;
    let gather = heist
      .get("gather_sec")
      .and_then(|v| v.as_i64())
      .unwrap_or(120);
    (round.id, true, gather)
  };

  if let Err(e) = heist_join(&state.db, &msg.user_key, &msg.user_name, amount).await {
    return Ok(format!("Heist: {e:#}"));
  }

  if started_new {
    schedule_heist_settle(state.clone(), round_id, gather_sec as u64);
    Ok(format!(
      "Soygun başladı! {} {} koydu. Katıl: !heist <puan> · {} sn",
      msg.user_name, amount, gather_sec
    ))
  } else {
    Ok(format!(
      "{} soyguna {} ile katıldı · ~{} sn kaldı",
      msg.user_name, amount, gather_sec
    ))
  }
}

/// Chat loop'u bloklamadan settle — `tokio::spawn` + `sleep`.
fn schedule_heist_settle(state: AppState, round_id: String, gather_sec: u64) {
  {
    let mut set = heist_scheduled().lock().unwrap();
    if !set.insert(round_id.clone()) {
      return;
    }
  }
  tokio::spawn(async move {
    tokio::time::sleep(Duration::from_secs(gather_sec.max(1))).await;
    {
      let mut set = heist_scheduled().lock().unwrap();
      set.remove(&round_id);
    }
    match heist_settle(&state.db).await {
      Ok(result) => {
        let win = result.get("win").and_then(|v| v.as_bool()).unwrap_or(false);
        let pot = result.get("pot").and_then(|v| v.as_i64()).unwrap_or(0);
        let text = if win {
          format!("Soygun başarılı! Pot {pot} dağıtıldı.")
        } else {
          format!("Soygun başarısız. Pot {pot} yandı.")
        };
        let fake = ChatInbound {
          platform: "bot".into(),
          user_key: "bot:heist".into(),
          user_name: "Heist".into(),
          text: String::new(),
          kind: "chat".into(),
          amount: None,
          badges: vec![],
          is_mod: false,
          is_vip: false,
          is_sub: false,
          color: None,
          raw_id: round_id,
        };
        let _ = send_reply(&state, &fake, &text).await;
        state.broadcast_json(&json!({
          "type": "game-event",
          "game": "heist",
          "phase": "settled",
          "result": result,
          "t": chrono_now(),
        }));
      }
      Err(e) => yya_warn!("[heist] settle: {e:#}"),
    }
  });
}

async fn handle_roulette(state: &AppState, msg: &ChatInbound, args: &[String]) -> Result<String> {
  let gs = get_game_settings(&state.db).await?;
  let rcfg = game_cfg_section(&gs.config_json, "roulette");
  if !enabled(&rcfg) {
    return Ok("Roulette kapalı.".into());
  }
  if args.len() < 2 {
    return Ok("Kullanım: !roulette <puan> <red|black|green|0-36>".into());
  }
  let amount: i64 = args[0].parse().unwrap_or(0);
  let choice = args[1].to_ascii_lowercase();
  if amount <= 0 {
    return Ok("Geçersiz bahis.".into());
  }
  match roulette(
    &state.db,
    Some(&msg.user_key),
    Some(amount),
    Some(&choice),
  )
  .await
  {
    Ok(r) => {
      let n = r.get("number").and_then(|v| v.as_i64()).unwrap_or(0);
      let c = r.get("color").and_then(|v| v.as_str()).unwrap_or("?");
      if r.get("won").and_then(|v| v.as_bool()).unwrap_or(false) {
        let p = r.get("payout").and_then(|v| v.as_i64()).unwrap_or(0);
        Ok(format!(
          "{} → {} ({}) · kazandı +{}",
          msg.user_name, n, c, p
        ))
      } else {
        Ok(format!("{} → {} ({}) · kaybetti", msg.user_name, n, c))
      }
    }
    Err(e) => Ok(format!("Roulette: {e:#}")),
  }
}

async fn handle_duel(state: &AppState, msg: &ChatInbound, args: &[String]) -> Result<String> {
  let gs = get_game_settings(&state.db).await?;
  let dcfg = game_cfg_section(&gs.config_json, "duel");
  if !enabled(&dcfg) {
    return Ok("Duel kapalı.".into());
  }

  if args
    .first()
    .map(|s| s.eq_ignore_ascii_case("accept") || s.eq_ignore_ascii_case("kabul"))
    .unwrap_or(false)
  {
    return handle_duel_accept(state, msg).await;
  }

  if args.len() < 2 {
    return Ok("Kullanım: !duel <kullanıcı> <puan> · kabul: !accept".into());
  }
  let target_name = args[0].trim_start_matches('@');
  let amount: i64 = args[1].parse().unwrap_or(0);
  if amount <= 0 {
    return Ok("Geçersiz bahis.".into());
  }
  if target_name.eq_ignore_ascii_case(&msg.user_name) {
    return Ok("Kendinle düello yapamazsın.".into());
  }

  let accept_sec = dcfg
    .get("accept_sec")
    .and_then(|v| v.as_i64())
    .unwrap_or(60);
  let key = target_name.to_ascii_lowercase();
  {
    let mut map = pending_duels().lock().unwrap();
    map.insert(
      key,
      PendingDuel {
        challenger_key: msg.user_key.clone(),
        challenger_name: msg.user_name.clone(),
        amount,
        expires_at: chrono_now() + accept_sec * 1000,
      },
    );
  }
  Ok(format!(
    "{} → @{} düello ({} puan)! Kabul: !accept · {} sn",
    msg.user_name, target_name, amount, accept_sec
  ))
}

async fn handle_duel_accept(state: &AppState, msg: &ChatInbound) -> Result<String> {
  let pending = {
    let mut map = pending_duels().lock().unwrap();
    let key = msg.user_name.to_ascii_lowercase();
    map.remove(&key)
  };
  let Some(p) = pending else {
    return Ok("Bekleyen düello yok.".into());
  };
  if chrono_now() > p.expires_at {
    return Ok("Düello süresi doldu.".into());
  }
  if p.challenger_key == msg.user_key {
    return Ok("Kendi düellonu kabul edemezsin.".into());
  }

  match duel(
    &state.db,
    &p.challenger_key,
    &p.challenger_name,
    &msg.user_key,
    &msg.user_name,
    p.amount,
  )
  .await
  {
    Ok(r) => {
      let w = r.get("winner_name").and_then(|v| v.as_str()).unwrap_or("?");
      let prize = r.get("prize").and_then(|v| v.as_i64()).unwrap_or(0);
      Ok(format!("Düello bitti · kazanan {w} (+{prize})"))
    }
    Err(e) => Ok(format!("Düello: {e:#}")),
  }
}
