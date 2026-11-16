import { describe, expect, it } from 'vitest'
import { kaynakSirasi, maskeIfadesi, maskele, ofsetYaz, parcaOfseti, sozuMaskele } from './sozDenetimi'
import { _onbellegiTemizle, sozleriGetir } from './lyrics'

const parca = { name: 'Paramparça', artists: 'Teoman' }

describe('söz denetimi (R9)', () => {
  it('şarkıya özel kayma genel kaymanın önüne geçer, silinince genele döner', () => {
    const config = { lyricsOffsetMs: 500, lyricsTrackOffsets: ofsetYaz({}, 'paramparça|teoman', -300) }
    expect(parcaOfseti(config, parca)).toBe(-300)
    expect(parcaOfseti(config, { name: 'Başka', artists: '' })).toBe(500)
    expect(parcaOfseti({ ...config, lyricsTrackOffsets: ofsetYaz(config.lyricsTrackOffsets, 'paramparça|teoman', null) }, parca)).toBe(500)
    expect(parcaOfseti(config, parca)).toBe(-300)
    // sıfır da bir kayıttır (genel kayma bu şarkıda uygulanmaz)
    expect(parcaOfseti({ lyricsOffsetMs: 500, lyricsTrackOffsets: { 'paramparça|teoman': 0 } }, parca)).toBe(0)
  })

  it('kayıt sayısı sınırlı, en eskisi atılır', () => {
    let h = {}
    for (let i = 0; i < 305; i++) h = ofsetYaz(h, `p${i}`, i)
    expect(Object.keys(h)).toHaveLength(300)
    expect(h.p0).toBeUndefined()
    expect(h.p304).toBe(304)
  })

  it('kaynak sırası: bilinmeyen ad varsayılana düşer', () => {
    expect(kaynakSirasi('netease-yok')).toEqual(['lrclib', 'ovh'])
    expect(kaynakSirasi('uydurma')[0]).toBe('kelime')
  })

  it('kaynaklar seçilen sırayla sorulur, listede olmayan hiç sorulmaz', async () => {
    _onbellegiTemizle()
    const sorulan = []
    const kaynak = (ad, sonuc) => async () => (sorulan.push(ad), sonuc)
    const k = {
      kelimeSor: kaynak('kelime', null),
      lrclibSor: kaynak('lrclib', { synced: true, lines: [{ time: 0, text: 'L' }], kaynak: 'LRCLIB' }),
      neteaseSor: kaynak('netease', { synced: true, lines: [{ time: 0, text: 'N' }], kaynak: 'NetEase' }),
      ovhSor: kaynak('ovh', null),
    }
    expect((await sozleriGetir('Şarkı', 'Sanatçı', 0, k, ['netease', 'lrclib'])).kaynak).toBe('NetEase')
    sorulan.length = 0
    expect((await sozleriGetir('Şarkı', 'Sanatçı', 0, k, kaynakSirasi('netease-yok'))).kaynak).toBe('LRCLIB')
    expect(sorulan).toEqual(['lrclib'])
  })

  it('küfür maskelenir, uzunluk korunur, masum kelimeler dokunulmaz', () => {
    const i = maskeIfadesi('lanet')
    expect(maskele('Siktirip gitti, AMK ne götürdü', i)).toBe('S******* gitti, A** ne götürdü')
    expect(maskele('lanetler olsun, sikke ve sıkı', i)).toBe('l******* olsun, sikke ve sıkı')
    const [l] = sozuMaskele([{ time: 1, text: 'fuck you', kelimeler: [{ t: 1, d: 1, m: 'fuck ' }, { t: 2, d: 1, m: 'you' }] }], i)
    expect(l.text).toBe('f*** you')
    expect(l.kelimeler.map((k) => k.m).join('')).toBe('f*** you')
  })
})
