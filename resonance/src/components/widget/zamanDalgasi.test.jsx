import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GorunumBaglami, ProgressBar } from './skinParts'

const ciz = (g) => renderToStaticMarkup(
  <GorunumBaglami.Provider value={g}><ProgressBar progress={0.3} progressMs={60000} durationMs={200000} color="#22d3ee" /></GorunumBaglami.Provider>,
)

describe('süreler arasındaki ses dalgası', () => {
  it('açıkken iki süre arasında çizilir, kapalıyken yok', () => {
    expect(ciz({ zamanDalgasi: true, oynuyor: true })).toContain('data-zaman-dalgasi')
    expect(ciz({ zamanDalgasi: false })).not.toContain('data-zaman-dalgasi')
  })
})
