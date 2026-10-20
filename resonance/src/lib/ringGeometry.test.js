import { describe, expect, it } from 'vitest'
import { clamp01, ringDash, ringHead, ringHeadOnScreen } from './ringGeometry'

const CX = 42
const R = 39.5

describe('ringHeadOnScreen', () => {
  it('başlangıçta tepe noktasında (saat 12)', () => {
    const p = ringHeadOnScreen(CX, R, 0)
    expect(p.x).toBeCloseTo(CX)
    expect(p.y).toBeCloseTo(CX - R)
  })
  it('çeyrekte sağda (saat 3), yarıda altta (saat 6), üç çeyrekte solda (saat 9)', () => {
    const q = ringHeadOnScreen(CX, R, 0.25)
    expect(q.x).toBeCloseTo(CX + R)
    expect(q.y).toBeCloseTo(CX)
    const h = ringHeadOnScreen(CX, R, 0.5)
    expect(h.x).toBeCloseTo(CX)
    expect(h.y).toBeCloseTo(CX + R)
    const t = ringHeadOnScreen(CX, R, 0.75)
    expect(t.x).toBeCloseTo(CX - R)
    expect(t.y).toBeCloseTo(CX)
  })
})

describe('işaret dolgunun ucunda', () => {
  it('döndürülmüş gruptaki koordinat, -90° döndürülünce ekrandaki konumla aynı', () => {
    // Grup `rotate(-90 cx cx)`: (x,y) → ekranda saat yönünün tersine 90° dönmüş nokta.
    const rot = (p) => {
      const dx = p.x - CX
      const dy = p.y - CX
      // -90°: (dx,dy) → (dy, -dx)
      return { x: CX + dy, y: CX - dx }
    }
    for (const pr of [0.1, 0.25, 0.5, 0.8]) {
      const inGroup = ringHead(CX, R, pr)
      const screen = ringHeadOnScreen(CX, R, pr)
      const r = rot(inGroup)
      expect(r.x).toBeCloseTo(screen.x)
      expect(r.y).toBeCloseTo(screen.y)
    }
  })

  it('dolgu yayının bittiği yerle nokta çakışır (eski hata: 90° öndeydi)', () => {
    // Dolgu: dashoffset = circ*(1-p) → yay uzunluğu = circ*p, tepe noktasından başlar.
    const p = 0.4
    const { circ, offset } = ringDash(R, p)
    const arcLen = circ - offset
    const arcAngle = (arcLen / circ) * 2 * Math.PI // tepeden itibaren saat yönünde
    const arcEnd = { x: CX + R * Math.sin(arcAngle), y: CX - R * Math.cos(arcAngle) }
    const head = ringHeadOnScreen(CX, R, p)
    expect(head.x).toBeCloseTo(arcEnd.x)
    expect(head.y).toBeCloseTo(arcEnd.y)
    // Eski (hatalı) konum: döndürülmemiş cos/sin — gerçekten farklı olduğunu kanıtla
    const eski = { x: CX + R * Math.cos(2 * Math.PI * p), y: CX + R * Math.sin(2 * Math.PI * p) }
    expect(Math.hypot(eski.x - arcEnd.x, eski.y - arcEnd.y)).toBeGreaterThan(20)
  })
})

describe('ringDash / clamp01', () => {
  it('ilerleme arttıkça offset azalır, sınırlar taşmaz', () => {
    expect(ringDash(R, 0).offset).toBeCloseTo(2 * Math.PI * R)
    expect(ringDash(R, 1).offset).toBe(0)
    expect(ringDash(R, 9).offset).toBe(0)
    expect(ringDash(R, -3).offset).toBeCloseTo(2 * Math.PI * R)
    expect(ringDash(R, 0.2).offset).toBeGreaterThan(ringDash(R, 0.6).offset)
  })
  it('geçersiz değerler 0', () => {
    expect(clamp01(NaN)).toBe(0)
    expect(clamp01('x')).toBe(0)
    expect(clamp01(0.5)).toBe(0.5)
  })
})
