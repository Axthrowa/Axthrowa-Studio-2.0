import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { exchangeCodeForToken } from '../lib/spotifyAuth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Callback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const { t } = useLanguage()
  const [error, setError] = useState(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = params.get('code')
    const errorParam = params.get('error')

    if (errorParam) {
      setError(errorParam)
      return
    }
    if (!code) {
      setError('missing_code')
      return
    }

    exchangeCodeForToken(code)
      .then(refreshUser)
      .then(() => navigate('/dashboard/home', { replace: true }))
      .catch((e) => setError(e.message))
  }, [params, navigate, refreshUser])

  return (
    <div className="flex min-h-screen items-center justify-center text-center">
      {error ? (
        <div className="max-w-sm text-[var(--color-text-muted)]">
          <p className="font-semibold text-white">{t('login.signInFailed')}</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : (
        <p className="text-[var(--color-text-muted)]">{t('callback.connecting')}</p>
      )}
    </div>
  )
}
