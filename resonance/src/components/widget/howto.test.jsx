import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HOWTO, HowToUse, howToFor } from './HowToUse'

describe('Resonance rehberi', () => {
  it('iki dilde de aynı sayıda adım ve sorun giderme maddesi var', () => {
    expect(HOWTO.tr.steps.length).toBe(HOWTO.en.steps.length)
    expect(HOWTO.tr.troubleshoot.length).toBe(HOWTO.en.troubleshoot.length)
    for (const lang of ['tr', 'en']) {
      for (const s of HOWTO[lang].steps) {
        expect(s.title.length, `${lang} başlık`).toBeGreaterThan(3)
        expect(s.body.length, `${lang} gövde`).toBeGreaterThan(20)
      }
    }
  })

  it('bilinmeyen dil İngilizceye düşer', () => {
    expect(howToFor('de')).toBe(HOWTO.en)
  })

  it('kapalıyken hiçbir şey çizmez', () => {
    expect(renderToStaticMarkup(<HowToUse open={false} onClose={() => {}} />)).toBe('')
  })

  it('açıkken başlığı, adımları ve OBS adresini gösterir', () => {
    const html = renderToStaticMarkup(
      <HowToUse open onClose={() => {}} language="tr" obsUrl="http://127.0.0.1:8843/resonance/overlay" />,
    )
    expect(html).toContain('Resonance nasıl kullanılır?')
    expect(html).toContain('http://127.0.0.1:8843/resonance/overlay')
    expect(html).toContain('role="dialog"')
    for (const s of HOWTO.tr.steps) expect(html).toContain(s.title.replace("'", '&#x27;'))
  })

  it('OBS adresi verilmezse adres kutusu çizilmez', () => {
    expect(renderToStaticMarkup(<HowToUse open onClose={() => {}} language="tr" />)).not.toContain('break-all font-mono')
  })
})
