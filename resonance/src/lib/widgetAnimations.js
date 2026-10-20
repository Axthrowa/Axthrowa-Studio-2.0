const OFFSET = 40

const STATES = {
  original: { opacity: 0, scale: 0.94 },
  fade: { opacity: 0 },
  'slide-left': { opacity: 0, x: -OFFSET },
  'slide-right': { opacity: 0, x: OFFSET },
  'slide-top': { opacity: 0, y: -OFFSET },
  'slide-bottom': { opacity: 0, y: OFFSET },
  grow: { opacity: 0, scale: 0.72 },
  shrink: { opacity: 0, scale: 1.28 },
  'swing-left': { opacity: 0, rotate: -14, x: -OFFSET },
  'swing-right': { opacity: 0, rotate: 14, x: OFFSET },
  'tilt-right': { opacity: 0, rotate: 10 },
  'tilt-left': { opacity: 0, rotate: -10 },
}

const REST = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }

export const REVEAL_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-top', label: 'Slide Top' },
  { value: 'slide-bottom', label: 'Slide Bottom' },
  { value: 'grow', label: 'Grow' },
  { value: 'shrink', label: 'Shrink' },
  { value: 'swing-left', label: 'Swing Left' },
  { value: 'swing-right', label: 'Swing Right' },
  { value: 'tilt-right', label: 'Tilt Right' },
  { value: 'tilt-left', label: 'Tilt Left' },
]

/**
 * Framer Motion 13 için açık initial/animate/exit.
 *
 * Eskiden `animate` içine `transition` gömülüyordu ve `exit` önce REST
 * (opacity:1) ile birleşip bazı durumlarda çıkış animasyonunu yutuyordu.
 * Ayrıca önizlemede ayar değişince key değişmezse animasyon hiç yeniden
 * oynamıyordu — widget tarafında animasyon anahtarını key'e eklemek gerekir.
 */
export function getAnimationVariants(revealKey, exitKey) {
  const revealFrom = STATES[revealKey] || STATES.fade
  const exitTo = STATES[exitKey] || STATES.fade
  return {
    initial: { ...REST, ...revealFrom },
    animate: { ...REST },
    exit: { ...exitTo },
    transition: { type: 'spring', stiffness: 280, damping: 26 },
    exitTransition: { duration: 0.32, ease: 'easeIn' },
  }
}
