/** Rust KickChatRuntime bağlıyken JS smartBot Kick yanıtlarını kes (çift cevap yok). */

import { API_BASE } from "./api";

let rustKickChatActive = false;

export function setRustKickChatActive(active: boolean) {
  rustKickChatActive = !!active;
}

export function isRustKickChatActive(): boolean {
  return rustKickChatActive;
}

/**
 * Rust Kick’i dinlerken sohbet yalnız overlay soketinden gelir ve Rust
 * komut yanıtı varsayılan olarak kapalıdır. O mesajları JS motoru işler.
 * Rust dinlemiyorsa aynı mesajı JS Pusher görür; burada tekrar işlenmez.
 */
export function jsHandlesKickCommands(rustListening: boolean): boolean {
  return rustListening;
}

let kickStatusAt = 0;
let kickStatusFlight: Promise<boolean> | null = null;

/** Panel kapalı olsa bile Rust dinleyici durumunu API’den oku. Aynı 4 sn içinde tek istek. */
export async function refreshRustKickChatActive(): Promise<boolean> {
  const now = Date.now();
  if (kickStatusFlight) return kickStatusFlight;
  if (kickStatusAt && now - kickStatusAt < 4000) return rustKickChatActive;
  kickStatusAt = now;
  kickStatusFlight = readRustKickChatActive().finally(() => {
    kickStatusFlight = null;
  });
  return kickStatusFlight;
}

async function readRustKickChatActive(): Promise<boolean> {
  for (const path of [
    `${API_BASE}/api/kick/oauth/status`,
    `${API_BASE}/api/botaxt/settings/kick/status`,
    `${API_BASE}/api/botrix/settings/kick/status`,
  ]) {
    try {
      const r = await fetch(path, { cache: "no-store" });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        connected?: boolean;
        connecting?: boolean;
        chatListening?: boolean;
      };
      if (path.endsWith("/oauth/status")) {
        rustKickChatActive = !!j?.chatListening;
      } else {
        rustKickChatActive = !!(j?.connected || j?.connecting);
      }
      return rustKickChatActive;
    } catch {
      /* sonraki path */
    }
  }
  return rustKickChatActive;
}
