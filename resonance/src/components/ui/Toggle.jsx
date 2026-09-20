import { Lock } from 'lucide-react'

export function Toggle({ checked, onChange, locked = false, disabled = false }) {
  const on = Boolean(checked)
  const isDisabled = disabled || locked
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => !isDisabled && onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 overflow-hidden rounded-full p-0.5 transition-colors ${
        on ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-3)]'
      } ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {locked ? (
        <Lock className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white" />
      ) : (
        <span
          aria-hidden
          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out will-change-transform ${
            on ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      )}
    </button>
  )
}

export function ToggleRow({ title, description, checked, onChange, locked, badge }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-white">{title}</p>
          {badge && (
            <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      <div className="shrink-0 pt-0.5">
        <Toggle checked={checked} onChange={onChange} locked={locked} />
      </div>
    </div>
  )
}
