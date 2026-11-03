import { describe, expect, it } from 'vitest'
import { GeciciHata, _onbellegiTemizle, aramaAdaylari, baslikTemizle, enIyiEslesme, etkinSatir, lrcAyikla, sarkiBitti, sade, satirOrani, sozleriGetir, sureyeYay } from './lyrics'

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
  it('süre dolunca sözler biter', () => {
    const parca = { durationMs: 10_000 }
    expect(sarkiBitti(parca, 9_000)).toBe(false)
    expect(sarkiBitti(parca, 9_800)).toBe(true)
    expect(sarkiBitti(null, 9_800)).toBe(false)
  })
  it('başlık gürültüsünü atar', () => {
    expect(baslikTemizle('Paramparça (Official Video) [4K]')).toBe('Paramparça')
    expect(baslikTemizle('Song - 2011 Remaster')).toBe('Song')
  })
  it('"Sanatçı - Şarkı" başlığından aday üretir, çoklu sanatçıyı ayırır', () => {
    const a = aramaAdaylari('Tarkan - Şımarık (Official Video)', 'Kanal')
    expect(a.some((x) => x.baslik === 'Şımarık' && x.sanatci === 'Tarkan')).toBe(true)
    expect(aramaAdaylari('Song', 'A & B, C')[0].sanatci).toBe('A')
  })
  it('Türkçe karakter ve büyük harf farkını saymaz', () => {
    expect(sade('Şımarık!')).toBe(sade('simarik'))
    expect(sade('IŞIK')).toBe(sade('ışık'))
  })
  it('eşleşme: başlık ve sanatçı tutmalı, süresi çok farklıysa kayıt reddedilir', () => {
    const k = [{ ad: 'Firuze', sanatci: 'RAZE23', sureMs: 200000 }, { ad: 'Firuze', sanatci: 'Sezen Aksu', sureMs: 250000 }]
    expect(enIyiEslesme(k, { baslik: 'Firuze', sanatci: 'Sezen Aksu' }, 251000)?.sanatci).toBe('Sezen Aksu')
    expect(enIyiEslesme(k, { baslik: 'Firuze', sanatci: 'Sezen Aksu' }, 100000)).toBeNull()
    expect(enIyiEslesme(k, { baslik: 'Başka', sanatci: 'Sezen Aksu' }, 0)).toBeNull()
  })
  it('düz sözü süreye yayar, karaoke oranı 0-1 arasında kalır', () => {
    const s = sureyeYay('a\n\nb', 100000)
    expect(s.map((x) => x.text)).toEqual(['a', 'b'])
    expect(s[1].time).toBeGreaterThan(s[0].time)
    expect(s[1].time).toBeLessThan(100)
    expect(satirOrani(s, 0, s[0].time)).toBe(0)
    expect(satirOrani(s, 0, 999)).toBe(1)
    expect(satirOrani(s, -1, 1)).toBe(0)
  })
  it('kaynak sırası: zamanlı olan düz metinden önce, geçici hatada önbelleğe yazılmaz', async () => {
    _onbellegiTemizle()
    const zamanli = { synced: true, tahmini: false, lines: [{ time: 1, text: 'x' }], kaynak: 'NetEase' }
    let lrclib = 0
    const s = await sozleriGetir('Bir', 'Ben', 0, {
      lrclibSor: async () => { lrclib++; throw new GeciciHata('503') },
      neteaseSor: async () => zamanli,
      ovhSor: async () => ({ duz: 'y', kaynak: 'Lyrics.ovh' }),
    })
    expect(s.kaynak).toBe('NetEase')
    expect(lrclib).toBe(1)
    const bos = { lrclibSor: async () => { throw new GeciciHata('503') }, neteaseSor: async () => null, ovhSor: async () => null }
    expect((await sozleriGetir('Iki', 'Ben', 0, bos)).lines).toEqual([])
    const sonra = await sozleriGetir('Iki', 'Ben', 0, { ...bos, ovhSor: async () => ({ duz: 'y\nz', kaynak: 'Lyrics.ovh' }) })
    expect(sonra.tahmini).toBe(true)
    expect(sonra.lines.length).toBe(2)
  })
})
