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

  let satirlar = []
  if (synced && lines.length) {
    satirlar = [lines[index - 1], lines[index], lines[index + 1]].map((l, i) => ({ l, i }))
  } else if (preview) {
    satirlar = [
      { l: { text: 'Senkron sözler burada görünür' }, i: 1 },
      { l: { text: 'çalan şarkıyla birlikte akar' }, i: 2 },
    ]
  }
  if (!satirlar.some((s) => s.l)) return null

  return (
    <div
      className="mt-3 flex w-full max-w-[640px] flex-col items-center gap-1 text-center"
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
                ? { color: '#fff', fontSize: 26, fontWeight: 700, borderBottom: `2px solid ${renk}` }
                : { color: 'rgba(255,255,255,.55)', fontSize: 18, fontWeight: 500 }
            }
          >
            {l.text}
          </p>
        ) : (
          <p key={`bos-${i}`} style={{ fontSize: i === 1 ? 26 : 18 }}>
            &nbsp;
          </p>
        ),
      )}
    </div>
  )
}
