/**
 * StreamAxT — şans çarkı sonucu (sunucuda seçilir)
 * Developed by AxthrowA
 *
 * Eskiden sunucu dilim sayısına bakmadan 0–7 arası rastgele bir sıra
 * yolluyordu: 5 dilimli çarkta sonuç ağırlıklara uymuyor, iki OBS sayfası
 * farklı kazanan gösterebiliyordu ve sonuç sohbete hiç yazılmıyordu.
 * Artık dilimler panelde kayıtlı widget ayarından okunur ve ağırlıklı seçilir.
 */
import { db } from '../../db/index.js';

export interface CarkDilimi {
  label: string;
  weight?: number;
}

/** Ayar yoksa (panelde hiç açılmadıysa) widget'ın varsayılan 8 dilimi */
const VARSAYILAN_DILIM_SAYISI = 8;

export function agirlikliSira(dilimler: CarkDilimi[], rastgele: () => number = Math.random): number {
  if (!dilimler.length) return Math.floor(rastgele() * VARSAYILAN_DILIM_SAYISI);
  const a = dilimler.map((d) => Math.max(0, Number(d.weight ?? 1)) || 0);
  const toplam = a.reduce((x, y) => x + y, 0);
  if (!toplam) return Math.floor(rastgele() * dilimler.length) % dilimler.length;
  let r = rastgele() * toplam;
  for (let i = 0; i < a.length; i++) {
    r -= a[i];
    if (r < 0) return i;
  }
  return dilimler.length - 1;
}

export function carkAyari(): { dilimler: CarkDilimi[]; donusMs: number } {
  try {
    const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get('widget_settings_wheel-of-fortune') as
      | { value?: string }
      | undefined;
    const j = JSON.parse(r?.value || '{}');
    const dilimler = Array.isArray(j.segments)
      ? j.segments.filter((d: any) => d && String(d.label ?? '').trim()).slice(0, 50).map((d: any) => ({ label: String(d.label).slice(0, 60), weight: Number(d.weight ?? 1) }))
      : [];
    return { dilimler, donusMs: Math.min(20_000, Math.max(1000, Number(j.spinMs) || 4500)) };
  } catch {
    return { dilimler: [], donusMs: 4500 };
  }
}

export function carkCevir(rastgele: () => number = Math.random): { index: number; etiket: string | null; donusMs: number } {
  const { dilimler, donusMs } = carkAyari();
  const index = agirlikliSira(dilimler, rastgele);
  return { index, etiket: dilimler[index]?.label ?? null, donusMs };
}
