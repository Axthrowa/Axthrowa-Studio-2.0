import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SKIN_REGISTRY, getSkin } from './skins'
import { SKIN_COVER_SUPPORT } from '../../lib/coverShape'
import { translations } from '../../i18n/translations'
import { pauseHideDelayMs, MIN_PAUSE_HIDE_MS } from '../../hooks/useWidgetVisibility'
import { sidebarPositionClasses } from '../layout/Sidebar'

const TRACK = {
  id: 't1',
  name: 'Test Şarkısı',
  artists: 'Test Sanatçı',
  album: 'Test Albüm',
  cover: 'https://example.com/c.jpg',
  durationMs: 200000,
}

function props(id, over = {}) {
  return {
    skin: id,
    track: TRACK,
    isPlaying: true,
    progress: 0.4,
    progressMs: 80000,
    durationMs: 200000,
    config: { hideVisualizer: false, coverGlow: false, coverBlur: false },
    accent: '#22d3b8',
    shellBg: 'rgba(15,16,21,0.88)',
    textColor: '#ffffff',
    mutedColor: 'rgba(255,255,255,0.6)',
    theme: 'dark',
    coverProps: { src: TRACK.cover, shape: 'square', radius: 8, glow: false, playing: true, accentColor: '#22d3b8' },
    blurProps: { blur: false, coverSrc: TRACK.cover },
    ...over,
  }
}

