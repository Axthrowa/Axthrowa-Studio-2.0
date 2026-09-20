import { useEffect, useRef, useState } from 'react'
import { getNowPlaying, hostBaseUrl, isHostAvailable } from '../lib/hostBridge'

function toTrack(np) {
  if (!np || !np.title) return null
  return {
    id: `${np.source}:${np.title}:${np.artist}`,
    name: np.title,
    artists: np.artist || '',
    album: np.album || '',
    cover: np.albumArt || undefined,
    durationMs: np.duration || 0,
    source: np.source || '',
  }
}

// Host (Rust) tek "şu an çalan" kaydını tutar: Spotify'ı kendi yoklar,
// YouTube Music'i Resonance köprüsünden alır. Resonance'ın kendi ekranları da
// buradan okur ki panel, widget ve OBS aynı anı göstersin.
export function useHostNowPlaying(enabled = true, pollMs = 3000) {
  const [available, setAvailable] = useState(false)
  const [track, setTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressMs, setProgressMs] = useState(0)
  const baseRef = useRef({ progress: 0, at: 0, playing: false, duration: 0 })

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false

    function applyNp(np) {
      setTrack(toTrack(np))
      setIsPlaying(Boolean(np?.isPlaying))
      // Örneğin yaşını ekle; yoksa her yoklamada çubuk geri sıçrıyor.
      const sampledAt = Number(np?.updatedAt) || 0
      const age = sampledAt > 0 ? Math.max(0, Date.now() - sampledAt) : 0
      const raw = (np?.progress || 0) + (np?.isPlaying ? age : 0)
      const dur = np?.duration || 0
      const started = dur > 0 ? Math.min(raw, dur) : raw
      baseRef.current = {
        progress: started,
        at: Date.now(),
        playing: Boolean(np?.isPlaying),
        duration: dur,
      }
      setProgressMs(started)
    }

    async function poll() {
      const ok = await isHostAvailable()
      if (cancelled) return
      setAvailable(ok)
      if (!ok) return
      try {
        const np = await getNowPlaying()
        if (cancelled) return
        applyNp(np)
      } catch {
        /* geçici hatalarda son bilinen durum korunur */
      }
    }

    poll()
    // Yoklama yedek; asıl güncelleme WebSocket `now-playing` yayınından gelir.
    const timer = setInterval(poll, pollMs)
    // Yoklamalar arasında ilerleme çubuğunu akıcı tut.
    const tick = setInterval(() => {
      const base = baseRef.current
      if (!base.playing) return
      const next = base.progress + (Date.now() - base.at)
      setProgressMs(base.duration ? Math.min(next, base.duration) : next)
    }, 250)

    let ws = null
    let retry
    const connect = () => {
      if (cancelled) return
      try {
        ws = new WebSocket(`${hostBaseUrl().replace(/^http/, 'ws')}/ws/overlay-sync`)
      } catch {
        return
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg?.type === 'now-playing') {
            applyNp(msg.data ?? null)
          } else if (msg?.type === 'snapshot' && 'nowPlaying' in (msg || {})) {
            applyNp(msg.nowPlaying ?? null)
          }
        } catch {
          /* ilgisiz mesaj */
        }
      }
      ws.onclose = () => {
        if (!cancelled) retry = setTimeout(connect, 3000)
      }
    }
    connect()

    return () => {
      cancelled = true
      clearInterval(timer)
      clearInterval(tick)
      clearTimeout(retry)
      try {
        ws?.close()
      } catch {
        /* */
      }
    }
  }, [enabled, pollMs])

  return { available, track, isPlaying, progressMs }
}
