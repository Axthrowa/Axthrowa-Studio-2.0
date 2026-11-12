/**
 * AxBoT — !clip (gerçek klip) saf yardımcıları
 * Developed by AxthrowA
 *
 * Eskiden `!clip` hiçbir şey kaydetmiyordu (yalnız "an" işaretliyordu). Yaygın
 * Kick botlarında `!clip [saniye]` canlı yayından gerçek bir video klip çıkarır
 * (herkese açık belgeler, 2026-10). Kick'in kanal yanıtındaki `playback_url`
 * bir HLS listesi; ölçüm (2026-10-14): ~1 sn'lik parçalar, ~29 sn geçmiş
 * penceresi, 160p–1080p varyantları. Klip = pencerenin başından (≈ son 29 sn)
 * başlayıp istenen süreye kadar ileri kaydedilir; ffmpeg yeniden kodlamaz.
 */

export const KLIP_EN_AZ = 10;

/**
 * Kick kanal JSON'undan HLS adresi. Kökteki `playback_url` kaybolunca
 * yayın açık olsa bile `!clip` "yayın kapalı" diyordu.
 */
export function kickPlaybackAdresi(data: unknown): string | null {
  const d = data as {
    playback_url?: unknown;
    livestream?: { playback_url?: unknown; source?: unknown; is_live?: unknown } | null;
  } | null;
  const ls = d?.livestream;
  const adaylar = [d?.playback_url, ls?.playback_url, ls?.source];
  for (const a of adaylar) {
    const s = String(a ?? '').trim();
    if (/^https?:\/\//i.test(s)) return s;
  }
  return null;
}

/** Canlı yayın nesnesi var mı (adres ayrı bakılır). */
export function kickCanliMi(data: unknown): boolean {
  const ls = (data as { livestream?: { is_live?: unknown } | null } | null)?.livestream;
  return Boolean(ls) && ls?.is_live !== false;
}

/**
 * Klip girdisi: Kick yayın kapalıyken de kanalda `playback_url` döndürür; o adres
 * kullanılırsa bot "kaydediliyor" deyip ffmpeg boş yayında düşüyordu. Yalnız canlıyken adres.
 */
export function klipAdresiSec(url: string | null, canli: boolean): string | null | 'adres-yok' {
  if (!canli) return null;
  return url || 'adres-yok';
}

/** `!clip 45` → 45 (en az 10, en çok `enCok`); sayı yoksa varsayılan. */
export function klipSuresi(arg: string | undefined, varsayilan: number, enCok: number): number {
  const ust = Math.max(KLIP_EN_AZ, Math.min(600, Math.floor(Number(enCok) || 60)));
  const v = Math.max(KLIP_EN_AZ, Math.min(ust, Math.floor(Number(varsayilan) || 30)));
  const n = Math.floor(Number(String(arg ?? '').trim()));
  if (!Number.isFinite(n) || n <= 0) return v;
  return Math.max(KLIP_EN_AZ, Math.min(ust, n));
}

/** Ana listeden varyant: hedef yüksekliğe en yakın (eşitlikte büyük olan). */
export function varyantSec(anaListe: string, temelAdres: string, hedefYukseklik = 720): string | null {
  const satirlar = String(anaListe ?? '').split(/\r?\n/);
  const varyantlar: Array<{ yukseklik: number; adres: string }> = [];
  for (let i = 0; i < satirlar.length; i++) {
    const s = satirlar[i];
    if (!s.startsWith('#EXT-X-STREAM-INF')) continue;
    const coz = s.match(/RESOLUTION=\d+x(\d+)/);
    const sonraki = satirlar.slice(i + 1).find((x) => x.trim() && !x.startsWith('#'));
    if (!sonraki) continue;
    try {
      varyantlar.push({ yukseklik: coz ? Number(coz[1]) : 0, adres: new URL(sonraki.trim(), temelAdres).href });
    } catch {
      /* bozuk satır */
    }
  }
  if (!varyantlar.length) return null;
  varyantlar.sort(
    (a, b) => Math.abs(a.yukseklik - hedefYukseklik) - Math.abs(b.yukseklik - hedefYukseklik) || b.yukseklik - a.yukseklik
  );
  return varyantlar[0].adres;
}

/** Güvenli dosya adı: `20261014-213005_ali_30sn.mp4` */
export function klipDosyaAdi(kim: string, tarih: Date, sure: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const zaman = `${tarih.getFullYear()}${p(tarih.getMonth() + 1)}${p(tarih.getDate())}-${p(tarih.getHours())}${p(tarih.getMinutes())}${p(tarih.getSeconds())}`;
  const ad = String(kim || 'izleyici')
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '')
    .slice(0, 24) || 'izleyici';
  return `${zaman}_${ad}_${Math.floor(sure)}sn.mp4`;
}

/** Sunulacak/silinecek dosya adı doğrulaması (yol geçişi engeli). */
export function klipAdiGecerliMi(ad: string): boolean {
  return /^\d{8}-\d{6}_[\w-]{1,24}_\d{1,3}sn\.mp4$/.test(String(ad ?? ''));
}

/** ffmpeg argümanları (yeniden kodlama yok; listenin en eski parçasından başla). */
export function ffmpegArgumanlari(girdi: string, cikti: string, sure: number): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-live_start_index',
    '0',
    '-rw_timeout',
    '15000000',
    '-i',
    girdi,
    '-t',
    String(Math.floor(sure)),
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0?',
    '-c',
    'copy',
    '-bsf:a',
    'aac_adtstoasc',
    '-movflags',
    '+faststart',
    cikti
  ];
}

/**
 * ffmpeg hata satırı sohbete yazılır: içindeki adresler (yayın akışı
 * belirteci taşıyabilir) ve disk yolları atılır.
 */
export function hataSatiriTemizle(metin: string): string {
  return String(metin || '')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<adres>')
    .replace(/[A-Za-z]:[\\/][^\s:]*/g, '<yol>')
    .slice(0, 120);
}