describe('SKIN_REGISTRY bütünlüğü', () => {
  it('kimlikler benzersiz', () => {
    const ids = SKIN_REGISTRY.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('her skinin bileşeni, önizlemesi ve kapak destek satırı var', () => {
    for (const s of SKIN_REGISTRY) {
      expect(typeof s.Component, s.id).toBe('function')
      expect(typeof s.Preview, s.id).toBe('function')
      expect(SKIN_COVER_SUPPORT[s.id], `${s.id} SKIN_COVER_SUPPORT'ta yok`).toBeDefined()
    }
  })

  it('kapak destek tablosunda kayıtsız artık skin yok', () => {
    const ids = new Set(SKIN_REGISTRY.map((s) => s.id))
    for (const k of Object.keys(SKIN_COVER_SUPPORT)) {
      expect(ids.has(k), `${k} tabloda ama kayıt defterinde yok`).toBe(true)
    }
  })

  it('her skinin iki dilde etiketi var', () => {
    for (const lang of ['en', 'tr']) {
      for (const s of SKIN_REGISTRY) {
        expect(translations[lang].skins[s.id], `${lang}: skins.${s.id}`).toBeTruthy()
      }
    }
  })

  it("'canvas' çevirileri kaldırılmış, yeni anahtarlar iki dilde var", () => {
    for (const lang of ['en', 'tr']) {
      expect(translations[lang].covers.canvas, lang).toBeUndefined()
      expect(translations[lang].pulse.cornerRadius, lang).toBeTruthy()
      expect(translations[lang].pulse.coverUnsupported, lang).toBeTruthy()
    }
  })

  it('yeni skinler kayıtlı ve "yeni" etiketli', () => {
    for (const id of ['clear', 'ring', 'aurora', 'edge', 'turntable', 'cassette']) {
      expect(getSkin(id).id).toBe(id)
      expect(SKIN_REGISTRY.find((s) => s.id === id).isNew).toBe(true)
    }
  })

  it('bilinmeyen skin varsayılana (compact) düşer', () => {
    expect(getSkin('silinmis-skin').id).toBe('compact')
    expect(getSkin(undefined).id).toBe('compact')
  })
})

describe('skinler çizilebiliyor', () => {
  it('pikapta iğne yalnız çalarken plağın üstünde', () => {
    const { Component } = getSkin('turntable')
    expect(renderToStaticMarkup(<Component {...props('turntable')} />)).toContain('data-igne="plakta"')
    expect(renderToStaticMarkup(<Component {...props('turntable', { isPlaying: false })} />)).toContain('data-igne="kalkik"')
  })

  it.each(SKIN_REGISTRY.map((s) => s.id))('%s parça adını ve sanatçıyı yazar', (id) => {
    const { Component } = getSkin(id)
    const html = renderToStaticMarkup(<Component {...props(id)} />)
    expect(html).toContain('Test Şarkısı')
    expect(html).toContain('Test Sanatçı')
  })

  it.each(SKIN_REGISTRY.map((s) => s.id))('%s parçasız yer tutucu ile de çöker mi', (id) => {
    const { Component } = getSkin(id)
    const track = { id: 'nothing-playing', name: 'Nothing Playing', artists: '', album: '', durationMs: 0 }
    const html = renderToStaticMarkup(
      <Component {...props(id, { track, progress: 0, progressMs: 0, durationMs: 0, isPlaying: false })} />,
    )
    expect(html).toContain('Nothing Playing')
  })

  it('halka skini ilerlemeyi dash offset olarak yazar', () => {
    const { Component } = getSkin('ring')
    const yarim = renderToStaticMarkup(<Component {...props('ring', { progress: 0.5 })} />)
    const bos = renderToStaticMarkup(<Component {...props('ring', { progress: 0 })} />)
    const off = (h) => Number(/stroke-dashoffset:\s*([\d.]+)/.exec(h)?.[1] ?? /stroke-dashoffset="([\d.]+)"/.exec(h)?.[1])
    expect(off(bos)).toBeGreaterThan(off(yarim))
    expect(off(yarim)).toBeGreaterThan(0)
  })

  it('halka ilerlemesi 0-1 dışına taşmaz', () => {
    const { Component } = getSkin('ring')
    const taşkın = renderToStaticMarkup(<Component {...props('ring', { progress: 7 })} />)
    expect(taşkın).not.toMatch(/stroke-dashoffset[:=]"?-/)
  })

  it('şeffaf skinin kabuğu (arka planı) yok', () => {
    const { Component } = getSkin('clear')
    const html = renderToStaticMarkup(<Component {...props('clear')} />)
    expect(html).not.toContain('rounded-xl border')
    expect(html).not.toContain('backdrop-blur')
  })

  it('kenarlık skini vurgu rengini çerçeveye yazar', () => {
    const { Component } = getSkin('edge')
    const html = renderToStaticMarkup(<Component {...props('edge', { accent: '#ff5500' })} />)
    expect(html.toLowerCase()).toContain('#ff5500')
  })

  it('gradyan cam skini vurgu renginden degrade türetir (color-mix kullanmaz)', () => {
    const { Component } = getSkin('aurora')
    const html = renderToStaticMarkup(<Component {...props('aurora', { accent: '#ff5500' })} />)
    expect(html).toContain('rgba(255, 85, 0')
    expect(html).not.toContain('color-mix')
  })
})

describe('halka skini', () => {
  const { Component } = getSkin('ring')

  it('Plak seçiliyse dönen plak çizer, Kare seçiliyse yuvarlak fotoğraf', () => {
    const plak = renderToStaticMarkup(
      <Component {...props('ring', { coverProps: { ...props('ring').coverProps, shape: 'vinyl' } })} />,
    )
    expect(plak).toContain('resonance-spin')
    const kare = renderToStaticMarkup(<Component {...props('ring')} />)
    expect(kare).not.toContain('resonance-spin')
    expect(kare).toContain('rounded-full')
  })

  it('ilerleme arttıkça dash offset azalır (halka gerçekten ilerler)', () => {
    const off = (pr) =>
      Number(/stroke-dashoffset="([\d.]+)"/.exec(renderToStaticMarkup(<Component {...props('ring', { progress: pr })} />))?.[1])
    expect(off(0.1)).toBeGreaterThan(off(0.4))
    expect(off(0.4)).toBeGreaterThan(off(0.9))
    expect(off(1)).toBe(0)
  })

  it('ilerleme ucunda işaret noktası çizer, başta ve sonda çizmez', () => {
    const dot = (pr) =>
      (renderToStaticMarkup(<Component {...props('ring', { progress: pr })} />).match(/<circle/g) || []).length
    expect(dot(0.5)).toBe(3)
    expect(dot(0)).toBe(2)
    expect(dot(1)).toBe(2)
  })
})

describe('arka planı gizle ve parlama', () => {
  it('bare açıkken kabuk data-bare işaretini taşır, kapalıyken taşımaz', () => {
    const { Component } = getSkin('compact')
    const bare = renderToStaticMarkup(
      <Component {...props('compact', { blurProps: { blur: false, coverSrc: TRACK.cover, bare: true } })} />,
    )
    expect(bare).toContain('data-bare="1"')
    expect(renderToStaticMarkup(<Component {...props('compact')} />)).not.toContain('data-bare')
  })

  it('bare açıkken bulanık kapak katmanı hiç çizilmez', () => {
    const { Component } = getSkin('compact')
    const html = renderToStaticMarkup(
      <Component {...props('compact', { blurProps: { blur: true, coverSrc: TRACK.cover, bare: true } })} />,
    )
    expect(html).not.toContain('blur-2xl')
  })

  it('kenarlık skini gizli arka planda çerçevesini korur', () => {
    const { Component } = getSkin('edge')
    const html = renderToStaticMarkup(
      <Component {...props('edge', { blurProps: { blur: false, coverSrc: TRACK.cover, bare: true } })} />,
    )
    expect(html).toContain('data-keep-border="1"')
  })

  it('parlama açıkken kart kapağın parlamasını kırpmaz, kapalıyken kırpar', () => {
    const { Component } = getSkin('compact')
    const acik = renderToStaticMarkup(
      <Component {...props('compact', { blurProps: { blur: false, coverSrc: TRACK.cover, allowGlow: true } })} />,
    )
    const kapali = renderToStaticMarkup(<Component {...props('compact')} />)
    expect(acik).not.toContain('overflow-hidden')
    expect(kapali).toContain('overflow-hidden')
  })

  it('galeri skini parlama açık olsa da kırpar (kapak kart köşelerine taşmasın)', () => {
    const { Component } = getSkin('gallery')
    const html = renderToStaticMarkup(
      <Component {...props('gallery', { blurProps: { blur: false, coverSrc: TRACK.cover, allowGlow: true } })} />,
    )
    expect(html).toContain('overflow-hidden')
  })

  it('kare kapakta köşe yarıçapı ve parlama gerçekten stile yazılır', () => {
    const { Component } = getSkin('compact')
    const html = renderToStaticMarkup(
      <Component
        {...props('compact', {
          coverProps: { src: TRACK.cover, shape: 'square', radius: 20, glow: true, playing: true, accentColor: '#ff0000' },
        })}
      />,
    )
    expect(html).toContain('border-radius:20px')
    expect(html).toContain('box-shadow:0 0 14px 2px #ff0000')
  })
})

describe('yan panel ve duraklama', () => {
  it('yan panel geniş ekranda kapalıyken akıştan çıkar, açıkken sticky olur', () => {
    expect(sidebarPositionClasses(true)).toContain('lg:sticky')
    expect(sidebarPositionClasses(true)).not.toContain('-translate-x-full')
    expect(sidebarPositionClasses(false)).toContain('-translate-x-full')
    expect(sidebarPositionClasses(false)).toContain('lg:fixed')
    expect(sidebarPositionClasses(false)).not.toContain('lg:sticky')
  })

  it('duraklamada gizleme gecikmesi 0 verilse bile en az bekleme uygulanır', () => {
    expect(pauseHideDelayMs({ hideOnPauseDelay: 0 })).toBe(MIN_PAUSE_HIDE_MS)
    expect(pauseHideDelayMs({})).toBe(MIN_PAUSE_HIDE_MS)
    expect(pauseHideDelayMs({ hideOnPauseDelay: 5 })).toBe(5000)
    expect(pauseHideDelayMs(undefined)).toBe(MIN_PAUSE_HIDE_MS)
  })
})
