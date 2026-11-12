/** Dashboard’daki tek yayın sağlığı satırı. */

export function saglikSatiri(g: { obs: boolean; yayin: boolean; dropPct: number; clip: boolean }): string {
  if (!g.obs) return "OBS bağlı değil";
  const kare = !g.yayin ? "yayın kapalı" : g.dropPct >= 2 ? `kare düşüşü %${g.dropPct.toFixed(1)}` : "kareler sağlam";
  return `${kare} · ${g.clip ? "ses kırpmaya yakın" : "ses normal"}`;
}
