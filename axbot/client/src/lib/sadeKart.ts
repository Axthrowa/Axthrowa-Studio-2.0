/**
 * Sayaç, izleyici sırası ve geri sayım katmanlarının ortak kutu görünümü.
 * Hareketli bir şey çizilmez: filtre/blur kullanılmaz (OBS'te her karede yeniden taranmasın).
 */
import type { CSSProperties } from 'react';
import { kutuTasarimi, yaziAilesi } from './widget-style.js';

/** "#rrggbb" + opaklık → rgba */
export function renkSaydam(hex: string, opaklik: number | string | undefined): string {
  const h = String(hex || '#000000').replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const a = Math.max(0, Math.min(1, Number(opaklik ?? 1)));
  return `rgba(${parseInt(t.slice(0, 2), 16) || 0}, ${parseInt(t.slice(2, 4), 16) || 0}, ${parseInt(t.slice(4, 6), 16) || 0}, ${a})`;
}

export const SADE_TEMALAR = ['kart', 'hap', 'neon', 'sade'] as const;

export function sadeKart(s: Record<string, any>): CSSProperties {
  const ortak: CSSProperties = {
    color: s.textColor || '#ffffff',
    fontFamily: yaziAilesi(String(s.fontFamily || 'Plus Jakarta Sans')),
    borderRadius: Number(s.radius ?? 18)
  };
  const kabuk = kutuTasarimi(s);
  if (kabuk) return { ...ortak, ...kabuk };
  const zemin = renkSaydam(s.bgColor || '#0b0d12', s.bgOpacity ?? 0.8);
  const vurgu = String(s.accentColor || '#22d3ee');
  switch (String(s.theme || 'kart')) {
    case 'hap':
      return { ...ortak, background: zemin, border: `1px solid ${renkSaydam('#ffffff', 0.12)}`, borderRadius: 999 };
    case 'neon':
      return { ...ortak, background: zemin, border: `2px solid ${vurgu}`, boxShadow: `0 0 16px ${renkSaydam(vurgu, 0.5)}` };
    case 'sade':
      return { ...ortak, background: 'transparent', textShadow: '0 2px 6px rgba(0,0,0,.75)' };
    default:
      return {
        ...ortak,
        background: zemin,
        border: `1px solid ${renkSaydam('#ffffff', 0.1)}`,
        boxShadow: `inset 0 1px 0 ${renkSaydam('#ffffff', 0.08)}, 0 10px 28px rgba(0,0,0,.45)`
      };
  }
}

/** Önizleme kipi: panelden gömülü ya da adreste ?preview=1 */
export function onizlemeMi(previewMode: boolean): boolean {
  return previewMode || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1');
}
