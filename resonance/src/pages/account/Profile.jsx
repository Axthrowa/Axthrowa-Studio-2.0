import { useProfile } from '../../context/ProfileContext'
import { useLanguage } from '../../context/LanguageContext'
import { colorForName } from '../../lib/avatarColor'

export default function Profile() {
  const { t, language } = useLanguage()
  const { username, bio, joinedAt } = useProfile()
  const color = colorForName(username || 'R')
  const joined = new Date(joinedAt).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">{t('profilePage.title')}</h1>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)]">
        <div className="h-32" style={{ background: `linear-gradient(135deg, ${color}, var(--color-accent))` }} />
        <div className="bg-[var(--color-surface)] p-6 pt-0">
          <div
            className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--color-surface)] text-3xl font-bold text-white"
            style={{ background: color }}
          >
            {(username || 'R')[0].toUpperCase()}
          </div>
          <h2 className="mt-3 text-xl font-semibold text-white">{username}</h2>

          <div className="mt-6 space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t('profilePage.displayName')}
              </p>
              <p className="mt-1 text-sm text-white">{username}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t('profilePage.joined')}
              </p>
              <p className="mt-1 text-sm text-white">{joined}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t('profilePage.bio')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {bio || t('profilePage.noBio')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
