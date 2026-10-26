import { describe, expect, it } from 'vitest'
import { baslikTemizle, etkinSatir, lrcAyikla } from './lyrics'

describe('şarkı sözleri', () => {
  it('LRC zamanlarını sıralı satırlara çevirir', () => {
    const s = lrcAyikla('[00:12.50]ikinci\n[00:03.00]ilk\n[00:20.00][00:40.00]nakarat')
    expect(s.map((x) => x.text)).toEqual(['ilk', 'ikinci', 'nakarat', 'nakarat'])
    expect(s[1].time).toBe(12.5)
  })
  it('konuma göre etkin satır', () => {
    const s = lrcAyikla('[00:03.00]a\n[00:12.00]b')
    expect(etkinSatir(s, 1)).toBe(-1)
    expect(etkinSatir(s, 5)).toBe(0)
    expect(etkinSatir(s, 99)).toBe(1)
  })
  it('başlık gürültüsünü atar', () => {
    expect(baslikTemizle('Paramparça (Official Video) [4K]')).toBe('Paramparça')
  })
})
