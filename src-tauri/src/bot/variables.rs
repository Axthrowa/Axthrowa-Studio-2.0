//! Komut şablonu değişken motoru — BotRix sözdizimiyle uyumlu.
//!
//! Amaç: BotRix'te yazılmış bir komut yanıtı, bizim botta **değiştirilmeden**
//! aynı sonucu versin. Sözdizimi ve sınırlar BotRix'in kendi dokümantasyonundan
//! alındı (`botrix.live/docs`); kod onlardan alınmadı, davranış yeniden yazıldı.
//!
//! ## Çözümleme sırası
//! ```text
//! 1. <hideText>…</hideText>  → içerik çalıştırılır, çıktıdan düşer
//! 2. <ifKick|ifTwitch|ifYouTube> → platforma göre tutulur/atılır
//! 3. $(...) ve eski köşeli biçimler → içten dışa
//! ```
//! `$(...)` iç içe geçebildiği için (örn. `$(settitle $(variable))`) en içteki
//! kapanıştan başlayarak çözüyoruz.
//!
//! ## Burada olmayanlar
//! Ağ veya veritabanı gerektiren değişkenler (`fetch[...]`, `$(points)`,
//! `$(uservar ...)`) bu modülde **çözülmez**; çağıran taraf `Ctx.lookup` ile
//! sağlar. Böylece motorun tamamı saf kalıyor ve testlerde ağ/DB gerekmiyor.

use std::collections::HashMap;

use chrono::{DateTime, Datelike, Duration as ChronoDuration, Utc};

/// Komutun çalıştığı bağlam — şablon dışından gelen her şey.
#[derive(Debug, Clone, Default)]
pub struct Ctx {
  /// Komutu yazan kullanıcı adı (`$(sender)`)
  pub sender: String,
  /// Gönderenin platform kimliği (`$(userid)` / `$(senderid)`)
  pub sender_id: String,
  /// Rozet/rol listesi (`$(roles)`) — boşsa "none"
  pub roles: Vec<String>,
  /// Komut adından sonraki ham metin (`$(variable)`, `$(v1)`, …)
  pub args: String,
  /// kick | twitch | youtube
  pub platform: String,
  /// Yayıncı kanal adı (`$(channel)`)
  pub channel: String,
  /// Sohbetteki rastgele kullanıcı için havuz (`$(randomuser)`)
  pub chatters: Vec<String>,
  /// DB/ağ gerektiren değişkenler: ad → hazır değer.
  /// Çağıran taraf önceden doldurur (örn. "points" → "150").
  pub lookup: HashMap<String, String>,
  /// Çalışan komutun adı — argümansız `$(count)` bunun sayacını kullanır.
  pub command: String,
}

/// `lookup`'tan sayısal değer; yoksa 0.
fn lookup_num(ctx: &Ctx, key: &str) -> f64 {
  ctx.lookup.get(key).and_then(|v| v.parse().ok()).unwrap_or(0.0)
}

/// `anahtar;varsayılan` biçimindeki varsayılanı verir, yoksa boş.
fn default_of(arg: &str) -> String {
  let parts: Vec<&str> = arg.split(';').map(str::trim).collect();
  // @kişi;anahtar;varsayılan → 3. parça, anahtar;varsayılan → 2. parça
  if parts.first().map(|p| p.starts_with('@')).unwrap_or(false) {
    parts.get(2).unwrap_or(&"").to_string()
  } else {
    parts.get(1).unwrap_or(&"").to_string()
  }
}

impl Ctx {
  fn platform_url(&self) -> &'static str {
    match self.platform.as_str() {
      "twitch" => "https://twitch.tv",
      "youtube" => "https://youtube.com",
      _ => "https://kick.com",
    }
  }
}

/// Şablonun istediği kalıcı yazma işlemleri.
///
/// Motor saf kalsın diye yazmayı kendisi yapmıyor: ne yazılacağını biriktirir,
/// çağıran taraf render bittikten sonra veritabanına uygular. Böylece testler
/// veritabanı olmadan çalışıyor ve aynı şablon iki kez çalıştırıldığında
/// yan etki sırası öngörülebilir kalıyor.
#[derive(Debug, Clone, PartialEq)]
pub enum Effect {
  SetCounter { name: String, value: f64 },
  SetVar { scope: String, owner: String, key: String, value: String },
}

/// Şablonun okuduğu kalıcı değerlerin anahtarları.
///
/// Hangi sayaç/değişkenin kullanıldığını ancak şablona bakarak biliyoruz;
/// çağıran taraf önce bunu çıkarıp `Ctx.lookup`'ı dolduruyor, sonra render
/// ediyor. İki aşama, tek sorgu turu.
#[derive(Debug, Default, PartialEq)]
pub struct Refs {
  pub counters: Vec<String>,
  pub uservars: Vec<String>,
  pub globalvars: Vec<String>,
}

