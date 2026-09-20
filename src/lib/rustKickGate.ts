/** Rust KickChatRuntime bağlıyken JS smartBot Kick yanıtlarını kes (çift cevap yok). */

import { API_BASE } from "./api";

let rustKickChatActive = false;

export function setRustKickChatActive(active: boolean) {
  rustKickChatActive = !!active;
}

export function isRustKickChatActive(): boolean {
  return rustKickChatActive;
}

/** Panel kapalı olsa bile Rust dinleyici durumunu API’den oku. */
export async function refreshRustKickChatActive(): Promise<boolean> {
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
