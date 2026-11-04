/**
 * Bildirim, çekiliş, Bil Bakalım ve anket ekrandayken bölgelerindeki diğer katmanlar geçici gizlenir.
 * Her widget için iki ayar var; yerleşim kaydında tutulur, verilmezse varsayılan geçerlidir.
 * Saf: yalnız kutu hesabı. Katmanın "ekranda" olup olmadığını OverlayKatmanlari izler.
 */

export interface Kutu {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
}

/** Varsayılan: bunlar ekrana gelince bölgesi boşaltılır, kendileri gizlenmez */
export const ONCELIKLI_KATMANLAR = ['alerts', 'polls', 'trivia', 'giveaway'];

export interface GizlemeAyari {
  arkasiniGizle?: boolean;
  cakisincaGizle?: boolean;
  [k: string]: unknown;
}

/** Bu widget ekrana gelince arkasındakileri gizler mi */
export const arkasiniGizlerMi = (anahtar: string, ayar?: GizlemeAyari): boolean =>
  ayar?.arkasiniGizle ?? ONCELIKLI_KATMANLAR.includes(anahtar);

/** Önüne öncelikli bir widget gelince bu widget gizlenir mi */
export const cakisincaGizlenirMi = (anahtar: string, ayar?: GizlemeAyari): boolean =>
  // Emote kombo saydam efekt: üstüne bildirim gelse de kaybolmaz
  ayar?.cakisincaGizle ?? !(ONCELIKLI_KATMANLAR.includes(anahtar) || anahtar === 'emoteCombo');

const kapsam = (k: Kutu) => {
  const olcek = typeof k.scale === 'number' ? k.scale : 1;
  return { sol: k.x, ust: k.y, sag: k.x + k.width * olcek, alt: k.y + k.height * olcek };
};

/** İçerik kutudan uzayıp tuvalin altından taşacaksa katmanın ne kadar yukarı alınacağı (tuvalin üstünü geçmez) */
export function tuvaleSigdirmaPayi(y: number, icerikH: number, olcek = 1, tuvalH = 1080): number {
  return Math.max(0, Math.min(y, y + icerikH * olcek - tuvalH));
}

/** Yalnız kenarı değen kutular çakışmış sayılmaz */
export function kutularCakisiyor(a: Kutu, b: Kutu): boolean {
  const p = kapsam(a);
  const q = kapsam(b);
  return p.sol < q.sag && q.sol < p.sag && p.ust < q.alt && q.ust < p.alt;
}

/** `kutular`: çizilen katmanlar; `etkinler`: şu an ekranda olan ve arkasını gizleyen katmanlar */
export function gizlenecekKatmanlar(
  kutular: Array<{ anahtar: string; kutu: Kutu; tamEkran?: boolean; gizlenmez?: boolean }>,
  etkinler: string[]
): Set<string> {
  const gizli = new Set<string>();
  const etkinKutular = kutular.filter((k) => etkinler.includes(k.anahtar));
  for (const k of kutular) {
    // Tam ekran katmanlar (emote, JumpScare) saydam efekttir, her şeyle çakışır: gizlenmez
    if (k.tamEkran || k.gizlenmez) continue;
    if (etkinKutular.some((e) => e.anahtar !== k.anahtar && kutularCakisiyor(e.kutu, k.kutu))) gizli.add(k.anahtar);
  }
  return gizli;
}
