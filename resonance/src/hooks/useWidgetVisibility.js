import { useEffect, useRef, useState } from 'react'

/** Duraklamada gizleme için en kısa bekleme (ms). */
export const MIN_PAUSE_HIDE_MS = 300

/**
 * "Duraklayınca gizle" gecikmesi. Ayarlı süre 0 iken (varsayılan) bile kısa bir
 * bekleme uygulanır: YouTube Music / Spotify geçişlerinde `isPlaying` bir an
 * `false` olabiliyor ve widget her seferinde gizlenip yeniden açılarak
 * yanıp sönüyordu.
 */
export function pauseHideDelayMs(config) {
  const ms = (Number(config?.hideOnPauseDelay) || 0) * 1000
  return Math.max(MIN_PAUSE_HIDE_MS, ms)
}

/**
 * Overlay görünürlüğü.
 *
 * `preview=true` (Pulse ayar önizlemesi): her zaman göster — placeholder dahil.
 * Overlay: parça yoksa varsayılan gizle; `showNothingPlaying` açıksa "çalmıyor" kartı.
 */
export function useWidgetVisibility(track, isPlaying, config, preview = false) {
  const [hiddenByPause, setHiddenByPause] = useState(false)
  const [hiddenBySongChange, setHiddenBySongChange] = useState(false)
  const pauseTimerRef = useRef(null)
  const songTimerRef = useRef(null)
  const lastTrackIdRef = useRef(null)

  useEffect(() => {
    if (preview || !config.hideOnPause || !track) {
      setHiddenByPause(false)
      return undefined
    }
    if (isPlaying) {
      setHiddenByPause(false)
      return undefined
    }
    const delayMs = pauseHideDelayMs(config)
    pauseTimerRef.current = setTimeout(() => setHiddenByPause(true), delayMs)
    return () => clearTimeout(pauseTimerRef.current)
  }, [preview, config.hideOnPause, config.hideOnPauseDelay, isPlaying, track])

  useEffect(() => {
    if (preview || !config.songChangeOnly || !track) {
      setHiddenBySongChange(false)
      lastTrackIdRef.current = track?.id ?? null
      return undefined
    }
    if (track.id !== lastTrackIdRef.current) {
      lastTrackIdRef.current = track.id
      setHiddenBySongChange(false)
      clearTimeout(songTimerRef.current)
      const durationMs = (Number(config.songChangeVisibleDuration) || 0) * 1000
      songTimerRef.current = setTimeout(() => setHiddenBySongChange(true), durationMs)
    }
    return () => clearTimeout(songTimerRef.current)
  }, [preview, config.songChangeOnly, config.songChangeVisibleDuration, track])

  if (preview) return true
  if (!track) return config.showNothingPlaying === true
  return !hiddenByPause && !hiddenBySongChange
}
