import { useEffect, useState } from 'react'

/**
 * Müziğin anlık ses seviyesi (0..1): AxthrowA Studio'nun OBS ölçerlerinden (`/api/obs/meters`) okunur, dalgalar
 * gerçek ritimle oynar. OBS bağlı değilse, ölçer yoksa ya da müzik girişi sessizse `null` döner: çağıran kendi
 * süslü animasyonuna düşer. Bütün dalgalar tek okuyucuyu paylaşır.
 * shortcut: ~12 Hz HTTP yoklaması, OBS ölçerleri WebSocket ile yayınlanırsa oraya geçilmeli.
 */
const ARALIK_MS = 80
/** Bu adlardaki giriş müzik sayılır; yoksa mikrofon dışındaki en yüksek giriş */
const MUZIK_ADI = /m[üu]zik|music|spotify|youtube|ytm|masa[üu]st[üu]|desktop|resonance/i
const MIKROFON = /mic|mikrofon|aux/i
/** -50 dBFS sessiz, 0 dBFS tam */
export const dbOrani = (db) => Math.min(1, Math.max(0, (Number(db) + 50) / 50))

/** Ölçer listesinden müziğin seviyesi; uygun giriş yoksa ya da hepsi sessizse null */
export function muzikSeviyesi(girisler) {
  const liste = (girisler || []).filter((g) => g && Number.isFinite(Number(g.peakDb)))
  const muzik = liste.filter((g) => MUZIK_ADI.test(g.name || ''))
  const aday = (muzik.length ? muzik : liste.filter((g) => !MIKROFON.test(g.name || ''))).map((g) => dbOrani(g.peakDb))
  const en = aday.length ? Math.max(...aday) : 0
  return en > 0 ? en : null
}

const dinleyiciler = new Set()
let zamanlayici = null
let son = null
let hataSayisi = 0

async function oku() {
  try {
    // Geç yüklenir: hostBridge açılışta `window`a bakıyor (testler ve sunucu çizimi window'suz)
    const { hostBaseUrl } = await import('../lib/hostBridge')
    const r = await fetch(`${hostBaseUrl()}/api/obs/meters`, { cache: 'no-store' })
    if (!r.ok) throw new Error(String(r.status))
    const ham = muzikSeviyesi((await r.json())?.inputs)
    hataSayisi = 0
    // Yumuşatma: yükselişi hemen al, düşüşü yavaş bırak (ölçer iğnesi gibi)
    son = ham == null ? null : son == null ? ham : ham > son ? ham : son * 0.7 + ham * 0.3
  } catch {
    son = null
    hataSayisi += 1
  }
  dinleyiciler.forEach((f) => f(son))
  // Ölçer yoksa (bağımsız Resonance, OBS kapalı) sunucuyu boşuna yormamak için seyrekleşir
  if (dinleyiciler.size) zamanlayici = setTimeout(oku, hataSayisi > 3 ? 3000 : ARALIK_MS)
  else zamanlayici = null
}

export function useMuzikSeviyesi(acik) {
  const [seviye, setSeviye] = useState(null)
  useEffect(() => {
    if (!acik) {
      setSeviye(null)
      return undefined
    }
    dinleyiciler.add(setSeviye)
    if (!zamanlayici) oku()
    return () => {
      dinleyiciler.delete(setSeviye)
    }
  }, [acik])
  return acik ? seviye : null
}
