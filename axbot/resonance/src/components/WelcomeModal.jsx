import { useState } from 'react'
import { AudioWaveform } from 'lucide-react'
import { useProfile } from '../context/ProfileContext'
import { useLanguage } from '../context/LanguageContext'
import { Button } from './ui/Button'

export function WelcomeModal() {
  const { hasUsername, setUsername } = useProfile()
  const { t } = useLanguage()
  const [value, setValue] = useState('')

  if (hasUsername) return null

  const submit = (e) => {
    e.preventDefault()
    if (value.trim()) setUsername(value)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center"
      >
        <AudioWaveform className="mx-auto mb-3 h-8 w-8 text-[var(--color-accent)]" />
        <h1 className="text-xl font-semibold text-white">{t('welcome.title')}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('welcome.body')}</p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('welcome.placeholder')}
          className="mt-5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-center text-white outline-none focus:border-[var(--color-accent)]"
        />
        <Button type="submit" variant="gradient" className="mt-4 w-full" disabled={!value.trim()}>
          {t('welcome.save')}
        </Button>
      </form>
    </div>
  )
}
