/**
 * AxBoT — değişkenler için güvenli ağ erişimi
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
 *
 * 4. turda kapatılan iki açık:
 *   - ALAN ADI yalnız metin olarak denetleniyordu: `127.0.0.1.nip.io`,
 *     `localtest.me` ya da A kaydı 192.168.x.x olan herhangi bir alan adı
 *     yerel ağa ulaşıyordu. Artık bağlantı kurulurken ÇÖZÜLEN IP denetlenir
 *     (`lookup` kancası); denetlenen adres bağlanılan adresin kendisi olduğu
 *     için DNS yeniden bağlama ile kontrol-sonra-kullan boşluğu da yok.
 *   - IPv6 yalnız birkaç önekle bakılıyordu: `http://[::ffff:127.0.0.1]/`
 *     (IPv4 eşlemeli IPv6) doğrudan yerel API'ye gidiyordu.
 */
import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { ipv4OncelikliLookup } from '../dns-hizli.js';
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

/** Özel / yerel / bağlantı-yerel / ayrılmış aralıklar. */
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
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
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

/** IPv6 metnini 8 adet 16 bitlik parçaya açar ("::" ve gömülü IPv4 dahil); geçersizse null. */
function ipv6Parcalar(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0];
  // Sondaki gömülü IPv4 (ör. ::ffff:127.0.0.1) → iki parça
  const v4 = s.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const n = ipv4Sayi(v4[2]);
    if (n === null) return null;
    s = `${v4[1]}${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const iki = s.split('::');
  if (iki.length > 2) return null;
  const sol = iki[0] ? iki[0].split(':') : [];
  const sag = iki.length === 2 && iki[1] ? iki[1].split(':') : [];
  const eksik = 8 - sol.length - sag.length;
  if (iki.length === 1 ? eksik !== 0 : eksik < 0) return null;
  const hepsi = [...sol, ...Array(iki.length === 2 ? eksik : 0).fill('0'), ...sag];
  if (hepsi.length !== 8 || hepsi.some((h) => !/^[0-9a-f]{1,4}$/.test(h))) return null;
  return hepsi.map((h) => parseInt(h, 16));
}

/**
 * IP adresi (v4 ya da v6) dışarıya çıkış için yasak mı?
 * Geçersiz metin de yasak sayılır (bilinmeyeni geçirmemek için).
 */
export function yasakIpMi(ip: string): boolean {
  const tur = net.isIP(ip);
  if (tur === 4) return ozelIpMi(ip);
  if (tur !== 6) return true;
  const p = ipv6Parcalar(ip);
  if (!p) return true;
  const hepsiSifir = (a: number, b: number) => p.slice(a, b).every((x) => x === 0);
  // :: ve ::1
  if (hepsiSifir(0, 7) && (p[7] === 0 || p[7] === 1)) return true;
  // Gömülü IPv4 taşıyan biçimler: eşlemeli (::ffff:a.b.c.d), uyumlu (::a.b.c.d),
  // NAT64 (64:ff9b::a.b.c.d) → gömülü adres denetlenir
  const gomulu = `${p[6] >> 8}.${p[6] & 0xff}.${p[7] >> 8}.${p[7] & 0xff}`;
  if (hepsiSifir(0, 5) && (p[5] === 0xffff || p[5] === 0)) return ozelIpMi(gomulu);
  if (p[0] === 0x64 && p[1] === 0xff9b && hepsiSifir(2, 6)) return ozelIpMi(gomulu);
  // 6to4 (2002:AABB:CCDD::) → gömülü IPv4
  if (p[0] === 0x2002) return ozelIpMi(`${p[1] >> 8}.${p[1] & 0xff}.${p[2] >> 8}.${p[2] & 0xff}`);
  // fc00::/7 benzersiz yerel, fe80::/10 bağlantı-yerel, ff00::/8 çoklu yayın
  if ((p[0] & 0xfe00) === 0xfc00) return true;
  if ((p[0] & 0xffc0) === 0xfe80) return true;
  if ((p[0] & 0xff00) === 0xff00) return true;
  return false;
}

/** Adres dış ağa çıkış için güvenli mi? (metin denetimi; çözümleme `guvenliGetir`'de) */
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
  if (YASAK_HOST.has(host) || host.endsWith('.localhost')) return { ok: false, sebep: 'yerel adres engelli' };
  // IP yazılmışsa (WHATWG ayrıştırıcısı 2130706433 / 0x7f.1 biçimlerini de
  // 127.0.0.1'e çevirir) doğrudan denetle
  if (net.isIP(host) && yasakIpMi(host)) return { ok: false, sebep: 'özel ağ adresi engelli' };

  return { ok: true };
}

/**
 * Bağlantı anında çözülen adresleri denetleyen `lookup`.
 * Alan adı özel bir adrese çözülüyorsa bağlantı hiç kurulmaz.
 */
export function guvenliLookup(
  hostname: string,
  secenek: dns.LookupOptions,
  geriDon: (hata: NodeJS.ErrnoException | null, adres: string | dns.LookupAddress[], aile?: number) => void
): void {
  // IPv4 öncelikli (bkz. core/dns-hizli.ts); her adres yine aşağıda denetlenir
  ipv4OncelikliLookup(hostname, { ...secenek, all: true }, (hata, adresler) => {
    if (hata) return geriDon(hata, '', undefined);
    const liste = adresler as dns.LookupAddress[];
    const yasak = liste.find((a) => yasakIpMi(a.address));
    if (!liste.length || yasak) {
      const e: NodeJS.ErrnoException = new Error(`özel ağ adresi engelli (${hostname})`);
      e.code = 'ESSRF';
      return geriDon(e, '', undefined);
    }
    if (secenek.all) return geriDon(null, liste);
    return geriDon(null, liste[0].address, liste[0].family);
  });
}

/** Tek istek: yönlendirme yok, zaman ve boyut sınırlı, çözülen IP denetimli. */
function istek(adres: string): Promise<{ durum: number; govde: string }> {
  return new Promise((coz, reddet) => {
    const u = new URL(adres);
    const modul = u.protocol === 'https:' ? https : http;
    const req = modul.get(
      u,
      {
        lookup: guvenliLookup as unknown as net.LookupFunction,
        headers: { 'User-Agent': 'AxBoT/1.0', Accept: 'text/plain, application/json, */*' },
        timeout: SINIR.agMs
      },
      (res) => {
        const durum = res.statusCode || 0;
        const parcalar: Buffer[] = [];
        let boyut = 0;
        res.on('data', (p: Buffer) => {
          boyut += p.length;
          if (boyut > SINIR.agBayt) {
            parcalar.push(p.subarray(0, Math.max(0, SINIR.agBayt - (boyut - p.length))));
            res.destroy();
            return;
          }
          parcalar.push(p);
        });
        const bitir = () => coz({ durum, govde: Buffer.concat(parcalar).toString('utf8') });
        res.on('end', bitir);
        res.on('close', bitir);
        res.on('error', (e) => reddet(e));
      }
    );
    const zamanAsimi = () => req.destroy(Object.assign(new Error('zaman aşımı'), { name: 'TimeoutError' }));
    // Soket hareketsizliği + toplam süre: damla damla yanıt veren sunucu da kesilir
    req.on('timeout', zamanAsimi);
    const toplam = setTimeout(zamanAsimi, SINIR.agMs);
    req.on('close', () => clearTimeout(toplam));
    req.on('error', reddet);
  });
}

/** Güvenli GET. Hata durumunda kısa bir işaret döner, şablon çökmez. */
export async function guvenliGetir(ham: string): Promise<string> {
  const kontrol = adresGuvenliMi(ham);
  if (!kontrol.ok) return `(fetch: ${kontrol.sebep})`;

  try {
    const { durum, govde } = await istek(ham.trim());
    // Yönlendirme takip edilmez: hedef yerel bir adrese yönlendirebilir.
    if (durum >= 300 && durum < 400) return '(fetch: yönlendirme izlenmez)';
    if (durum < 200 || durum >= 300) return `(fetch: HTTP ${durum})`;
    return govde.slice(0, SINIR.agBayt).trim();
  } catch (e: any) {
    if (e?.code === 'ESSRF') return '(fetch: özel ağ adresi engelli)';
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return '(fetch: zaman aşımı)';
    return '(fetch: bağlantı hatası)';
  }
}
