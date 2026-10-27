/**
 * StreamAxT — ek değişkenlerin saf mantığı (ağ yok, test edilir)
 * Developed by AxthrowA
 *
 * Yaygın botlarda gözlenen (herkese açık belgeler, 2026-10) ve StreamAxT'de
 * eksik olan değişkenler:
 *  - `$(if)`      koşullu yanıt
 *  - `$(pickw)`   ağırlıklı rastgele seçim (`a:70;b:20;c:10`)
 *  - `$(weather)` hava durumu (Open-Meteo, anahtarsız)
 *  - `$(kick alan [kullanıcı])` Kick profilinden biyografi / sosyal hesaplar
 */
import { trKatla } from '../text.js';

// ---- $(if) -------------------------------------------------------------------

const YANLIS = new Set(['', '0', 'false', 'hayir', 'hayır', 'yok', 'no', 'null', 'undefined']);

/**
 * Koşul: `sol OP sağ` ya da tek değer (doğruluk). OP: == != > < >= <= ~= (içerir).
 * Metin karşılaştırması Türkçe katlanır; iki taraf sayıysa sayısal.
 */
export function kosulDegerlendir(kosul: string): boolean {
  const k = String(kosul ?? '').trim();
  const m = k.match(/^(.*?)\s*(==|!=|>=|<=|~=|>|<)\s*(.*)$/s);
  if (!m) return !YANLIS.has(trKatla(k));
  const [, solHam, op, sagHam] = m;
  const sol = solHam.trim().replace(/^"(.*)"$/s, '$1');
  const sag = sagHam.trim().replace(/^"(.*)"$/s, '$1');
  const a = Number(sol);
  const b = Number(sag);
  const sayisal = sol !== '' && sag !== '' && Number.isFinite(a) && Number.isFinite(b);
  const sa = trKatla(sol);
  const sb = trKatla(sag);
  switch (op) {
    case '==':
      return sayisal ? a === b : sa === sb;
    case '!=':
      return sayisal ? a !== b : sa !== sb;
    case '~=':
      return sb !== '' && sa.includes(sb);
    case '>':
      return sayisal ? a > b : sa > sb;
    case '<':
      return sayisal ? a < b : sa < sb;
    case '>=':
      return sayisal ? a >= b : sa >= sb;
    case '<=':
      return sayisal ? a <= b : sa <= sb;
    default:
      return false;
  }
}

/** `$(if koşul;doğruysa;yanlışsa)` parçaları (noktalı virgülle bölünmüş). */
export function ifSonucu(parcalar: string[]): string {
  const [kosul = '', dogru = '', yanlis = ''] = parcalar;
  return kosulDegerlendir(kosul) ? dogru : yanlis;
}

// ---- $(pickw) ----------------------------------------------------------------

/** `metin:ağırlık` parçalarından ağırlıklı seçim; ağırlıksız öğe 1 sayılır. */
export function agirlikliSec(parcalar: string[], rastgele: () => number = Math.random): string {
  const ogeler = parcalar
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(.*):\s*(\d+(?:[.,]\d+)?)$/s);
      return m ? { metin: m[1].trim(), agirlik: Number(m[2].replace(',', '.')) } : { metin: p, agirlik: 1 };
    })
    .filter((o) => o.agirlik > 0);
  const toplam = ogeler.reduce((t, o) => t + o.agirlik, 0);
  if (!toplam) return '';
  let r = rastgele() * toplam;
  for (const o of ogeler) {
    r -= o.agirlik;
    if (r < 0) return o.metin;
  }
  return ogeler[ogeler.length - 1].metin;
}

// ---- $(weather) --------------------------------------------------------------

/** WMO hava kodu → Türkçe açıklama ve simge (Open-Meteo `weather_code`). */
export function havaKoduMetni(kod: number): { metin: string; simge: string } {
  const k = Number(kod);
  if (k === 0) return { metin: 'Açık', simge: '☀️' };
  if (k === 1) return { metin: 'Çoğunlukla açık', simge: '🌤️' };
  if (k === 2) return { metin: 'Parçalı bulutlu', simge: '⛅' };
  if (k === 3) return { metin: 'Kapalı', simge: '☁️' };
  if (k === 45 || k === 48) return { metin: 'Sisli', simge: '🌫️' };
  if (k >= 51 && k <= 57) return { metin: 'Çiseleyen yağmur', simge: '🌦️' };
  if (k >= 61 && k <= 67) return { metin: 'Yağmurlu', simge: '🌧️' };
  if (k >= 71 && k <= 77) return { metin: 'Karlı', simge: '🌨️' };
  if (k >= 80 && k <= 82) return { metin: 'Sağanak yağışlı', simge: '🌧️' };
  if (k === 85 || k === 86) return { metin: 'Kar sağanağı', simge: '🌨️' };
  if (k >= 95 && k <= 99) return { metin: 'Gök gürültülü fırtına', simge: '⛈️' };
  return { metin: 'Bilinmiyor', simge: '🌡️' };
}