/// Şablonu tarayıp hangi kalıcı değerlerin gerektiğini çıkarır.
pub fn collect_refs(tpl: &str, command_name: &str) -> Refs {
  let mut r = Refs::default();
  let mut rest = tpl;
  while let Some(i) = rest.find("$(") {
    rest = &rest[i + 2..];
    let Some(end) = rest.find(')') else { break };
    let body = &rest[..end];
    let (name, arg) = match body.find(char::is_whitespace) {
      Some(k) => (&body[..k], body[k..].trim()),
      None => (body, ""),
    };
    match name.to_ascii_lowercase().as_str() {
      // Argümansız $(count) komutun kendi sayacını kullanır.
      "count" => push_unique(&mut r.counters, command_name),
      "getcounter" => push_unique(&mut r.counters, arg),
      "setcounter" => {
        // `$(setcounter ad değer)` iki argümanlıysa ilk kelime addır.
        let parts: Vec<&str> = arg.split_whitespace().collect();
        if parts.len() >= 2 {
          push_unique(&mut r.counters, parts[0]);
        } else {
          push_unique(&mut r.counters, command_name);
        }
      }
      "uservar" | "setuservar" => {
        let (_, key) = split_owner_key(arg);
        push_unique(&mut r.uservars, &key);
      }
      "globalvar" | "setglobalvar" => {
        let key = arg.split(';').next().unwrap_or("").trim();
        push_unique(&mut r.globalvars, key);
      }
      _ => {}
    }
  }
  r
}

fn push_unique(v: &mut Vec<String>, item: &str) {
  let item = item.trim().to_ascii_lowercase();
  if !item.is_empty() && !v.iter().any(|x| x == &item) {
    v.push(item);
  }
}

/// `@kullanıcı;anahtar[;varsayılan]` veya `anahtar[;varsayılan]`
fn split_owner_key(arg: &str) -> (String, String) {
  let parts: Vec<&str> = arg.split(';').map(str::trim).collect();
  if parts.first().map(|p| p.starts_with('@')).unwrap_or(false) {
    (
      parts[0].trim_start_matches('@').to_ascii_lowercase(),
      parts.get(1).unwrap_or(&"").to_ascii_lowercase(),
    )
  } else {
    (String::new(), parts.first().unwrap_or(&"").to_ascii_lowercase())
  }
}

/// Rastgelelik: testlerde sabitlenebilsin diye dışarıdan verilir.
pub trait Rng {
  /// [min, max] aralığında (iki uç dâhil) bir tam sayı.
  fn int(&mut self, min: i64, max: i64) -> i64;
}

/// Üretimde kullanılan basit üreteç.
pub struct SysRng;

impl Rng for SysRng {
  fn int(&mut self, min: i64, max: i64) -> i64 {
    if max <= min {
      return min;
    }
    let span = (max - min + 1) as u64;
    // Zaman tabanlı, kriptografik olmayan; sohbet oyunu için yeterli.
    let nanos = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.subsec_nanos() as u64 ^ d.as_secs())
      .unwrap_or(0);
    min + (nanos % span) as i64
  }
}

/// BotRix sınırları — dokümantasyonda açıkça verilenler.
const MAX_REPEAT: usize = 10;
const MAX_LOCALS: usize = 5;

/// Şablonu çözer. Kalıcı yazmalar `effects` listesine birikir.
pub fn render(
  tpl: &str,
  ctx: &Ctx,
  rng: &mut dyn Rng,
  now: DateTime<Utc>,
  effects: &mut Vec<Effect>,
) -> String {
  let mut locals: HashMap<String, String> = HashMap::new();
  let stage = strip_platform_tags(tpl, &ctx.platform);
  let stage = resolve_dollars(&stage, ctx, rng, now, &mut locals, effects);
  let stage = strip_hidden(&stage);
  collapse_ws(&stage)
}

/* ------------------------------------------------------------ işaretleme */

/// `<ifKick>…</ifKick>` gibi blokları platforma göre tutar veya atar.
fn strip_platform_tags(input: &str, platform: &str) -> String {
  let mut out = input.to_string();
  for (tag, plat) in [
    ("ifTwitch", "twitch"),
    ("ifKick", "kick"),
    ("ifYouTube", "youtube"),
  ] {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    while let Some(start) = out.find(&open) {
      let Some(rel_end) = out[start..].find(&close) else {
        // Kapanışı olmayan etiket: açılışı at, metni bırak.
        out.replace_range(start..start + open.len(), "");
        break;
      };
      let inner_start = start + open.len();
      let inner_end = start + rel_end;
      let keep = platform.eq_ignore_ascii_case(plat);
      let inner = out[inner_start..inner_end].to_string();
      let replacement = if keep { inner } else { String::new() };
      out.replace_range(start..inner_end + close.len(), &replacement);
    }
  }
  out
}

/// `<hideText>…</hideText>` — içerik zaten çalıştırıldı, çıktıdan düşsün.
fn strip_hidden(input: &str) -> String {
  let mut out = input.to_string();
  while let Some(start) = out.find("<hideText>") {
    let Some(rel_end) = out[start..].find("</hideText>") else {
      out.replace_range(start..start + "<hideText>".len(), "");
      break;
    };
    let end = start + rel_end + "</hideText>".len();
    out.replace_range(start..end, "");
  }
  out
}

/// Şablon çözüldükten sonra kalan çift boşlukları toparlar.
fn collapse_ws(input: &str) -> String {
  let mut out = String::with_capacity(input.len());
  let mut last_space = false;
  for ch in input.chars() {
    let is_space = ch == ' ' || ch == '\t';
    if is_space && last_space {
      continue;
    }
    last_space = is_space;
    out.push(ch);
  }
  out.trim().to_string()
}

