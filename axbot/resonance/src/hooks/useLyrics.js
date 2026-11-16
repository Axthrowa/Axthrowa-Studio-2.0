import { useEffect, useRef, useState } from 'react'
import { etkinSatir, saatOku, saatOrnekle, saatYeni, sozleriGetir } from '../lib/lyrics'
import { maskeIfadesi, sozuMaskele } from '../lib/sozDenetimi'

const BOS = { synced: false, tahmini: false, lines: [], kaynak: '' }
const TIK_PAYI_MS = 300

/**
 * Çalan parçanın sözleri ve şu anki satır. `saat` karaoke dolumunun da okuduğu tek
 * zaman kaynağıdır: satır ve kelime birbirinden kopmaz. `offsetMs` sözleri kaydırır.
 * `secenek.sira`: kaynak sırası; `secenek.maske`: null = kapalı, metin = küfür maskesi açık (+ ek kelimeler).
 */
export function useLyrics(track, progressMs, enabled = true, offsetMs = 0, secenek = {}) {
  const sira = secenek.sira
  const siraAnahtari = (sira || []).join(',')
  const maske = secenek.maske ?? null
  const [soz, setSoz] = useState(BOS)
  const [, yenile] = useState(0)
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
    void sozleriGetir(track.name, track.artists, track.durationMs, undefined, sira).then((s) => {
      if (!iptal && sonAnahtar.current === anahtar) setSoz(maske == null ? s : { ...s, lines: sozuMaskele(s.lines, maskeIfadesi(maske)) })
    })
    return () => {
      iptal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, enabled, siraAnahtari, maske])

  // İlerleme 4 kez/sn gelir: satır 250 ms geç değişmesin diye saat araları doldurur
  const saat = useRef(null)
  const su = performance.now()
  saat.current = saat.current ? saatOrnekle(saat.current, Number(progressMs), su) : saatYeni(Number(progressMs), su)
  const anlikMs = saatOku(saat.current, su) + Number(offsetMs || 0)
  const konumSn = anlikMs / 1000
  const zamanli = soz.synced || soz.tahmini
  const index = zamanli ? etkinSatir(soz.lines, konumSn) : -1
  // Sonraki satırın başlangıcı iki örnek arasına düşüyorsa tam o anda yeniden çizilir
  const sonrakiMs = zamanli ? soz.lines[index + 1]?.time * 1000 : NaN
  useEffect(() => {
    const kalan = sonrakiMs - anlikMs
    if (!(kalan > 0 && kalan <= TIK_PAYI_MS)) return undefined
    const z = setTimeout(() => yenile((n) => n + 1), kalan)
    return () => clearTimeout(z)
  })
  return { ...soz, index, saat }
}
