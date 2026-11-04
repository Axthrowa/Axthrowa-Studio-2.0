// Şarkı sözleri: LRCLIB ve Lyrics.ovh tarayıcıdan, NetEase uygulamanın sunucusu üzerinden sorulur.
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
    .replace(/\((?:[^)]*?(official|video|audio|lyric|lyrics|mv|klip|remaster|sözleri|sözler)[^)]*)\)/gi, '')
    .replace(/\s+-\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|live|radio edit|single version|mono|stereo)\b.*$/i, '')
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

/**
 * Satırın söylenme süresi (sn). Kaynak yalnız satır başlarını verir; sonraki satıra kadar uzun müzik arası
 * varsa dolum sürünmesin diye süre metin uzunluğuyla sınırlanır (ağır baladda bile harf başına 0,16 sn yeter).
 */
export function satirSuresi(satirlar, i) {
  const l = satirlar[i]
  if (!l) return 4
  const ara = (satirlar[i + 1]?.time ?? l.time + 4) - l.time
  return Math.max(0.2, Math.min(ara, Math.max(1.5, String(l.text || '').length * 0.16)))
}

/** Satırın ne kadarı söylendi (0-1): karaoke dolumu için */
export function satirOrani(satirlar, i, konumSn) {
  const l = satirlar[i]
  if (!l) return 0
  return Math.max(0, Math.min(1, (konumSn - l.time) / satirSuresi(satirlar, i)))
}

/** Aranacak başlık ve sanatçı çeşitleri: en güveniliri önce */
export function aramaAdaylari(title, artist) {
  const temiz = baslikTemizle(title)
  const parantezsiz = temiz.replace(/\([^)]*\)/g, '').replace(/\s*\|.*$/, '').trim()
  const sanatcilar = String(artist || '').split(/\s*(?:,|&|\sx\s|\sfeat\.?\s|\sft\.?\s)\s*/i).map((s) => s.trim()).filter(Boolean)
  const adaylar = []
  const ekle = (baslik, sanatci) => {
    if (baslik && !adaylar.some((a) => a.baslik === baslik && a.sanatci === sanatci)) adaylar.push({ baslik, sanatci })
  }
  ekle(temiz, sanatcilar[0] || '')
  ekle(parantezsiz, sanatcilar[0] || '')
  // YouTube başlığı çoğu zaman "Sanatçı - Şarkı"
  const parca = parantezsiz.split(/\s+[-–—]\s+/)
  if (parca.length === 2) {
    ekle(parca[1], parca[0])
    ekle(parca[0], sanatcilar[0] || parca[1])
  }
  return adaylar
}

