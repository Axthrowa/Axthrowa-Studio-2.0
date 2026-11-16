import { describe, expect, it } from 'vitest'
import { kurallariAyikla, sahneEylemi } from './sahneKurali'

const temalar = new Set(['pill', 'poster'])
const varMi = (id) => temalar.has(id)
const metin = 'Oyun = pill\nMola = poster\nSohbet = Gizle\nbozuk satır\n= adsız\nIntro=göster'

describe('sahne kuralları (R5)', () => {
  it('Oyun küçük, Mola büyük görünüm; Sohbet gizli; Intro her zaman görünür', () => {
    expect(sahneEylemi(metin, 'Oyun', varMi)).toEqual({ skin: 'pill' })
    expect(sahneEylemi(metin, 'mola', varMi)).toEqual({ skin: 'poster' })
    expect(sahneEylemi(metin, 'Sohbet', varMi)).toEqual({ gizle: true })
    expect(sahneEylemi(metin, 'Intro', varMi)).toEqual({ goster: true })
  })

  it('kuralsız sahne, bilinmeyen tema ve sahne yoksa dokunulmaz', () => {
    expect(sahneEylemi(metin, 'Başka', varMi)).toBeNull()
    expect(sahneEylemi('Oyun = uydurma', 'Oyun', varMi)).toBeNull()
    expect(sahneEylemi(metin, '', varMi)).toBeNull()
    expect(kurallariAyikla(metin)).toHaveLength(4)
  })
})
