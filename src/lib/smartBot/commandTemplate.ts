/** Komut yanıt şablonları — {url} / komut adını tekrar etmeme. */

export function extractDiscordInvite(text: string): string {
  const s = String(text || "");
  const m =
    s.match(/https?:\/\/(?:www\.)?discord(?:app)?\.gg\/([A-Za-z0-9-]+)/i) ||
    s.match(/(?:^|\s)discord\.gg\/([A-Za-z0-9-]+)/i);
  return m?.[1] ? `https://discord.gg/${m[1]}` : "";
}

export function normalizeSocialUrl(kind: string, raw: string): string {
  const s = String(raw || "")
    .trim()
    .replace(/^@/, "");
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const k = kind.replace(/^!/, "").toLowerCase();
  if (k === "discord") {
    const path = s.replace(/^https?:\/\//i, "").replace(/^discord\.gg\/?/i, "");
    return `https://discord.gg/${path.replace(/^\/+/, "")}`;
  }
  if (k === "kick") {
    const slug = s.replace(/^https?:\/\//i, "").replace(/^(www\.)?kick\.com\/?/i, "");
    return `https://kick.com/${slug.replace(/^\/+/, "")}`;
  }
  if (k === "twitch") {
    const slug = s.replace(/^https?:\/\//i, "").replace(/^(www\.)?twitch\.tv\/?/i, "");
    return `https://twitch.tv/${slug.replace(/^\/+/, "")}`;
  }
  if (s.includes(".")) return `https://${s.replace(/^\/+/, "")}`;
  return s;
}

export function fillBraceVars(
  template: string,
  vars: Record<string, string>
): string {
  let out = String(template || "");
  for (const [key, value] of Object.entries(vars)) {
    if (!key) continue;
    out = out.split(`{${key}}`).join(value ?? "");
    out = out.split(`$(${key})`).join(value ?? "");
  }
  return out;
}

export function finalizeCommandReply(opts: {
  name: string;
  reply: string;
  url: string;
  trigger: string;
}): string {
  const name = opts.name.replace(/^!/, "").trim().toLowerCase();
  if ((opts.reply.includes("{url}") || !String(opts.reply || "").trim()) && !opts.url) {
    if (name === "discord") {
      return "Discord linki yok — Komutlar sekmesinde Varsayılan komutlar içinde discord ayarlarından davet linkini yaz.";
    }
    if (name === "sosyal" || name === "socials") {
      return "Sosyal link yok — Giriş ekranına hesapları yaz veya Komutlar’dan bağlantıyı yaz.";
    }
  }
  let s = fillBraceVars(opts.reply, {
    url: opts.url,
  }).trim();
  const compact = s.replace(/\s+/g, "").toLowerCase();
  const trig = opts.trigger.trim().toLowerCase();
  const echoed =
    !s || compact === trig || compact === name || compact === `!${name}` || s.includes("{url}");
  if (echoed) {
    if (opts.url) {
      return name === "discord" ? `Discord: ${opts.url}` : opts.url;
    }
    if (name === "discord") {
      return "Discord linki yok — Komutlar sekmesinde Varsayılan komutlar içinde discord ayarlarından davet linkini yaz.";
    }
  }
  return s;
}
