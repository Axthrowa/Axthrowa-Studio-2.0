/**
 * Kapak (albüm görseli) biçimi.
 *
 * ## Neden `canvas` kalktı
 * "Kare" ile "Tuval" arasındaki tek fark köşe yarıçapıydı (8px / 12px). İki ayrı
 * seçenek yerine tek "Kare" + köşe yuvarlaklığı kaydırıcısı var. Eski profillerde
 * `cover: 'canvas'` kayıtlı olabilir; bu dosya onu görünümü değişmeden karşılar
 * (`square` + 12px).
 */

export const COVER_SHAPES = ['square', 'vinyl', 'none']

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
  compact: ['square', 'vinyl', 'none'],
  boxy: ['square', 'vinyl', 'none'],
  macos: ['square', 'vinyl', 'none'],
  minimal: [], // kapak hiç çizilmiyor
  shell: ['vinyl', 'none'],
  discord: ['square', 'vinyl'],
  gallery: ['square', 'vinyl'],
  // yeni skinler
  clear: ['square', 'vinyl', 'none'],
  ring: ['square', 'vinyl'], // 'square' = yuvarlak fotoğraf, 'vinyl' = dönen plak; kapaksız halka yok
  aurora: ['square', 'vinyl', 'none'],
  edge: ['square', 'vinyl', 'none'],
}

/** Destek listesi dışında kalan seçimin düşeceği biçim. */
const FALLBACK = { shell: 'vinyl', discord: 'square', gallery: 'square', ring: 'square' }

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
