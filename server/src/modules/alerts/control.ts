/**
 * AxBoT — ekip çapında uyarı kuyruğu denetimi (saf)
 * Developed by AxthrowA
 *
 * Kuyruğun kendisi her OBS tarayıcı kaynağında (AlertBox widget'ı) çalışır; sunucu yalnız DENETİM durumunu
 * (duraklatıldı mı, sessiz mi) ve komutları (atla, temizle, yeniden oynat) tutar ve yayınlar. Böylece
 * Mod A bir uyarıyı atladığında Mod B'nin paneli ve tüm OBS kaynakları anında aynı durumu görür.
 *
 * İyimser kilit: istemci gördüğü `version`'ı gönderir; arada başka biri değiştirdiyse istek reddedilir ve
 * güncel durum döner (çakışan iki moderatör birbirinin eylemini habersizce geri almasın).
 *
 * Ayrıca: uyarı kimlikleri eskiden ön ayar kimliğiydi (`alert-follow`, türe göre SABİT); widget aynı kimliği
 * tekrar sayıp attığı için bir OBS oturumunda her türün yalnız İLK uyarısı oynuyordu. Kimlik artık olay başına
 * benzersiz (`uyariKimligi`).
 */

export type KontrolEylemi = 'pause' | 'resume' | 'mute' | 'unmute' | 'skip' | 'clear' | 'replay' | 'play_now' | 'move_last' | 'remove';

export const EYLEMLER: KontrolEylemi[] = ['pause', 'resume', 'mute', 'unmute', 'skip', 'clear', 'replay', 'play_now', 'move_last', 'remove'];

/** Sıradaki tek bir uyarıya uygulanan eylemler (A7 sağ tık): `alertId` zorunlu, kuyruğu uyarı kutusu uygular */
export const OGE_EYLEMLERI: readonly KontrolEylemi[] = ['play_now', 'move_last', 'remove'];

export interface KontrolDurumu {
  /** Duraklatılmışken ekrandaki uyarı biter, sıradaki başlamaz */
  paused: boolean;
  /** Uyarı sesleri kapalı (görsel sürer) */
  muted: boolean;
  version: number;
  updatedAt: number;
  updatedBy: string;
  lastAction: KontrolEylemi | null;
}

export const BASLANGIC: KontrolDurumu = {
  paused: false,
  muted: false,
  version: 0,
  updatedAt: 0,
  updatedBy: '',
  lastAction: null
};

export type Sonuc =
  | { ok: true; durum: KontrolDurumu }
  | { ok: false; kod: 'conflict' | 'invalid'; mesaj: string; durum: KontrolDurumu };

/**
 * Eylemi uygular. `beklenenSurum` verilmezse kilit uygulanmaz (tek kullanıcı / kısayol).
 */
export function kontrolUygula(
  durum: KontrolDurumu,
  eylem: string,
  kim: string,
  beklenenSurum?: number | null,
  simdi = Date.now()
): Sonuc {
  if (!EYLEMLER.includes(eylem as KontrolEylemi)) {
    return { ok: false, kod: 'invalid', mesaj: 'Geçersiz eylem', durum };
  }
  if (beklenenSurum !== undefined && beklenenSurum !== null && Number(beklenenSurum) !== durum.version) {
    return {
      ok: false,
      kod: 'conflict',
      mesaj: `Başka biri az önce değiştirdi (${durum.updatedBy || 'bilinmiyor'}: ${durum.lastAction ?? '—'})`,
      durum
    };
  }
  const e = eylem as KontrolEylemi;
  const yeni: KontrolDurumu = {
    ...durum,
    version: durum.version + 1,
    updatedAt: simdi,
    updatedBy: String(kim || 'bilinmiyor').slice(0, 60),
    lastAction: e
  };
  if (e === 'pause') yeni.paused = true;
  if (e === 'resume') yeni.paused = false;
  if (e === 'mute') yeni.muted = true;
  if (e === 'unmute') yeni.muted = false;
  return { ok: true, durum: yeni };
}

/** Olay başına benzersiz uyarı kimliği (widget tekrar önleme bunu kullanır). */
export function uyariKimligi(tur: string, simdi = Date.now(), rastgele = Math.random): string {
  const tr = String(tur || 'alert').replace(/[^a-z0-9_]/gi, '').slice(0, 20) || 'alert';
  return `${tr}-${simdi.toString(36)}-${Math.floor(rastgele() * 1e9).toString(36)}`;
}

export interface SonUyari {
  id: string;
  eventType: string;
  title: string;
  message: string;
  at: number;
  isTest: boolean;
  /** Yeniden oynatma için widget'a giden veri */
  alert: Record<string, unknown>;
  /** Olayın ham verisi (kullanıcı, tutar…): etkinlik akışı geçmişi için (U4) */
  data?: unknown;
  /** Yayıncı ya da moderatör "teşekkür edildi" işaretledi mi (U4, tüm panellerde ortak) */
  tesekkur?: boolean;
}