/* --------------------------------------------------------- $() çözümleme */

/// En içteki `$(` … `)` çiftinden başlayarak çözer; iç içe kullanım çalışır.
fn resolve_dollars(
  input: &str,
  ctx: &Ctx,
  rng: &mut dyn Rng,
  now: DateTime<Utc>,
  locals: &mut HashMap<String, String>,
  effects: &mut Vec<Effect>,
) -> String {
  let mut out = resolve_legacy(input, rng);
  // Sonsuz döngüye karşı üst sınır: her tur en az bir ifadeyi tüketiyor.
  for _ in 0..200 {
    let Some(open) = find_innermost_open(&out) else { break };
    // Gövdedeki sıradan parantezler ($(math (2+3) * 4)) grubun kapanışıyla
    // karışmasın: derinlik sayarak eşleşen ')' bulunur.
    let Some(close) = matching_close(&out, open) else { break };
    let body = out[open + 2..close].to_string();
    let value = eval(&body, ctx, rng, now, locals, effects);
    out.replace_range(open..close + 1, &value);
  }
  out
}

/// `$(` ile açılan grubun kapanış parantezi (iç parantezler sayılarak).
fn matching_close(s: &str, open: usize) -> Option<usize> {
  let b = s.as_bytes();
  let mut depth = 0i32;
  let mut i = open + 1; // '(' karakterinden başla
  while i < b.len() {
    match b[i] {
      b'(' => depth += 1,
      b')' => {
        depth -= 1;
        if depth == 0 {
          return Some(i);
        }
      }
      _ => {}
    }
    i += 1;
  }
  None
}

/// İçinde başka `$(` barındırmayan ilk `$(` konumu.
fn find_innermost_open(s: &str) -> Option<usize> {
  let bytes = s.as_bytes();
  let mut last: Option<usize> = None;
  let mut i = 0;
  while i + 1 < bytes.len() {
    if bytes[i] == b'$' && bytes[i + 1] == b'(' {
      last = Some(i);
    }
    if bytes[i] == b')' && last.is_some() {
      return last;
    }
    i += 1;
  }
  last
}

/// Eski köşeli biçimler: `Rand[a,b]` ve `RandomList[a;b;c]`.
fn resolve_legacy(input: &str, rng: &mut dyn Rng) -> String {
  let mut out = input.to_string();
  while let Some(start) = out.find("RandomList[") {
    let Some(rel) = out[start..].find(']') else { break };
    let end = start + rel;
    let items: Vec<&str> = out[start + "RandomList[".len()..end]
      .split(';')
      .map(str::trim)
      .filter(|s| !s.is_empty())
      .collect();
    let pick = if items.is_empty() {
      String::new()
    } else {
      items[rng.int(0, items.len() as i64 - 1).clamp(0, items.len() as i64 - 1) as usize].to_string()
    };
    out.replace_range(start..end + 1, &pick);
  }
  while let Some(start) = out.find("Rand[") {
    let Some(rel) = out[start..].find(']') else { break };
    let end = start + rel;
    let inner = out[start + "Rand[".len()..end].to_string();
    let mut it = inner.split(',');
    let a = it.next().unwrap_or("0").trim().parse::<i64>().unwrap_or(0);
    let b = it.next().unwrap_or("0").trim().parse::<i64>().unwrap_or(0);
    let v = rng.int(a.min(b), a.max(b)).to_string();
    out.replace_range(start..end + 1, &v);
  }
  out
}

