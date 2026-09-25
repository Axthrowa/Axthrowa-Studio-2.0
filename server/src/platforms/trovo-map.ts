/**
 * StreamAxT — Trovo sohbet eşlemesi (saf)
 * Developed by AxthrowA
 *
 * Veritabanı ve ağ erişimi YOK: test edilebilsin ve testler çalışan
 * sunucunun SQLite kilidine takılmasın (prediction-math.ts ile aynı desen).
 *
 * KAYNAK: Trovo Chat Service resmi belgesi — "Chat Message Types and
 * Samples" (§3.4) ve "User Roles" (§3.5).
 * Sınıflandırma: CONFIRMED_IN_PUBLIC_DOCS.
 * https://developer.trovo.live/docs/Chat%20Service.html
 *
 * Tür kimlikleri tahmin edilmedi; belgedeki tablodan alındı. Tanımadığımız
 * bir tür gelirse SESSİZCE YOK SAYILIR — uydurma bir olaya çevrilmez.
 */

/** Sohbet baloncuğu sayılan türler: düz sohbet + "magic chat" çeşitleri. */
export const SOHBET_TURLERI = new Set([0, 6, 7, 8, 9]);

export type TrovoOlayTuru =
  | 'chat'
  | 'follow'
  | 'sub'
  | 'gift_sub'
  | 'gift'
  | 'raid'
  | 'stream_online'
  | 'stream_offline'
  | 'yoksay';

export interface TrovoRolleri {
  isMod: boolean;
  isSub: boolean;
  isVip: boolean;
  isBroadcaster: boolean;
  rozetler: string[];
}

export interface TrovoSohbeti {
  type?: number;
  content?: string;
  nick_name?: string;
  user_name?: string;
  avatar?: string;
  roles?: string[];
  medals?: string[];
  message_id?: string;
  uid?: number | string;
  sender_id?: number | string;
  send_time?: number | string;
  sub_lv?: string;
  content_data?: Record<string, unknown>;
}

export interface TrovoOlayi {
  tur: TrovoOlayTuru;
  /** Sohbet/olay metni. */
  metin: string;
  /** Sayısal değer: hediye adedi, raid izleyici sayısı… */
  adet: number;
  /** Hediye adı (spell) veya hediye abonenin alıcısı. */
  hedef: string;
}

/**
 * Rolleri bizim bayraklarımıza çevirir.
 *
 * Trovo'da "vip" rolü YOKTUR; en yakın karşılık platform üyeliği olan
 * `ace` / `ace+` değil, kanal düzeyindeki `editor`dır. Uydurma yapmamak
 * için `isVip` yalnız `editor` ve `supermod` için açılır — bunlar da
 * kanala özel ayrıcalıklı rollerdir.
 */
export function rolleriCoz(roller: unknown, rozetler: unknown): TrovoRolleri {
  const r = (Array.isArray(roller) ? roller : []).map((x) => String(x).toLowerCase());
  const m = (Array.isArray(rozetler) ? rozetler : []).map((x) => String(x));
  return {
    isBroadcaster: r.includes('streamer'),
    isMod: r.includes('mod') || r.includes('supermod') || r.includes('admin') || r.includes('warden'),
    isSub: r.includes('subscriber'),
    isVip: r.includes('editor') || r.includes('supermod'),
    rozetler: m
  };
}

/**
 * Spell (hediye) içeriğini çözer.
 * Biçim: `{"gift":"Winner", "num":1}` — tür 5 ve 5009.
 * Bozuk JSON gelirse adet 0 döner; uydurma değer üretilmez.
 */
export function hediyeCoz(content: unknown): { hediye: string; adet: number } {
  try {
    const j = JSON.parse(String(content ?? ''));
    return {
      hediye: String(j?.gift ?? '').trim(),
      adet: Math.max(0, Number(j?.num) || 0)
    };
  } catch {
    return { hediye: '', adet: 0 };
  }
}

