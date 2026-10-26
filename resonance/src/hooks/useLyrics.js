import { useEffect, useRef, useState } from 'react'
import { etkinSatir, sozleriGetir } from '../lib/lyrics'

/**
 * Çalan parçanın sözleri ve şu anki satır. İlerleme (`progressMs`) zaten akıcı
 * güncellenir (useHostNowPlaying); `offsetMs` sözleri ileri/geri kaydırır.
 */
export function useLyrics(track, progressMs, enabled = true, offsetMs = 0) {
  const [soz, setSoz] = useState({ synced: false, lines: [] })
  const anahtar = track ? `${track.name}|${track.artists}` : ''
  const sonAnahtar = useRef('')

  useEffect(() => {
    if (!enabled || !anahtar) {
      setSoz({ synced: false, lines: [] })
      return undefined
    }
    let iptal = false
    sonAnahtar.current = anahtar
    setSoz({ synced: false, lines: [] })
    void sozleriGetir(track.name, track.artists, track.durationMs).then((s) => {
      if (!iptal && sonAnahtar.current === anahtar) setSoz(s)
    })
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, enabled])

  const konumSn = (Number(progressMs) + Number(offsetMs || 0)) / 1000
  const index = soz.synced ? etkinSatir(soz.lines, konumSn) : -1
  return { ...soz, index }
}
