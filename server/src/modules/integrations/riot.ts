/**
 * StreamAxT — League of Legends sıralaması (Riot API)
 * Developed by AxthrowA
 *
 * Kurallar ve kaynaklar `riot-rules.ts`'te. Güvenlik:
 *   • İstek adresi YALNIZ sabit tablodan gelen bölge/platform kodlarıyla
 *     kurulur; oyun adı ve etiket kodlanır — kullanıcı girdisi ana makineyi
 *     seçemez (SSRF yok).
 *   • Anahtar yalnız `*.api.riotgames.com`'a gider; yönlendirme REDDEDİLİR
 *     (anahtar başka bir adrese taşınmasın).
 *   • Geliştirici anahtarının sınırı dar (20 istek/sn, 100 istek/2 dk):
 *     sonuç 5 dk önbellekte tutulur.
 */
import { settingsCache } from '../../core/settings-cache.js';
import { lolSorgusuCoz, siralamaMetni, type LigKaydi } from './riot-rules.js';

const ONBELLEK_MS = 5 * 60_000;
const onbellek = new Map<string, { zaman: number; metin: string }>();

async function riotGetir(adres: string, anahtar: string): Promise<{ durum: number; veri: any }> {
  const r = await fetch(adres, {
    headers: { 'X-Riot-Token': anahtar, Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(6000)
  });
  const veri = await r.json().catch(() => null);
  return { durum: r.status, veri };
}

function durumMetni(durum: number): string {
  if (durum === 401 || durum === 403) {
    return '(Riot API anahtarı geçersiz ya da süresi dolmuş — geliştirici anahtarı 24 saatte bir yenilenir)';
  }
  if (durum === 404) return '(oyuncu bulunamadı — Riot kimliği Ad#Etiket biçiminde olmalı)';
  if (durum === 429) return '(Riot API sınırı aşıldı, biraz sonra tekrar deneyin)';
  return `(Riot API hatası: ${durum})`;
}

/** `$(leagueoflegends Ad#Etiket bölge)` yanıtı. Hata da okunur bir metindir. */
export async function lolSiralamasi(ham: string): Promise<string> {
  const anahtar = settingsCache.get('riot_api_key', '').trim();
  if (!anahtar) return '(Riot API anahtarı girilmemiş — Entegrasyonlar > League of Legends)';
  const s = lolSorgusuCoz(ham, settingsCache.get('riot_varsayilan_bolge', 'tr1'));
  if (!s) return '(kullanım: $(leagueoflegends Ad#Etiket tr))';

  const anahtarAdi = `${s.ad}#${s.etiket}@${s.platform}`.toLowerCase();
  const o = onbellek.get(anahtarAdi);
  if (o && Date.now() - o.zaman < ONBELLEK_MS) return o.metin;

  try {
    const hesap = await riotGetir(
      `https://${s.bolge}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(s.ad)}/${encodeURIComponent(s.etiket)}`,
      anahtar
    );
    if (hesap.durum !== 200 || !hesap.veri?.puuid) return durumMetni(hesap.durum);

    const lig = await riotGetir(
      `https://${s.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(String(hesap.veri.puuid))}`,
      anahtar
    );
    if (lig.durum !== 200) return durumMetni(lig.durum);

    const kimlik = `${hesap.veri.gameName || s.ad}#${hesap.veri.tagLine || s.etiket}`;
    const metin = siralamaMetni(kimlik, Array.isArray(lig.veri) ? (lig.veri as LigKaydi[]) : []);
    if (onbellek.size > 200) onbellek.clear();
    onbellek.set(anahtarAdi, { zaman: Date.now(), metin });
    return metin;
  } catch {
    return "(Riot API'ye ulaşılamadı)";
  }
}
