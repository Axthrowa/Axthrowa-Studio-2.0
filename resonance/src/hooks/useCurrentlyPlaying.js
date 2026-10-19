import { useEffect, useRef, useState } from 'react'
import { getCurrentlyPlaying, getCurrentlyPlayingWithToken } from '../lib/spotifyApi'
import { refreshAccessTokenStandalone } from '../lib/spotifyAuth'
import { useAuth } from '../context/AuthContext'

function mapPlaybackData(data) {
  const item = data?.item
  if (!item) return { track: null, isPlaying: false, progressMs: 0 }
  // Şarkıda `artists` + `album`, podcast bölümünde `show` + kendi `images`
  // alanı var. Tek biçime indirgiyoruz; aksi halde bölüm çalarken
  // `artists.map` patlıyor ve widget hiçbir şey göstermiyordu.
  const artists = Array.isArray(item.artists)
    ? item.artists.map((a) => a.name).join(', ')
    : item.show?.publisher || item.show?.name || ''
  return {
    track: {
      id: item.id,
      name: item.name,
      artists,
      album: item.album?.name || item.show?.name || '',
      cover: item.album?.images?.[0]?.url || item.images?.[0]?.url,
      durationMs: item.duration_ms,
    },
    isPlaying: data.is_playing,
    progressMs: data.progress_ms || 0,
  }
}

// `override` ({ refreshToken, clientId }) lets a caller (the /overlay page,
// when the Browser Source URL carries its own embedded Spotify credentials)
// manage its own access token in memory instead of relying on this app's
// localStorage — needed because OBS's Browser Source runs an entirely
// separate browser profile that can never see tokens saved elsewhere.
export function useCurrentlyPlaying(pollMs = 3000, enabled = true, override = null) {
  const { isAuthenticated } = useAuth()
  const [track, setTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressMs, setProgressMs] = useState(0)
  const timerRef = useRef(null)
  const overrideTokenRef = useRef({ accessToken: null, expiresAt: 0 })

  const hasAuth = override ? Boolean(override.refreshToken && override.clientId) : isAuthenticated

  useEffect(() => {
    if (!hasAuth || !enabled) return undefined

    let cancelled = false

    async function getOverrideAccessToken() {
      const cached = overrideTokenRef.current
      if (cached.accessToken && Date.now() < cached.expiresAt - 30_000) {
        return cached.accessToken
      }
      const refreshed = await refreshAccessTokenStandalone(override)
      overrideTokenRef.current = refreshed
      return refreshed.accessToken
    }

    async function poll() {
      try {
        const data = override
          ? await getCurrentlyPlayingWithToken(await getOverrideAccessToken())
          : await getCurrentlyPlaying()
        if (cancelled) return
        const mapped = mapPlaybackData(data)
        setTrack(mapped.track)
        setIsPlaying(mapped.isPlaying)
        setProgressMs(mapped.progressMs)
      } catch {
        /* keep last known state on transient errors */
      }
    }

    poll()
    timerRef.current = setInterval(poll, pollMs)
    return () => {
      cancelled = true
      clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAuth, enabled, pollMs, override?.refreshToken, override?.clientId])

  return { track, isPlaying, progressMs }
}