export interface HavaKonumu {
  name?: string;
  country?: string;
  admin1?: string;
}
export interface HavaAnlik {
  temperature_2m?: number;
  apparent_temperature?: number;
  relative_humidity_2m?: number;
  wind_speed_10m?: number;
  weather_code?: number;
}

/** Sohbet satırı: "⛅ İstanbul, Türkiye: Parçalı bulutlu, 18°C (hissedilen 17°C), nem %72, rüzgâr 14 km/s" */
export function havaMetni(konum: HavaKonumu, anlik: HavaAnlik): string {
  const { metin, simge } = havaKoduMetni(Number(anlik.weather_code));
  const yer = [konum.name, konum.country].filter(Boolean).join(', ');
  const derece = (v?: number) => (Number.isFinite(Number(v)) ? `${Math.round(Number(v))}°C` : '?');
  const parcalar = [`${metin}, ${derece(anlik.temperature_2m)}`];
  if (Number.isFinite(Number(anlik.apparent_temperature))) parcalar[0] += ` (hissedilen ${derece(anlik.apparent_temperature)})`;
  if (Number.isFinite(Number(anlik.relative_humidity_2m))) parcalar.push(`nem %${Math.round(Number(anlik.relative_humidity_2m))}`);
  if (Number.isFinite(Number(anlik.wind_speed_10m))) parcalar.push(`rüzgâr ${Math.round(Number(anlik.wind_speed_10m))} km/s`);
  return `${simge} ${yer || 'Konum'}: ${parcalar.join(', ')}`;
}

// ---- $(kick alan [kullanıcı]) ------------------------------------------------

export const KICK_PROFIL_ALANLARI = [
  'bio',
  'instagram',
  'twitter',
  'youtube',
  'discord',
  'tiktok',
  'facebook',
  'takipci',
  'url'
] as const;
export type KickProfilAlani = (typeof KICK_PROFIL_ALANLARI)[number];

const ALAN_TAKMA: Record<string, KickProfilAlani> = {
  biyografi: 'bio',
  followers: 'takipci',
  takipçi: 'takipci',
  x: 'twitter',
  adres: 'url',
  link: 'url'
};

export function kickAlaniCoz(ham: string): KickProfilAlani | null {
  const a = trKatla(ham).replace(/ç/g, 'c');
  const k = (ALAN_TAKMA[a] || a) as KickProfilAlani;
  return (KICK_PROFIL_ALANLARI as readonly string[]).includes(k) ? k : null;
}

/** `kick.com/api/v2/channels/<slug>` yanıtından alan. */
export function kickProfilAlani(kanal: any, alan: KickProfilAlani, slug: string): string {
  const u = kanal?.user || {};
  switch (alan) {
    case 'bio':
      return String(u.bio || '').trim();
    case 'takipci':
      return String(Number(kanal?.followers_count ?? kanal?.followersCount ?? 0) || 0);
    case 'url':
      return `https://kick.com/${String(kanal?.slug || slug).toLowerCase()}`;
    default:
      return String(u[alan] || '').trim();
  }
}

/** Steam profil XML'inden bir alan: `<gameName><![CDATA[Counter-Strike 2]]></gameName>` ya da düz `<onlineState>in-game</onlineState>` */
export function steamAlani(xml: string, etiket: string): string {
  const bas = xml.indexOf(`<${etiket}>`);
  if (bas < 0) return '';
  const son = xml.indexOf(`</${etiket}>`, bas);
  if (son < 0) return '';
  const ic = xml.slice(bas + etiket.length + 2, son).trim();
  return (ic.startsWith('<![CDATA[') && ic.endsWith(']]>') ? ic.slice(9, -3) : ic).trim();
}
