import { useLyrics } from '../../hooks/useLyrics'

/**
 * Senkron şarkı sözleri: önceki (soluk), şu anki (vurgulu), sonraki (soluk) satır.
 * Zaman damgası olmayan sözlerde yalnız ilk satırlar gösterilmez — boş kalır
 * (yanlış anda yanlış satır göstermektense).
 */
export function Lyrics({ track, progressMs, config, preview = false }) {
  const { lines, synced, index } = useLyrics(track, progressMs, true, Number(config?.lyricsOffsetMs) || 0)
  const renk = config?.tintColor || '#22d3b8'
  const font = config?.font || 'Poppins'
  const buyuk = Number(config?.lyricsFontSize) || 26
  const kucuk = Number(config?.lyricsSideSize) || 18
  const metinRengi = config?.lyricsColor || '#ffffff'
  const tekSatir = config?.lyricsSingleLine === true

  let satirlar = []
  if (synced && lines.length) {
    satirlar = [lines[index - 1], lines[index], lines[index + 1]].map((l, i) => ({ l, i })).filter((s) => !tekSatir || s.i === 1)
  } else if (preview) {
    satirlar = [
      { l: { text: 'Senkron sözler burada görünür' }, i: 1 },
      { l: { text: 'çalan şarkıyla birlikte akar' }, i: 2 },
    ].filter((s) => !tekSatir || s.i === 1)
  }
  if (!satirlar.some((s) => s.l)) return null

  return (
    <div
      className="mt-3 flex w-full max-w-[900px] flex-col items-center gap-1 text-center"
      style={{ fontFamily: font, textShadow: '0 2px 8px rgba(0,0,0,.65)' }}
      aria-live="polite"
    >
      {satirlar.map(({ l, i }) =>
        l ? (
          <p
            key={`${i}-${l.text}`}
            className="transition-all duration-300"
            style={
              i === 1
                ? { color: metinRengi, fontSize: buyuk, fontWeight: 700, borderBottom: `2px solid ${renk}` }
                : { color: metinRengi, opacity: 0.55, fontSize: kucuk, fontWeight: 500 }
            }
          >
            {l.text}
          </p>
        ) : (
          <p key={`bos-${i}`} style={{ fontSize: i === 1 ? buyuk : kucuk }}>
            &nbsp;
          </p>
        ),
      )}
    </div>
  )
}
