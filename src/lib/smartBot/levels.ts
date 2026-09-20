/** Rozet → StreamElements tarzı kullanıcı seviyesi. */

import type { ChatMessage } from "../chatHub";
import type { UserLevel } from "./types";

export function userLevel(msg: ChatMessage, broadcasterNames: string[] = []): UserLevel {
  const u = (msg.user || "").toLowerCase();
  if (broadcasterNames.some((b) => b.toLowerCase() === u)) return 1500;

  const labels = (msg.badges || []).map((b) => (b.label || "").toLowerCase());
  const hay = labels.join(" ");

  if (
    hay.includes("broadcaster") ||
    hay.includes("yayıncı") ||
    hay.includes("streamer") ||
    hay.includes("owner")
  ) {
    return 1500;
  }
  if (hay.includes("mod") || hay.includes("moderat")) return 500;
  if (hay.includes("vip")) return 400;
  if (
    hay.includes("sub") ||
    hay.includes("abone") ||
    hay.includes("member") ||
    hay.includes("üye") ||
    hay.includes("founder")
  ) {
    return 250;
  }
  return 100;
}

export function hasLevel(have: UserLevel, need: UserLevel): boolean {
  return have >= need;
}
