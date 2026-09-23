/**
 * StreamAxT — Twitch Helix kuralları (saf)
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
