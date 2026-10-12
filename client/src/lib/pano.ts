/**
 * StreamAxT — Ses/Video Panosu istemci yardımcıları (saf, birim testli)
 * Developed by AxthrowA
 */
import type { CSSProperties } from 'react';

export type PanoKonum = 'orta' | 'ust-orta' | 'alt-orta' | 'ust-sol' | 'ust-sag' | 'alt-sol' | 'alt-sag';
export interface PanoGorunum {
  konum: PanoKonum;
  genislikYuzde: number;
  adGoster: boolean;
}

export const KONUM_ADLARI: Record<PanoKonum, string> = {
  orta: 'Orta',
  'ust-orta': 'Üst orta',
  'alt-orta': 'Alt orta',
  'ust-sol': 'Sol üst',
  'ust-sag': 'Sağ üst',
  'alt-sol': 'Sol alt',
  'alt-sag': 'Sağ alt'
};

/** Katman kutusunun yerleşimi: ekran kenarından %3 boşluk, genişlik ekranın yüzdesi */
export function konumStili(g: PanoGorunum): CSSProperties {
  const genislik = `${Math.min(100, Math.max(10, g.genislikYuzde))}%`;
  const s: CSSProperties = { width: genislik };
  const [dikey, yatay] = g.konum === 'orta' ? ['orta', 'orta'] : g.konum.split('-');
  if (dikey === 'ust') s.top = '3%';
  else if (dikey === 'alt') s.bottom = '3%';
  else s.top = '50%';
  if (yatay === 'sol') s.left = '3%';
  else if (yatay === 'sag') s.right = '3%';
  else s.left = '50%';
  const tx = yatay === 'orta' ? '-50%' : '0';
  const ty = dikey === 'orta' ? '-50%' : '0';
  if (tx !== '0' || ty !== '0') s.transform = `translate(${tx}, ${ty})`;
  return s;
}

/** Sohbet adı önizlemesi (sunucudaki kuralla aynı: küçük harf, boşluk → tire, yalnız harf/rakam/tire) */
export function sohbetAdi(s: string): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 32);
}