/**
 * Hediye abone alıcısını çözer.
 * Tür 5006 içeriği: `"100000252,CatKing"` → alıcı `CatKing`.
 */
export function hediyeAboneAlici(content: unknown): string {
  const s = String(content ?? '');
  const i = s.indexOf(',');
  return i >= 0 ? s.slice(i + 1).trim() : '';
}

/**
 * Raid mesajındaki izleyici sayısını çıkarır.
 * Tür 5008: `"{nickname} is carrying {raiderNum} raiders to this channel."`
 * Şablon yerine gerçek sayı gelir; ilk sayı alınır. Bulunamazsa 0.
 */
export function raidSayisi(content: unknown): number {
  const m = String(content ?? '').match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Bir Trovo sohbet nesnesini bizim olay modelimize çevirir.
 *
 * Tanınmayan tür `yoksay` döner: belgede olmayan bir kodu uydurma bir
 * olaya bağlamak, panelin yanlış uyarı göstermesi demektir.
 */
export function sohbetOlayi(c: TrovoSohbeti): TrovoOlayi {
  const tur = Number(c?.type);
  const metin = String(c?.content ?? '');
  const bos: TrovoOlayi = { tur: 'yoksay', metin, adet: 0, hedef: '' };

  if (SOHBET_TURLERI.has(tur)) return { ...bos, tur: 'chat' };

  switch (tur) {
    case 5: // Spell (mana / elixir)
    case 5009: {
      // Özel spell
      const { hediye, adet } = hediyeCoz(metin);
      return { tur: 'gift', metin, adet, hedef: hediye };
    }
    case 5001: // Abonelik
      return { ...bos, tur: 'sub', adet: 1 };
    case 5003: // Takip
      return { ...bos, tur: 'follow' };
    case 5005: // Rastgele hediye abone — içerik ADET
      return { ...bos, tur: 'gift_sub', adet: Math.max(1, Number(metin) || 1) };
    case 5006: // Belirli kişiye hediye abone
      return { tur: 'gift_sub', metin, adet: 1, hedef: hediyeAboneAlici(metin) };
    case 5008: // Raid ile gelen karşılama
      return { tur: 'raid', metin, adet: raidSayisi(metin), hedef: '' };
    case 5012: // Yayın açıldı / kapandı (izleyiciye görünmez)
      return {
        ...bos,
        tur: metin.trim().toLowerCase() === 'stream_on' ? 'stream_online' : 'stream_offline'
      };
    // 5002 sistem, 5004 kanala giriş, 5007 platform etkinliği, 5013 takipten
    // çıkma: bizde karşılığı olan bir uyarı yok, sessizce geçilir.
    default:
      return bos;
  }
}

/** PONG yanıtındaki önerilen kalp atışı aralığı (ms). Makul sınırlara çekilir. */
export function kalpAtisiAraligi(pong: any): number {
  const sn = Number(pong?.data?.gap);
  if (!Number.isFinite(sn) || sn <= 0) return 30_000;
  return Math.min(120_000, Math.max(5_000, Math.round(sn * 1000)));
}

/** Yeniden bağlanma gecikmesi: üstel artış, 30 sn tavan. */
export function yenidenBaglanmaGecikmesi(deneme: number): number {
  const n = Math.max(0, Math.floor(deneme));
  return Math.min(30_000, 1000 * 2 ** Math.min(n, 5));
}

/**
 * Trovo'nun komut ucu (`channels/command`) tek bir dizge alır: `ban xxx`.
 * Kullanıcı adında boşluk olursa ek argüman sayılabilir (ör. `ban ali 99`
 * süre olarak yorumlanabilir) ya da `/` ile başka komut sokulabilir. Yalnız
 * harf, rakam, alt çizgi, nokta ve tire kabul edilir; aksi hâlde `null`.
 */
export function trovoKomutAdi(ham: unknown): string | null {
  const ad = String(ham ?? '').trim().replace(/^@+/, '');
  return /^[\p{L}\p{N}_.\-]{1,40}$/u.test(ad) ? ad : null;
}
