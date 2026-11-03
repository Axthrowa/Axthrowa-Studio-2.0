import { describe, expect, it } from 'vitest'
import { baskinRenk } from './baskinRenk'

const pikseller = (...parcalar) => parcalar.flatMap(([renk, adet]) => Array.from({ length: adet }, () => [...renk, 255])).flat()

describe('baskinRenk', () => {
  it('griler çoğunlukta olsa da kapağın rengini bulur', () => {
    expect(baskinRenk(pikseller([[120, 120, 120], 80], [[220, 30, 30], 20]))).toBe('#dc1e1e')
  })

  it('en güçlü tonu seçer, ötekilerle karıştırmaz', () => {
    expect(baskinRenk(pikseller([[30, 200, 60], 60], [[220, 30, 30], 20]))).toBe('#1ec83c')
  })

  it('koyu kapağın rengi görünür parlaklığa çekilir', () => {
    expect(baskinRenk(pikseller([[80, 10, 10], 50]))).toBe('#aa1515')
  })

  it('gri kapakta düz ortalamaya döner, renk uydurmaz', () => {
    expect(baskinRenk(pikseller([[100, 100, 100], 99], [[255, 0, 0], 1]))).toBe('#666363')
  })

  it('saydam ya da boş görselde sonuç yok', () => {
    expect(baskinRenk([10, 20, 30, 0])).toBeNull()
    expect(baskinRenk([])).toBeNull()
  })
})
