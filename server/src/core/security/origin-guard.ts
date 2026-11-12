/**
 * AxBoT — Host ve WebSocket köken koruması (saf)
 * Developed by AxthrowA
 *
 * `local-guard.ts` HTTP yazma isteklerini kökenle koruyordu; iki boşluk
 * kalmıştı (3. turda bulundu):
 *
 * 1) WEBSOCKET KÖKEN DENETİMİ YOKTU (Cross-Site WebSocket Hijacking).
 *    Tarayıcılar WebSocket'e CORS uygulamaz. Yayıncının açtığı HERHANGİ bir
 *    web sitesi `ws://127.0.0.1:<port>/ws`'ye bağlanıp şunları yapabiliyordu:
 *      • `{action:"send_chat"}` → bot GERÇEK sohbete istediği mesajı yazar
 *      • `{action:"trigger_tts"}` → yayında istediği metni sesli okutur
 *      • `{action:"clear_chat"}`, `{action:"test_alert"}`
 *      • canlı sohbeti, bağış mesajlarını ve olayları dinler
 *
 * 2) DNS YENİDEN BAĞLAMA (DNS rebinding). Saldırgan kendi alan adını
 *    127.0.0.1'e çözdürürse tarayıcı istekleri `Host: kotu.com:3001` ile
 *    bizim sunucumuza gider ve köken ile Host "aynı" görünür. Tek çare Host
 *    başlığını izin listesiyle doğrulamak: saldırganın alan adı listede yok.
 *
 * Kurallar:
 *   • Host: localhost / 127.0.0.1 / ::1 veya BU makinenin arayüz IP'leri
 *     (LAN kipinde OBS başka bilgisayardaysa) ya da AXBOT_IZINLI_HOSTLAR.
 *   • Köken: yerel köken (local-guard) VEYA Host ile birebir aynı köken
 *     (LAN'daki OBS sayfası kendi sunucusuna bağlanabilsin).
 *   • Köken yoksa (tarayıcı dışı istemci: OBS eklentisi, betik) kabul —
 *     tarayıcılar WebSocket el sıkışmasında Origin'i HER ZAMAN gönderir.
 */
import { yerelKokenMi } from './local-guard.js';

const DONGU_ADLARI = new Set(['localhost', '127.0.0.1', '::1']);

/** "127.0.0.1:3001" → "127.0.0.1", "[::1]:3001" → "::1", "LocalHost" → "localhost" */
export function hostAdi(host: string | undefined | null): string {
  const h = String(host ?? '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) {
    const kapanis = h.indexOf(']');
    return kapanis > 0 ? h.slice(1, kapanis) : h;
  }
  // Yalnız bir ':' varsa port ayırıcısıdır; çok varsa köşeli parantezsiz IPv6
  const parcalar = h.split(':');
  return parcalar.length === 2 ? parcalar[0] : h;
}

/**
 * Host başlığı kabul edilir mi?
 * @param arayuzAdresleri bu makinenin IP'leri (os.networkInterfaces)
 * @param ekIzinliler kullanıcının ortam değişkeniyle eklediği adlar
 */
export function izinliHostMu(
  host: string | undefined | null,
  arayuzAdresleri: Set<string> = new Set(),
  ekIzinliler: Set<string> = new Set()
): boolean {
  const ad = hostAdi(host);
  // HTTP/1.0 istemcileri Host göndermeyebilir; tarayıcı her zaman gönderir.
  if (!ad) return true;
  return DONGU_ADLARI.has(ad) || arayuzAdresleri.has(ad) || ekIzinliler.has(ad);
}

/** Köken, isteğin geldiği Host ile birebir aynı mı (şema + ad + port)? */
export function ayniKokenMi(origin: string | undefined | null, host: string | undefined | null): boolean {
  if (!origin || !host) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.host.toLowerCase() === String(host).trim().toLowerCase();
  } catch {
    return false;
  }
}

/** Köken kabul edilir mi? (HTTP yazma ve WebSocket el sıkışması için ortak) */
export function kokenKabulEdilir(origin: string | undefined | null, host: string | undefined | null): boolean {
  if (origin === undefined || origin === null || origin === '') return true;
  return yerelKokenMi(origin) || ayniKokenMi(origin, host);
}

/** "a.local, 192.168.1.9" → Set */
export function ekHostlariCoz(ham: string | undefined): Set<string> {
  return new Set(
    String(ham ?? '')
      .split(',')
      .map((x) => hostAdi(x))
      .filter(Boolean)
  );
}
