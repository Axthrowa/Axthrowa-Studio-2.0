import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Cover } from './Cover'
import { COVER_SHAPES, effectiveCover, halkaDestekli, isCoverSupported } from '../../lib/coverShape'
import { translations } from '../../i18n/translations'

const ciz = (o) => renderToStaticMarkup(<Cover src="https://example.com/c.jpg" accentColor="#22d3b8" size={80} {...o} />)

describe('kapak biçimleri', () => {
  it('plakta delik var, deliksiz plakta yok; ikisi de döner', () => {
    expect(ciz({ shape: 'vinyl' })).toContain('data-delik')
    const disc = ciz({ shape: 'disc' })
    expect(disc).not.toContain('data-delik')
    expect(disc).toContain('resonance-spin')
  })

  it('duraklayınca dönüş durur', () => {
    expect(ciz({ shape: 'disc', playing: false })).toContain('animation-play-state:paused')
    expect(ciz({ shape: 'cd', playing: true })).toContain('animation-play-state:running')
  })

  it.each(COVER_SHAPES.filter((s) => s !== 'none'))('%s görselsiz de çizilir', (shape) => {
    expect(ciz({ shape, src: undefined })).toContain('<svg')
  })

  it('"yok" hiçbir şey çizmez', () => {
    expect(ciz({ shape: 'none' })).toBe('')
  })

  it('her biçimin iki dilde etiketi var', () => {
    for (const lang of ['en', 'tr']) {
      for (const s of COVER_SHAPES) expect(translations[lang].covers[s], `${lang}: ${s}`).toBeTruthy()
    }
  })
})

describe('kapak halkası', () => {
  it.each(['vinyl', 'disc', 'cd', 'circle'])('%s biçiminde açılınca ilerlemeyi gösterir', (shape) => {
    expect(ciz({ shape })).not.toContain('data-kapak-halkasi')
    const off = (progress) =>
      Number(/stroke-dashoffset="([\d.]+)"/.exec(ciz({ shape, ring: true, progress }))[1])
    expect(off(0.2)).toBeGreaterThan(off(0.7))
    expect(off(1)).toBe(0)
  })

  it('kendi halkası olan oynatıcıda ve yuvarlak olmayan kapakta sunulmaz', () => {
    expect(halkaDestekli('compact', 'vinyl')).toBe(true)
    expect(halkaDestekli('compact', 'disc')).toBe(true)
    expect(halkaDestekli('turntable', 'cd')).toBe(true)
    expect(halkaDestekli('ring', 'vinyl')).toBe(false)
    expect(halkaDestekli('compact', 'square')).toBe(false)
    expect(halkaDestekli('compact', 'none')).toBe(false)
  })
})

describe('oynatıcı başına destek', () => {
  it('plak destekleyen her oynatıcı deliksiz plağı da destekler', () => {
    for (const skin of ['compact', 'shell', 'discord', 'gallery', 'ring', 'turntable', 'pill', 'lcd']) {
      expect(isCoverSupported(skin, 'vinyl'), skin).toBe(true)
      expect(isCoverSupported(skin, 'disc'), skin).toBe(true)
    }
  })

  it('desteklemeyen oynatıcı seçimi sessizce çizilebilir biçime indirir', () => {
    expect(effectiveCover('turntable', 'polaroid')).toBe('vinyl')
    expect(effectiveCover('albumfocus', 'disc')).toBe('square')
  })
})
