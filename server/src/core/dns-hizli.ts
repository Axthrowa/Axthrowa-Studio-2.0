/**
 * StreamAxT — IPv4 öncelikli DNS çözümleme
 * Developed by AxthrowA
 *
 * Bazı ev ağlarında aile belirtilmemiş `dns.lookup` (A + AAAA) AAAA
 * yanıtını beklerken 4–12 sn takılıyor; IPv4 sorgusu anında dönüyor.
 * Sonuç: Kick API, 7TV, hava durumu gibi her dış istek saniyelerce gecikiyor
 * ve 5 sn sınırlı istekler zaman aşımına düşüyordu. Önce IPv4 denenir;
 * bulunamazsa (yalnız IPv6 olan alan adı) normal çözümlemeye düşülür.
 */
import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

type GeriDon = (hata: NodeJS.ErrnoException | null, adres: string | dns.LookupAddress[], aile?: number) => void;

export function ipv4OncelikliLookup(hostname: string, secenek: dns.LookupOptions | number | undefined, geriDon: GeriDon): void {
  const s: dns.LookupOptions = typeof secenek === 'number' ? { family: secenek } : { ...(secenek || {}) };
  // Aile zaten seçilmişse ya da ad bir IP ise dokunma
  if (s.family === 4 || s.family === 6 || net.isIP(hostname)) {
    dns.lookup(hostname, s as any, geriDon as any);
    return;
  }
  dns.lookup(hostname, { ...s, family: 4 } as any, ((hata: NodeJS.ErrnoException | null, adres: any, aile?: number) => {
    if (!hata && (!Array.isArray(adres) || adres.length)) return geriDon(null, adres, aile);
    dns.lookup(hostname, s as any, geriDon as any);
  }) as any);
}

let kuruldu = false;

/** http/https genel ajanlarına (axios dahil) IPv4 öncelikli çözümlemeyi takar. */
export function hizliDnsKur(): void {
  if (kuruldu) return;
  kuruldu = true;
  for (const ajan of [http.globalAgent, https.globalAgent] as any[]) {
    if (ajan?.options && !ajan.options.lookup) ajan.options.lookup = ipv4OncelikliLookup;
  }
}
