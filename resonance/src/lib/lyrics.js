// Şarkı sözleri (lrclib.net, anahtarsız, CORS açık). Tarayıcıdan doğrudan sorulur:
// Resonance hem AxthrowA Studio'da (8843) hem AxBoT'ta (3001) aynı çalışır.

/** LRC metni → zamanlı satırlar ([mm:ss.xx] metin; bir satırda birden çok zaman olabilir) */
export function lrcAyikla(lrc) {
  const out = []
  for (const satir of String(lrc || '').split(/\r?\n/)) {
    const zamanlar = [...satir.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)]
    if (!zamanlar.length) continue
    const metin = satir.replace(/\[[^\]]*\]/g, '').trim()
    if (!metin) continue
    for (const z of zamanlar) out.push({ time: Number(z[1]) * 60 + Number(z[2].replace(':', '.')), text: metin })
  }
  return out.sort((a, b) => a.time - b.time)
}

/** Başlıktan arama gürültüsünü atar: (Official Video), [MV], feat., "- Topic" */
export function baslikTemizle(t) {
  return String(t || '')
    .replace(/\((?:[^)]*?(official|video|audio|lyric|lyrics|mv|klip|remaster)[^)]*)\)/gi, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+(feat\.?|ft\.?)\s+.*$/i, '')
    .replace(/\s+-\s+topic$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Parça süresi dolmuşsa sözler hemen kalksın. Süre bilinmiyorsa karar verilmez. */
export function sarkiBitti(track, progressMs) {
  const sure = Number(track?.durationMs) || 0
  if (!track || sure <= 0) return false
  return Number(progressMs) >= sure - 250
}

/** Konum (sn) → etkin satır sırası (ilk satırdan önce -1) */
export function etkinSatir(satirlar, konumSn) {
  let i = -1
  for (let k = 0; k < satirlar.length; k++) {
    if (satirlar[k].time <= konumSn) i = k
    else break
  }
  return i
}

function donustur(kayit) {
  if (!kayit) return null
  if (kayit.syncedLyrics) {
    const lines = lrcAyikla(kayit.syncedLyrics)
    if (lines.length) return { synced: true, lines }
  }
  if (kayit.plainLyrics) {
    const lines = String(kayit.plainLyrics)
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, i) => ({ time: i * 4, text }))
    if (lines.length) return { synced: false, lines }
  }
  return null
}

const onbellek = new Map()
const BOS = { synced: false, lines: [] }

/** Parçanın sözleri (önbellekli; ağ hatası önbelleğe yazılmaz). */
export async function sozleriGetir(title, artist, sureMs = 0) {
  const temiz = baslikTemizle(title)
  if (!temiz) return BOS
  const ilkSanatci = String(artist || '').split(',')[0].trim()
  const anahtar = `${temiz.toLowerCase()}|${ilkSanatci.toLowerCase()}`
  if (onbellek.has(anahtar)) return onbellek.get(anahtar)
  let sonuc = null
  try {
    if (ilkSanatci) {
      const p = new URLSearchParams({ track_name: temiz, artist_name: ilkSanatci })
      if (sureMs > 0) p.set('duration', String(Math.round(sureMs / 1000)))
      const r = await fetch(`https://lrclib.net/api/get?${p}`)
      if (r.ok) sonuc = donustur(await r.json())
    }
    if (!sonuc) {
      const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${ilkSanatci} ${temiz}`.trim())}`)
      const liste = r.ok ? await r.json() : []
      sonuc = donustur((Array.isArray(liste) && (liste.find((x) => x?.syncedLyrics) || liste[0])) || null)
    }
  } catch {
    return BOS
  }
  const son = sonuc || BOS
  onbellek.set(anahtar, son)
  if (onbellek.size > 100) onbellek.delete(onbellek.keys().next().value)
  return son
}
