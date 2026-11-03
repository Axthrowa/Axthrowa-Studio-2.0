import { useEffect, useRef, useState } from 'react'
import { etkinSatir, satirOrani, sozleriGetir } from '../lib/lyrics'

const BOS = { synced: false, tahmini: false, lines: [], kaynak: '' }

/**
 * Çalan parçanın sözleri ve şu anki satır. İlerleme (`progressMs`) zaten akıcı
 * güncellenir (useHostNowPlaying); `offsetMs` sözleri ileri/geri kaydırır.
 */
export function useLyrics(track, progressMs, enabled = true, offsetMs = 0) {
  const [soz, setSoz] = useState(BOS)
  const anahtar = track ? `${track.name}|${track.artists}` : ''
  const sonAnahtar = useRef('')

  useEffect(() => {
    if (!enabled || !anahtar) {
      setSoz(BOS)
      return undefined
    }
    let iptal = false
    sonAnahtar.current = anahtar
    setSoz(BOS)
    void sozleriGetir(track.name, track.artists, track.durationMs).then((s) => {
      if (!iptal && sonAnahtar.current === anahtar) setSoz(s)
    })
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, enabled])

  const konumSn = (Number(progressMs) + Number(offsetMs || 0)) / 1000
  const zamanli = soz.synced || soz.tahmini
  const index = zamanli ? etkinSatir(soz.lines, konumSn) : -1
  return { ...soz, index, oran: zamanli ? satirOrani(soz.lines, index, konumSn) : 0 }
}