/// Tek bir `$( … )` gövdesini değerlendirir.
fn eval(
  body: &str,
  ctx: &Ctx,
  rng: &mut dyn Rng,
  now: DateTime<Utc>,
  locals: &mut HashMap<String, String>,
  effects: &mut Vec<Effect>,
) -> String {
  let body = body.trim();
  let (name, rest) = match body.find(char::is_whitespace) {
    Some(i) => (&body[..i], body[i..].trim()),
    None => (body, ""),
  };

  match name.to_ascii_lowercase().as_str() {
    /* --- kullanıcı ve girdi --- */
    "sender" | "user" | "username" => ctx.sender.clone(),
    "userid" | "senderid" => ctx.sender_id.clone(),
    "roles" => {
      if ctx.roles.is_empty() {
        "none".into()
      } else {
        ctx.roles.join(", ")
      }
    }
    // Komuttan sonraki tüm metin; yoksa fallback (varsa) ya da boş.
    "variable" => {
      if ctx.args.trim().is_empty() {
        rest.to_string()
      } else {
        ctx.args.trim().to_string()
      }
    }
    // Aynısı ama girdi yoksa "null" — fetch adreslerinde ayırt edilebilsin diye.
    "optionalvariable" => {
      if ctx.args.trim().is_empty() {
        "null".into()
      } else {
        ctx.args.trim().to_string()
      }
    }
    "v1" | "v2" | "v3" | "v4" | "v5" => {
      let idx: usize = name[1..].parse().unwrap_or(1);
      ctx
        .args
        .split_whitespace()
        .nth(idx - 1)
        .map(str::to_string)
        // Konumsal fallback tek kelime olmalı (BotRix kuralı).
        .unwrap_or_else(|| rest.split_whitespace().next().unwrap_or("").to_string())
    }
    // Baştaki @ atılır: kick.com/$(toname) gibi adresler bozulmasın.
    "toname" => {
      let first = ctx.args.split_whitespace().next().unwrap_or("");
      first.trim_start_matches('@').to_string()
    }
    "randomuser" => pick_chatter(ctx, rng).unwrap_or_default(),
    "optionalrandomuser" => {
      let given = ctx.args.split_whitespace().next().unwrap_or("").trim_start_matches('@');
      if given.is_empty() {
        pick_chatter(ctx, rng).unwrap_or_default()
      } else {
        given.to_string()
      }
    }

    /* --- kanal --- */
    "channel" => ctx.channel.clone(),
    "platform" => ctx.platform.clone(),
    "platformurl" => ctx.platform_url().to_string(),

    /* --- rastgele ve metin --- */
    "random" => {
      let mut it = rest.split_whitespace();
      let a = it.next().unwrap_or("0").parse::<i64>().unwrap_or(0);
      let b = it.next().unwrap_or("0").parse::<i64>().unwrap_or(0);
      rng.int(a.min(b), a.max(b)).to_string()
    }
    "repeat" => {
      let (n, text) = match rest.find(char::is_whitespace) {
        Some(i) => (rest[..i].parse::<usize>().unwrap_or(0), rest[i..].trim()),
        None => (0, ""),
      };
      text.repeat(n.min(MAX_REPEAT))
    }
    "urlencode" => urlencoding::encode(rest).into_owned(),
    "urldecode" => urlencoding::decode(rest)
      .map(|s| s.into_owned())
      .unwrap_or_else(|_| rest.to_string()),

    /* --- matematik --- */
    "math" => eval_math(rest).map(fmt_num).unwrap_or_else(|| "(math error)".into()),
    "round" => rest
      .trim()
      .parse::<f64>()
      .map(|v| v.round() as i64)
      .map(|v| v.to_string())
      .unwrap_or_else(|_| "(math error)".into()),

    /* --- zaman --- */
    "countdown" => span_text(parse_when(rest), now, true),
    "countup" => span_text(parse_when(rest), now, false),

    /* --- sayaçlar --- */
    // Argümansız $(count) komutun kendi sayacı; `+1` / `-10` değiştirir.
    "count" => {
      let ad = ctx.command.to_ascii_lowercase();
      let simdi = lookup_num(ctx, &format!("counter:{ad}"));
      if rest.is_empty() {
        return fmt_num(simdi);
      }
      let delta: f64 = rest.trim().parse().unwrap_or(0.0);
      let yeni = simdi + delta;
      effects.push(Effect::SetCounter { name: ad, value: yeni });
      fmt_num(yeni)
    }
    "getcounter" => fmt_num(lookup_num(ctx, &format!("counter:{}", rest.to_ascii_lowercase()))),
    "setcounter" => {
      let parts: Vec<&str> = rest.split_whitespace().collect();
      let (ad, deger) = if parts.len() >= 2 {
        (parts[0].to_ascii_lowercase(), parts[1].parse().unwrap_or(0.0))
      } else {
        (ctx.command.to_ascii_lowercase(), parts.first().and_then(|v| v.parse().ok()).unwrap_or(0.0))
      };
      effects.push(Effect::SetCounter { name: ad, value: deger });
      fmt_num(deger)
    }

    /* --- kalıcı değişkenler --- */
    "uservar" => {
      let (owner, key) = split_owner_key(rest);
      let sahip = if owner.is_empty() { ctx.sender.to_ascii_lowercase() } else { owner };
      let varsayilan = default_of(rest);
      ctx
        .lookup
        .get(&format!("uservar:{sahip}:{key}"))
        .cloned()
        .unwrap_or(varsayilan)
    }
    "setuservar" => {
      // `$(setuservar anahtar;değer)` veya `$(setuservar @kişi;anahtar;değer)`
      let parts: Vec<&str> = rest.split(';').map(str::trim).collect();
      let (sahip, key, value) = if parts.first().map(|p| p.starts_with('@')).unwrap_or(false) {
        (
          parts[0].trim_start_matches('@').to_ascii_lowercase(),
          parts.get(1).unwrap_or(&"").to_ascii_lowercase(),
          parts.get(2).unwrap_or(&"").to_string(),
        )
      } else {
        (
          ctx.sender.to_ascii_lowercase(),
          parts.first().unwrap_or(&"").to_ascii_lowercase(),
          parts.get(1).unwrap_or(&"").to_string(),
        )
      };
      effects.push(Effect::SetVar {
        scope: "user".into(),
        owner: sahip,
        key,
        value: value.clone(),
      });
      value
    }
    "uservarlist" => ctx
      .lookup
      .get(&format!("uservarlist:{}", ctx.sender.to_ascii_lowercase()))
      .cloned()
      .unwrap_or_default(),
    "globalvar" => {
      let key = rest.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
      ctx
        .lookup
        .get(&format!("globalvar:{key}"))
        .cloned()
        .unwrap_or_else(|| default_of(rest))
    }
    "setglobalvar" => {
      let (key, value) = split_semi(rest);
      effects.push(Effect::SetVar {
        scope: "global".into(),
        owner: String::new(),
        key,
        value: value.clone(),
      });
      value
    }
    "globalvarlist" => ctx.lookup.get("globalvarlist").cloned().unwrap_or_default(),

    /* --- yerel değişkenler --- */
    "setlocal" => {
      let (k, v) = split_semi(rest);
      if locals.len() >= MAX_LOCALS && !locals.contains_key(&k) {
        return String::new();
      }
      locals.insert(k, v.clone());
      v
    }
    "local" => {
      let (k, default) = split_semi(rest);
      locals.get(&k).cloned().unwrap_or(default)
    }

    /* --- dışarıdan sağlananlar --- */
    _ => {
      let key = if rest.is_empty() {
        name.to_ascii_lowercase()
      } else {
        format!("{} {}", name.to_ascii_lowercase(), rest)
      };
      ctx
        .lookup
        .get(&key)
        .or_else(|| ctx.lookup.get(&name.to_ascii_lowercase()))
        .cloned()
        .unwrap_or_default()
    }
  }
}

