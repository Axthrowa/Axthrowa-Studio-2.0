/**
 * AxBoT — Kick gerçek zamanlı sohbet protokolü (saf, ağsız)
 * Developed by AxthrowA
 *
 * Kick sohbeti eskiden sabit bir Pusher anahtarıyla (`32cbd69e…`, küme us2)
 * okunuyordu. 2026 Ekim'de Pusher bu anahtarı reddetmeye başladı ("App key
 * … not in this cluster", kod 4001): bot mesaj GÖNDEREBİLİYOR ama sohbeti
 * OKUYAMIYORDU — komutlar ve bilgi yarışması cevapları bota hiç ulaşmıyordu.
 *
 * Kick'in web istemcisi artık önce bir "bağlantı pazarlığı" yapıyor
 * (`POST web.kick.com/api/v1/realtime/connection`) ve sunucunun verdiği
 * sağlayıcıya bağlanıyor. Gözlem (2026-10-14, oturumsuz istemci):
 *  - yanıt `{data:{connections:[{provider:"centrifugo",credentials:{url}}]}}`,
 *  - Centrifugo belirteci `POST …/realtime/auth/connection {client_id}` →
 *    `{data:{token}}` (oturum gerektirmiyor; herkese açık sohbet okuma),
 *  - bağlan: `{"connect":{"token","name":"js"},"id":1}`, yanıt `connect`
 *    içinde `ping` (sn), `expires`, `ttl`,
 *  - abone ol: `{"subscribe":{"channel","flag":1},"id":N}`,
 *  - sohbet: kanal `chatrooms.<oda>.v2`, olay `App\Events\ChatMessageEvent`,
 *    veri (JSON metni) eski Pusher yükünün AYNISI,
 *  - sunucu `{}` ile yoklar, istemci `{}` ile yanıtlar,
 *  - belirteç süresi dolmadan `{"refresh":{"token"},"id":N}`.
 * Sunucu yanıtı Pusher da önerebilir (anahtar+küme ile); ikisi de desteklenir.
 *
 * Bu dosya yalnız biçim/karar mantığıdır — testler ağ açmaz.
 */

export const VARSAYILAN_REALTIME_API = 'https://web.kick.com/api/v1/realtime';

export type KickSaglayici = 'centrifugo' | 'pusher';

export interface KickBaglantiSecimi {
  saglayici: KickSaglayici;
  /** Centrifugo: WebSocket adresi. */
  url?: string;
  /** Pusher: uygulama anahtarı ve küme. */
  appKey?: string;
  cluster?: string;
}

/** Pazarlık isteği gövdesi (Kick'in web istemcisinin gönderdiği biçim). */
export function pazarlikGovdesi(istemciId: string, saglayicilar: KickSaglayici[] = ['centrifugo', 'pusher']) {
  return {
    client: { id: istemciId, type: 'web' },
    capabilities: { accepted_providers: saglayicilar.map((provider) => ({ provider })) }
  };
}

/**
 * Centrifugo adresi güvenli mi: yalnız `wss://*.kick.com` (testte izin
 * verilen yerel kök ayrıca geçer). Bozuk/kötü bir yanıt botu rastgele bir
 * sunucuya bağlamasın.
 */
