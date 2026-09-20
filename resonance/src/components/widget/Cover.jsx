import { Music2 } from 'lucide-react'

function PlaceholderArt({ size }) {
  return (
    <div
      className="flex items-center justify-center bg-white/10 text-white/40"
      style={{ width: size, height: size }}
    >
      <Music2 style={{ width: size * 0.4, height: size * 0.4 }} />
    </div>
  )
}

/**
 * Kapak parlaması: iki katmanlı, vurgu renginde.
 *
 * Eskiden tek katman `0 0 24px 4px` idi ve kartın `overflow-hidden`'ı yüzünden
 * kart dolgusunun ötesine hiç taşmıyordu — açık olsa da görünmüyordu.
 * Kartın kırpması artık parlama açıkken kalkıyor (`SkinCard`), burada da
 * gücü artırdık.
 */
export function glowShadow(color) {
  const c = color || 'rgba(139,92,246,0.9)'
  return `0 0 14px 2px ${c}, 0 0 34px 8px ${c}`
}

/**
 * `shape`: square | vinyl | none. Köşe yuvarlaklığı yalnız `square` için
 * (`radius`, 0-24 px); plak her zaman daire.
 *
 * Plak dönüşü CSS animasyonu: eskiden framer-motion her karede JS ile stil
 * yazıyordu (saniyede ~180 DOM değişimi) ve ilerleme çubuğu her 250 ms'de
 * yeniden çizilirken titreme yapıyordu. CSS animasyonu ana iş parçacığına yük
 * bindirmez, duraklatınca açıyı korur.
 */
export function Cover({ src, shape = 'square', glow = false, playing = false, size = 64, accentColor, radius = 8 }) {
  if (shape === 'none') return null

  const glowStyle = glow ? { boxShadow: glowShadow(accentColor) } : undefined

  if (shape === 'vinyl') {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className="resonance-spin h-full w-full overflow-hidden rounded-full border-4 border-black/60 bg-black"
          style={{ ...glowStyle, animationPlayState: playing ? 'running' : 'paused' }}
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover opacity-90" />
          ) : (
            <PlaceholderArt size={size} />
          )}
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-bg)]" />
        </div>
      </div>
    )
  }

  if (!src) {
    return (
      <div className="shrink-0 overflow-hidden" style={{ width: size, height: size, borderRadius: radius, ...glowStyle }}>
        <PlaceholderArt size={size} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className="shrink-0 object-cover"
      style={{ width: size, height: size, borderRadius: radius, ...glowStyle }}
    />
  )
}
