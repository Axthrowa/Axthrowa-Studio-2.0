import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Projede DOM ortamı yok: kancanın bağımlılık davranışını sınayacak kadar küçük bir React taklidi
const h = vi.hoisted(() => ({ i: 0, slots: [] }))
vi.mock('react', () => ({
  useState: (ilk) => {
    const i = h.i++
    h.slots[i] ??= { v: ilk }
    const s = h.slots[i]
    return [s.v, (v) => { s.v = v }]
  },
  useRef: (ilk) => {
    const i = h.i++
    h.slots[i] ??= { current: ilk }
    return h.slots[i]
  },
  useEffect: (fn, deps) => {
    const i = h.i++
    const s = h.slots[i]
    if (!s || deps.some((d, k) => !Object.is(d, s.deps[k]))) {
      s?.temizle?.()
      h.slots[i] = { deps, temizle: fn() }
    }
  },
}))

const { useWidgetVisibility } = await import('./useWidgetVisibility')

const cizim = (...a) => {
  h.i = 0
  return useWidgetVisibility(...a)
}
// Sunucu her yoklamada aynı parça için yeni nesne üretir
const parca = (id = 'a') => ({ id, name: 'Şarkı' })

beforeEach(() => {
  vi.useFakeTimers()
  h.slots = []
})
afterEach(() => vi.useRealTimers())

describe('duraklayınca gizle', () => {
  const ayar = { hideOnPause: true, hideOnPauseDelay: 5 }

  it('yoklama her saniye yeni parça nesnesi getirse de süre dolunca gizler', () => {
    cizim(parca(), false, ayar)
    for (let s = 0; s < 6; s++) {
      vi.advanceTimersByTime(1000)
      cizim(parca(), false, ayar)
    }
    expect(cizim(parca(), false, ayar)).toBe(false)
  })

  it('süre dolmadan gizlemez, çalmaya dönünce yeniden gösterir', () => {
    expect(cizim(parca(), false, ayar)).toBe(true)
    vi.advanceTimersByTime(4000)
    expect(cizim(parca(), false, ayar)).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(cizim(parca(), false, ayar)).toBe(false)
    cizim(parca(), true, ayar)
    expect(cizim(parca(), true, ayar)).toBe(true)
  })

  it('ayar kapalıyken duraklasa da görünür kalır', () => {
    cizim(parca(), false, { hideOnPause: false })
    vi.advanceTimersByTime(60_000)
    expect(cizim(parca(), false, { hideOnPause: false })).toBe(true)
  })
})

describe('yalnız şarkı değişince göster', () => {
  const ayar = { songChangeOnly: true, songChangeVisibleDuration: 3 }

  it('aynı parçanın yeni nesneleri süreyi sıfırlamaz', () => {
    cizim(parca(), true, ayar)
    for (let s = 0; s < 4; s++) {
      vi.advanceTimersByTime(1000)
      cizim(parca(), true, ayar)
    }
    expect(cizim(parca(), true, ayar)).toBe(false)
    cizim(parca('b'), true, ayar)
    expect(cizim(parca('b'), true, ayar)).toBe(true)
  })
})
