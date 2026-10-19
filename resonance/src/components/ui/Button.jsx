export function Button({
  children,
  variant = 'default',
  className = '',
  as: As = 'button',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[99%] disabled:cursor-not-allowed disabled:opacity-50'
  const variants = {
    default: 'bg-[var(--color-accent)] text-white hover:brightness-110',
    outline:
      'border border-[var(--color-border)] bg-[var(--color-surface-2)] text-white hover:bg-[var(--color-surface-3)]',
    ghost: 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
    gradient:
      'text-white bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-2)] hover:brightness-110 shadow-lg shadow-black/30',
  }
  return (
    <As className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </As>
  )
}