export function guvenliRealtimeUrl(url: unknown, ekIzinliKokler: string[] = []): boolean {
  if (typeof url !== 'string' || !url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (ekIzinliKokler.some((kok) => url.startsWith(kok))) return true;
  if (u.protocol !== 'wss:') return false;
  const h = u.hostname.toLowerCase();
  return h === 'kick.com' || h.endsWith('.kick.com');
}

/** Pazarlık yanıtından desteklenen ilk bağlantıyı seçer (sunucunun sırasıyla). */
export function baglantiSec(yanit: unknown, ekIzinliKokler: string[] = []): KickBaglantiSecimi | null {
  const baglantilar = (yanit as any)?.data?.connections;
  if (!Array.isArray(baglantilar)) return null;
  for (const b of baglantilar) {
    const saglayici = String(b?.provider || '').toLowerCase();
    const k = b?.credentials || {};
    if (saglayici === 'centrifugo' && guvenliRealtimeUrl(k.url, ekIzinliKokler)) {
      return { saglayici: 'centrifugo', url: String(k.url) };
    }
    if (saglayici === 'pusher' && typeof k.app_key === 'string' && /^[a-z0-9]+$/i.test(k.app_key)) {
      const cluster = typeof k.cluster === 'string' && /^[a-z0-9-]+$/i.test(k.cluster) ? k.cluster : 'us2';
      return { saglayici: 'pusher', appKey: k.app_key, cluster };
    }
  }
  return null;
}

/** Belirteç yanıtı: `{data:{token}}` ya da `{token}`. */
export function belirtecSec(yanit: unknown): string | null {
  const t = (yanit as any)?.data?.token ?? (yanit as any)?.token;
  return typeof t === 'string' && t.length > 0 ? t : null;
}

/** Kanal adları: sohbet (`.v2`), eski sohbet ve kanal olayları (takip/abone). */
export function abonelikKanallari(chatroomId: number, kanalId?: number | null): string[] {
  // Gözlem (2026-11, oturumsuz): KicksGifted `channel_<id>`, RewardRedeemedEvent `chatroom_<oda>` kanalında gelir
  const k = [`chatrooms.${chatroomId}.v2`, `chatrooms.${chatroomId}`, `chatroom_${chatroomId}`];
  if (kanalId && Number.isFinite(kanalId)) k.push(`channel.${kanalId}`, `channel_${kanalId}`);
  return k;
}

/**
 * Olay adının öneksiz hâli. Kick aynı olayı kanala göre farklı adlandırıyor (gözlem 2026-11:
 * `GiftedSubscriptionsEvent` `chatroom_<oda>` kanalında öneksiz, `App\\Events\\SubscriptionEvent` önekli).
 */
export function olayAdi(olay: string): string {
  return String(olay || '').replace(/^App\\Events\\/, '');
}

export type CentrifugoCerceve =
  | { tur: 'ping' }
  | { tur: 'yayin'; kanal: string; olay: string; veri: unknown }
  | {
      tur: 'yanit';
      id: number;
      connect?: { ping?: number; expires?: boolean; ttl?: number };
      refresh?: { expires?: boolean; ttl?: number };
      hata?: { code: number; message: string };
    }
  | { tur: 'bilinmeyen' };

/** Bir WebSocket iletisi birden çok satır (her biri bir JSON çerçevesi) taşıyabilir. */
export function satirlar(ham: string): string[] {
  return String(ham ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Yayın verisi: `{event, data}`; `data` çoğu zaman JSON METNİ. */
export function yayinCoz(pubVeri: unknown): { olay: string; veri: unknown } | null {
  const d = pubVeri as any;
  if (!d || typeof d !== 'object' || typeof d.event !== 'string') return null;
  let veri: unknown = d.data;
  if (typeof veri === 'string') {
    try {
      veri = JSON.parse(veri);
    } catch {
      /* düz metin bırak */
    }
  }
  return { olay: d.event, veri };
}

export function cerceveCoz(satir: string): CentrifugoCerceve {
  if (satir === '{}') return { tur: 'ping' };
  let f: any;
  try {
    f = JSON.parse(satir);
  } catch {
    return { tur: 'bilinmeyen' };
  }
  if (!f || typeof f !== 'object') return { tur: 'bilinmeyen' };
  if (Object.keys(f).length === 0) return { tur: 'ping' };
  if (f.push && typeof f.push === 'object') {
    const kanal = String(f.push.channel || '');
    const y = yayinCoz(f.push.pub?.data);
    if (kanal && y) return { tur: 'yayin', kanal, olay: y.olay, veri: y.veri };
    return { tur: 'bilinmeyen' };
  }
  if (typeof f.id === 'number') {
    const sonuc: CentrifugoCerceve = { tur: 'yanit', id: f.id };
    if (f.connect && typeof f.connect === 'object') {
      sonuc.connect = {
        ping: typeof f.connect.ping === 'number' ? f.connect.ping : undefined,
        expires: f.connect.expires === true,
        ttl: typeof f.connect.ttl === 'number' ? f.connect.ttl : undefined
      };
    }
    if (f.refresh && typeof f.refresh === 'object') {
      sonuc.refresh = { expires: f.refresh.expires === true, ttl: typeof f.refresh.ttl === 'number' ? f.refresh.ttl : undefined };
    }
    if (f.error && typeof f.error === 'object') {
      sonuc.hata = { code: Number(f.error.code) || 0, message: String(f.error.message || '') };
    }
    return sonuc;
  }
  return { tur: 'bilinmeyen' };
}

/** Centrifugo hata kodu 109 = belirteç süresi doldu → yeni belirteçle yeniden bağlan. */
export const BELIRTEC_DOLDU = 109;

/** Belirteç yenileme zamanı: süre bitmeden 15 sn önce (en az 5 sn sonra). */
export function yenilemeGecikmesiMs(ttlSn: number | undefined): number | null {
  if (typeof ttlSn !== 'number' || !(ttlSn > 0)) return null;
  return Math.max(ttlSn * 1000 - 15_000, 5_000);
}

/** Sessizlik sınırı: sunucunun ping aralığı + 10 sn pay (varsayılan 25 sn). */
export function sessizlikSiniriMs(pingSn: number | undefined): number {
  const p = typeof pingSn === 'number' && pingSn > 0 ? pingSn : 25;
  return (p + 10) * 1000;
}

/** Yeniden bağlanma beklemesi: 1, 2, 5, 10, 30, 60 sn (sonra 60'ta kalır). */
export function yenidenDenemeMs(deneme: number): number {
  const adimlar = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];
  return adimlar[Math.min(Math.max(0, deneme), adimlar.length - 1)];
}

/** Anket katmanının anladığı biçim (PollsWidget `anketAyikla`). */
export interface KatmanAnketi {
  question: string;
  options: string[];
  votes: Record<string, number>;
  endsAt: number;
}

/**
 * Kick'in kendi anketi: `App\Events\PollUpdateEvent` verisi
 * `{poll:{title, options:[{id,label,votes}], duration, remaining}}` (süreler saniye).
 * Kick panelinden başlatılan anket bot katmanına hiç ulaşmıyordu.
 */
export function kickAnketi(veri: unknown, simdi = Date.now()): KatmanAnketi | null {
  const p = (veri as any)?.poll;
  if (!p || !Array.isArray(p.options) || p.options.length < 2) return null;
  const options = p.options.map((o: any) => String(o?.label ?? ''));
  const votes: Record<string, number> = {};
  p.options.forEach((o: any, i: number) => (votes[String(i + 1)] = Number(o?.votes) || 0));
  const kalan = Number(p.remaining ?? p.duration);
  return {
    question: String(p.title || ''),
    options,
    votes,
    endsAt: simdi + (Number.isFinite(kalan) && kalan > 0 ? kalan : 0) * 1000
  };
}
