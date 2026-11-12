/** Olay patlaması: tavanlı adet. Bağış ve bit karekök ile artar. */

export const PATLAMA_TAVAN = 12;

const SIMGE: Record<string, string> = {
  follow: "💜",
  sub: "⭐",
  membership: "⭐",
  raid: "🚀",
  donation: "💰",
  bits: "💎",
  superchat: "💰",
};

export function patlamaSimgesi(kind: string): string {
  return SIMGE[kind] || "✨";
}

/** null: bu olay duvarda patlamaz. */
export function patlamaAdedi(
  kind: string,
  amount: unknown,
  acik: { follow: boolean; sub: boolean }
): number | null {
  if (kind === "follow") return acik.follow ? 6 : null;
  if (kind === "sub" || kind === "membership") return acik.sub ? 8 : null;
  if (kind === "raid") return 8;
  if (kind === "donation" || kind === "bits" || kind === "superchat") {
    const n = Number(String(amount ?? "").replace(/[^\d.]/g, ""));
    const adet = Number.isFinite(n) && n > 0 ? Math.round(Math.sqrt(n)) : 4;
    return Math.max(1, Math.min(PATLAMA_TAVAN, adet));
  }
  return null;
}
