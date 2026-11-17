// UI-1: 4 düğme türü ortak/tasarim.css'ten (Studio ve AxBoT ile aynı). Eski adlar eşlenir: outline → ikincil, gradient → birincil
const TUR = {
  default: 'axt-dugme-birincil',
  gradient: 'axt-dugme-birincil',
  outline: 'axt-dugme-ikincil',
  ghost: 'axt-dugme-sessiz',
  danger: 'axt-dugme-tehlike',
}

export function Button({
  children,
  variant = 'default',
  className = '',
  as: As = 'button',
  ...props
}) {
  return (
    <As className={`axt-dugme axt-dugme-buyuk ${TUR[variant] || TUR.default} ${className}`} {...props}>
      {children}
    </As>
  )
}
