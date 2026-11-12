/**
 * Eski sürümlerin tarayıcı depolama anahtarları ve ayar alanı. Yalnız göç için: ilk açılışta yeni adlara kopyalanır,
 * eskiler silinmez (eski sürüme dönülürse ayarlar yerinde kalır).
 */
const ONEKLER: [string, string][] = [
  ["yya.", "studio."],
  ["yya-", "studio-"],
  ["botaxt.", "studio.bot."],
  ["panel.smartBot", "panel.sohbetBot"],
];
const BAYRAK = "studio.eskiAnahtarlarTasindi";

export function eskiAnahtarlariTasi(depo: Storage | undefined = globalThis.localStorage): number {
  if (!depo) return 0;
  try {
    if (depo.getItem(BAYRAK)) return 0;
    let n = 0;
    for (let i = 0; i < depo.length; i++) {
      const k = depo.key(i);
      const es = k && ONEKLER.find(([eski]) => k.startsWith(eski));
      if (!k || !es) continue;
      const yeni = es[1] + k.slice(es[0].length);
      if (depo.getItem(yeni) === null) {
        depo.setItem(yeni, depo.getItem(k) ?? "");
        n++;
      }
    }
    depo.setItem(BAYRAK, "1");
    return n;
  } catch {
    return 0;
  }
}

/** Panel ayarındaki bot yapılandırması: eski sürümler `smartBot` alanına yazıyordu */
export function panelBotu(o: Record<string, unknown> | null | undefined): unknown {
  return o?.sohbetBot ?? o?.smartBot;
}
