/**
 * R5: OBS sahnesine göre görünürlük. Her satır `Sahne adı = eylem`; eylem `gizle`, `göster` ya da bir tema kimliği
 * (ör. `Oyun = pill`, `Mola = poster`). Sahne adı büyük/küçük harfe duyarsız; ilk eşleşen satır geçerli.
 */
const GIZLE = new Set(['gizle', 'hide', 'kapat'])
const GOSTER = new Set(['göster', 'goster', 'show', 'aç', 'ac'])

export function kurallariAyikla(metin) {
  return String(metin || '')
    .split(/\r?\n/)
    .map((satir) => {
      const i = satir.indexOf('=')
      if (i < 1) return null
      const sahne = satir.slice(0, i).trim()
      const eylem = satir.slice(i + 1).trim().toLocaleLowerCase('tr')
      return sahne && eylem ? { sahne, eylem } : null
    })
    .filter(Boolean)
}

/** `{ gizle }`, `{ goster }`, `{ skin }` ya da kural yoksa / tema bilinmiyorsa null */
export function sahneEylemi(metin, sahne, temaVarMi) {
  if (!sahne) return null
  const ad = sahne.trim().toLocaleLowerCase('tr')
  const k = kurallariAyikla(metin).find((r) => r.sahne.toLocaleLowerCase('tr') === ad)
  if (!k) return null
  if (GIZLE.has(k.eylem)) return { gizle: true }
  if (GOSTER.has(k.eylem)) return { goster: true }
  return temaVarMi(k.eylem) ? { skin: k.eylem } : null
}
