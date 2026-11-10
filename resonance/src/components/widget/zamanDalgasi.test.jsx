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
  it('süre satırı varken hiç görünmez (aradaki dalga kapalı olsa da), yalnız süre yokken görünür', () => {
    expect(sagDalga({}, 200000)).toBe(false)
    expect(sagDalga({ timeWave: false }, 200000)).toBe(false)
    expect(sagDalga({}, 0)).toBe(true)
    expect(sagDalga({ hideVisualizer: true, timeWave: false }, 200000)).toBe(false)
  })
})

describe('müzik seviyesi (OBS ölçerleri)', async () => {
  const { muzikSeviyesi, dbOrani } = await import('../../hooks/useMuzikSeviyesi')
  it('müzik adlı girişi seçer, mikrofonu saymaz, sessizlikte null', () => {
    expect(dbOrani(-50)).toBe(0)
    expect(dbOrani(0)).toBe(1)
    expect(muzikSeviyesi([{ name: 'Mic/Aux', peakDb: -5 }, { name: 'Müzik', peakDb: -25 }])).toBeCloseTo(0.5)
    expect(muzikSeviyesi([{ name: 'Mic/Aux', peakDb: -5 }, { name: 'Oyun', peakDb: -10 }])).toBeCloseTo(0.8)
    expect(muzikSeviyesi([{ name: 'Müzik', peakDb: -100 }])).toBeNull()
    expect(muzikSeviyesi([])).toBeNull()
  })
})

describe('geçen ve kalan süre', async () => {
  const { gecenSn, kalanSn } = await import('./skinParts')
  it('aynı anda değişir ve toplamı tutar', () => {
    const sure = 149232
    for (let ms = 0; ms <= sure; ms += 250) expect(gecenSn(ms) + kalanSn(ms, sure)).toBe(149)
    expect(kalanSn(1999, sure) - kalanSn(2000, sure)).toBe(1)
    expect(kalanSn(sure + 5000, sure)).toBe(0)
  })
})
