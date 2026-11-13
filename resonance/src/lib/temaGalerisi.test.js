import { describe, expect, it } from 'vitest'
import { SKIN_REGISTRY } from '../components/widget/skins'
import { TEMA_BOYUT, ayarlariDisaAktar, ayarlariIceAl, favoriDegistir, temaEtiketleri, temalariSuz } from './temaGalerisi'

// ConfigContext tarayıcı ister; varsayılanın biçimi yeter
const DEFAULT_CONFIG = { musicService: 'spotify', skin: 'compact', hideOnPause: false, lyricsTrackOffsets: {} }
const secenekler = SKIN_REGISTRY.map((s) => ({ value: s.id, label: s.id }))

describe('görünüm galerisi (R8)', () => {
  it('27 temanın hepsinin ölçüsü ve en az bir etiketi var', () => {
    expect(SKIN_REGISTRY).toHaveLength(27)
    for (const s of SKIN_REGISTRY) {
      expect(TEMA_BOYUT[s.id], s.id).toBeTruthy()
      expect(temaEtiketleri(s.id).length, s.id).toBeGreaterThan(0)
    }
  })

  it('"dikey" yalnız dar ya da dikey temaları listeler', () => {
    const dikey = temalariSuz(secenekler, { etiket: 'dikey' }).map((s) => s.value)
    expect(dikey).toContain('poster')
    expect(dikey).toContain('sidebar')
    expect(dikey).not.toContain('strip')
    expect(dikey).not.toContain('wave')
    for (const id of dikey) {
      const [g, y] = TEMA_BOYUT[id]
      expect(g <= 320 || y > g, id).toBe(true)
    }
  })

  it('arama etiketlerde de bakar, sık kullanılanlar başa gelir', () => {
    expect(temalariSuz(secenekler, { arama: 'retro' }).map((s) => s.value)).toContain('cassette')
    const fav = favoriDegistir([], 'ticket')
    expect(temalariSuz(secenekler, { favoriler: fav })[0].value).toBe('ticket')
    expect(temalariSuz(secenekler, { favoriler: fav, yalnizFavori: true })).toHaveLength(1)
    expect(favoriDegistir(fav, 'ticket')).toEqual([])
  })

  it('dışa aktarılan ayar geri alınır; yabancı ve türü yanlış alanlar atılır', () => {
    const metin = ayarlariDisaAktar({ ...DEFAULT_CONFIG, skin: 'poster', musicService: 'youtube-music' }, DEFAULT_CONFIG)
    expect(metin).not.toContain('musicService')
    expect(ayarlariIceAl(metin, DEFAULT_CONFIG).skin).toBe('poster')
    const yama = ayarlariIceAl(JSON.stringify({ resonance: 1, ayarlar: { skin: 'pill', hideOnPause: 'evet', uydurma: 1 } }), DEFAULT_CONFIG)
    expect(yama).toEqual({ skin: 'pill' })
    expect(() => ayarlariIceAl('{bozuk', DEFAULT_CONFIG)).toThrow('JSON')
    expect(() => ayarlariIceAl('{"ayarlar":{}}', DEFAULT_CONFIG)).toThrow('Resonance')
  })
})
