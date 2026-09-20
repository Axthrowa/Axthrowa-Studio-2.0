import { useEffect, useState } from 'react'
import { SkipBack, SkipForward, Play, Pause, Loader2 } from 'lucide-react'
import { isHostAvailable, playerCommand } from '../../lib/hostBridge'

// Oynatma kontrolü host üzerinden gider: Spotify Web API veya YouTube Music
// Companion komut ucu. Resonance tek başına açıldığında (host yok) gizlenir —
// çalışmayacak bir düğme göstermenin anlamı yok.
export function TransportBar({ isPlaying, musicService }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    isHostAvailable().then(setEnabled)
  }, [])

  if (!enabled) return null

  const run = async (action) => {
    setBusy(true)
    setError(null)
    try {
      await playerCommand(action, musicService)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const Btn = ({ onClick, children, primary }) => (
    <button
      onClick={onClick}
      disabled={busy}
      className={`grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-40 ${
        primary
          ? 'bg-[var(--color-accent)] text-black hover:brightness-110'
          : 'border border-[var(--color-border)] text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <Btn onClick={() => run('previous')}>
          <SkipBack className="h-4 w-4" />
        </Btn>
        <Btn primary onClick={() => run('playPause')}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Btn>
        <Btn onClick={() => run('next')}>
          <SkipForward className="h-4 w-4" />
        </Btn>
      </div>
      {error && <p className="text-center text-xs text-red-300">{error}</p>}
    </div>
  )
}
