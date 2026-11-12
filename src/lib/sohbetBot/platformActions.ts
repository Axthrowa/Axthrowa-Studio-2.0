/** Sohbet komutlarının platforma giden uçları. */

import { API_BASE } from "../api";
import { emitSfxCue } from "../soundboard";
import { twitchClipOlustur, twitchKanalGuncelle, twitchKategoriAra } from "../platformAuth/twitchWrite";

export function discordWebhookAllowed(url: unknown): boolean {
  try {
    const u = new URL(String(url || "").trim());
    return (
      u.protocol === "https:" &&
      (u.hostname === "discord.com" || u.hostname === "discordapp.com") &&
      u.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

export function pickCategory<T extends { id: number | string; name?: string; ad?: string }>(
  list: T[],
  query: string
): T | null {
  const q = query.trim().toLocaleLowerCase("tr");
  if (!q || !list.length) return null;
  return (
    list.find((c) => String(c.name || c.ad || "").toLocaleLowerCase("tr") === q) || list[0]
  );
}

const loyaltyBatch = new Map<string, { delta: number; reason: string }>();
let loyaltyBatchTimer: number | null = null;

export function mirrorLoyalty(userKey: string, delta: number, reason: string) {
  if (!userKey || !Number.isFinite(delta) || delta === 0) return;
  const prev = loyaltyBatch.get(userKey);
  loyaltyBatch.set(userKey, { delta: (prev?.delta || 0) + delta, reason });
  if (loyaltyBatchTimer != null) return;
  loyaltyBatchTimer = window.setTimeout(() => {
    loyaltyBatchTimer = null;
    const rows = [...loyaltyBatch];
    loyaltyBatch.clear();
    for (const [key, row] of rows) {
      if (!row.delta) continue;
      void fetch(`${API_BASE}/api/bot/loyalty/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_key: key, delta: row.delta, reason: row.reason }),
      }).catch(() => {});
    }
  }, 3000);
}

export async function kickModerate(opts: {
  action: "timeout" | "ban" | "unban";
  user: string;
  minutes?: number;
  reason?: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/api/kick/moderation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: opts.action,
      user: opts.user.replace(/^@/, ""),
      minutes: opts.minutes,
      reason: opts.reason,
    }),
  });
  if (!res.ok) {
    const t = (await res.text().catch(() => "")).slice(0, 180);
    return t || `Kick moderasyon HTTP ${res.status}`;
  }
  if (opts.action === "unban") return `@${opts.user.replace(/^@/, "")} ban kaldırıldı`;
  if (opts.action === "ban") return `@${opts.user.replace(/^@/, "")} banlandı`;
  return `@${opts.user.replace(/^@/, "")} ${opts.minutes || 5} dk timeout`;
}

async function kickYaz(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/yayin-bilgisi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, confirm: true }),
  });
  if (res.ok) return null;
  return (await res.text().catch(() => "")).slice(0, 180) || `HTTP ${res.status}`;
}

export async function pushStreamTitle(platform: string, title: string): Promise<string> {
  if (platform === "twitch") {
    try {
      await twitchKanalGuncelle({ baslik: title });
      return `Başlık: ${title}`;
    } catch (e) {
      return `Başlık yerelde duruyor. Twitch: ${(e as Error).message || e}`;
    }
  }
  if (platform !== "kick") return `Başlık yerelde: ${title}`;
  const err = await kickYaz({ baslik: title });
  return err ? `Başlık yerelde duruyor. Kick: ${err}` : `Başlık: ${title}`;
}

export async function pushStreamGame(platform: string, game: string): Promise<string> {
  if (platform === "twitch") {
    try {
      const list = await twitchKategoriAra(game);
      const hit = pickCategory(
        list.map((c) => ({ id: c.id, name: c.ad })),
        game
      );
      if (!hit) return `Twitch kategorisi yok: ${game}`;
      await twitchKanalGuncelle({ kategoriId: String(hit.id) });
      return `Oyun: ${hit.name}`;
    } catch (e) {
      return `Oyun yerelde duruyor. Twitch: ${(e as Error).message || e}`;
    }
  }
  if (platform !== "kick") return `Oyun yerelde: ${game}`;
  const res = await fetch(
    `${API_BASE}/api/yayin-bilgisi/kategoriler?q=${encodeURIComponent(game)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return `Oyun yerelde duruyor. Kick: ${(await res.text().catch(() => "")).slice(0, 180)}`;
  }
  const data = (await res.json()) as { kategoriler?: { id: number; name: string }[] };
  const hit = pickCategory(data.kategoriler || [], game);
  if (!hit) return `Kick kategorisi yok: ${game}`;
  const err = await kickYaz({ kategori_id: hit.id });
  return err ? `Oyun yerelde duruyor. Kick: ${err}` : `Oyun: ${hit.name}`;
}

export async function createClip(platform: string): Promise<string> {
  if (platform === "twitch") return twitchClipOlustur();
  if (platform === "kick") {
    return "Kick’in açık API’sinde klip oluşturma yok. Klip, Kick’in kendi klip düğmesinden alınır.";
  }
  return "Bu platformda klip komutu yok.";
}

export async function requestSong(query: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/player/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, queue: true }),
  });
  if (!res.ok) {
    const t = (await res.text().catch(() => "")).slice(0, 160);
    return t || "Çalar sıraya ekleyemedi";
  }
  const data = (await res.json()) as { title?: string; artist?: string };
  const title = data.title || query;
  return data.artist ? `${title} — ${data.artist}` : title;
}

export async function fireShopEffect(item: { scene?: string; sfx?: string; sound?: string }) {
  const scene = String(item.scene || "").trim();
  if (scene) {
    window.dispatchEvent(new CustomEvent("studio-shop-scene", { detail: { scene } }));
  }
  const file = String(item.sfx || item.sound || "").trim();
  if (file) await emitSfxCue({ file, volume: 1 });
}

export async function notifyDiscordLive(opts: {
  webhookUrl?: string;
  enabled?: boolean;
  message?: string;
  channel?: string;
  title?: string;
}) {
  if (opts.enabled === false) return;
  if (!discordWebhookAllowed(opts.webhookUrl)) return;
  const content = String(opts.message || "$(channel) yayında!")
    .replace(/\$\(channel\)/gi, opts.channel || "")
    .replace(/\$\(title\)/gi, opts.title || "")
    .slice(0, 1800);
  await fetch(String(opts.webhookUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}
