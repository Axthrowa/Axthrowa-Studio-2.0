/**
 * AxBoT — Twitch Helix kuralları (saf)
 * Developed by AxthrowA
 *
 * KAYNAK: Twitch API Reference (dev.twitch.tv/docs/api/reference) —
 * CONFIRMED_IN_PUBLIC_DOCS:
 *   • Ban User           POST   /helix/moderation/bans?broadcaster_id&moderator_id
 *                        gövde {data:{user_id, duration?, reason?}}
 *                        duration SANİYE, 1…1.209.600 (2 hafta); yoksa kalıcı ban
 *                        kapsam moderator:manage:banned_users
 *   • Delete Chat Msgs   DELETE /helix/moderation/chat?broadcaster_id&moderator_id&message_id
 *                        kapsam moderator:manage:chat_messages
 *                        "PRIVMSG'deki id etiketi mesaj kimliğidir"
 *   • Modify Channel     PATCH  /helix/channels?broadcaster_id  {title?, game_id?}
 *                        kapsam channel:manage:broadcast, jeton YAYINCININ olmalı
 *   • Update Chat Settings PATCH /helix/chat/settings?broadcaster_id&moderator_id
 *                        kapsam moderator:manage:chat_settings; tüm alanlar isteğe bağlı;
 *                        slow_mode_wait_time 3…120 sn (vars. 30), follower_mode_duration
 *                        0…129600 dk (vars. 0); süre alanı yalnız ilgili mod true iken
 *                        (Chrome ile resmi belgeden okundu, 2026-09-26)
 *   • Token doğrulama    GET    https://id.twitch.tv/oauth2/validate
 *                        → {client_id, login, user_id, scopes, expires_in}
 *
 * Twitch sohbeti IRC ile okunuyor; IRC ile /timeout komutları Şubat 2023'te
 * kaldırıldı. Moderasyon yalnız Helix ile yapılabilir.
 */

export const TWITCH_ZAMAN_ASIMI_UST = 1_209_600;

