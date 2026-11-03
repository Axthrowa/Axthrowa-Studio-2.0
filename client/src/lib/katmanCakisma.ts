/**
 * Çekiliş, Bil Bakalım ve anket ekrandayken bölgelerindeki diğer katmanlar geçici gizlenir.
 * Saf: yalnız kutu hesabı. Katmanın "ekranda" olup olmadığını OverlayKatmanlari izler.
 */

export interface Kutu {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
}

/** Bunlar ekrana gelince bölgesi boşaltılır */
export const ONCELIKLI_KATMANLAR = ['polls', 'trivia', 'giveaway'];

/** Bildirim kısa sürer ve kaçırılırsa geri gelmez: bağış ve abonelik görünür kalsın */
const GIZLENMEYEN_KATMANLAR = ['alerts'];

const kapsam = (k: Kutu) => {
  const olcek = typeof k.scale === 'number' ? k.scale : 1;
  return { sol: k.x, ust: k.y, sag: k.x + k.width * olcek, alt: k.y + k.height * olcek };
};

/** Yalnız kenarı değen kutular çakışmış sayılmaz */
export function kutularCakisiyor(a: Kutu, b: Kutu): boolean {
  const p = kapsam(a);
  const q = kapsam(b);
  return p.sol < q.sag && q.sol < p.sag && p.ust < q.alt && q.ust < p.alt;
}

/** `kutular`: çizilen katmanlar; `etkinler`: şu an ekranda olan öncelikli katmanlar */
export function gizlenecekKatmanlar(
  kutular: Array<{ anahtar: string; kutu: Kutu; tamEkran?: boolean }>,
  etkinler: string[]
): Set<string> {
  const gizli = new Set<string>();
  const etkinKutular = kutular.filter((k) => etkinler.includes(k.anahtar));
  for (const k of kutular) {
    // Tam ekran katmanlar (emote, JumpScare) saydam efekttir, her şeyle çakışır: gizlenmez
    if (k.tamEkran || ONCELIKLI_KATMANLAR.includes(k.anahtar) || GIZLENMEYEN_KATMANLAR.includes(k.anahtar)) continue;
    if (etkinKutular.some((e) => kutularCakisiyor(e.kutu, k.kutu))) gizli.add(k.anahtar);
  }
  return gizli;
}
