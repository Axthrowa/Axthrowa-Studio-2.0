/**
 * StreamAxT — Hype Treni hesapları (saf)
 * Developed by AxthrowA
 *
 * Widget'taki hesapların (HypeTrainWidget.tsx) sunucu karşılığı; kurallar
 * birebir aynı. Veritabanı ve ağ erişimi yok — test edilebilir.
 */

export interface HypeAyari {
  levelGoal: number;
  levelGrowth: number;
  maxLevel: number;
  windowSeconds: number;
  pointsSub: number;
  pointsGiftSub: number;
  pointsTip: number;
  pointsKicks: number;
  pointsFollow: number;
}

/** Widget varsayılanlarıyla aynı (client/src/lib/widget-defaults.ts HYPE_TRAIN_DEFAULTS). */
export const HYPE_VARSAYILAN: HypeAyari = {
  levelGoal: 500,
  levelGrowth: 1.5,
  maxLevel: 10,
  windowSeconds: 300,
  pointsSub: 100,
  pointsGiftSub: 100,
  pointsTip: 10,
  pointsKicks: 1,
  pointsFollow: 5
};

/** Seviye hedefi kademeli büyür: taban * büyüme^(seviye-1). */
export function seviyeHedefi(seviye: number, taban: number, buyume: number): number {
  const s = Math.max(1, Math.floor(Number(seviye) || 1));
  const t = Math.max(1, Number(taban) || 1);
  const b = Math.max(1, Number(buyume) || 1);
  return Math.round(t * Math.pow(b, s - 1));
}

/** Bir yayın olayının kaç hype puanı ettiği. Desteklenmeyen olay 0 döner. */
export function olayPuani(subType: string, data: any, s: Partial<HypeAyari>): number {
  const d = data || {};
  const adet = Math.max(1, Number(d.count || 1));
  const tutar = Math.max(0, Number(d.amount || 0));
  if (subType === 'sub') return Math.max(0, Number(s.pointsSub) || 0);
  if (subType === 'gift_sub') return Math.max(0, Number(s.pointsGiftSub) || 0) * adet;
  if (subType === 'tip') return Math.round(Math.max(0, Number(s.pointsTip) || 0) * tutar);
  if (subType === 'kicks') return Math.round(Math.max(0, Number(s.pointsKicks) || 0) * tutar);
  if (subType === 'follow' || subType === 'follower') return Math.max(0, Number(s.pointsFollow) || 0);
  return 0;
}

/** Puan eklendikten sonraki seviye ve seviye içi puan. */
export function seviyeIlerlet(
  seviye: number,
  puan: number,
  eklenen: number,
  s: Partial<HypeAyari>
): { seviye: number; puan: number; atladi: boolean } {
  const tavan = Math.max(1, Number(s.maxLevel) || 10);
  let sv = Math.max(1, Math.floor(seviye));
  let pn = Math.max(0, puan) + Math.max(0, eklenen);
  let atladi = false;
  let hedef = seviyeHedefi(sv, Number(s.levelGoal) || 500, Number(s.levelGrowth) || 1.5);
  while (pn >= hedef && sv < tavan) {
    pn -= hedef;
    sv += 1;
    atladi = true;
    hedef = seviyeHedefi(sv, Number(s.levelGoal) || 500, Number(s.levelGrowth) || 1.5);
  }
  if (sv >= tavan) pn = Math.min(pn, hedef);
  return { seviye: sv, puan: pn, atladi };
}
