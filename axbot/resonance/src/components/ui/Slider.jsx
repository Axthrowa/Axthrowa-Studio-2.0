export function Slider({ value, min = 0, max = 30, step = 1, onChange, suffix = 's' }) {
  const safe = Number.isFinite(value) ? value : min
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safe}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full min-w-0 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-3)] accent-[var(--color-accent)]"
      />
      <span className="min-w-[2.75rem] shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-[var(--color-text-muted)]">
        {safe}&nbsp;{suffix}
      </span>
    </div>
  )
}
