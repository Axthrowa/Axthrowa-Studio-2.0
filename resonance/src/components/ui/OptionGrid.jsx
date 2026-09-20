import { Lock } from 'lucide-react'

export function OptionGrid({ options, value, onChange, columns = 5 }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.locked || opt.disabled}
            title={opt.hint}
            aria-disabled={opt.locked || opt.disabled || undefined}
            onClick={() => !(opt.locked || opt.disabled) && onChange(opt.value)}
            className={`group relative flex flex-col items-center gap-2 rounded-xl border p-1 pb-2 transition ${
              selected
                ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
            } ${opt.locked ? 'opacity-60' : ''} ${opt.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {opt.badge && (
              <span className="absolute -top-2 right-1 z-10 rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {opt.badge}
              </span>
            )}
            <div className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--color-surface-3)]">
              {opt.preview}
              {opt.locked && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70">
                  <Lock className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <span
              className={`text-xs font-medium ${opt.locked ? 'text-[var(--color-text-muted)]' : 'text-white'}`}
            >
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
