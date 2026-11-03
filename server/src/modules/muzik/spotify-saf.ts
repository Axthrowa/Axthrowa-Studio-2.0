/**
 * AxBoT — Spotify yardımcıları (saf; testli)
 * Developed by AxthrowA
 *
 * Yetkilendirme PKCE ile yapılır: istemci gizli anahtarı (client secret)
 * gerekmez, yalnız Spotify Developer Dashboard'daki "Client ID".
 * Davranış AxthrowA Studio'nun Rust müzik modülüyle aynıdır (aynı
 * Resonance arayüzü her ikisiyle de çalışsın).
 */
import crypto from 'crypto';

export const SPOTIFY_KAPSAMLARI =
  'user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read user-modify-playback-state';

/** Sunucunun Spotify kodunu karşıladığı yollar (Dashboard'a hangisi kayıtlıysa). */
export const SPOTIFY_DONUS_YOLLARI = ['/resonance/callback', '/callback', '/api/player/spotify/callback'] as const;

export interface CalanSarki {
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  isPlaying: boolean;
  /** ms */
  progress: number;
  /** ms */
  duration: number;
  source: string;
  updatedAt: number;
  /** Spotify parça kimliği (istek kuyruğunu eşlemek için) */
  trackId?: string;
}

export function pkceUret(): { dogrulayici: string; meydanOkuma: string } {
  const dogrulayici = crypto.randomBytes(48).toString('base64url');
  const meydanOkuma = crypto.createHash('sha256').update(dogrulayici).digest('base64url');
  return { dogrulayici, meydanOkuma };
}

export function clientIdGecerliMi(id: string): boolean {
  return /^[a-f0-9]{32}$/i.test(String(id || '').trim());
}

/** İstenen dönüş adresi bizim karşıladığımız yollardan biri mi? Değilse ilki. */
export function donusAdresiSec(kok: string, istenen?: string): string {
  const izinli = SPOTIFY_DONUS_YOLLARI.map((y) => `${kok}${y}`);
  const i = String(istenen || '').trim();
  return izinli.includes(i) ? i : izinli[0];
}

export function yetkiAdresi(clientId: string, donus: string, meydanOkuma: string, durum: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: donus,
    scope: SPOTIFY_KAPSAMLARI,
    code_challenge_method: 'S256',
    code_challenge: meydanOkuma,
    state: durum
  });
  return `https://accounts.spotify.com/authorize?${p.toString()}`;
}

/** Yapıştırılan koddan ya da tam dönüş adresinden yetki kodunu ayıklar. */
export function koduAyikla(ham: string): { kod: string } | { hata: string } {
  const t = String(ham || '').trim();
  if (!t) return { hata: 'Kod veya adres boş' };
  const hataM = t.match(/[?&]error=([^&]+)/);
  if (hataM) return { hata: `Spotify hata döndürdü: ${decodeURIComponent(hataM[1])}` };
  const m = t.match(/[?&]code=([^&\s]+)/);
  const kod = (m ? m[1] : t).trim();
  if (!kod || /\s/.test(kod) || kod.length < 20) return { hata: 'Bu bir yetkilendirme kodu gibi görünmüyor' };
  return { kod };
}

/** `/me/player/currently-playing` yanıtı → ortak "şu an çalan" (yoksa null). */
export function calaniAyikla(veri: any, simdi = Date.now()): CalanSarki | null {
  const item = veri?.item;
  if (!item) return null;
  const sanatci =
    (Array.isArray(item.artists) ? item.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '') ||
    String(item.show?.name || '');
  const gorseller = item.album?.images || item.images || item.show?.images || [];
  return {
    title: String(item.name || ''),
    artist: sanatci,
    album: String(item.album?.name || item.show?.name || ''),
    albumArt: String(gorseller[0]?.url || ''),
    isPlaying: Boolean(veri.is_playing),
    progress: Math.max(0, Number(veri.progress_ms) || 0),
    duration: Math.max(0, Number(item.duration_ms) || 0),
    source: 'spotify',
    updatedAt: simdi,
    trackId: typeof item.id === 'string' ? item.id : undefined
  };
}

/** Şarkı isteği metninden Spotify parça kimliği (link ya da URI) */
export function parcaKimligi(metin: string): string | null {
  const m = String(metin || '').match(/(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
}

/** Spotify oynatıcı hata kodlarını Türkçeye çevirir. */
export function oynaticiHatasi(durum: number): string {
  if (durum === 401) return 'Spotify oturumu geçersiz — panelden yeniden bağlan.';
  if (durum === 403) return 'Spotify çalamadı — oynatma kontrolü Spotify Premium gerektirir.';
  if (durum === 404) return 'Açık Spotify cihazı yok — Spotify uygulamasında bir şey çalmaya başlat.';
  if (durum === 429) return 'Spotify hız sınırı — biraz sonra tekrar dene.';
  return `Spotify isteği başarısız (${durum}).`;
}
