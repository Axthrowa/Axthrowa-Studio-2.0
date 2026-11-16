/**
 * AxBoT — hedef çubuklarının ilerlemesi (bağış / takipçi / abone / KICKs)
 * Developed by AxthrowA
 *
 * İlerleme eskiden yalnız OBS sayfasının belleğinde sayılıyordu: OBS yeniden açılınca, sahne yenilenince ya
 * da bot güncellenince çubuk "Mevcut" değerine dönüyor, test ve "yeniden oynat" uyarıları da sayılıyordu;
 * Tek URL ile ayrı OBS kaynağı ayrı ayrı sayıyordu. Artık gerçek olay gelince hedef widget'ının `current`
 * ayarı sunucuda artırılıp kaydedilir; ayar kanalı yeni değeri bütün OBS sayfalarına yayar.
 */
import { eventBus, hediyeAdedi } from '../../core/event-bus.js';
import { db } from '../../db/index.js';

export type HedefOlayi = 'tip' | 'follow' | 'sub' | 'kicks';

/** 100, 250, 500… dolunca bir sonraki basamak. Hedef yoksa veya dolmadıysa null. */
export const HEDEF_BASAMAKLARI = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

export function sonrakiBasamak(mevcut: number, hedef: number): number | null {
  if (!(hedef > 0) || mevcut < hedef) return null;
  const bulunan = HEDEF_BASAMAKLARI.find((b) => b > hedef && b >= mevcut);
  if (bulunan) return bulunan;
  let n = HEDEF_BASAMAKLARI[HEDEF_BASAMAKLARI.length - 1];
  while (n <= mevcut) n *= 2;
  return n;
}

export interface ToplamSatiri {
  event_type: string;
  amount: number | null;
  metadata: string | null;
}

/** Kayıtlı olayların toplamı. Takipçi sayısı Kick’ten gelirse o yazılır; yoksa null (eski değer korunur). */
export function hedefToplamlari(satirlar: ToplamSatiri[], kickTakipci: number | null): { follower: number | null; sub: number; tip: number; kicks: number } {
  let sub = 0;
  let tip = 0;
  let kicks = 0;
  for (const s of satirlar) {
    let meta: { isTest?: boolean; count?: unknown; recipient?: unknown; isGift?: boolean } | null = null;
    try {
      meta = s.metadata ? JSON.parse(s.metadata) : null;
    } catch {
      meta = null;
    }
    if (meta?.isTest) continue;
    const t = s.event_type;
    if (t === 'sub' || t === 'gift_sub' || t === 'subscription') sub += hediyeAdedi(meta);
    else if (t === 'tip' || t === 'donation') tip += Math.max(0, Number(s.amount) || 0);
    else if (t === 'kicks') kicks += Math.max(0, Number(s.amount) || 0);
  }
  return { follower: kickTakipci, sub, tip: Math.round(tip * 100) / 100, kicks };
}

const TOPLAM_TUR: Record<string, 'follower' | 'sub' | 'tip' | 'kicks'> = {
  follower: 'follower',
  sub: 'sub',
  tip: 'tip',
  donation: 'tip',
  kicks: 'kicks'
};

/** Açılışta ve etiket isteğinde hedeflerin mevcut değerini Kick + kayıtlı olaylarla yazar. */
export function hedefleriToplamdanYaz(
  toplam: { follower: number | null; sub: number; tip: number; kicks: number },
  oku: (id: string) => Record<string, unknown>,
  yaz: (id: string, govde: Record<string, unknown>) => unknown
): string[] {
  const doldu: string[] = [];
  for (const [id, varsayilanTur] of kayitliHedefler()) {
    const ayar = oku(id);
    const alan = TOPLAM_TUR[String(ayar.type || varsayilanTur)];
    if (!alan) continue;
    if (alan === 'follower' && ayar.gercekSayi === false) continue;
    const sayi = toplam[alan];
    if (sayi == null) continue;
    const hedef = Number(ayar.target) || 0;
    const sonraki = sonrakiBasamak(sayi, hedef);
    if (Number(ayar.current) === sayi && (sonraki == null || sonraki === hedef)) continue;
    yaz(id, sonraki != null && sonraki !== hedef ? { current: sayi, target: sonraki } : { current: sayi });
    if (sonraki != null && sonraki !== hedef) doldu.push(id);
  }
  return doldu;
}

async function otomatikSatirlar(): Promise<ToplamSatiri[]> {
  return db.prepare(
    `SELECT event_type, amount, metadata FROM stream_events
     WHERE event_type IN ('sub','gift_sub','subscription','tip','donation','kicks')`
  ).all() as unknown as ToplamSatiri[];
}

