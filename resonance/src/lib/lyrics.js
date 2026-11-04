// Şarkı sözleri: LRCLIB ve Lyrics.ovh tarayıcıdan, NetEase uygulamanın sunucusu üzerinden sorulur.
// Resonance hem AxthrowA Studio'da (8843) hem AxBoT'ta (3001) aynı çalışır.

/** LRC metni → zamanlı satırlar ([mm:ss.xx] metin; bir satırda birden çok zaman olabilir) */
export function lrcAyikla(lrc) {
  const out = []
  for (const satir of String(lrc || '').split(/\r?\n/)) {
    const zamanlar = [...satir.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)]
    if (!zamanlar.length) continue
    const govde = satir.replace(/\[[^\]]*\]/g, '')
    // Geliştirilmiş LRC: <00:12.50>kelime
    const parcalar = [...govde.matchAll(/<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>([^<]*)/g)]
    const metin = govde.replace(/<[^>]*>/g, '').trim()
    if (!metin) continue
    const kelimeler = parcalar.length > 1 ? kelimeSureleri(parcalar.map((p) => ({ t: Number(p[1]) * 60 + Number(p[2].replace(':', '.')), m: p[3] }))) : null
    for (const z of zamanlar) {
      const l = { time: Number(z[1]) * 60 + Number(z[2].replace(':', '.')), text: metin }
      if (kelimeler) l.kelimeler = kelimeler
      out.push(l)
    }
  }
  return out.sort((a, b) => a.time - b.time)
}

/** Yalnız başlangıcı bilinen kelimelerin süresi: sonraki kelimeye kadar, sonuncu en çok 1,5 sn */
function kelimeSureleri(k) {
  return k.filter((x) => x.m).map((x, i, d) => ({ ...x, d: Math.max(0.05, (d[i + 1]?.t ?? x.t + 1.5) - x.t) }))
}

/**
 * NetEase kelime zamanlı söz (yrc): `[satırMs,süreMs](kelimeMs,süreMs,0)kelime(...)kelime`.
 * Kelime zamanları şarkı başına göredir. Satır dışı (JSON künye) kayıtlar atlanır.
 */
export function yrcAyikla(yrc) {
  const out = []
  for (const satir of String(yrc || '').split(/\r?\n/)) {
    const bas = satir.match(/^\[(\d+),(\d+)\]/)
    if (!bas) continue
    const kelimeler = [...satir.slice(bas[0].length).matchAll(/\((\d+),(\d+),\d+\)([^(]*(?:\((?!\d+,\d+,\d+\))[^(]*)*)/g)]
      .map((p) => ({ t: Number(p[1]) / 1000, d: Math.max(0.03, Number(p[2]) / 1000), m: p[3] }))
      .filter((k) => k.m)
    const text = kelimeler.map((k) => k.m).join('').trim()
    if (text) out.push({ time: Number(bas[1]) / 1000, text, kelimeler })
  }
  return out.sort((a, b) => a.time - b.time)
}

/**
 * Yalnız satır zamanı bilinen sözde kelimeler hece ağırlığıyla yayılır: uzun kelimede dolum
 * yavaşlar, virgülde nefes payı kalır. Sesli harfi olmayan yazılarda harf sayısı kullanılır.
 */
export function kelimeleriTahminEt(metin, sureSn, baslangic = 0) {
  const kelimeler = String(metin || '').match(/\S+\s*/g) || []
  const agirliklar = kelimeler.map((k) => {
    const hece = (k.match(/[aeıioöuüâîûyàáèéêíóôúäë]/gi) || []).length
    const durak = /[,;:.!?…]\s*$/.test(k) ? 0.6 : 0
    return (hece || Math.max(1, k.trim().length / 2)) + 0.35 + durak
  })
  const toplam = agirliklar.reduce((a, b) => a + b, 0) || 1
  let t = baslangic
  return kelimeler.map((m, i) => {
    const d = (agirliklar[i] / toplam) * sureSn
    const k = { t, d, m }
    t += d
    return k
  })
}

/** Konumda hangi kelime söyleniyor ve ne kadarı bitti (kelimeden önce i = -1) */
export function kelimeDolumu(kelimeler, konumSn) {
  let i = -1
  for (let k = 0; k < kelimeler.length; k++) {
    if (kelimeler[k].t <= konumSn) i = k
    else break
  }
  if (i < 0) return { i: -1, oran: 0 }
  return { i, oran: Math.min(1, (konumSn - kelimeler[i].t) / kelimeler[i].d) }
}

const SAAT_SICRAMA_MS = 300
const SAAT_DURMA_MS = 1500

/** Söz saati: seyrek gelen konum örneklerinden karede bir okunabilen akıcı konum */
export function saatYeni(ms, at) {
  return { ms, at, hiz: 1, sonOrnek: ms, sonDegisim: at }
}

export function saatOku(s, simdi) {
  // Örnek gelmiyorsa parça duraklatılmıştır: dolum sürüp gitmesin
  const gecen = Math.min(Math.max(0, simdi - s.at), Math.max(0, s.sonDegisim + SAAT_DURMA_MS - s.at))
  return s.ms + gecen * s.hiz
}

/**
 * Yeni örnek. Küçük fark hızla kapatılır (saat geri gitmez, dolum titremez);
 * büyük fark (ileri/geri sarma, yeni parça) doğrudan atlanır.
 */
export function saatOrnekle(s, ornekMs, simdi) {
  if (ornekMs === s.sonOrnek) return s
  const su = saatOku(s, simdi)
  const fark = ornekMs - su
  if (Math.abs(fark) > SAAT_SICRAMA_MS) return saatYeni(ornekMs, simdi)
  return { ms: su, at: simdi, hiz: Math.max(0.9, Math.min(1.1, 1 + fark / 1500)), sonOrnek: ornekMs, sonDegisim: simdi }
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
  const kelimeli = yrcAyikla(soz?.yrc?.lyric).filter((l) => !KUNYE.test(l.text))
  if (kelimeli.length >= 3) return { synced: true, tahmini: false, lines: kelimeli, kaynak: 'NetEase', kelimeli: true }
  const lines = lrcAyikla(soz?.lrc?.lyric).filter((l) => !KUNYE.test(l.text))
  return lines.length >= 3 ? { synced: true, tahmini: false, lines, kaynak: 'NetEase' } : null
}

/** Kelime zamanı varsa o kazanır: karaokenin en doğru hâli */
async function kelimeSor(aday, sureMs) {
  const s = await neteaseSor(aday, sureMs)
  return s?.kelimeli ? s : null
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
export async function sozleriGetir(title, artist, sureMs = 0, kaynaklar = { kelimeSor, lrclibSor, neteaseSor, ovhSor }) {
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
  let son = kaynaklar.kelimeSor ? await dene(kaynaklar.kelimeSor, adaylar[0]) : null
  for (const fn of son ? [] : [kaynaklar.lrclibSor, kaynaklar.neteaseSor, kaynaklar.ovhSor]) {
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
