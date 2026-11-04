/**
 * Overlay Stüdyo yerleşim hesapları: tuval sınırı, hizalama ve sürüklerken yapışma.
 *
 * Katman tuvalde `width × scale` boyutunda çizilir (bkz. OverlayLayers `katmanStili`).
 * Sınır ve hizalama eskiden ölçeksiz boyutu kullanıyordu: ölçeği 1'den küçük sohbet
 * ekranın altına/sağına inemiyor, 1'den büyük olan tuvalden taşıyordu.
 */
export const TUVAL_G = 1920;
export const TUVAL_Y = 1080;

export interface Kutu {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
}

export const gorunen = (k: Kutu) => {
  const s = typeof k.scale === 'number' && k.scale > 0 ? k.scale : 1;
  return { g: k.width * s, y: k.height * s };
};

/** Görünen kutu tuvalin içinde kalsın. */
export function sinirla(x: number, y: number, k: Kutu): { x: number; y: number } {
  const { g, y: h } = gorunen(k);
  return {
    x: Math.round(Math.max(0, Math.min(TUVAL_G - g, x))),
    y: Math.round(Math.max(0, Math.min(TUVAL_Y - h, y)))
  };
}

/**
 * Boyut değişince widget yerinde kalır: kutu merkezinde büyür, yalnız tuval kenarına dayanınca içeri itilir.
 * Widget'ların çoğu kutusunda ortalı; sol üst sabit kalınca kutu büyüdükçe içerik kayıyordu.
 */
export function merkezdeBoyutla(k: Kutu, yeni: { width?: number; height?: number; scale?: number }): Required<Kutu> {
  const eski = gorunen(k);
  const s = typeof k.scale === 'number' && k.scale > 0 ? k.scale : 1;
  const width = Math.round(Math.max(1, Math.min(TUVAL_G / s, yeni.width ?? k.width)));
  const height = Math.round(Math.max(1, Math.min(TUVAL_Y / s, yeni.height ?? k.height)));
  const scale = Math.round(Math.max(0.25, Math.min(3, TUVAL_G / width, TUVAL_Y / height, yeni.scale ?? s)) * 100) / 100;
  const hedef = { x: k.x + eski.g / 2 - (width * scale) / 2, y: k.y + eski.y / 2 - (height * scale) / 2 };
  return { ...sinirla(hedef.x, hedef.y, { x: 0, y: 0, width, height, scale }), width, height, scale };
}

export type Yon = 'sol' | 'yatayOrta' | 'sag' | 'ust' | 'dikeyOrta' | 'alt';

/** Seçili kutuyu tuvale göre hizalar; yalnız değişen ekseni döndürür. */
export function hizala(k: Kutu, yon: Yon): { x?: number; y?: number } {
  const { g, y: h } = gorunen(k);
  switch (yon) {
    case 'sol': return { x: 0 };
    case 'yatayOrta': return { x: Math.round((TUVAL_G - g) / 2) };
    case 'sag': return { x: Math.round(TUVAL_G - g) };
    case 'ust': return { y: 0 };
    case 'dikeyOrta': return { y: Math.round((TUVAL_Y - h) / 2) };
    case 'alt': return { y: Math.round(TUVAL_Y - h) };
  }
}

export interface Kilavuzlar {
  /** Dikey kılavuz çizgilerinin x konumları */
  dikey: number[];
  /** Yatay kılavuz çizgilerinin y konumları */
  yatay: number[];
}

/**
 * Sürüklenen kutunun sol/orta/sağ (ve üst/orta/alt) kenarını, `esik` pikselden yakınsa
 * tuvalin kenar/ortasına ve diğer katmanların kenar/ortasına yapıştırır.
 */
export function yapistir(
  x: number,
  y: number,
  k: Kutu,
  digerleri: Kutu[],
  esik = 10
): { x: number; y: number; kilavuz: Kilavuzlar } {
  const { g, y: h } = gorunen(k);
  const dikeyHedef = [0, TUVAL_G / 2, TUVAL_G];
  const yatayHedef = [0, TUVAL_Y / 2, TUVAL_Y];
  for (const d of digerleri) {
    const b = gorunen(d);
    dikeyHedef.push(d.x, d.x + b.g / 2, d.x + b.g);
    yatayHedef.push(d.y, d.y + b.y / 2, d.y + b.y);
  }

  const enYakin = (konum: number, boy: number, hedefler: number[]) => {
    let iyi: { kayma: number; cizgi: number } | null = null;
    for (const kenar of [0, boy / 2, boy]) {
      for (const c of hedefler) {
        const kayma = c - (konum + kenar);
        if (Math.abs(kayma) <= esik && (!iyi || Math.abs(kayma) < Math.abs(iyi.kayma))) iyi = { kayma, cizgi: c };
      }
    }
    return iyi;
  };

  const sx = enYakin(x, g, dikeyHedef);
  const sy = enYakin(y, h, yatayHedef);
  const yeni = sinirla(x + (sx?.kayma ?? 0), y + (sy?.kayma ?? 0), k);
  return {
    ...yeni,
    kilavuz: { dikey: sx ? [sx.cizgi] : [], yatay: sy ? [sy.cizgi] : [] }
  };
}
