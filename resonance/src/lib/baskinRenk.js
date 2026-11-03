const KOVA = 12
const EN_AZ_DOYGUNLUK = 25
/** Renkli piksel bu payın altındaysa kapak gri sayılır: rastgele bir leke vurgu olmasın */
const EN_AZ_RENKLI_PAY = 0.08
/** Koyu kapaktan çıkan renk parlama ve yazı gölgesinde görünsün diye en parlak kanal buraya çekilir */
const EN_AZ_PARLAKLIK = 170

function hex(r, g, b) {
  return `#${[r, g, b].map((v) => Math.min(255, Math.round(v)).toString(16).padStart(2, '0')).join('')}`
}

function ton(r, g, b, enCok, fark) {
  const h = enCok === r ? ((g - b) / fark + 6) % 6 : enCok === g ? (b - r) / fark + 2 : (r - g) / fark + 4
  return Math.min(KOVA - 1, Math.floor((h / 6) * KOVA))
}

/**
 * RGBA piksellerinden albüm kapağının vurgu rengi. Düz ortalama her kapağı çamur rengine
 * çevirir: pikseller tona göre kovalanır, doygunlukla ağırlıklı en güçlü kovanın ortalaması alınır.
 */
export function baskinRenk(data) {
  const kovalar = Array.from({ length: KOVA }, () => ({ agirlik: 0, r: 0, g: 0, b: 0 }))
  let toplam = 0
  let renkli = 0
  let R = 0
  let G = 0
  let B = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    toplam++
    R += r
    G += g
    B += b
    const enCok = Math.max(r, g, b)
    const fark = enCok - Math.min(r, g, b)
    if (fark < EN_AZ_DOYGUNLUK || enCok < 40) continue
    renkli++
    const k = kovalar[ton(r, g, b, enCok, fark)]
    k.agirlik += fark
    k.r += r * fark
    k.g += g * fark
    k.b += b * fark
  }
  if (!toplam) return null
  if (renkli / toplam < EN_AZ_RENKLI_PAY) return hex(R / toplam, G / toplam, B / toplam)
  const en = kovalar.reduce((a, b) => (b.agirlik > a.agirlik ? b : a))
  const r = en.r / en.agirlik
  const g = en.g / en.agirlik
  const b = en.b / en.agirlik
  const carpan = Math.max(1, EN_AZ_PARLAKLIK / Math.max(r, g, b))
  return hex(r * carpan, g * carpan, b * carpan)
}