/** Karşılaştırma için sadeleştirir: büyük/küçük harf ve Türkçe karakter farkı sayılmaz */
export function sade(t) {
  return String(t || '')
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Zamanı olmayan sözleri parçanın süresine yayar: yaklaşık, gerçek zamanlama değil */
export function sureyeYay(metin, sureMs) {
  const satirlar = String(metin || '').split(/\r?\n/).map((t) => t.trim()).filter(Boolean)
  if (!satirlar.length) return []
  const sure = Number(sureMs) > 0 ? Number(sureMs) / 1000 : satirlar.length * 4
  const bas = sure * 0.05
  const adim = (sure * 0.9) / satirlar.length
  return satirlar.map((text, i) => ({ time: bas + i * adim, text }))
}

/** Arama sonuçlarından başlığı ve sanatçısı tutan, süresi en yakın kaydı seçer */
export function enIyiEslesme(kayitlar, aday, sureMs) {
  const b = sade(aday.baslik)
  const s = sade(aday.sanatci)
  const uygun = (kayitlar || []).filter((k) => {
    const ad = sade(k.ad)
    return ad === b && (!s || sade(k.sanatci).includes(s) || s.includes(sade(k.sanatci)))
  })
  if (!uygun.length) return null
  const fark = (k) => (sureMs > 0 && k.sureMs > 0 ? Math.abs(k.sureMs - sureMs) : 0)
  const sirali = [...uygun].sort((x, y) => fark(x) - fark(y))
  // Süre bilindiği halde çok farklıysa başka bir kayıttır (remix, canlı): yanlış söz göstermektense yok say
  return sureMs > 0 && sirali[0].sureMs > 0 && fark(sirali[0]) > 15_000 ? null : sirali[0]
}

/** NetEase sözünün başındaki emeği geçenler satırları */
const KUNYE = /^(作词|作曲|编曲|制作人|混音|母带|和声|吉他|贝斯|鼓|弦乐|监制|录音|出品|词|曲)\s*[:：]/

class GeciciHata extends Error {}

async function jsonAl(adres) {
  let r
  try {
    r = await fetch(adres)
  } catch {
    throw new GeciciHata('ag')
  }
  if (r.status === 429 || r.status >= 500) throw new GeciciHata(String(r.status))
  if (!r.ok) return null
  try {
    return await r.json()
  } catch {
    return null
  }
}

async function lrclibSor(aday, sureMs) {
  let kayit = null
  if (aday.sanatci) {
    const p = new URLSearchParams({ track_name: aday.baslik, artist_name: aday.sanatci })
    if (sureMs > 0) p.set('duration', String(Math.round(sureMs / 1000)))
    kayit = await jsonAl(`https://lrclib.net/api/get?${p}`)
  }
  if (!kayit?.syncedLyrics) {
    const liste = await jsonAl(`https://lrclib.net/api/search?q=${encodeURIComponent(`${aday.sanatci} ${aday.baslik}`.trim())}`)
    if (Array.isArray(liste)) {
      const ciftler = liste.map((k) => ({ ...k, ad: k.trackName, sanatci: k.artistName, sureMs: (Number(k.duration) || 0) * 1000 }))
      const eslesen = enIyiEslesme(ciftler.filter((k) => k.syncedLyrics), aday, sureMs) || enIyiEslesme(ciftler, aday, sureMs)
      kayit = kayit || eslesen
      if (eslesen?.syncedLyrics) kayit = eslesen
    }
  }
  if (!kayit) return null
  const lines = lrcAyikla(kayit.syncedLyrics)
  if (lines.length) return { synced: true, tahmini: false, lines, kaynak: 'LRCLIB' }
  return kayit.plainLyrics ? { duz: kayit.plainLyrics, kaynak: 'LRCLIB' } : null
}

/** NetEase tarayıcıdan sorulamaz (CORS): uygulamanın kendi sunucusu aracılık eder */
async function neteaseSor(aday, sureMs) {
  const { hostBaseUrl } = await import('./hostBridge')
  const taban = `${hostBaseUrl()}/api/player/sozler`
  const veri = await jsonAl(`${taban}?ara=${encodeURIComponent(`${aday.sanatci} ${aday.baslik}`.trim())}`)
  const kayitlar = (veri?.result?.songs || []).map((k) => ({ id: k.id, ad: k.name, sanatci: (k.artists || []).map((a) => a.name).join(' '), sureMs: Number(k.duration) || 0 }))
  const eslesen = enIyiEslesme(kayitlar, aday, sureMs)
  if (!eslesen) return null
  const soz = await jsonAl(`${taban}?id=${encodeURIComponent(eslesen.id)}`)
  const lines = lrcAyikla(soz?.lrc?.lyric).filter((l) => !KUNYE.test(l.text))
  return lines.length >= 3 ? { synced: true, tahmini: false, lines, kaynak: 'NetEase' } : null
}

async function ovhSor(aday) {
  if (!aday.sanatci) return null
  const veri = await jsonAl(`https://api.lyrics.ovh/v1/${encodeURIComponent(aday.sanatci)}/${encodeURIComponent(aday.baslik)}`)
  return veri?.lyrics ? { duz: veri.lyrics, kaynak: 'Lyrics.ovh' } : null
}

const onbellek = new Map()
const BOS = { synced: false, tahmini: false, lines: [], kaynak: '' }

/**
 * Parçanın sözleri: önce zamanlı kaynaklar (LRCLIB, NetEase), yoksa düz metin (LRCLIB, Lyrics.ovh).
 * Geçici hatada (ağ, 429, 5xx) sonraki kaynağa geçilir ve "söz yok" önbelleğe yazılmaz.
 */
export async function sozleriGetir(title, artist, sureMs = 0, kaynaklar = { lrclibSor, neteaseSor, ovhSor }) {
  const adaylar = aramaAdaylari(title, artist)
  if (!adaylar.length) return BOS
  const anahtar = `${adaylar[0].baslik.toLowerCase()}|${adaylar[0].sanatci.toLowerCase()}`
  if (onbellek.has(anahtar)) return onbellek.get(anahtar)
  let geciciVar = false
  let duz = null
  const dene = async (fn, aday) => {
    try {
      return await fn(aday, sureMs)
    } catch (e) {
      if (e instanceof GeciciHata) geciciVar = true
      return null
    }
  }
  let son = null
  for (const fn of [kaynaklar.lrclibSor, kaynaklar.neteaseSor, kaynaklar.ovhSor]) {
    for (const aday of adaylar) {
      const s = await dene(fn, aday)
      if (s?.lines) {
        son = s
        break
      }
      duz = duz || s
    }
    if (son) break
  }
  if (!son && duz) son = { synced: false, tahmini: true, lines: sureyeYay(duz.duz, sureMs), kaynak: duz.kaynak }
  if (!son && geciciVar) return BOS
  son = son || BOS
  onbellek.set(anahtar, son)
  if (onbellek.size > 100) onbellek.delete(onbellek.keys().next().value)
  return son
}

export function _onbellegiTemizle() {
  onbellek.clear()
}

export { GeciciHata }
