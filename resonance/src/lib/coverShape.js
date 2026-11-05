/**
 * Kapak (albüm görseli) biçimi.
 *
 * ## Neden `canvas` kalktı
 * "Kare" ile "Tuval" arasındaki tek fark köşe yarıçapıydı (8px / 12px). İki ayrı
 * seçenek yerine tek "Kare" + köşe yuvarlaklığı kaydırıcısı var. Eski profillerde
 * `cover: 'canvas'` kayıtlı olabilir; bu dosya onu görünümü değişmeden karşılar
 * (`square` + 12px).
 */

export const COVER_SHAPES = ['square', 'circle', 'hexagon', 'polaroid', 'vinyl', 'disc', 'cd', 'none']

/** Çalarken dönen kapaklar: `vinyl` delikli plak, `disc` deliksiz plak, `cd` parlak disk. */
export const DONEN_KAPAKLAR = ['vinyl', 'disc', 'cd']

const YUVARLAK_KAPAKLAR = [...DONEN_KAPAKLAR, 'circle']
const KAPAKSIZ_OLMAZ = COVER_SHAPES.filter((s) => s !== 'none')

export const DEFAULT_CORNER_RADIUS = 8
export const MIN_CORNER_RADIUS = 0
export const MAX_CORNER_RADIUS = 24

/** Eski `canvas`'ın sabit yarıçapı — geçişte görünüm aynı kalsın. */
const LEGACY_CANVAS_RADIUS = 12

/** Bilinmeyen / eski değeri geçerli bir biçime indirger. */
export function normalizeCoverShape(value) {
  if (value === 'canvas') return 'square'
  return COVER_SHAPES.includes(value) ? value : 'square'
}

export function clampRadius(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_CORNER_RADIUS
  return Math.min(MAX_CORNER_RADIUS, Math.max(MIN_CORNER_RADIUS, Math.round(n)))
}

/**
 * Yapılandırmadaki köşe yarıçapı. `coverRadius` hiç yazılmamışsa (eski profil):
 * `canvas` idiyse 12, değilse 8.
 */
export function resolveRadius(config) {
  const raw = config?.coverRadius
  if (raw === undefined || raw === null || raw === '') {
    return config?.cover === 'canvas' ? LEGACY_CANVAS_RADIUS : DEFAULT_CORNER_RADIUS
  }
  return clampRadius(raw)
}

/**
 * Hangi skin hangi kapak biçimini gerçekten uyguluyor.
 *
 * Eskiden `shell` seçimi sessizce plağa çeviriyor, `discord`/`gallery` "yok"u
 * kareye çeviriyordu; kullanıcı seçeneği tıklayıp hiçbir şey olmadığını
 * görüyordu. Tablo hem arayüzü (desteklenmeyeni devre dışı göster) hem de
 * çizimi (`effectiveCover`) besliyor — iki yerin ayrışması mümkün değil.
 */
export const SKIN_COVER_SUPPORT = {
  compact: COVER_SHAPES,
  boxy: COVER_SHAPES,
  macos: COVER_SHAPES,
  minimal: [], // kapak hiç çizilmiyor
  shell: [...YUVARLAK_KAPAKLAR, 'none'],
  discord: KAPAKSIZ_OLMAZ,
  gallery: KAPAKSIZ_OLMAZ,
  // yeni skinler
  clear: COVER_SHAPES,
  ring: ['square', ...DONEN_KAPAKLAR], // 'square' = yuvarlak fotoğraf, diğerleri dönen disk; kapaksız halka yok
  aurora: COVER_SHAPES,
  edge: COVER_SHAPES,
  turntable: DONEN_KAPAKLAR, // kapak hep plağın üstünde döner
  cassette: [], // kapak hiç çizilmiyor
  pill: COVER_SHAPES,
  island: COVER_SHAPES,
  strip: COVER_SHAPES,
  albumfocus: ['square'],
  sidebar: COVER_SHAPES,
  gameboy: ['square', 'none'],
  hud: ['square', 'none'],
  sticky: ['square', 'none'],
  neon: COVER_SHAPES,
  wave: COVER_SHAPES,
  poster: KAPAKSIZ_OLMAZ,
  terminal: [], // kapak hiç çizilmiyor
  lcd: [...DONEN_KAPAKLAR, 'none'],
  ticket: ['square', 'circle', 'polaroid', 'vinyl', 'disc', 'cd', 'none'],
}

/** Destek listesi dışında kalan seçimin düşeceği biçim. */
const FALLBACK = { shell: 'vinyl', discord: 'square', gallery: 'square', ring: 'square', turntable: 'vinyl', lcd: 'cd', poster: 'square' }

export function supportedCovers(skin) {
  return SKIN_COVER_SUPPORT[skin] || SKIN_COVER_SUPPORT.compact
}

/** Seçili kapak biçimi bu skinde geçerli mi? */
export function isCoverSupported(skin, shape) {
  const list = supportedCovers(skin)
  return list.includes(normalizeCoverShape(shape))
}

/** Skinin gerçekten çizeceği kapak biçimi. */
export function effectiveCover(skin, shape) {
  const s = normalizeCoverShape(shape)
  const list = supportedCovers(skin)
  if (!list.length) return s // kapak kullanmayan skin: değer önemsiz
  if (list.includes(s)) return s
  return FALLBACK[skin] || list[0]
}

/** İlerleme halkası bu oynatıcı ve kapakta eklenebilir mi? Halka oynatıcısının kendi halkası var. */
export function halkaDestekli(skin, shape) {
  return skin !== 'ring' && YUVARLAK_KAPAKLAR.includes(shape)
}

/**
 * Saklanan profil yapılandırmasını yeni şemaya taşır (`canvas` → `square` +
 * yarıçap). Başka alana dokunmaz.
 */
export function migrateCoverConfig(config) {
  if (!config || typeof config !== 'object') return config
  if (config.cover !== 'canvas') return config
  return {
    ...config,
    cover: 'square',
    coverRadius: config.coverRadius ?? LEGACY_CANVAS_RADIUS,
  }
}
