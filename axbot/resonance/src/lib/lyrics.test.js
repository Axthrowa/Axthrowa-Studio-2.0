import { describe, expect, it } from 'vitest'
import { yrcAyikla, kelimeleriTahminEt, kelimeDolumu, saatYeni, saatOku, saatOrnekle, satirSuresi, GeciciHata, _onbellegiTemizle, aramaAdaylari, baslikTemizle, enIyiEslesme, etkinSatir, lrcAyikla, sarkiBitti, sade, sozleriGetir, sureyeYay } from './lyrics'

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

describe('satirSuresi', () => {
  it('müzik arasında metin uzunluğuyla sınırlanır, sık satırda sonraki satıra kadardır', () => {
    const s = [{ time: 0, text: 'kisa' }, { time: 30, text: 'x'.repeat(50) }, { time: 32, text: 'son' }]
    expect(satirSuresi(s, 0)).toBe(1.5)
    expect(satirSuresi(s, 1)).toBe(2)
  })
})

describe('kelime zamanlı karaoke', () => {
  it('NetEase yrc satır ve kelimelerini okur, künyeyi atlar', () => {
    const s = yrcAyikla('{"t":0,"c":[{"tx":"söz"}]}\n[6190,4440](6190,210,0)Hello(6400,300,0) it(6700,250,0)\'s (me)')
    expect(s).toHaveLength(1)
    expect(s[0].time).toBe(6.19)
    expect(s[0].text).toBe("Hello it's (me)")
    expect(s[0].kelimeler.map((k) => k.m)).toEqual(['Hello', ' it', "'s (me)"])
    expect(s[0].kelimeler[1]).toMatchObject({ t: 6.4, d: 0.3 })
  })
  it('geliştirilmiş LRC kelime zamanlarını okur, düz LRC değişmez', () => {
    const [s] = lrcAyikla('[00:10.00]<00:10.00>bir <00:11.00>iki')
    expect(s.text).toBe('bir iki')
    expect(s.kelimeler.map((k) => [k.t, k.d])).toEqual([[10, 1], [11, 1.5]])
    expect(lrcAyikla('[00:10.00]bir iki')[0].kelimeler).toBeUndefined()
  })
  it('kelime tahmini satırı tam doldurur, uzun kelimeye çok süre verir', () => {
    const k = kelimeleriTahminEt('ve yaşamaktayız, sen', 4, 10)
    expect(k.map((x) => x.m).join('')).toBe('ve yaşamaktayız, sen')
    expect(k[0].t).toBe(10)
    expect(k[2].t + k[2].d).toBeCloseTo(14)
    expect(k[1].d).toBeGreaterThan(k[0].d * 2)
    expect(kelimeleriTahminEt('', 4)).toEqual([])
    expect(kelimeleriTahminEt('你好 世界', 2)).toHaveLength(2)
  })
  it('kelime dolumu', () => {
    const k = [{ t: 1, d: 1, m: 'a' }, { t: 3, d: 2, m: 'b' }]
    expect(kelimeDolumu(k, 0.5)).toEqual({ i: -1, oran: 0 })
    expect(kelimeDolumu(k, 1.5)).toEqual({ i: 0, oran: 0.5 })
    expect(kelimeDolumu(k, 2.5)).toEqual({ i: 0, oran: 1 }) // ara: önceki dolu kalır
    expect(kelimeDolumu(k, 4)).toEqual({ i: 1, oran: 0.5 })
  })
})

describe('söz saati', () => {
  it('örnekler arasını doldurur', () => {
    expect(saatOku(saatYeni(1000, 0), 200)).toBe(1200)
  })
  it('küçük farkta geri gitmez, farkı kapatır', () => {
    let s = saatYeni(1000, 0)
    s = saatOrnekle(s, 1100, 250) // saat 1250'de, örnek 150 ms geride
    expect(saatOku(s, 250)).toBe(1250)
    expect(s.hiz).toBeLessThan(1)
    let onceki = 1250
    for (let t = 300; t < 1500; t += 50) {
      const o = saatOku(s, t)
      expect(o).toBeGreaterThan(onceki)
      onceki = o
    }
    // aynı anda gerçek konum: 1100 + 1250 = 2350
    expect(Math.abs(saatOku(s, 1500) - 2350)).toBeLessThan(40)
  })
  it('büyük farkta (sarma) doğrudan atlar', () => {
    const s = saatOrnekle(saatYeni(1000, 0), 60_000, 250)
    expect(saatOku(s, 250)).toBe(60_000)
    expect(s.hiz).toBe(1)
  })
  it('örnek kesilince (duraklatma) durur, gelince sürer', () => {
    const s = saatYeni(1000, 0)
    expect(saatOku(s, 10_000)).toBe(2500)
    const d = saatOrnekle(s, 2500, 10_000)
    expect(saatOku(d, 10_100)).toBeGreaterThan(2500)
  })
})
