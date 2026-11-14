import { describe, expect, it } from 'vitest'
import { istekOzeti } from './istekSirasi'

const veri = {
  current: { id: 'a', title: 'Paramparça — Teoman', requestedBy: 'ali' },
  queue: [
    { id: 'a', title: 'Paramparça — Teoman', requestedBy: 'ali' },
    { id: 'b', title: 'Bir Derdim Var', requestedBy: 'veli' },
  ],
}

describe('istek şeridi (R6)', () => {
  it('çalanın isteyeni ve çalan dışındaki ilk istek sıradakidir', () => {
    const o = istekOzeti(veri, null)
    expect(o.isteyen).toBe('ali')
    expect(o.siradaki).toEqual({ ad: 'Bir Derdim Var', isteyen: 'veli' })
    expect(o.yeni).toBeNull()
  })

  it('yalnız sonradan gelen kimlik yeni istek sayılır', () => {
    expect(istekOzeti(veri, ['a', 'b']).yeni).toBeNull()
    expect(istekOzeti(veri, ['a']).yeni).toEqual({ ad: 'Bir Derdim Var', isteyen: 'veli' })
  })

  it('çalan istek değilse isteyen boş, kuyruğun başı sıradaki; bozuk yanıt çökmez', () => {
    expect(istekOzeti({ current: null, queue: veri.queue }, null)).toMatchObject({ isteyen: '', siradaki: { isteyen: 'ali' } })
    expect(istekOzeti(null, null)).toEqual({ isteyen: '', siradaki: null, yeni: null, idler: [] })
  })
})