fn pick_chatter(ctx: &Ctx, rng: &mut dyn Rng) -> Option<String> {
  if ctx.chatters.is_empty() {
    return None;
  }
  let i = rng.int(0, ctx.chatters.len() as i64 - 1);
  ctx.chatters.get(i.max(0) as usize).cloned()
}

/// `anahtar;değer` — ayraç yoksa değer boş.
fn split_semi(rest: &str) -> (String, String) {
  match rest.split_once(';') {
    Some((k, v)) => (k.trim().to_ascii_lowercase(), v.trim().to_string()),
    None => (rest.trim().to_ascii_lowercase(), String::new()),
  }
}

fn fmt_num(v: f64) -> String {
  if (v - v.round()).abs() < 1e-9 {
    format!("{}", v.round() as i64)
  } else {
    // Gereksiz ondalık kuyruğu olmasın.
    let s = format!("{v:.6}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
  }
}

/* ------------------------------------------------------------- matematik */

/// `+ - * / %` ve parantez destekli küçük bir ifade değerlendirici.
///
/// Hazır bir ifade kütüphanesi eklemek yerine yazıldı: girdi sohbetten
/// geliyor, bağımlılık yüzeyini büyütmenin bir faydası yok.
fn eval_math(src: &str) -> Option<f64> {
  let mut p = MathParser { b: src.as_bytes(), i: 0 };
  let v = p.expr()?;
  p.ws();
  if p.i != p.b.len() {
    return None;
  }
  v.is_finite().then_some(v)
}

struct MathParser<'a> {
  b: &'a [u8],
  i: usize,
}

impl MathParser<'_> {
  fn ws(&mut self) {
    while self.i < self.b.len() && (self.b[self.i] as char).is_whitespace() {
      self.i += 1;
    }
  }

  fn expr(&mut self) -> Option<f64> {
    let mut acc = self.term()?;
    loop {
      self.ws();
      match self.b.get(self.i) {
        Some(b'+') => {
          self.i += 1;
          acc += self.term()?;
        }
        Some(b'-') => {
          self.i += 1;
          acc -= self.term()?;
        }
        _ => return Some(acc),
      }
    }
  }

  fn term(&mut self) -> Option<f64> {
    let mut acc = self.unary()?;
    loop {
      self.ws();
      match self.b.get(self.i) {
        Some(b'*') => {
          self.i += 1;
          acc *= self.unary()?;
        }
        Some(b'/') => {
          self.i += 1;
          let d = self.unary()?;
          if d == 0.0 {
            return None;
          }
          acc /= d;
        }
        Some(b'%') => {
          self.i += 1;
          let d = self.unary()?;
          if d == 0.0 {
            return None;
          }
          acc %= d;
        }
        _ => return Some(acc),
      }
    }
  }

  fn unary(&mut self) -> Option<f64> {
    self.ws();
    if self.b.get(self.i) == Some(&b'-') {
      self.i += 1;
      return Some(-self.unary()?);
    }
    self.atom()
  }

  fn atom(&mut self) -> Option<f64> {
    self.ws();
    if self.b.get(self.i) == Some(&b'(') {
      self.i += 1;
      let v = self.expr()?;
      self.ws();
      if self.b.get(self.i) != Some(&b')') {
        return None;
      }
      self.i += 1;
      return Some(v);
    }
    let start = self.i;
    while self.i < self.b.len() && ((self.b[self.i] as char).is_ascii_digit() || self.b[self.i] == b'.') {
      self.i += 1;
    }
    (start != self.i).then(|| std::str::from_utf8(&self.b[start..self.i]).ok()?.parse().ok())?
  }
}

/* ------------------------------------------------------------------ zaman */