/** Widget açılışı ve bot başlangıcı: Kick takipçisi ve kayıtlı bağış/abone/Kicks toplamı. */
export async function hedefleriOtomatikYaz(): Promise<void> {
  const { widgetAyariOku, widgetAyariYaz } = await import('../../api/rotalar/widgetlar.js');
  const { takipciSayisi } = await import('../widgets/takipci-sayisi.js');
  const kick = await takipciSayisi(true);
  const toplam = hedefToplamlari(await otomatikSatirlar(), kick);
  for (const widgetId of hedefleriToplamdanYaz(toplam, widgetAyariOku, widgetAyariYaz)) {
    eventBus.emit('hedef_doldu', { widgetId });
  }
}
export const HEDEF_WIDGETLARI: Record<string, string> = {
  'donation-goal': 'tip',
  'follower-goal': 'follower',
  'subscriber-goal': 'sub',
  'kicks-goal': 'kicks'
};

/** Ek hedef çubukları `follower-goal-2` gibi kimlik alır; türü taban kimlikten gelir. */
export function hedefListesi(anahtarlar: string[]): [string, string][] {
  const liste = Object.entries(HEDEF_WIDGETLARI);
  for (const k of anahtarlar) {
    const id = k.replace(/^widget_settings_/, '');
    const taban = id.replace(/-\d+$/, '');
    if (id !== taban && HEDEF_WIDGETLARI[taban] && /-\d+$/.test(id)) liste.push([id, HEDEF_WIDGETLARI[taban]]);
  }
  return liste;
}

function kayitliHedefler(): [string, string][] {
  try {
    const satirlar = db.prepare("SELECT key FROM bot_settings WHERE key LIKE 'widget_settings_%-goal-%'").all() as { key: string }[];
    return hedefListesi(satirlar.map((r) => r.key));
  } catch {
    return Object.entries(HEDEF_WIDGETLARI);
  }
}

/**
 * Takipçi hedefi varsayılan olarak kanalın gerçek takipçi sayısını gösterir: bot kapalıyken gelenler de sayılır,
 * bırakanlar düşer. `gercekSayi: false` ise eskisi gibi elle girilen değerden olay başına artar.
 */
export function takipciSayisiniYaz(
  sayi: number,
  oku: (id: string) => Record<string, unknown>,
  yaz: (id: string, govde: Record<string, unknown>) => unknown
): string[] {
  const doldu: string[] = [];
  for (const [id, varsayilanTur] of kayitliHedefler()) {
    const ayar = oku(id);
    if (String(ayar.type || varsayilanTur) !== 'follower' || ayar.gercekSayi === false) continue;
    if (Number(ayar.current) !== sayi) {
      const sonraki = sonrakiBasamak(sayi, Number(ayar.target) || 0);
      yaz(id, sonraki != null ? { current: sayi, target: sonraki } : { current: sayi });
      if (sonraki != null) doldu.push(id);
    }
  }
  return doldu;
}

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
): string[] {
  const doldu: string[] = [];
  for (const [id, varsayilanTur] of kayitliHedefler()) {
    const ayar = oku(id);
    const tur = String(ayar.type || varsayilanTur);
    // Gerçek sayıya bağlı takipçi hedefini sayı olayı günceller; burada artarsa iki kez sayılır
    if (tur === 'follower' && ayar.gercekSayi !== false) continue;
    const artis = hedefArtisi(tur, olay, p);
    if (!artis) continue;
    const yeni = Math.round(((Number(ayar.current) || 0) + artis) * 100) / 100;
    const sonraki = sonrakiBasamak(yeni, Number(ayar.target) || 0);
    yaz(id, sonraki != null ? { current: yeni, target: sonraki } : { current: yeni });
    if (sonraki != null) doldu.push(id);
  }
  return doldu;
}

/** Olayı hedeflere işler. Olay yolundan geçmeyen bağışlar (BynoGame, web kancası) da bunu çağırır. */
export function hedefOlayiIsle(olay: HedefOlayi, p: unknown): void {
  // Döngüsel içe aktarma olmasın: rotalar modülü olay anında yüklenir
  void import('../../api/rotalar/widgetlar.js')
    .then(({ widgetAyariOku, widgetAyariYaz }) => {
      for (const widgetId of hedefleriIlerlet(olay, p, widgetAyariOku, widgetAyariYaz)) {
        eventBus.emit('hedef_doldu', { widgetId });
      }
    })
    .catch((e) => console.warn('[Hedef] ilerleme kaydedilemedi:', (e as Error)?.message || e));
}

export function hedefleriBagla(): void {
  const isle = (olay: HedefOlayi) => (p: unknown) => hedefOlayiIsle(olay, p);
  eventBus.on('tip', isle('tip'));
  eventBus.on('follow', isle('follow'));
  eventBus.on('sub', isle('sub'));
  eventBus.on('kicks', isle('kicks'));
  void hedefleriOtomatikYaz();
  eventBus.on('takipci_sayisi', (sayi: number) => {
    void import('../../api/rotalar/widgetlar.js')
      .then(({ widgetAyariOku, widgetAyariYaz }) => {
        for (const widgetId of takipciSayisiniYaz(sayi, widgetAyariOku, widgetAyariYaz)) {
          eventBus.emit('hedef_doldu', { widgetId });
        }
      })
      .catch((e) => console.warn('[Hedef] takipçi sayısı yazılamadı:', (e as Error)?.message || e));
  });
}
