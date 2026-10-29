/**
 * StreamAxT — hedef çubuklarının ilerlemesi (bağış / takipçi / abone / KICKs)
 * Developed by AxthrowA
 *
 * İlerleme eskiden yalnız OBS sayfasının belleğinde sayılıyordu: OBS yeniden açılınca, sahne yenilenince ya
 * da bot güncellenince çubuk "Mevcut" değerine dönüyor, test ve "yeniden oynat" uyarıları da sayılıyordu;
 * Tek URL ile ayrı OBS kaynağı ayrı ayrı sayıyordu. Artık gerçek olay gelince hedef widget'ının `current`
 * ayarı sunucuda artırılıp kaydedilir; ayar kanalı yeni değeri bütün OBS sayfalarına yayar.
 */
import { eventBus, hediyeAdedi } from '../../core/event-bus.js';

export type HedefOlayi = 'tip' | 'follow' | 'sub' | 'kicks';

/** Hedef widget'ları ve varsayılan türleri (panelde tür değiştirilebilir: `type` ayarı) */
export const HEDEF_WIDGETLARI: Record<string, string> = {
  'donation-goal': 'tip',
  'follower-goal': 'follower',
  'subscriber-goal': 'sub',
  'kicks-goal': 'kicks'
};

/** Olay bu türdeki hedefe kaç ekler (0 = eklemez) */
export function hedefArtisi(tur: string, olay: HedefOlayi, p: any): number {
  if (p?.isTest === true || p?.isReplay === true) return 0;
  if ((tur === 'tip' || tur === 'donation') && olay === 'tip') return Math.max(0, Number(p?.amount) || 0);
  if (tur === 'follower' && olay === 'follow') return 1;
  if (tur === 'sub' && olay === 'sub') return p?.isGift ? hediyeAdedi(p) : 1;
  if (tur === 'kicks' && olay === 'kicks') return Math.max(0, Number(p?.amount) || 0);
  return 0;
}

/** Olay gelince hedefleri ilerletir. `oku`/`yaz`: widget ayarı (api/rotalar/widgetlar.ts) */
export function hedefleriIlerlet(
  olay: HedefOlayi,
  p: unknown,
  oku: (id: string) => Record<string, unknown>,
  yaz: (id: string, govde: Record<string, unknown>) => unknown
): void {
  for (const [id, varsayilanTur] of Object.entries(HEDEF_WIDGETLARI)) {
    const ayar = oku(id);
    const artis = hedefArtisi(String(ayar.type || varsayilanTur), olay, p);
    if (!artis) continue;
    const yeni = Math.round(((Number(ayar.current) || 0) + artis) * 100) / 100;
    yaz(id, { current: yeni });
  }
}

/** Olayı hedeflere işler. Olay yolundan geçmeyen bağışlar (BynoGame, web kancası) da bunu çağırır. */
export function hedefOlayiIsle(olay: HedefOlayi, p: unknown): void {
  // Döngüsel içe aktarma olmasın: rotalar modülü olay anında yüklenir
  void import('../../api/rotalar/widgetlar.js')
    .then(({ widgetAyariOku, widgetAyariYaz }) => hedefleriIlerlet(olay, p, widgetAyariOku, widgetAyariYaz))
    .catch((e) => console.warn('[Hedef] ilerleme kaydedilemedi:', (e as Error)?.message || e));
}

export function hedefleriBagla(): void {
  const isle = (olay: HedefOlayi) => (p: unknown) => hedefOlayiIsle(olay, p);
  eventBus.on('tip', isle('tip'));
  eventBus.on('follow', isle('follow'));
  eventBus.on('sub', isle('sub'));
  eventBus.on('kicks', isle('kicks'));
}
