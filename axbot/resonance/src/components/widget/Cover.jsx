import { Music2 } from 'lucide-react'
import { DONEN_KAPAKLAR } from '../../lib/coverShape'
import { ringDash } from '../../lib/ringGeometry'

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
 * İlerleme halkası: yuvarlak kapağın kenarına oturur, disk dönerken sabit kalır.
 */
function KapakHalkasi({ size, progress, color }) {
  const kalinlik = Math.max(2, Math.round(size * 0.05))
  const r = (size - kalinlik) / 2
  const { circ, offset } = ringDash(r, progress)
  return (
    <svg data-kapak-halkasi width={size} height={size} className="absolute inset-0" aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={kalinlik} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color || '#8b5cf6'}
          strokeWidth={kalinlik}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 300ms linear' }}
        />
      </g>
    </svg>
  )
}

/** CD'nin gökkuşağı parıltısı; disk dönse de ışık sabit kalır. */
const CD_PARILTI =
  'conic-gradient(rgba(255,255,255,0) 0 10%, rgba(255,255,255,.38) 16%, rgba(125,211,252,.22) 21%, rgba(255,255,255,0) 28% 58%, rgba(255,255,255,.34) 66%, rgba(244,114,182,.2) 71%, rgba(255,255,255,0) 78%)'
const PLAK_OLUKLARI = 'repeating-radial-gradient(circle, rgba(0,0,0,.2) 0 1px, rgba(0,0,0,0) 1px 4px)'

/**
 * `shape`: `COVER_SHAPES` değerleri. Köşe yuvarlaklığı yalnız `square` için
 * (`radius`, 0-24 px).
 *
 * Plak dönüşü CSS animasyonu: eskiden framer-motion her karede JS ile stil
 * yazıyordu (saniyede ~180 DOM değişimi) ve ilerleme çubuğu her 250 ms'de
 * yeniden çizilirken titreme yapıyordu. CSS animasyonu ana iş parçacığına yük
 * bindirmez, duraklatınca açıyı korur.
 */
export function Cover({ src, shape = 'square', glow = false, playing = false, size = 64, accentColor, radius = 8, ring = false, progress = 0 }) {
  if (shape === 'none') return null

  const glowStyle = glow ? { boxShadow: glowShadow(accentColor) } : undefined

  const halka = ring ? <KapakHalkasi size={size} progress={progress} color={accentColor} /> : null
  const gorsel = src ? (
    <img src={src} alt="" className="h-full w-full object-cover" />
  ) : (
    <PlaceholderArt size={size} />
  )

  if (shape === 'circle') {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div className="h-full w-full overflow-hidden rounded-full" style={glowStyle}>{gorsel}</div>
        {halka}
      </div>
    )
  }

  if (shape === 'hexagon') {
    // box-shadow clip-path'e takılır: parlama üst katmanda drop-shadow ile
    return (
      <div className="shrink-0" style={{ width: size, height: size, filter: glow ? `drop-shadow(0 0 10px ${accentColor || '#8b5cf6'})` : undefined }}>
        <div className="h-full w-full" style={{ clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)' }}>{gorsel}</div>
      </div>
    )
  }

  if (shape === 'polaroid') {
    const pay = Math.max(2, Math.round(size * 0.06))
    return (
      <div
        className="shrink-0 bg-white shadow-md"
        style={{ width: size, height: size, padding: pay, paddingBottom: Math.round(size * 0.18), transform: 'rotate(-3deg)', ...glowStyle }}
      >
        <div className="h-full w-full overflow-hidden bg-zinc-800">{gorsel}</div>
      </div>
    )
  }

  if (DONEN_KAPAKLAR.includes(shape)) {
    return (
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <div
          className={`resonance-spin relative h-full w-full overflow-hidden rounded-full border-black/60 bg-black ${shape === 'cd' ? 'border-2' : 'border-4'}`}
          style={{ ...glowStyle, animationPlayState: playing ? 'running' : 'paused' }}
        >
          {src ? (
            <img src={src} alt="" className="h-full w-full object-cover opacity-90" />
          ) : (
            <PlaceholderArt size={size} />
          )}
          {shape === 'vinyl' && (
            <div data-delik className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-bg)]" />
          )}
          {shape === 'disc' && <div aria-hidden className="absolute inset-0" style={{ background: PLAK_OLUKLARI }} />}
          {shape === 'cd' && (
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/30"
              style={{ width: size * 0.3, height: size * 0.3 }}
            >
              <div className="rounded-full bg-[var(--color-bg)]" style={{ width: size * 0.12, height: size * 0.12 }} />
            </div>
          )}
        </div>
        {shape === 'cd' && <div aria-hidden className="absolute inset-0 rounded-full" style={{ background: CD_PARILTI }} />}
        {halka}
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
