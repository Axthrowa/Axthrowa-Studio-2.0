import { useEffect, useMemo, useRef } from 'react'
import { useLyrics } from '../../hooks/useLyrics'
import { kelimeDolumu, kelimeleriTahminEt, saatOku, satirSuresi } from '../../lib/lyrics'

/** Söz görünümleri. `kutu`: çevreleyen alan; `etkin`: şu anki satır; `yan`: önceki/sonraki satır */
export const SOZ_TEMALARI = {
  klasik: {
    ad: 'Klasik',
    stil: (v) => ({ kutu: { textShadow: '0 2px 8px rgba(0,0,0,.65)' }, etkin: { fontWeight: 700, borderBottom: `2px solid ${v}` }, yan: { opacity: 0.55 } }),
  },
  sade: {
    ad: 'Sade',
    stil: () => ({ kutu: { textShadow: '0 1px 4px rgba(0,0,0,.8)' }, etkin: { fontWeight: 600 }, yan: { opacity: 0.45 } }),
  },
  kart: {
    ad: 'Kart',
    stil: (v, zemin) => ({ kutu: { background: zemin, borderRadius: 14, padding: '10px 14px', borderTop: `3px solid ${v}` }, etkin: { fontWeight: 700 }, yan: { opacity: 0.55 } }),
  },
  cam: {
    ad: 'Cam',
    stil: () => ({
      kutu: { background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.22)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: '10px 14px', textShadow: '0 1px 3px rgba(0,0,0,.5)' },
      etkin: { fontWeight: 700 },
      yan: { opacity: 0.6 },
    }),
  },
  karaoke: {
    ad: 'Karaoke',
    karaoke: true,
    stil: () => ({ kutu: { textShadow: 'none' }, etkin: { fontWeight: 800 }, yan: { opacity: 0.5, textShadow: '0 1px 4px rgba(0,0,0,.8)' } }),
  },
  neon: {
    ad: 'Neon',
    stil: (v) => ({ kutu: {}, etkin: { fontWeight: 700, textShadow: `0 0 6px ${v}, 0 0 18px ${v}, 0 0 36px ${v}` }, yan: { opacity: 0.5, textShadow: `0 0 6px ${v}` } }),
  },
  sinema: {
    ad: 'Film altyazısı',
    stil: () => ({ kutu: {}, etkin: { fontWeight: 600, background: 'rgba(0,0,0,.78)', padding: '2px 12px', borderRadius: 4 }, yan: { opacity: 0.6, background: 'rgba(0,0,0,.5)', padding: '0 10px', borderRadius: 4 } }),
  },
  kapsul: {
    ad: 'Kapsül',
    stil: (v) => ({ kutu: {}, etkin: { fontWeight: 700, background: v, color: '#0b0f17', padding: '3px 16px', borderRadius: 999 }, yan: { opacity: 0.55, textShadow: '0 1px 4px rgba(0,0,0,.8)' } }),
  },
  retro: {
    ad: 'Retro ekran',
    yazi: '"JetBrains Mono", monospace',
    stil: () => ({ kutu: { background: 'rgba(2,11,5,.9)', border: '1px solid #22c55e', borderRadius: 6, padding: '8px 12px' }, etkin: { color: '#86efac', fontWeight: 700, textShadow: '0 0 8px #22c55e' }, yan: { color: '#22c55e', opacity: 0.6 } }),
  },
}

function satirSayisi(config) {
  if (config?.lyricsSingleLine === true || config?.lyricsLayout === 'tek') return 1
  return config?.lyricsLayout === 'iki' ? 2 : 3
}

/** Sözlerin kapladığı yükseklik: satır gelip giderken kart yerinden oynamasın */
export function sozYuksekligi(config) {
  const buyuk = Number(config?.lyricsFontSize) || 26
  const kucuk = Number(config?.lyricsSideSize) || 18
  const n = satirSayisi(config)
  const dolgulu = ['kart', 'cam', 'retro'].includes(config?.lyricsTheme) ? 24 : 0
  return Math.ceil(buyuk * 1.45 + (n - 1) * kucuk * 1.45 + (n - 1) * 4 + dolgulu)
}

/**
 * Karaoke dolumu kelime kelime, her karede yazılır (React'e uğramadan). Yalnız değişen kelimeye dokunulur:
 * eski kelimeler dolu, gelecektekiler boş kalır. Kelime kendi içinde dolduğu için uzun satır alta kayınca da doğru akar.
 */