/// `2024-12-31`, `2024-12-31 00:00`, `2024-12-31 00:00 GMT+1`
fn parse_when(src: &str) -> Option<DateTime<Utc>> {
  let src = src.trim();
  if src.is_empty() {
    return None;
  }
  let mut parts = src.split_whitespace();
  let date = parts.next()?;
  let time = parts.next().unwrap_or("00:00");
  let offset_hours = parts
    .next()
    .and_then(|z| {
      let z = z.trim().to_ascii_uppercase();
      let z = z.strip_prefix("GMT").or_else(|| z.strip_prefix("UTC"))?;
      z.parse::<i64>().ok()
    })
    .unwrap_or(0);

  let mut d = date.split('-');
  let y: i32 = d.next()?.parse().ok()?;
  let mo: u32 = d.next()?.parse().ok()?;
  let da: u32 = d.next()?.parse().ok()?;
  let mut t = time.split(':');
  let h: u32 = t.next().unwrap_or("0").parse().ok()?;
  let mi: u32 = t.next().unwrap_or("0").parse().ok()?;

  let naive = chrono::NaiveDate::from_ymd_opt(y, mo, da)?.and_hms_opt(h, mi, 0)?;
  Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc) - ChronoDuration::hours(offset_hours))
}

/// İki tarih arasını "1 yıl 2 ay 3 gün 4 saat" gibi yazar.
fn span_text(when: Option<DateTime<Utc>>, now: DateTime<Utc>, countdown: bool) -> String {
  let Some(when) = when else {
    return "(bad date)".into();
  };
  let (from, to) = if countdown { (now, when) } else { (when, now) };
  if to <= from {
    return "0 dakika".into();
  }
  // Yıl/ay takvimsel, gerisi süreden: "1 ay" her zaman 30 gün değil.
  let mut years = to.year() - from.year();
  let mut months = to.month() as i32 - from.month() as i32;
  if months < 0 {
    years -= 1;
    months += 12;
  }
  let anchor = add_months(from, years * 12 + months);
  let (years, months, anchor) = if anchor > to {
    let m = years * 12 + months - 1;
    (m / 12, m % 12, add_months(from, m))
  } else {
    (years, months, anchor)
  };
  let rest = to - anchor;
  let days = rest.num_days();
  let hours = rest.num_hours() - days * 24;
  let mins = rest.num_minutes() - rest.num_hours() * 60;

  let mut out: Vec<String> = Vec::new();
  if years > 0 {
    out.push(format!("{years} yıl"));
  }
  if months > 0 {
    out.push(format!("{months} ay"));
  }
  if days > 0 {
    out.push(format!("{days} gün"));
  }
  if hours > 0 {
    out.push(format!("{hours} saat"));
  }
  if mins > 0 || out.is_empty() {
    out.push(format!("{mins} dakika"));
  }
  let text = out.join(" ");
  if countdown {
    text
  } else {
    format!("{text} önce")
  }
}

