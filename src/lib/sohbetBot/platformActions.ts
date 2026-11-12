/** Sohbet komutlarının platforma giden uçları. */

import { API_BASE } from "../api";

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