function KaraokeSatir({ satir, satirSn, saat, offsetMs, renk, metinRengi, style }) {
  const kelimeler = useMemo(() => satir.kelimeler || kelimeleriTahminEt(satir.text, satirSn, satir.time), [satir, satirSn])
  const kutu = useRef(null)
  useEffect(() => {
    const dolu = `linear-gradient(${renk}, ${renk})`
    const bos = `linear-gradient(${metinRengi}, ${metinRengi})`
    const elemanlar = [...(kutu.current?.children || [])]
    for (const el of elemanlar) el.style.backgroundImage = bos
    let kare
    let sonI = -1
    let sonYuzde = -1
    const ciz = () => {
      const { i, oran } = kelimeDolumu(kelimeler, (saatOku(saat.current, performance.now()) + offsetMs) / 1000)
      if (i !== sonI) {
        // Geri sarmada da doğru: her kelime kendi tarafına yazılır
        elemanlar.forEach((el, k) => {
          if (k !== i) el.style.backgroundImage = k < i ? dolu : bos
        })
        sonI = i
        sonYuzde = -1
      }
      const yuzde = Math.round(oran * 100)
      if (i >= 0 && yuzde !== sonYuzde) {
        sonYuzde = yuzde
        elemanlar[i].style.backgroundImage = `linear-gradient(90deg, ${renk} ${yuzde}%, ${metinRengi} ${Math.min(100, yuzde + 4)}%)`
      }
      kare = requestAnimationFrame(ciz)
    }
    ciz()
    return () => cancelAnimationFrame(kare)
  }, [kelimeler, renk, metinRengi, saat, offsetMs])
  return (
    <p ref={kutu} className="max-w-full" style={{ ...style, whiteSpace: 'pre-wrap' }}>
      {kelimeler.map((k, i) => (
        <span key={i} style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          {k.m}
        </span>
      ))}
    </p>
  )
}

/**
 * Şarkı sözleri: önceki, şu anki ve sonraki satır. Görünüm Resonance'ta seçilir. Zamanı olmayan sözler
 * süreye yayılarak yaklaşık gösterilir ("Zamanı olmayan sözleri de göster" kapatılabilir).
 */
export function Lyrics({ track, progressMs, config, preview = false }) {
  const { lines, synced, tahmini, index, saat } = useLyrics(track, progressMs, true, Number(config?.lyricsOffsetMs) || 0)
  const tema = SOZ_TEMALARI[config?.lyricsTheme] || SOZ_TEMALARI.klasik
  const renk = config?.tintColor || '#22d3b8'
  const zemin = `rgba(15,16,21,${Number(config?.lyricsBgOpacity ?? 0.75)})`
  const stil = tema.stil(renk, zemin)
  const font = config?.lyricsFont || tema.yazi || config?.font || 'Poppins'
  const buyuk = Number(config?.lyricsFontSize) || 26
  const kucuk = Number(config?.lyricsSideSize) || 18
  const metinRengi = config?.lyricsColor || '#ffffff'
  const n = satirSayisi(config)
  const goster = synced || (tahmini && config?.lyricsPlain !== false)

  let satirlar = []
  if (goster && lines.length) {
    satirlar = [lines[index - 1], lines[index], lines[index + 1]].map((l, i) => ({ l, i }))
  } else if (preview) {
    satirlar = [
      { l: { text: 'Önceki satır' }, i: 0 },
      { l: { text: 'Sözler burada görünür' }, i: 1 },
      { l: { text: 'çalan şarkıyla birlikte akar' }, i: 2 },
    ]
  }
  satirlar = satirlar.filter((s) => (n === 1 ? s.i === 1 : n === 2 ? s.i >= 1 : true))
  if (!satirlar.some((s) => s.l)) return null

  const hiza = config?.lyricsAlign === 'left' ? 'flex-start' : config?.lyricsAlign === 'right' ? 'flex-end' : 'center'
  return (
    <div
      className="flex w-full flex-col gap-1"
      style={{ fontFamily: font, alignItems: hiza, textAlign: config?.lyricsAlign || 'center', ...stil.kutu }}
      aria-live="polite"
    >
      {satirlar.map(({ l, i }) => {
        if (!l) return <p key={`bos-${i}`} style={{ fontSize: i === 1 ? buyuk : kucuk, lineHeight: 1.3 }}>&nbsp;</p>
        const etkin = i === 1
        const satirStili = { color: metinRengi, fontSize: etkin ? buyuk : kucuk, fontWeight: 500, lineHeight: 1.3, ...(etkin ? stil.etkin : stil.yan) }
        if (etkin && tema.karaoke && goster) {
          return (
            <KaraokeSatir
              key={`${i}-${index}-${l.text}`}
              satir={l}
              satirSn={satirSuresi(lines, index)}
              saat={saat}
              offsetMs={Number(config?.lyricsOffsetMs) || 0}
              renk={renk}
              metinRengi={metinRengi}
              style={satirStili}
            />
          )
        }
        const dolum = etkin && tema.karaoke
          ? {
              backgroundImage: `linear-gradient(90deg, ${renk} 50%, ${metinRengi} 0)`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }
          : {}
        return (
          <p
            key={`${i}-${l.text}`}
            className="max-w-full transition-opacity duration-300"
            style={{ ...satirStili, ...dolum }}
          >
            {l.text}
          </p>
        )
      })}
    </div>
  )
}
