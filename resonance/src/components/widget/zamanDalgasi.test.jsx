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

describe('süre satırının sağındaki dalga', async () => {
  const { sagDalga } = await import('./skins')
  it('süreler arasında dalga varken gizli, dalga kapalıyken ya da süre yokken görünür', () => {
    expect(sagDalga({}, 200000)).toBe(false)
    expect(sagDalga({ timeWave: false }, 200000)).toBe(true)
    expect(sagDalga({}, 0)).toBe(true)
    expect(sagDalga({ hideVisualizer: true, timeWave: false }, 200000)).toBe(false)
  })
})
