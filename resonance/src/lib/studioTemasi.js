/**
 * Studio içinde gömülüyken Studio'nun renkleri Resonance'a uygulanır. Studio, AxBoT'a gönderdiği
 * `{ tur: 'studio-tema', degiskenler }` iletisinin aynısını gönderir; değerler süzülüp CSS değişkeni olarak yazılır.
 */

const ESLEME = {
  '--axt-zemin': '--color-bg',
  '--axt-yuzey': '--color-surface',
  '--axt-yuzey-2': '--color-surface-2',
  '--axt-kenar': '--color-border',
  '--axt-vurgu': '--color-accent',
  '--axt-metin': '--color-text',
  '--axt-soluk': '--color-text-muted',
}
const RENK = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%/]+\))$/i
/** Ölçüler ortak tasarım dosyasındaki adla aynen yazılır (köşe, başlık) */
const OLCULER = ['--axt-yaricap-kart', '--axt-yaricap-dugme', '--axt-yazi-baslik']
const OLCU = /^(\d{1,2}(\.\d+)?|\.\d+)(rem|px)$/ // sıkıştırılmış CSS baştaki sıfırı atar (.75rem)

/** Geçerli iletiden Resonance değişkenlerini çıkarır; tanınmayan ileti için null. */
export function studioTemasiCoz(veri) {
  if (!veri || typeof veri !== 'object' || veri.tur !== 'studio-tema') return null
  const ham = veri.degiskenler && typeof veri.degiskenler === 'object' ? veri.degiskenler : {}
  const cikti = {}
  for (const [axt, bizim] of Object.entries(ESLEME)) {
    const d = typeof ham[axt] === 'string' ? ham[axt].trim() : ''
    if (RENK.test(d)) cikti[bizim] = d
  }
  for (const ad of OLCULER) {
    const d = typeof ham[ad] === 'string' ? ham[ad].trim() : ''
    if (OLCU.test(d)) cikti[ad] = d
  }
  return cikti
}

/** Üst pencere Studio ise temasını iste ve dinle. Döner: dinlemeyi bırakan işlev. */
export function studioTemasiniDinle() {
  if (window.parent === window) return () => {}
  const dinle = (e) => {
    if (e.source !== window.parent) return
    const t = studioTemasiCoz(e.data)
    if (!t) return
    for (const [ad, deger] of Object.entries(t)) document.documentElement.style.setProperty(ad, deger)
  }
  window.addEventListener('message', dinle)
  window.parent.postMessage({ tur: 'studio-tema-iste' }, '*')
  return () => window.removeEventListener('message', dinle)
}
