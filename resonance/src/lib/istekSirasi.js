/**
 * R6: AxBoT şarkı isteği kuyruğundan katman şeridi. `veri` = GET /api/songrequest/queue yanıtı.
 * `onceki`: önceki yoklamadaki kimlikler (null = ilk yoklama, "yeni istek" sayılmaz).
 */
export function istekOzeti(veri, onceki) {
  const kuyruk = Array.isArray(veri?.queue) ? veri.queue : []
  const calan = veri?.current || null
  const ogeyi = (o) => (o ? { ad: String(o.title || '').slice(0, 120), isteyen: String(o.requestedBy || '').slice(0, 40) } : null)
  const siradaki = kuyruk.find((o) => o?.id && o.id !== calan?.id) || null
  const idler = kuyruk.map((o) => o?.id).filter(Boolean)
  const yeni = onceki ? [...kuyruk].reverse().find((o) => o?.id && !onceki.includes(o.id)) || null : null
  return { isteyen: calan?.requestedBy ? String(calan.requestedBy).slice(0, 40) : '', siradaki: ogeyi(siradaki), yeni: ogeyi(yeni), idler }
}
