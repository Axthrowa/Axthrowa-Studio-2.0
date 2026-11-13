/** R8: görünüm galerisi — etiketler, arama, sık kullanılanlar, ayar içe/dışa aktarma. Saf. */

/**
 * Varsayılan kart genişliğinde ölçülen boyut (px, genişlik × yükseklik; 2026-11-13, örnek parçayla).
 * "dikey" etiketi bundan türetilir: 9:16 tuvalin dar alanına sığanlar (genişlik ≤ 320) ya da kendisi dikey olanlar.
 */
export const TEMA_BOYUT = {
  compact: [320, 62], boxy: [384, 106], gallery: [256, 325], minimal: [320, 70], macos: [320, 86],
  shell: [384, 66], discord: [320, 132], clear: [384, 81], ring: [384, 110], aurora: [384, 95],
  edge: [384, 88], turntable: [384, 124], cassette: [384, 127], pill: [352, 51], island: [320, 52],
  strip: [544, 42], albumfocus: [256, 256], sidebar: [176, 236], gameboy: [320, 87], hud: [384, 75],
  sticky: [256, 78], neon: [384, 90], wave: [416, 116], poster: [208, 253], terminal: [384, 98],
  lcd: [384, 90], ticket: [384, 80],
}

const STIL = {
  kapak: ['gallery', 'albumfocus', 'poster', 'sidebar', 'turntable'],
  retro: ['cassette', 'gameboy', 'turntable', 'lcd', 'terminal', 'ticket', 'macos', 'shell'],
  sade: ['compact', 'minimal', 'clear', 'pill', 'island', 'strip', 'sticky'],
  renkli: ['aurora', 'neon', 'wave', 'ring', 'edge', 'hud', 'discord', 'boxy'],
}

export const ETIKETLER = ['dikey', 'küçük', 'büyük', 'kapak', 'retro', 'sade', 'renkli']

export function dikeyUygunMu(id) {
  const b = TEMA_BOYUT[id]
  return Boolean(b) && (b[0] <= 320 || b[1] > b[0])
}

export function temaEtiketleri(id) {
  const b = TEMA_BOYUT[id]
  const e = []
  if (dikeyUygunMu(id)) e.push('dikey')
  if (b && b[1] <= 70) e.push('küçük')
  if (b && b[1] >= 200) e.push('büyük')
  for (const [ad, liste] of Object.entries(STIL)) if (liste.includes(id)) e.push(ad)
  return e
}

/** Seçenekler `{ value, label }`; arama ad ve etiketlerde, sık kullanılanlar başa */
export function temalariSuz(secenekler, { arama = '', etiket = '', favoriler = [], yalnizFavori = false } = {}) {
  const q = arama.trim().toLocaleLowerCase('tr')
  const fav = new Set(favoriler)
  return secenekler
    .filter((s) => {
      const etiketler = temaEtiketleri(s.value)
      if (etiket && !etiketler.includes(etiket)) return false
      if (yalnizFavori && !fav.has(s.value)) return false
      return !q || `${s.label} ${s.value} ${etiketler.join(' ')}`.toLocaleLowerCase('tr').includes(q)
    })
    .sort((a, b) => Number(fav.has(b.value)) - Number(fav.has(a.value)))
}

export const favoriDegistir = (favoriler, id) => (favoriler || []).includes(id) ? favoriler.filter((f) => f !== id) : [...(favoriler || []), id]

// Cihaza özgü: başka bilgisayara taşınınca anlamsız
const TASINMAZ = new Set(['musicService'])

export function ayarlariDisaAktar(config, varsayilan) {
  const secili = Object.fromEntries(Object.keys(varsayilan).filter((k) => !TASINMAZ.has(k) && k in config).map((k) => [k, config[k]]))
  return JSON.stringify({ resonance: 1, ayarlar: secili }, null, 2)
}

/** Yalnız bilinen ve aynı türdeki alanlar alınır; geri kalanı yok sayılır. Bozuk dosyada Error. */
export function ayarlariIceAl(metin, varsayilan) {
  let veri
  try {
    veri = JSON.parse(String(metin))
  } catch {
    throw new Error('Dosya okunamadı (JSON değil)')
  }
  const ayarlar = veri?.ayarlar
  if (veri?.resonance !== 1 || !ayarlar || typeof ayarlar !== 'object' || Array.isArray(ayarlar)) throw new Error('Bu bir Resonance ayar dosyası değil')
  const yama = {}
  for (const [k, v] of Object.entries(ayarlar)) {
    if (!(k in varsayilan) || TASINMAZ.has(k)) continue
    const tur = (x) => (Array.isArray(x) ? 'dizi' : x === null ? 'yok' : typeof x)
    if (tur(v) !== tur(varsayilan[k])) continue
    yama[k] = typeof v === 'string' ? v.slice(0, 5000) : v
  }
  if (!Object.keys(yama).length) throw new Error('Dosyada uygulanacak ayar yok')
  return yama
}