/** Son uyarılar halkası (yeniden oynatma listesi). */
export class SonUyarilar {
  private liste: SonUyari[];
  /** `degisti`: her değişiklikte (kalıcı kayıt için, K1); `baslangic`: önceki çalışmadan kalan liste */
  constructor(private tavan = 50, private degisti?: (liste: SonUyari[]) => void, baslangic: unknown = []) {
    this.liste = Array.isArray(baslangic) ? baslangic.filter((u) => u && typeof u.id === 'string').slice(0, tavan) : [];
  }

  ekle(u: SonUyari): void {
    this.liste.unshift(u);
    if (this.liste.length > this.tavan) this.liste.length = this.tavan;
    this.degisti?.(this.liste);
  }

  bul(id: string): SonUyari | undefined {
    return this.liste.find((x) => x.id === id);
  }

  /** Teşekkür işareti; uyarı halkada yoksa false */
  tesekkurIsaretle(id: string, deger: boolean): boolean {
    const u = this.bul(id);
    if (!u) return false;
    u.tesekkur = deger;
    this.degisti?.(this.liste);
    return true;
  }

  hepsi(): SonUyari[] {
    return [...this.liste];
  }
}

/** OBS'teki uyarı kutusunun bildirdiği kuyruk (U3): panel ve uzak moderatör "sırada ne var" görür. */
export interface KuyrukOgesi {
  id: string;
  eventType: string;
  title: string;
  message: string;
  isTest: boolean;
}

export interface KuyrukAynasi {
  aktif: KuyrukOgesi | null;
  bekleyen: KuyrukOgesi[];
  /** Raporun geldiği an (0: hiç rapor yok) */
  guncellendi: number;
  /** Rapor gönderen açık uyarı kutusu sayısı */
  kaynak: number;
}

export const BOS_AYNA: KuyrukAynasi = { aktif: null, bekleyen: [], guncellendi: 0, kaynak: 0 };
const EN_COK_BEKLEYEN = 30;

function ogeTemizle(ham: unknown): KuyrukOgesi | null {
  if (!ham || typeof ham !== 'object') return null;
  const o = ham as Record<string, unknown>;
  const id = String(o.id ?? '').slice(0, 80);
  if (!id) return null;
  const temiz = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
  return { id, eventType: temiz(o.eventType, 30), title: temiz(o.title, 80), message: temiz(o.message, 80), isTest: o.isTest === true };
}

/** Widget'tan gelen ham rapor (güvenilmez girdi) → temiz kuyruk; biçimsizse null */
export function kuyrukRaporuTemizle(ham: unknown): { aktif: KuyrukOgesi | null; bekleyen: KuyrukOgesi[] } | null {
  if (!ham || typeof ham !== 'object') return null;
  const r = ham as Record<string, unknown>;
  if (!Array.isArray(r.bekleyen)) return null;
  return {
    aktif: ogeTemizle(r.aktif),
    bekleyen: r.bekleyen.slice(0, EN_COK_BEKLEYEN).map(ogeTemizle).filter((x): x is KuyrukOgesi => !!x)
  };
}

/**
 * Her açık uyarı kutusunun son raporu. Aynı kutu iki sahnede açıksa ikisi de kendi kuyruğunu çalıştırır; panel
 * OBS kaynaklarından en son güncelleneni gösterir (OBS dışı önizleme yalnız başka kaynak yoksa).
 */
export class KuyrukAynalari<K> {
  private raporlar = new Map<K, { aktif: KuyrukOgesi | null; bekleyen: KuyrukOgesi[]; obs: boolean; zaman: number }>();

  bildir(kaynak: K, rapor: { aktif: KuyrukOgesi | null; bekleyen: KuyrukOgesi[] }, obs: boolean, simdi = Date.now()) {
    this.raporlar.set(kaynak, { ...rapor, obs, zaman: simdi });
  }

  /** true: kaynağın raporu vardı ve silindi */
  kopar(kaynak: K): boolean {
    return this.raporlar.delete(kaynak);
  }

  ozet(): KuyrukAynasi {
    const hepsi = [...this.raporlar.values()];
    if (!hepsi.length) return BOS_AYNA;
    const aday = hepsi.some((r) => r.obs) ? hepsi.filter((r) => r.obs) : hepsi;
    const son = aday.reduce((a, b) => (b.zaman > a.zaman ? b : a));
    return { aktif: son.aktif, bekleyen: son.bekleyen, guncellendi: son.zaman, kaynak: hepsi.length };
  }
}
