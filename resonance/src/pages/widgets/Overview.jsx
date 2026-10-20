import { Link } from 'react-router-dom'
import { Music2 } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

export default function WidgetsOverview() {
  const { t } = useLanguage()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">{t('sidebar.widgets')}</h1>

      <Link
        to="/dashboard/widgets/pulse"
        className="mt-6 block max-w-xs overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-accent)]"
      >
        <div className="flex h-32 items-center justify-center bg-gradient-to-br from-[#1a1030] via-[var(--color-surface-2)] to-[var(--color-surface)]">
          <Music2 className="h-10 w-10 text-[var(--color-accent)]" />
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-white">{t('pulse.title')}</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('widgetsOverview.pulseDesc')}</p>
        </div>
      </Link>
    </div>
  )
}
