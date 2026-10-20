import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useProfile } from '../../context/ProfileContext'
import { useLanguage } from '../../context/LanguageContext'

export default function AccountSettings() {
  const { t } = useLanguage()
  const { username, setUsername, bio, setBio, resetAllData } = useProfile()
  const [nameInput, setNameInput] = useState(username)
  const [bioInput, setBioInput] = useState(bio)
  const [saved, setSaved] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const save = () => {
    if (nameInput.trim()) setUsername(nameInput)
    setBio(bioInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">{t('sidebar.settings')}</h1>

      <Card className="mt-6">
        <h3 className="text-lg font-semibold text-white">{t('profilePage.title')}</h3>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('profilePage.displayName')}
          </p>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('profilePage.displayNameHint')}</p>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {t('profilePage.bio')}
          </p>
          <textarea
            value={bioInput}
            onChange={(e) => setBioInput(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <Button variant="gradient" className="mt-4" onClick={save}>
          {saved ? t('profilePage.saved') : t('common.save')}
        </Button>
      </Card>

      <Card className="mt-6 border-red-500/30">
        <h3 className="text-lg font-semibold text-red-300">{t('profilePage.dangerZone')}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('profilePage.resetWarning')}</p>
        <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {t('profilePage.typeToConfirm').replace('{word}', 'DELETE')}
        </p>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full rounded-xl border border-red-500/30 bg-[var(--color-surface-2)] px-4 py-3 text-white outline-none focus:border-red-400"
        />
        <Button
          variant="outline"
          className="mt-3 border-red-500/40 text-red-300 hover:bg-red-500/10"
          disabled={confirmText !== 'DELETE'}
          onClick={resetAllData}
        >
          {t('profilePage.resetButton')}
        </Button>
      </Card>
    </div>
  )
}
