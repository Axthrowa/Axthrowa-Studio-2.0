import { useMuzikSeviyesi } from '../../hooks/useMuzikSeviyesi'
import { cubukOlcegi } from './skinParts'

const BAR_DELAYS = [0, 0.15, 0.3, 0.1, 0.25]
const BAR_BOYLARI = [0.6, 1, 0.75, 0.9, 0.55]

export function Visualizer({ playing, color = '#8b5cf6', size = 'sm' }) {
  const height = size === 'sm' ? 12 : 18
  const seviye = useMuzikSeviyesi(playing)
  const ritim = seviye != null
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {BAR_DELAYS.map((delay, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: color,
            height: '100%',
            animation: playing && !ritim ? `resonance-bar 0.9s ease-in-out ${delay}s infinite` : 'none',
            opacity: playing ? 1 : 0.35,
            transform: ritim ? `scaleY(${cubukOlcegi(BAR_BOYLARI[i], seviye, i)})` : playing ? undefined : 'scaleY(0.3)',
            transition: ritim ? 'transform 90ms linear' : undefined,
          }}
        />
      ))}
      <style>{`
        @keyframes resonance-bar {
          0%, 100% { transform: scaleY(0.25); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}