fn add_months(base: DateTime<Utc>, months: i32) -> DateTime<Utc> {
  let total = base.year() * 12 + base.month() as i32 - 1 + months;
  let y = total.div_euclid(12);
  let m = total.rem_euclid(12) as u32 + 1;
  // Ayın son günü taşarsa (31 Ocak + 1 ay) o ayın son gününe çek.
  let day = base.day();
  let mut d = day;
  loop {
    if let Some(nd) = chrono::NaiveDate::from_ymd_opt(y, m, d) {
      let t = base.time();
      return DateTime::<Utc>::from_naive_utc_and_offset(nd.and_time(t), Utc);
    }
    if d <= 1 {
      return base;
    }
    d -= 1;
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Testlerde rastgelelik sabit: hep aralığın alt ucu.
  struct FixedRng(i64);
  impl Rng for FixedRng {
    fn int(&mut self, min: i64, max: i64) -> i64 {
      (min + self.0).min(max)
    }
  }

  fn ctx() -> Ctx {
    Ctx {
      sender: "AxthrowA".into(),
      sender_id: "835456".into(),
      roles: vec!["moderator".into(), "subscriber".into()],
      args: String::new(),
      platform: "kick".into(),
      channel: "Streamer".into(),
      chatters: vec!["ViewerA".into(), "ViewerB".into()],
      lookup: HashMap::new(),
      command: "test".into(),
    }
  }

  fn run(tpl: &str, c: &Ctx) -> String {
    let mut fx = Vec::new();
    render(tpl, c, &mut FixedRng(0), Utc::now(), &mut fx)
  }

  /// Yazma isteklerini de görmek gerektiğinde.
  fn run_fx(tpl: &str, c: &Ctx) -> (String, Vec<Effect>) {
    let mut fx = Vec::new();
    let out = render(tpl, c, &mut FixedRng(0), Utc::now(), &mut fx);
    (out, fx)
  }

  #[test]
  fn kullanici_degiskenleri() {
    let c = ctx();
    assert_eq!(run("Merhaba @$(sender)", &c), "Merhaba @AxthrowA");
    assert_eq!(run("$(sender) roles: $(roles)", &c), "AxthrowA roles: moderator, subscriber");
    assert_eq!(run("Your ID: $(userid)", &c), "Your ID: 835456");

    let mut bos = ctx();
    bos.roles.clear();
    assert_eq!(run("roles: $(roles)", &bos), "roles: none");
  }

  #[test]
  fn variable_ve_fallback() {
    let mut c = ctx();
    c.args = "red car".into();
    assert_eq!(run("You chose: $(variable)", &c), "You chose: red car");

    c.args = String::new();
    assert_eq!(run("You chose: $(variable fallback text)", &c), "You chose: fallback text");
    // optionalvariable girdi yoksa "null" — fetch adresinde ayırt edilsin
    assert_eq!(run("value=$(optionalvariable)", &c), "value=null");
  }

  #[test]
  fn konumsal_argumanlar() {
    let mut c = ctx();
    c.args = "mouse keyboard".into();
    assert_eq!(run("Second item: $(v2)", &c), "Second item: keyboard");
    assert_eq!(run("Winner: $(v1)", &c), "Winner: mouse");

    c.args = "mouse".into();
    assert_eq!(run("Second item: $(v2 fallback)", &c), "Second item: fallback");
  }

  #[test]
  fn toname_at_isaretini_atar() {
    let mut c = ctx();
    c.args = "@elJenrix".into();
    assert_eq!(
      run("Follow https://kick.com/$(toname)", &c),
      "Follow https://kick.com/elJenrix"
    );
  }

  #[test]
  fn platform_kosullari() {
    let mut c = ctx();
    c.platform = "kick".into();
    assert_eq!(run("Selam!<ifTwitch>DinoDance</ifTwitch><ifKick>kickEmote</ifKick>", &c), "Selam!kickEmote");
    c.platform = "twitch".into();
    assert_eq!(run("Selam!<ifTwitch>DinoDance</ifTwitch><ifKick>kickEmote</ifKick>", &c), "Selam!DinoDance");
    c.platform = "youtube".into();
    assert_eq!(run("Selam!<ifTwitch>a</ifTwitch><ifKick>b</ifKick>", &c), "Selam!");
  }

  #[test]
  fn hidetext_ciktidan_duser() {
    let c = ctx();
    assert_eq!(run("Başlık değişti. <hideText>gizli</hideText>", &c), "Başlık değişti.");
  }

  #[test]
  fn matematik() {
    let c = ctx();
    assert_eq!(run("Result: $(math 5 * 5)", &c), "Result: 25");
    assert_eq!(run("$(math (2 + 3) * 4)", &c), "20");
    assert_eq!(run("$(math 7 / 2)", &c), "3.5");
    assert_eq!(run("$(math 10 % 3)", &c), "1");
    assert_eq!(run("$(round 4.6)", &c), "5");
    // Sıfıra bölme sessizce yanlış sonuç vermesin
    assert_eq!(run("$(math 1 / 0)", &c), "(math error)");
  }

  #[test]
  fn repeat_on_ile_sinirli() {
    let c = ctx();
    assert_eq!(run("$(repeat 3 ha)", &c), "hahaha");
    // BotRix sınırı: en çok 10 tekrar
    assert_eq!(run("$(repeat 50 x)", &c).len(), 10);
  }

  #[test]
  fn url_kodlama() {
    let c = ctx();
    assert_eq!(run("$(urlencode hello world)", &c), "hello%20world");
    assert_eq!(run("$(urldecode hello%20world)", &c), "hello world");
  }

  #[test]
  fn eski_rastgele_bicimleri() {
    let c = ctx();
    assert_eq!(run("Luck: Rand[0,10]", &c), "Luck: 0");
    assert_eq!(run("Answer: RandomList[Yes;No;Maybe]", &c), "Answer: Yes");
  }

  #[test]
  fn yerel_degiskenler_ve_sinir() {
    let c = ctx();
    assert_eq!(run("$(setlocal result;winner)|$(local result)", &c), "winner|winner");
    assert_eq!(run("$(local missing;fallback)", &c), "fallback");
    // 5'ten fazla yerel değişken kabul edilmemeli
    let tpl = "$(setlocal a;1)$(setlocal b;2)$(setlocal c;3)$(setlocal d;4)$(setlocal e;5)$(setlocal f;6)$(local f;yok)";
    assert!(run(tpl, &c).ends_with("yok"), "{}", run(tpl, &c));
  }

  #[test]
  fn ic_ice_degiskenler() {
    let mut c = ctx();
    c.args = "yeni başlık".into();
    c.lookup.insert("settitle yeni başlık".into(), "(yeni başlık)".into());
    assert_eq!(run("$(settitle $(variable))", &c), "(yeni başlık)");
  }

  #[test]
  fn disaridan_saglanan_degerler() {
    let mut c = ctx();
    c.lookup.insert("points".into(), "150".into());
    c.lookup.insert("uptime".into(), "1h 33min".into());
    assert_eq!(run("You have $(points) points.", &c), "You have 150 points.");
    assert_eq!(run("Uptime: $(uptime)", &c), "Uptime: 1h 33min");
    // Bilinmeyen değişken metni kirletmesin
    assert_eq!(run("x$(bilinmeyen)y", &c), "xy");
  }

  #[test]
  fn platform_url() {
    let mut c = ctx();
    c.args = "@elJenrix".into();
    assert_eq!(run("$(platformUrl)/$(toname)", &c), "https://kick.com/elJenrix");
    c.platform = "twitch".into();
    assert_eq!(run("$(platformUrl)/$(toname)", &c), "https://twitch.tv/elJenrix");
  }

  #[test]
  fn geri_sayim_ve_gecen_sure() {
    let c = ctx();
    let now = DateTime::<Utc>::from_naive_utc_and_offset(
      chrono::NaiveDate::from_ymd_opt(2024, 1, 1).unwrap().and_hms_opt(0, 0, 0).unwrap(),
      Utc,
    );
    let out = render("$(countdown 2024-03-01)", &c, &mut FixedRng(0), now, &mut Vec::new());
    assert!(out.contains("2 ay"), "{out}");
    let out2 = render("$(countup 2023-01-01)", &c, &mut FixedRng(0), now, &mut Vec::new());
    assert!(out2.contains("1 yıl") && out2.ends_with("önce"), "{out2}");
    assert_eq!(render("$(countdown bozuk)", &c, &mut FixedRng(0), now, &mut Vec::new()), "(bad date)");
  }

  #[test]
  fn sayac_okur_ve_yazma_istegi_uretir() {
    let mut c = ctx();
    c.command = "olum".into();
    c.lookup.insert("counter:olum".into(), "10".into());
    assert_eq!(run("Ölüm: $(count)", &c), "Ölüm: 10");

    let (out, fx) = run_fx("$(count +1)", &c);
    assert_eq!(out, "11");
    assert_eq!(fx, vec![Effect::SetCounter { name: "olum".into(), value: 11.0 }]);

    let (out2, fx2) = run_fx("$(count -10)", &c);
    assert_eq!(out2, "0");
    assert_eq!(fx2, vec![Effect::SetCounter { name: "olum".into(), value: 0.0 }]);
  }

  #[test]
  fn adlandirilmis_sayac() {
    let mut c = ctx();
    c.lookup.insert("counter:olum".into(), "5".into());
    assert_eq!(run("$(getcounter olum)", &c), "5");
    // Olmayan sayaç 0
    assert_eq!(run("$(getcounter yok)", &c), "0");

    let (out, fx) = run_fx("$(setcounter olum 102)", &c);
    assert_eq!(out, "102");
    assert_eq!(fx, vec![Effect::SetCounter { name: "olum".into(), value: 102.0 }]);
  }

  #[test]
  fn kullanici_degiskeni_okur_ve_yazar() {
    let mut c = ctx();
    c.lookup.insert("uservar:axthrowa:wins".into(), "7".into());
    assert_eq!(run("$(uservar wins)", &c), "7");
    // Varsayılan yalnız değer yokken kullanılır
    assert_eq!(run("$(uservar rank;unranked)", &c), "unranked");

    let (out, fx) = run_fx("$(setuservar wins;9)", &c);
    assert_eq!(out, "9");
    assert_eq!(
      fx,
      vec![Effect::SetVar {
        scope: "user".into(),
        owner: "axthrowa".into(),
        key: "wins".into(),
        value: "9".into()
      }]
    );
  }

  #[test]
  fn baska_kullanicinin_degiskeni() {
    let mut c = ctx();
    c.lookup.insert("uservar:player1:rank".into(), "gold".into());
    assert_eq!(run("$(uservar @player1;rank)", &c), "gold");
    assert_eq!(run("$(uservar @player1;rank;unranked)", &c), "gold");
    assert_eq!(run("$(uservar @bos;rank;unranked)", &c), "unranked");

    let (_, fx) = run_fx("$(setuservar @player1;rank;silver)", &c);
    assert_eq!(fx[0], Effect::SetVar {
      scope: "user".into(), owner: "player1".into(),
      key: "rank".into(), value: "silver".into()
    });
  }

  #[test]
  fn global_degisken() {
    let mut c = ctx();
    c.lookup.insert("globalvar:status".into(), "live".into());
    assert_eq!(run("$(globalvar status)", &c), "live");
    assert_eq!(run("$(globalvar mode;default)", &c), "default");

    let (out, fx) = run_fx("$(setglobalvar status;offline)", &c);
    assert_eq!(out, "offline");
    assert_eq!(fx[0], Effect::SetVar {
      scope: "global".into(), owner: String::new(),
      key: "status".into(), value: "offline".into()
    });
  }

  #[test]
  fn degisken_listeleri() {
    let mut c = ctx();
    c.lookup.insert("uservarlist:axthrowa".into(), "rank, wins".into());
    c.lookup.insert("globalvarlist".into(), "mode, status".into());
    assert_eq!(run("$(uservarlist)", &c), "rank, wins");
    assert_eq!(run("$(globalvarlist)", &c), "mode, status");
  }

  #[test]
  fn collect_refs_sablondan_anahtarlari_cikarir() {
    let r = collect_refs(
      "$(count +1) $(getcounter dolar) $(uservar wins) $(globalvar mode) $(setuservar @x;rank;gold)",
      "olum",
    );
    assert_eq!(r.counters, vec!["olum", "dolar"]);
    assert_eq!(r.uservars, vec!["wins", "rank"]);
    assert_eq!(r.globalvars, vec!["mode"]);
  }

  #[test]
  fn rastgele_kullanici() {
    let mut c = ctx();
    assert_eq!(run("Winner: $(randomuser)", &c), "Winner: ViewerA");
    c.args = "@picked".into();
    assert_eq!(run("$(sender) hugs $(optionalrandomuser)", &c), "AxthrowA hugs picked");
  }
}
