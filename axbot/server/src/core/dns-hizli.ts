/**
 * AxBoT — IPv4 öncelikli DNS çözümleme
 * Developed by AxthrowA
 *
 * Bazı ev ağlarında aile belirtilmemiş `dns.lookup` (A + AAAA) AAAA
 * yanıtını beklerken 4–12 sn takılıyor; IPv4 sorgusu anında dönüyor.
 * Sonuç: Kick API, 7TV, Gemini, Discord webhook, hava durumu gibi HER dış
 * istek saniyelerce gecikiyor, süre sınırlı istekler zaman aşımına düşüyordu
 * (ölçüm: `fetch` 10,7 sn → 0,3 sn). Önce IPv4 denenir; bulunamazsa (yalnız
 * IPv6 olan alan adı) normal çözümlemeye düşülür.
 *
 * `hizliDnsKur` süreç genelindeki `dns.lookup`'ı sarar: yerleşik `fetch`
 * (undici), axios, ws ve discord.js bağlantıları `net.connect` üzerinden bu
 * işlevi çağırır; ayrı ayrı ajan ayarlamak `fetch`'i kapsamıyordu.
 */
import dns from 'dns';
import net from 'net';

type GeriDon = (hata: NodeJS.ErrnoException | null, adres: string | dns.LookupAddress[], aile?: number) => void;

/** Sarılmadan önceki özgün işlev (özyineleme olmasın). */
const asilLookup: typeof dns.lookup = dns.lookup;

/** Verilen özgün çözücüyü IPv4 öncelikli hâle getirir (testte sahte çözücü verilir). */
export function ipv4OncelikliYap(asil: (...a: any[]) => void) {
  return function ipv4Oncelikli(
    hostname: string,
    secenek: dns.LookupOptions | number | GeriDon | undefined,
    geriDon?: GeriDon
  ): void {
    if (typeof secenek === 'function') {
      geriDon = secenek;
      secenek = {};
    }
    const cb = geriDon as GeriDon;
    const s: dns.LookupOptions = typeof secenek === 'number' ? { family: secenek } : { ...(secenek || {}) };
    // Aile zaten seçilmişse ya da ad bir IP ise dokunma
    if (s.family === 4 || s.family === 6 || net.isIP(hostname)) {
      asil.call(dns, hostname, s, cb);
      return;
    }
    asil.call(dns, hostname, { ...s, family: 4 }, (hata: NodeJS.ErrnoException | null, adres: any, aile?: number) => {
      if (!hata && (!Array.isArray(adres) || adres.length)) return cb(null, adres, aile);
      asil.call(dns, hostname, s, cb);
    });
  };
}

export const ipv4OncelikliLookup = ipv4OncelikliYap(asilLookup as any);

let kuruldu = false;

/** Süreç genelinde (fetch, axios, ws, discord.js) IPv4 öncelikli çözümleme. */
export function hizliDnsKur(): void {
  if (kuruldu) return;
  kuruldu = true;
  (dns as any).lookup = ipv4OncelikliLookup;
}
