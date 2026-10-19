export function Card({ children, className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-xl font-semibold text-white ${className}`}>{children}</h3>
}

export function CardSubtitle({ children, className = '' }) {
  return <p className={`text-sm text-[var(--color-text-muted)] ${className}`}>{children}</p>
}
