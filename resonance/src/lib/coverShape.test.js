import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CORNER_RADIUS,
  MAX_CORNER_RADIUS,
  SKIN_COVER_SUPPORT,
  clampRadius,
  effectiveCover,
  isCoverSupported,
  migrateCoverConfig,
  normalizeCoverShape,
  resolveRadius,
} from './coverShape'

describe('normalizeCoverShape', () => {
  it("eski 'canvas' kareye iner", () => {
    expect(normalizeCoverShape('canvas')).toBe('square')
  })
  it('geçerli değerleri korur, bilinmeyeni kareye düşürür', () => {
    expect(normalizeCoverShape('vinyl')).toBe('vinyl')
    expect(normalizeCoverShape('none')).toBe('none')
    expect(normalizeCoverShape('kare')).toBe('square')
    expect(normalizeCoverShape(undefined)).toBe('square')
  })
})

describe('köşe yarıçapı', () => {
  it("eski 'canvas' profili 12px ile görünüm değiştirmeden taşınır", () => {
    expect(resolveRadius({ cover: 'canvas' })).toBe(12)
    expect(migrateCoverConfig({ cover: 'canvas', font: 'Inter' })).toEqual({
      cover: 'square',
      coverRadius: 12,
      font: 'Inter',
    })
  })
  it('kullanıcı yarıçap seçtiyse göç onu ezmez', () => {
    expect(migrateCoverConfig({ cover: 'canvas', coverRadius: 4 }).coverRadius).toBe(4)
  })
  it('yazılmamışsa varsayılan 8', () => {
    expect(resolveRadius({ cover: 'square' })).toBe(DEFAULT_CORNER_RADIUS)
    expect(resolveRadius({})).toBe(DEFAULT_CORNER_RADIUS)
    expect(resolveRadius(undefined)).toBe(DEFAULT_CORNER_RADIUS)
  })
  it('0 geçerli bir seçim (keskin köşe), varsayılana dönmez', () => {
    expect(resolveRadius({ coverRadius: 0 })).toBe(0)
  })
  it('sınırlara sıkıştırır, saçma değerde varsayılana döner', () => {
    expect(clampRadius(999)).toBe(MAX_CORNER_RADIUS)
    expect(clampRadius(-5)).toBe(0)
    expect(clampRadius('abc')).toBe(DEFAULT_CORNER_RADIUS)
    expect(clampRadius(7.6)).toBe(8)
  })
  it("'canvas' olmayan yapılandırmaya dokunmaz", () => {
    const cfg = { cover: 'vinyl' }
    expect(migrateCoverConfig(cfg)).toBe(cfg)
    expect(migrateCoverConfig(null)).toBeNull()
  })
})

describe('skin başına kapak desteği', () => {
  it('shell kareyi plağa çevirir (eski davranış korunur), "yok"u korur', () => {
    expect(effectiveCover('shell', 'square')).toBe('vinyl')
    expect(effectiveCover('shell', 'none')).toBe('none')
    expect(isCoverSupported('shell', 'square')).toBe(false)
  })
  it('discord ve gallery "yok"u kareye çevirir', () => {
    expect(effectiveCover('discord', 'none')).toBe('square')
    expect(effectiveCover('gallery', 'none')).toBe('square')
    expect(isCoverSupported('gallery', 'none')).toBe(false)
  })
  it('her şeyi destekleyen skinlerde seçim aynen geçer', () => {
    for (const skin of ['compact', 'boxy', 'macos', 'clear', 'aurora', 'edge']) {
      for (const shape of ['square', 'vinyl', 'none']) {
        expect(effectiveCover(skin, shape), `${skin}/${shape}`).toBe(shape)
      }
    }
  })
  it('eski canvas değeri de destek kontrolünden kare olarak geçer', () => {
    expect(isCoverSupported('compact', 'canvas')).toBe(true)
    expect(effectiveCover('compact', 'canvas')).toBe('square')
  })
  it('kapak kullanmayan skin (minimal) boş listeye sahip', () => {
    expect(SKIN_COVER_SUPPORT.minimal).toEqual([])
  })
  it('halka skini kare (yuvarlak fotoğraf) ve plağı destekler, "yok"u kareye çevirir', () => {
    expect(SKIN_COVER_SUPPORT.ring).toEqual(['square', 'vinyl'])
    expect(effectiveCover('ring', 'vinyl')).toBe('vinyl')
    expect(effectiveCover('ring', 'square')).toBe('square')
    expect(effectiveCover('ring', 'none')).toBe('square')
    expect(isCoverSupported('ring', 'none')).toBe(false)
  })
  it('bilinmeyen skin compact gibi davranır', () => {
    expect(isCoverSupported('yok-boyle-skin', 'vinyl')).toBe(true)
  })
})
