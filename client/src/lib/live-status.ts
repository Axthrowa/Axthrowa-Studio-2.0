/**
 * StreamAxT — canlı yayın durumu rozetleri (saf)
 * Developed by AxthrowA
 *
 * Sunucu yayının açık olup olmadığını platform API'lerinden yoklar
 * (core/live-status). `$(uptime)` ve "yalnız yayındayken" komutları bu
 * duruma bağlı; ama panelde görünmüyordu — yayıncı botun yayını nasıl
 * gördüğünü bilemiyordu. `/api/status` yanıtındaki `canli` alanını okur.
 */

export interface PlatformYayini {
  platform: string;
  canli: boolean;
  izleyici: number;
  baslik: string;
  kategori: string;
  baslangic: number | null;
}

export interface CanliOzet {
  /** null = hiçbir platform durum bildirmedi (bilinmiyor) */
  canli: boolean | null;
  baslangic: number | null;
  izleyici: number;
  canliPlatformlar: string[];
  platformlar?: PlatformYayini[];
}

export type RozetTuru = 'canli' | 'kapali' | 'bilinmiyor';

export interface Rozet {
  metin: string;
  tur: RozetTuru;
  ipucu: string;
}

const PLATFORM_ADI: Record<string, string> = {
  kick: 'Kick',
  twitch: 'Twitch',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  trovo: 'Trovo',
  discord: 'Discord'
};

const ad = (p: string) => PLATFORM_ADI[p] || p;

function izleyiciMetni(n: number): string {
  return `${Math.max(0, Math.round(n)).toLocaleString('tr-TR')} izleyici`;
}

/** Panodaki genel rozet. */
export function genelRozet(o?: CanliOzet | null): Rozet {
  if (!o || o.canli === null || o.canli === undefined) {
    return {
      metin: 'Yayın durumu bilinmiyor',
      tur: 'bilinmiyor',
      ipucu:
        'Bağlı platformlardan hiçbiri yayın durumunu bildirmedi. Bu durumda "yalnız yayındayken" komutları engellenmez.'
    };
  }
  if (o.canli) {
    const platformlar = o.canliPlatformlar.map(ad).join(', ');
    return {
      metin: o.izleyici > 0 ? `CANLI · ${izleyiciMetni(o.izleyici)}` : 'CANLI',
      tur: 'canli',
      ipucu: `Yayında: ${platformlar || '—'}`
    };
  }
  return {
    metin: 'Yayın kapalı',
    tur: 'kapali',
    ipucu: '"Yalnız yayındayken" komutları şu an çalışmaz; "yalnız yayın dışında" olanlar çalışır.'
  };
}

/** Platform kartındaki satır; platform durum bildirmiyorsa null. */
export function platformRozeti(o: CanliOzet | null | undefined, platform: string): Rozet | null {
  const d = o?.platformlar?.find((x) => x.platform === platform);
  if (!d) return null;
  if (!d.canli) return { metin: 'Yayın kapalı', tur: 'kapali', ipucu: `${ad(platform)} yayını kapalı` };
  const ayrinti = [d.baslik, d.kategori].filter(Boolean).join(' · ');
  return {
    metin: d.izleyici > 0 ? `CANLI · ${izleyiciMetni(d.izleyici)}` : 'CANLI',
    tur: 'canli',
    ipucu: ayrinti || `${ad(platform)} yayında`
  };
}
