/**
 * İlerleme halkası geometrisi.
 *
 * Halka tepe noktasından (saat 12) saat yönünde dolar. Bunu SVG'de yapmak için
 * daire -90° döndürülür; ilerleme ucundaki işaret de AYNI döndürülmüş grubun
 * içinde çizilmelidir. Eskiden nokta grubun dışındaydı ve `cos/sin(2π·p)`
 * (0 rad = sağ taraf) ile konumlanıyordu: tam 90° (çeyrek tur) önde gidiyor,
 * halkanın dolgusunu geçiyordu.
 */

export const RING_SIZE = 84
export const RING_STROKE = 5

export function clamp01(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/** Halkanın çevresi ve verilen ilerlemedeki dash offset'i. */
export function ringDash(radius, progress) {
  const circ = 2 * Math.PI * radius
  return { circ, offset: circ * (1 - clamp01(progress)) }
}

/**
 * İşaret noktasının, döndürülmüş grubun İÇİNDEKİ koordinatı (grup -90° döner;
 * 0 rad = döndürülmüş eksende sağ = ekranda tepe noktası).
 */
export function ringHead(cx, radius, progress) {
  const a = 2 * Math.PI * clamp01(progress)
  return { x: cx + radius * Math.cos(a), y: cx + radius * Math.sin(a) }
}

/** Aynı noktanın EKRANDAKİ koordinatı (döndürme uygulanmış) — testler için. */
export function ringHeadOnScreen(cx, radius, progress) {
  const a = 2 * Math.PI * clamp01(progress) - Math.PI / 2
  return { x: cx + radius * Math.cos(a), y: cx + radius * Math.sin(a) }
}