/** "oauth:abc" / "Bearer abc" / "abc" → "abc" */
export function twitchJetonTemizle(ham: unknown): string {
  return String(ham ?? '')
    .trim()
    .replace(/^oauth:/i, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
}

/** Zaman aşımı süresini Twitch sınırlarına çeker. */
export function twitchSureSinirla(saniye: number): number {
  const n = Math.round(Number(saniye) || 0);
  return Math.min(TWITCH_ZAMAN_ASIMI_UST, Math.max(1, n));
}

/** Gereken kapsam jetonda var mı? */
export function kapsamVar(kapsamlar: unknown, gereken: string): boolean {
  return Array.isArray(kapsamlar) && kapsamlar.map(String).includes(gereken);
}

/**
 * Helix hata yanıtını kullanıcıya anlaşılır metne çevirir.
 * Sessiz başarısızlık yok: panel ve sohbet uyarısı bu metni gösterir.
 */
export function twitchHataAciklamasi(durum: number, govde: any, gerekenKapsam?: string): string {
  const mesaj = String(govde?.message || govde?.error || '').slice(0, 140);
  if (durum === 401) {
    return gerekenKapsam
      ? `Twitch jetonu geçersiz ya da "${gerekenKapsam}" izni yok — Platformlar'dan jetonu yenileyin`
      : 'Twitch jetonu geçersiz veya süresi dolmuş';
  }
  if (durum === 403) return 'Bot hesabı bu kanalda moderatör değil (Twitch 403)';
  if (durum === 400) return `Twitch isteği reddetti: ${mesaj || 'geçersiz parametre'}`;
  if (durum === 404) return 'Twitch: kullanıcı veya mesaj bulunamadı';
  if (durum === 429) return 'Twitch hız sınırı aşıldı, biraz sonra tekrar deneyin';
  return `Twitch hatası ${durum}${mesaj ? `: ${mesaj}` : ''}`;
}

/** Helix `streams` yanıtından yayın bilgisi. Boş dizi = yayın kapalı. */
export function twitchYayinCoz(govde: any): {
  canli: boolean;
  baslangic: number | null;
  izleyici: number;
  baslik: string;
  kategori: string;
  yayinId: string;
} {
  const s = Array.isArray(govde?.data) ? govde.data[0] : null;
  if (!s || String(s.type || 'live') !== 'live') {
    return { canli: false, baslangic: null, izleyici: 0, baslik: '', kategori: '', yayinId: '' };
  }
  const t = Date.parse(String(s.started_at || ''));
  return {
    canli: true,
    baslangic: Number.isFinite(t) ? t : null,
    izleyici: Math.max(0, Number(s.viewer_count) || 0),
    baslik: String(s.title || ''),
    kategori: String(s.game_name || ''),
    yayinId: String(s.id || '')
  };
}

/** Sohbet modu isteği (panel) — yalnız verilen alanlar değişir. */
export interface SohbetModuGirdisi {
  /** 0 = kapat, 3…120 sn = aç */
  yavasSn?: number;
  /** null/false = kapat, 0…129600 dk = aç */
  takipciDk?: number | null | false;
  abone?: boolean;
  emote?: boolean;
  benzersiz?: boolean;
}

export const YAVAS_MOD_ARALIK = [3, 120] as const;
export const TAKIPCI_MOD_UST_DK = 129_600;

/**
 * Panel girdisini Helix `PATCH /chat/settings` gövdesine çevirir; aralık dışı değer reddedilir (Twitch
 * 400 dönmeden önce açık hata). En az bir alan gerekir.
 */
export function sohbetModuGovdesi(g: unknown): { ok: true; govde: Record<string, boolean | number> } | { ok: false; hata: string } {
  const o = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
  const govde: Record<string, boolean | number> = {};
  if (o.yavasSn !== undefined) {
    const n = Number(o.yavasSn);
    if (!Number.isInteger(n)) return { ok: false, hata: 'Yavaş mod süresi tam sayı olmalı' };
    if (n === 0) govde.slow_mode = false;
    else if (n >= YAVAS_MOD_ARALIK[0] && n <= YAVAS_MOD_ARALIK[1]) {
      govde.slow_mode = true;
      govde.slow_mode_wait_time = n;
    } else return { ok: false, hata: `Yavaş mod ${YAVAS_MOD_ARALIK[0]}-${YAVAS_MOD_ARALIK[1]} sn olmalı (0 = kapat)` };
  }
  if (o.takipciDk !== undefined) {
    if (o.takipciDk === null || o.takipciDk === false) govde.follower_mode = false;
    else {
      const n = Number(o.takipciDk);
      if (!Number.isInteger(n) || n < 0 || n > TAKIPCI_MOD_UST_DK) return { ok: false, hata: `Takipçi modu 0-${TAKIPCI_MOD_UST_DK} dk olmalı` };
      govde.follower_mode = true;
      govde.follower_mode_duration = n;
    }
  }
  for (const [ad, alan] of [['abone', 'subscriber_mode'], ['emote', 'emote_mode'], ['benzersiz', 'unique_chat_mode']] as const) {
    if (o[ad] === undefined) continue;
    if (typeof o[ad] !== 'boolean') return { ok: false, hata: `'${ad}' true/false olmalı` };
    govde[alan] = o[ad] as boolean;
  }
  if (!Object.keys(govde).length) return { ok: false, hata: 'Değiştirilecek sohbet modu yok' };
  return { ok: true, govde };
}

/** IRC `emotes` etiketi ("25:0-4,12-16/1902:6-10") → { '25': ['0-4', '12-16'], '1902': ['6-10'] }. Boşsa undefined. */
export function twitchEmoteEtiketi(ham: unknown): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const parca of String(ham || '').split('/')) {
    const [id, konumlar] = parca.split(':');
    if (!/^[\w-]+$/.test(id || '') || !konumlar) continue;
    const gecerli = konumlar.split(',').filter((k) => /^\d+-\d+$/.test(k));
    if (gecerli.length) out[id] = gecerli;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Helix `/chat/badges/global` ve `/chat/badges?broadcaster_id=` yanıtları → "set/sürüm" → görsel adresi.
 * Sonra verilen yanıt öncekini ezer (kanalın kendi abone/bit rozetleri genel rozetlerin yerine geçer).
 */
export function twitchRozetHaritasi(...yanitlar: any[]): Map<string, string> {
  const h = new Map<string, string>();
  for (const y of yanitlar) {
    for (const set of Array.isArray(y?.data) ? y.data : []) {
      for (const v of Array.isArray(set?.versions) ? set.versions : []) {
        const url = String(v?.image_url_2x || v?.image_url_1x || '');
        if (set?.set_id && v?.id && /^https:\/\/static-cdn\.jtvnw\.net\//.test(url)) h.set(`${set.set_id}/${v.id}`, url);
      }
    }
  }
  return h;
}

/** IRC `badges` etiketi → özgün rozet görselleri. Haritada olmayan rozet düz ad kalır (istemci yedeğini çizer). */
export function twitchRozetleri(badgesStr: string, harita: ReadonlyMap<string, string>): Array<string | { type: string; text: string; imageUrl: string }> {
  return String(badgesStr || '')
    .split(',')
    .filter(Boolean)
    .map((b) => {
      const url = harita.get(b);
      return url ? { type: b.split('/')[0], text: b, imageUrl: url } : b;
    });
}
