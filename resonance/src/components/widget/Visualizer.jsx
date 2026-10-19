const BAR_DELAYS = [0, 0.15, 0.3, 0.1, 0.25]

export function Visualizer({ playing, color = '#8b5cf6', size = 'sm' }) {
  const height = size === 'sm' ? 12 : 18
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {BAR_DELAYS.map((delay, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            background: color,
            height: '100%',
            animation: playing ? `resonance-bar 0.9s ease-in-out ${delay}s infinite` : 'none',
            opacity: playing ? 1 : 0.35,
            transform: playing ? undefined : 'scaleY(0.3)',
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
