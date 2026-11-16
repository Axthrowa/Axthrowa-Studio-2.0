/**
 * AxBoT — canlı şarkı sözleri (lrclib.net, anahtarsız)
 * Developed by AxthrowA
 *
 * Eskiden "çalan şarkı" olarak istek kuyruğunun İLK şarkısı kullanılıyordu
 * (Spotify'da gerçekte çalan parça değil), her 12 sn'de lrclib'e yeni istek
 * gidiyordu ve zaman damgalı sözler bile sabit aralıkla dönüyordu.
 * Artık: önce müzik host'unun gerçekten çalan parçası (Spotify/YTMD), yoksa
 * istek kuyruğu; sonuç parça başına önbellekli; sözler ilerleme süresine göre
 * senkron gösterilir.
 */
import axios from 'axios';

export interface SozSatiri {
  time: number;
  text: string;
}

export interface SozSonucu {
  bulundu: boolean;
  synced: boolean;
  lines: SozSatiri[];
  title: string;
  artist: string;
}

/** LRC metni → zamanlı satırlar ([mm:ss.xx] metin; bir satırda birden çok zaman olabilir) */
export function lrcAyikla(lrc: string): SozSatiri[] {
  const out: SozSatiri[] = [];
  for (const satir of String(lrc || '').split(/\r?\n/)) {
    const zamanlar = [...satir.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!zamanlar.length) continue;
    const metin = satir.replace(/\[[^\]]*\]/g, '').trim();
    if (!metin) continue;
    for (const z of zamanlar) out.push({ time: Number(z[1]) * 60 + Number(z[2].replace(':', '.')), text: metin.slice(0, 200) });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Başlıktan arama gürültüsünü atar: (Official Video), [MV], feat., "- Topic" … */
export function baslikTemizle(t: string): string {
  return String(t || '')
    .replace(/\((?:[^)]*?(official|video|audio|lyric|lyrics|mv|klip|remaster)[^)]*)\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+(feat\.?|ft\.?)\s+.*$/i, '')
    .replace(/\s+-\s+topic$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** İlerleme (ms) → etkin satır sırası (henüz ilk satır gelmediyse -1) */
export function etkinSatir(satirlar: SozSatiri[], konumSn: number): number {
  let i = -1;
  for (let k = 0; k < satirlar.length; k++) {
    if (satirlar[k].time <= konumSn) i = k;
    else break;
  }
  return i;
}

const onbellek = new Map<string, SozSonucu>();

function sonucDonustur(kayit: any, title: string, artist: string): SozSonucu | null {
  if (!kayit) return null;
  if (kayit.syncedLyrics) {
    const lines = lrcAyikla(kayit.syncedLyrics);
    if (lines.length) return { bulundu: true, synced: true, lines, title: kayit.trackName || title, artist: kayit.artistName || artist };
  }
  if (kayit.plainLyrics) {
    const lines = String(kayit.plainLyrics)
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ time: i * 4, text: text.slice(0, 200) }));
    if (lines.length) return { bulundu: true, synced: false, lines, title: kayit.trackName || title, artist: kayit.artistName || artist };
  }
  return null;
}

/**
 * Arama sonuçlarından söz sürümü: zaman damgalı ve süresi çalan parçaya en yakın olan.
 * Eskiden ilk zaman damgalı sonuç alınıyordu; başka bir sürümse (radyo edit, canlı, uzun intro)
 * sözler şarkıdan saniyelerce kayıyordu.
 */
export function surumSec<T extends { syncedLyrics?: unknown; duration?: unknown }>(liste: T[], sureMs: number): T | undefined {
  const zamanli = liste.filter((x) => x?.syncedLyrics);
  if (!zamanli.length) return liste[0];
  if (!(sureMs > 0)) return zamanli[0];
  const fark = (x: T) => Math.abs((Number(x.duration) || 0) * 1000 - sureMs);
  return [...zamanli].sort((a, b) => fark(a) - fark(b))[0];
}

/** Parçanın sözleri (önbellekli). `sureMs` tam eşleşmeyi güçlendirir. */
export async function sozleriGetir(title: string, artist: string, sureMs = 0): Promise<SozSonucu> {
  const temiz = baslikTemizle(title);
  const anahtar = `${temiz.toLowerCase()}|${artist.toLowerCase()}`;
  const onbellekte = onbellek.get(anahtar);
  if (onbellekte) return onbellekte;
  let sonuc: SozSonucu | null = null;
  const opts = { timeout: 8000, headers: { 'User-Agent': 'AxBoT' } };
  try {
    // 1) Tam eşleşme: şarkı + sanatçı (+ süre)
    if (artist) {
      const p = new URLSearchParams({ track_name: temiz, artist_name: artist.split(',')[0].trim() });
      if (sureMs > 0) p.set('duration', String(Math.round(sureMs / 1000)));
      const r = await axios.get(`https://lrclib.net/api/get?${p.toString()}`, { ...opts, validateStatus: (s) => s === 200 || s === 404 });
      if (r.status === 200) sonuc = sonucDonustur(r.data, temiz, artist);
    }
    // 2) Arama: "sanatçı şarkı" — zaman damgalı olan tercih edilir
    if (!sonuc) {
      const r = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(`${artist ? artist.split(',')[0] + ' ' : ''}${temiz}`)}`, opts);
      const liste: any[] = Array.isArray(r.data) ? r.data : [];
      const secilen = surumSec(liste, sureMs);
      sonuc = sonucDonustur(secilen, temiz, artist);
    }
  } catch {
    // Ağ hatası önbelleğe yazılmaz (bir sonraki yoklamada yeniden denenir)
    return { bulundu: false, synced: false, lines: [], title: temiz, artist };
  }
  const son = sonuc || { bulundu: false, synced: false, lines: [], title: temiz, artist };
  onbellek.set(anahtar, son);
  if (onbellek.size > 100) onbellek.delete(onbellek.keys().next().value as string);
  return son;
}
