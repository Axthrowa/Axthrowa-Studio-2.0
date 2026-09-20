import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useYtmd } from '../context/YtmdContext'
import { getYtmdHost, getYtmdPort, getYtmdToken } from '../lib/ytmdAuth'
import { isHostAvailable, putNowPlaying } from '../lib/hostBridge'

/// Parça değişmese de ilerlemeyi bu sıklıkta host'a yaz. Seyrek yazınca
/// overlay ekranları eski bir tabandan yürütüyor ve saniye takılıyordu.
const PUSH_THROTTLE_MS = 2_000
/// Oynatma durumu (play/pause) değişince throttle yok — overlay anında
/// gizlensin/görünsün.
const PUSH_REFRESH_MS = 10_000

// player.trackState: -1 Unknown, 0 Paused, 1 Playing, 2 Buffering
function isTrackPlaying(trackState) {
  return trackState === 1
}

function largestThumbnail(thumbnails) {
  if (!thumbnails || !thumbnails.length) return undefined
  return thumbnails[thumbnails.length - 1]?.url
}

function mapState(state) {
  const video = state?.video
  if (!video || !video.title) {
    return { track: null, isPlaying: false, progressMs: 0 }
  }
  return {
    track: {
      id: video.id,
      name: video.title,
      artists: video.author,
      album: video.album || '',
      cover: largestThumbnail(video.thumbnails),
      durationMs: (video.durationSeconds || 0) * 1000,
      source: 'youtube-music',
    },
    isPlaying: isTrackPlaying(state.player?.trackState),
    progressMs: (state.player?.videoProgress || 0) * 1000,
  }
}

// Real-time updates via the Companion Server's Socket.IO endpoint, per the
// official docs: the REST /state endpoint is rate-limited and explicitly
// not meant for polling — /api/v1/realtime pushes state-update events instead.
//
// `override` lets a caller (the /overlay page, when the Browser Source URL
// carries its own embedded connection) bypass localStorage/context entirely
// — this is what makes the URL work inside OBS, which has its own isolated
// browser profile and can never see the tokens saved in your regular browser.
//
// `bridge` açıkken her state-update host'a (Rust) yazılır; panel ve tüm
// overlay ekranları YouTube Music verisini oradan okur.
export function useYtmdNowPlaying(enabled = true, override = null, bridge = false) {
  const { connected, reportSocket } = useYtmd()
  const [track, setTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressMs, setProgressMs] = useState(0)
  const tickRef = useRef(null)
  const isPlayingRef = useRef(false)
  const lastPushRef = useRef('')
  const lastPushAtRef = useRef(0)
  const lastPayloadRef = useRef(null)
  const progressBaseRef = useRef({ progress: 0, at: 0, playing: false, duration: 0 })

  const hasConnection = override ? Boolean(override.token) : connected

  useEffect(() => {
    if (!hasConnection || !enabled) {
      reportSocket?.('idle')
      return undefined
    }

    const token = override?.token || getYtmdToken()
    if (!token) {
      reportSocket?.('error', 'YouTube Music oturum anahtarı yok — yeniden bağlanın.')
      return undefined
    }
    const host = override?.host || getYtmdHost()
    const port = override?.port || getYtmdPort()

    reportSocket?.('connecting')
    const socket = io(`http://${host}:${port}/api/v1/realtime`, {
      transports: ['websocket'],
      auth: { token },
    })

    socket.on('connect', () => reportSocket?.('connecting'))
    socket.on('connect_error', (err) =>
      reportSocket?.(
        'error',
        `Companion Server'a bağlanılamadı (${host}:${port}). YouTube Music Desktop açık ve Ayarlar > Entegrasyonlar > Companion Server etkin olmalı. (${err?.message || 'bağlantı hatası'})`,
      ),
    )
    socket.on('disconnect', () => reportSocket?.('connecting'))

    socket.on('state-update', (state) => {
      const mapped = mapState(state)
      setTrack(mapped.track)
      setIsPlaying(mapped.isPlaying)
      isPlayingRef.current = mapped.isPlaying
      progressBaseRef.current = {
        progress: mapped.progressMs,
        at: Date.now(),
        playing: mapped.isPlaying,
        duration: mapped.track?.durationMs || 0,
      }
      setProgressMs(mapped.progressMs)
      reportSocket?.('live')

      if (!bridge) return
      const payload = mapped.track
        ? {
            title: mapped.track.name,
            artist: mapped.track.artists || '',
            album: mapped.track.album || '',
            albumArt: mapped.track.cover || '',
            isPlaying: mapped.isPlaying,
            progress: Math.round(mapped.progressMs),
            duration: Math.round(mapped.track.durationMs || 0),
            source: 'youtube-music',
            updatedAt: Date.now(),
          }
        : null
      lastPayloadRef.current = payload

      // Aynı parça + aynı oynatma durumu saniyede birkaç kez gönderilmesin.
      // Oynatma durumu değişince (pause/stop) hemen yaz — throttle yalnız
      // progress tazelemesi için.
      const key = payload ? `${payload.title}|${payload.artist}|${payload.isPlaying}` : 'none'
      const playingChanged = key !== lastPushRef.current
      const stale = Date.now() - lastPushAtRef.current > PUSH_THROTTLE_MS
      if (!playingChanged && !stale) return
      lastPushRef.current = key
      lastPushAtRef.current = Date.now()
      isHostAvailable().then((ok) => {
        if (ok) putNowPlaying(payload).catch(() => {})
      })
    })

    // Smooth the progress bar between pushes instead of snapping every update.
    // Sabit `prev + 1000` biriktirici setInterval kaymasıyla sürükleniyor ve
    // her `state-update` geldiğinde değer zıplıyordu. Taban + geçen süre
    // modeli hem akıcı hem de kaynakla senkron kalıyor.
    tickRef.current = setInterval(() => {
      const base = progressBaseRef.current
      if (!base.playing) return
      const next = base.progress + (Date.now() - base.at)
      setProgressMs(base.duration > 0 ? Math.min(next, base.duration) : next)
    }, 250)

    // Host yeniden başladığında bir sonraki `state-update`'i beklemeden
    // mevcut parçayı geri koy.
    const resendTimer = setInterval(() => {
      if (!bridge || !lastPayloadRef.current) return
      if (Date.now() - lastPushAtRef.current < PUSH_REFRESH_MS) return
      lastPushAtRef.current = Date.now()
      isHostAvailable().then((ok) => {
        if (ok) putNowPlaying(lastPayloadRef.current).catch(() => {})
      })
    }, PUSH_REFRESH_MS)

    return () => {
      clearInterval(tickRef.current)
      clearInterval(resendTimer)
      socket.removeAllListeners()
      socket.disconnect()
      reportSocket?.('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasConnection, enabled, bridge, override?.token, override?.host, override?.port])

  return { track, isPlaying, progressMs }
}
