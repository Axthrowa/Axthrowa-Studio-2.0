/** R9: söz denetimi — şarkıya özel kayma, kaynak sırası, küfür maskesi. Saf. */

const OFSET_SINIRI = 300

/** Kayma kaydının anahtarı: aynı parça farklı kaynaklardan gelse de aynı kalsın */
export const parcaAnahtari = (track) => (track ? `${track.name || ''}|${track.artists || ''}`.trim().toLocaleLowerCase('tr') : '')

/** Bu parça için kaydedilmiş kayma varsa o, yoksa genel kayma (ms) */
export function parcaOfseti(config, track) {
  const ozel = config?.lyricsTrackOffsets?.[parcaAnahtari(track)]
  return Number.isFinite(Number(ozel)) ? Number(ozel) : Number(config?.lyricsOffsetMs) || 0
}

/** Yeni kayma haritası; `ms` null ise kayıt silinir (genel kaymaya döner). En eski kayıtlar atılır. */
export function ofsetYaz(harita, anahtar, ms) {
  const yeni = { ...(harita || {}) }
  delete yeni[anahtar]
  if (anahtar && ms != null) yeni[anahtar] = Math.max(-10_000, Math.min(10_000, Math.round(Number(ms) || 0)))
  const anahtarlar = Object.keys(yeni)
  for (const a of anahtarlar.slice(0, Math.max(0, anahtarlar.length - OFSET_SINIRI))) delete yeni[a]
  return yeni
}

/** Kaynak sırası: `kelime` NetEase'in kelime zamanlı sözü */
export const KAYNAK_SIRALARI = {
  varsayilan: ['kelime', 'lrclib', 'netease', 'ovh'],
  lrclib: ['lrclib', 'kelime', 'netease', 'ovh'],
  'netease-yok': ['lrclib', 'ovh'],
}
export const kaynakSirasi = (ad) => KAYNAK_SIRALARI[ad] || KAYNAK_SIRALARI.varsayilan

// Ek almış hâliyle eşlenen kökler (Türkçe çekim ekleri) ve yalnız tam kelime olarak eşlenenler ("göt" "götür"ü yakalamasın)
const ONEK = ['orospu', 'yarrak', 'amcık', 'amına', 'siktir', 'sikerim', 'sikeyim', 'pezevenk', 'fuck', 'motherfuck', 'bitch', 'nigga', 'nigger']
const TAM = ['amk', 'aq', 'piç', 'sik', 'göt', 'shit', 'cunt', 'dick', 'pussy']
const kac = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Maske ifadesi; `ek` kullanıcının kendi kelimeleri (virgül/satır ayrılmış, ek almış hâlleriyle eşlenir) */
export function maskeIfadesi(ek = '') {
  const kendi = String(ek || '')
    .split(/[,\n]/)
    .map((k) => k.trim().toLocaleLowerCase('tr'))
    .filter((k) => k.length >= 2)
  const onek = [...ONEK, ...kendi].map(kac).join('|')
  const tam = TAM.map(kac).join('|')
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:(?:${onek})\\p{L}*|(?:${tam})(?![\\p{L}\\p{N}]))`, 'giu')
}

/** İlk harf kalır, gerisi yıldız: uzunluk değişmez, karaoke kelime zamanları bozulmaz */
export const maskele = (metin, ifade) => String(metin ?? '').replace(ifade, (m) => m[0] + '*'.repeat([...m].length - 1))

export function sozuMaskele(satirlar, ifade) {
  return satirlar.map((l) => ({
    ...l,
    text: maskele(l.text, ifade),
    ...(l.kelimeler ? { kelimeler: l.kelimeler.map((k) => ({ ...k, m: maskele(k.m, ifade) })) } : {}),
  }))
}
