import { useEffect, useState } from 'react'
import { hostBaseUrl } from '../lib/hostBridge'
import { istekOzeti } from '../lib/istekSirasi'

const YOKLAMA_MS = 3000
const YENI_GORUNUR_MS = 6000

/**
 * AxBoT kuyruğu: çalanın isteyeni, sıradaki istek, yeni gelen istek (6 sn).
 * Studio host'unda bu uç yok (404): o zaman şerit hiç çıkmaz, seyrek yeniden denenir.
 */
export function useIstekSirasi(acik) {
  const [durum, setDurum] = useState({ isteyen: '', siradaki: null, yeni: null })
  useEffect(() => {
    if (!acik) return undefined
    let iptal = false
    let zaman
    let idler = null
    let yeniBitis = 0
    let yeni = null
    const yokla = async () => {
      let bekle = YOKLAMA_MS
      try {
        const r = await fetch(`${hostBaseUrl()}/api/songrequest/queue`, { cache: 'no-store' })
        if (!r.ok) throw new Error(String(r.status))
        const o = istekOzeti(await r.json(), idler)
        idler = o.idler
        if (o.yeni) {
          yeni = o.yeni
          yeniBitis = Date.now() + YENI_GORUNUR_MS
        }
        if (!iptal) setDurum({ isteyen: o.isteyen, siradaki: o.siradaki, yeni: Date.now() < yeniBitis ? yeni : null })
      } catch {
        bekle = 30_000
        if (!iptal) setDurum({ isteyen: '', siradaki: null, yeni: null })
      }
      if (!iptal) zaman = setTimeout(yokla, bekle)
    }
    void yokla()
    return () => {
      iptal = true
      clearTimeout(zaman)
    }
  }, [acik])
  return durum
}
