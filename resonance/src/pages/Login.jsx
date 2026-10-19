import { Navigate } from 'react-router-dom'
import { AudioWaveform } from 'lucide-react'
import { redirectToSpotifyAuthorize, isSpotifyConfigured } from '../lib/spotifyAuth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { Button } from '../components/ui/Button'

function friendlyAuthError(message, t) {
  if (!message) return null
  if (message.includes('Active premium subscription required for the owner of the app')) {
    return t('login.premiumRequired')
  }
  return message
}

export default function Login() {
  const { isAuthenticated, loading, authError } = useAuth()
  const { t } = useLanguage()

  if (loading) return null
  if (isAuthenticated) return <Navigate to="/dashboard/home" replace />

  return (
    <div className="waveform-backdrop flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="relative flex items-center gap-2">
        <AudioWaveform
          className="h-8 w-8 text-[var(--color-accent)]"
          style={{ filter: 'drop-shadow(0 0 10px color-mix(in srgb, var(--color-accent) 60%, transparent))' }}
        />
        <span className="text-2xl font-bold text-white">Resonance</span>
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <h1 className="text-xl font-semibold text-white">{t('login.title')}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{t('login.subtitle')}</p>

        {isSpotifyConfigured() ? (
          <>
            <Button
              variant="default"
              className="mt-6 w-full !bg-[#1db954] hover:!bg-[#1ed760]"
              onClick={() => redirectToSpotifyAuthorize()}
            >
              {t('login.continueWithSpotify')}
            </Button>
            {authError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left text-xs text-red-300">
                <p className="font-semibold">{t('login.signInFailed')}</p>
                <p className="mt-1 text-red-300/80">{friendlyAuthError(authError, t)}</p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-left text-xs text-amber-300">
            <p className="font-semibold">{t('login.notConfiguredTitle')}</p>
            <p className="mt-1 text-amber-300/80">{t('login.notConfiguredBody')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
