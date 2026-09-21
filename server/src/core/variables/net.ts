/**
 * StreamAxT — değişkenler için güvenli ağ erişimi
 * Developed by AxthrowA
 *
 * `fetch[...]` ve `$(urlfetch ...)` kullanıcı şablonundan gelen bir adrese
 * istek atar. Koruma olmadan bu bir SSRF kapısıdır: izleyici komut
 * oluşturabiliyorsa `fetch[http://127.0.0.1:3001/api/platforms]` yazıp
 * tokenı sohbete bastırabilir.
 *
 * Bu yüzden:
 *   - Yalnız http/https
 *   - Özel ve yerel IP aralıkları ENGELLİ (kendi API'miz dahil)
 *   - Zaman aşımı ve yanıt boyutu sınırlı
 *   - Yönlendirme takip edilmez (yönlendirmeyle yerel adrese sızma olmasın)
 */
import { SINIR } from './types.js';

/** Engellenen ana makine adları. */
const YASAK_HOST = new Set(['localhost', 'metadata.google.internal', 'metadata']);

/** IPv4 metnini 32 bitlik sayıya çevirir; IPv4 değilse null. */
function ipv4Sayi(host: string): number | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

/** Özel / yerel / bağlantı-yerel aralıklar. */
const OZEL_ARALIK: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['100.64.0.0', 10],
  ['192.0.0.0', 24],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4]
];

export function ozelIpMi(host: string): boolean {
  const n = ipv4Sayi(host);
  if (n === null) return false;
  return OZEL_ARALIK.some(([taban, bit]) => {
    const t = ipv4Sayi(taban)!;
    const maske = bit === 0 ? 0 : (~0 << (32 - bit)) >>> 0;
    return (n & maske) >>> 0 === (t & maske) >>> 0;
  });
}

/** Adres dış ağa çıkış için güvenli mi? */
export function adresGuvenliMi(ham: string): { ok: boolean; sebep?: string } {
  let u: URL;
  try {
    u = new URL(String(ham).trim());
  } catch {
    return { ok: false, sebep: 'geçersiz adres' };
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, sebep: 'yalnız http/https' };
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (YASAK_HOST.has(host)) return { ok: false, sebep: 'yerel adres engelli' };
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return { ok: false, sebep: 'yerel adres engelli' };
  }
  if (ozelIpMi(host)) return { ok: false, sebep: 'özel ağ adresi engelli' };

  return { ok: true };
}

/** Güvenli GET. Hata durumunda kısa bir işaret döner, şablon çökmez. */
export async function guvenliGetir(ham: string): Promise<string> {
  const kontrol = adresGuvenliMi(ham);
  if (!kontrol.ok) return `(fetch: ${kontrol.sebep})`;

  const iptal = AbortSignal.timeout(SINIR.agMs);
  try {
    const r = await fetch(ham.trim(), {
      signal: iptal,
      redirect: 'error', // yönlendirmeyle yerel adrese sızmayı engelle
      headers: { 'User-Agent': 'StreamAxT/1.0' }
    });
    if (!r.ok) return `(fetch: HTTP ${r.status})`;

    const metin = await r.text();
    return metin.slice(0, SINIR.agBayt).trim();
  } catch (e: any) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return '(fetch: zaman aşımı)';
    return '(fetch: bağlantı hatası)';
  }
}
