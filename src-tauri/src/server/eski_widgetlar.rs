//! WID-0: Studio'nun eski widget adresleri AxBoT'taki tek uygulamaya yönlenir.
//! OBS'e önceki sürümlerde eklenmiş kaynaklar (`/goal`, `/widgets/poll`, `/overlay/widgets/wheel`…)
//! çalışmaya devam eder; görünüm ve ayar artık botun widget'ından gelir.
//! Studio'ya özgü olanlar burada yok: giriş/mola/çıkış, sohbet ekranı, altyazı, ses efekti, birleşik katman.

use std::sync::Arc;

use axum::http::Uri;
use axum::response::{IntoResponse, Redirect, Response};
use axum::routing::get;
use axum::Router;

use crate::AppState;

/// Studio widget türü (eski adres) → AxBoT widget yolu.
const ESLESME: &[(&str, &str)] = &[
  ("goal", "/widgets/goals"),
  ("goals", "/widgets/goals"),
  ("kicksubs", "/widgets/subscriber-goal"),
  ("kick-subs", "/widgets/subscriber-goal"),
  ("label", "/widgets/event-labels"),
  ("labels", "/widgets/event-labels"),
  ("poll", "/widgets/polls"),
  ("polls", "/widgets/polls"),
  ("activity", "/widgets/activity-feed"),
  ("activityfeed", "/widgets/activity-feed"),
  ("subathon", "/widgets/subathon"),
  ("viewers", "/widgets/viewer-counter"),
  ("emote-combo", "/widgets/emote-combo"),
  ("emotecombo", "/widgets/emote-combo"),
  ("emotewall", "/widgets/emotes"),
  ("emotes", "/widgets/emotes"),
  ("shoutout", "/widgets/shoutout"),
  ("shoutouts", "/widgets/shoutout"),
  ("wheel", "/widgets/wheel"),
  ("fortunewheel", "/widgets/wheel"),
  ("hype", "/widgets/hype-train"),
  ("hypetrain", "/widgets/hype-train"),
  ("now-playing", "/widgets/now-playing"),
  ("songrequest", "/widgets/now-playing"),
  ("redeems", "/widgets/loyalty-redeem"),
  ("giveaway", "/widgets/giveaways"),
  ("raffles", "/widgets/giveaways"),
  ("cup", "/widgets/the-cup"),
  ("glass", "/widgets/the-cup"),
  ("tts", "/widgets/audio-player"),
  ("cloudtts", "/widgets/audio-player"),
  ("credits", "/widgets/credits"),
  ("moviecredits", "/widgets/credits"),
  ("alerts", "/widgets/alertbox"),
  ("alert", "/widgets/alertbox"),
  ("chat", "/widgets/chatbox"),
];

/// Hedef türüne göre ayrı bot adresi olan hedef çubukları (`/goal?kind=followers`).
fn hedef_turu(sorgu: &str) -> Option<&'static str> {
  for parca in sorgu.split('&') {
    let (k, v) = parca.split_once('=').unwrap_or((parca, ""));
    if k != "kind" && k != "type" {
      continue;
    }
    return match v.to_ascii_lowercase().as_str() {
      "followers" | "follower" | "follow" => Some("/widgets/follower-goal"),
      "subs" | "sub" | "subscribers" => Some("/widgets/subscriber-goal"),
      "tips" | "tip" | "donation" | "donations" | "donationgoal" => Some("/widgets/donation-goal"),
      "kicks" | "kick" => Some("/widgets/kicks-goal"),
      _ => None,
    };
  }
  None
}

/// Eski Studio yolu → bot yolu (sorgu korunur). Eşleşmeyen yol `None`.
pub fn hedef(yol: &str, sorgu: Option<&str>) -> Option<String> {
  let tur = yol
    .trim_end_matches('/')
    .strip_prefix("/overlay/widgets/")
    .or_else(|| yol.strip_prefix("/widgets/"))
    .or_else(|| yol.strip_prefix("/overlay/"))
    .or_else(|| yol.strip_prefix('/'))?
    .to_ascii_lowercase();
  let mut bot = ESLESME.iter().find(|(k, _)| *k == tur).map(|(_, v)| *v)?;
  let sorgu = sorgu.unwrap_or("");
  if bot == "/widgets/goals" {
    bot = hedef_turu(sorgu).unwrap_or(bot);
  }
  Some(if sorgu.is_empty() { bot.to_string() } else { format!("{bot}?{sorgu}") })
}

async fn yonlendir(uri: Uri) -> Response {
  match hedef(uri.path(), uri.query()) {
    // Bot yalnız bu makinede dinler; OBS de aynı makinede
    Some(h) => Redirect::temporary(&format!("http://127.0.0.1:{}{h}", crate::axbot::port())).into_response(),
    None => axum::http::StatusCode::NOT_FOUND.into_response(),
  }
}

/// Eski adreslerin hepsi: kök (`/goal`), `/widgets/<tür>`, `/overlay/widgets/<tür>` ve `/overlay/alerts`.
pub fn router() -> Router<Arc<AppState>> {
  let mut r = Router::new().route("/overlay/alerts", get(yonlendir));
  for (tur, _) in ESLESME {
    // Kökteki `/chat` Studio'nun sohbet ekranıdır (kalır); yalnız widget biçimi yönlenir
    if *tur != "chat" {
      r = r.route(&format!("/{tur}"), get(yonlendir));
    }
    r = r.route(&format!("/widgets/{tur}"), get(yonlendir));
    r = r.route(&format!("/overlay/widgets/{tur}"), get(yonlendir));
  }
  r
}

#[cfg(test)]
mod tests {
  use super::hedef;

  #[test]
  fn eski_adresler_bota_yonlenir() {
    assert_eq!(hedef("/goal", Some("kind=followers&obs=1")).as_deref(), Some("/widgets/follower-goal?kind=followers&obs=1"));
    assert_eq!(hedef("/goal", None).as_deref(), Some("/widgets/goals"));
    assert_eq!(hedef("/widgets/poll", Some("obs=1")).as_deref(), Some("/widgets/polls?obs=1"));
    assert_eq!(hedef("/overlay/widgets/Wheel", None).as_deref(), Some("/widgets/wheel"));
    assert_eq!(hedef("/overlay/alerts", None).as_deref(), Some("/widgets/alertbox"));
    assert_eq!(hedef("/widgets/chat", None).as_deref(), Some("/widgets/chatbox"));
  }

  #[test]
  fn studioya_ozgu_adresler_yonlenmez() {
    for yol in ["/widgets/altyazi", "/widgets/master", "/overlay/master", "/starting", "/sfx"] {
      assert_eq!(hedef(yol, None), None, "{yol}");
    }
  }
}
