/**
 * AxBoT — başka botların dışa aktarımlarını Nightbot biçimine çevirir (saf)
 *
 * StreamElements ve Fossabot dosyaları alan adlarıyla tanınır; komut ve zamanlayıcılar Nightbot
 * biçimine çevrilip mevcut içe aktarma yolundan geçer. Veritabanı erişimi YOK.
 * shortcut: alan adları belgelerden ve örnek dosyalardan çıkarıldı, gerçek dışa aktarımla sınanmadı;
 * tanınmayan alan atlanır, eksik komut sayılır.
 */
import type { NightbotKomut, NightbotTimer } from './nightbot-map.js';

export type DisKaynak = 'nightbot' | 'streamelements' | 'fossabot' | 'axbot';

export interface CozulmusAktarim {
  kaynak: DisKaynak;
  komutlar: NightbotKomut[];
  zamanlayicilar: NightbotTimer[];
  uyarilar: string[];
}

type Kayit = Record<string, any>;

function dizi(v: unknown): Kayit[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
}

/** İlk dolu metin alanı */
function metin(k: Kayit, ...adlar: string[]): string {
  for (const a of adlar) {
    const v = k[a];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') return String(v[0]).trim();
  }
  return '';
}

function sayi(...degerler: unknown[]): number | undefined {
  for (const d of degerler) {
    const n = Number(d);
    if (d !== undefined && d !== null && d !== '' && Number.isFinite(n)) return n;
  }
  return undefined;
}

/** StreamElements erişim düzeyi (100 herkes … 1500 yayıncı) → Nightbot düzeyi */
export function seDuzeyi(d: unknown): string {
  const n = Number(d) || 100;
  if (n >= 1500) return 'owner';
  if (n >= 500) return 'moderator';
  if (n >= 400) return 'vip';
  if (n >= 300) return 'regular';
  if (n >= 250) return 'subscriber';
  return 'everyone';
}

/** StreamElements `${...}` değişkenlerini Nightbot `$(...)` biçimine çevirir; karşılığı olmayanları bildirir. */
export function seSablonu(ham: string): { metin: string; uyarilar: string[] } {
  const uyarilar: string[] = [];
  const t = String(ham || '').replace(/\$\{([^{}]+)\}/g, (tam, ic: string) => {
    const s = ic.trim();
    const k = s.toLowerCase();
    if (k === 'sender' || k === 'user' || k === 'user.name' || k === 'sender.name') return '$(user)';
    if (k === 'touser') return '$(touser)';
    if (/^[1-9]$/.test(k)) return `{${k}}`;
    if (k === '1:' || k === 'args') return '$(query)';
    if (['channel', 'uptime', 'game', 'title', 'count'].includes(k)) return `$(${k})`;
    if (k.startsWith('customapi.')) return `$(urlfetch ${s.slice('customapi.'.length)})`;
    uyarilar.push(`${tam} — karşılığı yok, elle düzenleyin`);
    return tam;
  });
  return { metin: t, uyarilar };
}

function bicimBul(veri: any): DisKaynak {
  if (veri?.kaynak === 'axbot') return 'axbot';
  const komutlar = dizi(Array.isArray(veri) ? veri : veri?.commands);
  const ilk = komutlar[0] || {};
  if ('reply' in ilk || 'accessLevel' in ilk || /\$\{[^}]+\}/.test(JSON.stringify(veri ?? '').slice(0, 20000))) return 'streamelements';
  if ('response' in ilk) return 'fossabot';
  return 'nightbot';
}

/** Gelen dosyayı tanır ve komut/zamanlayıcıları Nightbot biçimine çevirir. `axbot` kendi yolundan aktarılır. */
export function disAktarimiCoz(veri: any): CozulmusAktarim {
  const kaynak = bicimBul(veri);
  const uyarilar: string[] = [];
  const hamKomut = dizi(Array.isArray(veri) ? veri : veri?.commands);
  const hamTimer = dizi(veri?.timers);
  if (kaynak === 'nightbot' || kaynak === 'axbot') {
    return { kaynak, komutlar: hamKomut as NightbotKomut[], zamanlayicilar: hamTimer as NightbotTimer[], uyarilar };
  }

  const sablon = (ad: string, s: string) => {
    if (kaynak !== 'streamelements') return s;
    const c = seSablonu(s);
    for (const u of c.uyarilar) uyarilar.push(`${ad}: ${u}`);
    return c.metin;
  };

  const komutlar: NightbotKomut[] = hamKomut.map((k) => {
    const ad = metin(k, 'command', 'name', 'trigger').replace(/^!/, '');
    const bekleme = k.cooldown && typeof k.cooldown === 'object' ? sayi(k.cooldown.global, k.cooldown.user) : sayi(k.cooldown, k.global_cooldown);
    const takma = Array.isArray(k.aliases) ? k.aliases[0] : k.alias;
    return {
      name: ad,
      message: sablon(`!${ad}`, metin(k, 'reply', 'response', 'message', 'text')),
      coolDown: bekleme,
      userLevel: kaynak === 'streamelements' ? seDuzeyi(k.accessLevel) : metin(k, 'userLevel', 'permission', 'level') || undefined,
      alias: typeof takma === 'string' ? takma : undefined,
    };
  });

  const zamanlayicilar: NightbotTimer[] = hamTimer.map((t) => {
    const ad = metin(t, 'name');
    // SE ve Fossabot aralığı dakika tutar; Nightbot biçimi saniye
    const dk = sayi(t.online?.interval, t.onlineInterval, t.interval);
    // Nightbot zamanlayıcısı tek mesaj tutar; SE'nin sıradaki mesajları kaybolmasın diye bildirilir
    const fazla = Array.isArray(t.messages) ? t.messages.filter((m: unknown) => typeof m === 'string' && m.trim()).length - 1 : 0;
    if (fazla > 0) uyarilar.push(`${ad}: ${fazla} ek mesaj aktarılmadı (yalnız ilki alındı), elle ekleyin`);
    return {
      name: ad,
      message: sablon(ad, metin(t, 'messages', 'message', 'response', 'text')),
      interval: dk === undefined ? undefined : dk * 60,
      lines: sayi(t.chatLines, t.lines, t.min_lines),
      enabled: t.enabled !== false && t.online?.enabled !== false,
    };
  });

  return { kaynak, komutlar, zamanlayicilar, uyarilar };
}
