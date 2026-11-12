import { describe, expect, it } from 'vitest'
import { studioTemasiCoz } from './studioTemasi'

describe('studioTemasiCoz', () => {
  it('Studio renklerini Resonance değişkenlerine çevirir, bozuk değeri atlar', () => {
    const t = studioTemasiCoz({
      tur: 'studio-tema',
      degiskenler: { '--axt-zemin': '#101010', '--axt-vurgu': 'rgb(1, 2, 3)', '--axt-metin': 'red;x:url(a)' },
    })
    expect(t).toEqual({ '--color-bg': '#101010', '--color-accent': 'rgb(1, 2, 3)' })
  })

  it('köşe ve başlık ölçülerini ortak adla geçirir, bozuk ölçüyü atlar (T1)', () => {
    const t = studioTemasiCoz({
      tur: 'studio-tema',
      degiskenler: { '--axt-yaricap-kart': '0.25rem', '--axt-yazi-baslik': '1.5rem', '--axt-yaricap-dugme': '.75rem', '--axt-yazi-govde': 'calc(1px)' },
    })
    expect(t).toEqual({ '--axt-yaricap-kart': '0.25rem', '--axt-yaricap-dugme': '.75rem', '--axt-yazi-baslik': '1.5rem' })
  })

  it('başka iletiyi yok sayar', () => {
    expect(studioTemasiCoz({ tur: 'baska' })).toBeNull()
    expect(studioTemasiCoz(null)).toBeNull()
  })
})
