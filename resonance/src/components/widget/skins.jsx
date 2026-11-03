import { Cover, glowShadow } from './Cover'
import { Visualizer } from './Visualizer'
import { PROGRESS_TRANSITION_MS, ProgressBar, SkinCard, TIME_TEXT, clock, withAlpha } from './skinParts'
import { RING_SIZE, RING_STROKE, clamp01, ringDash, ringHead } from '../../lib/ringGeometry'
import {
  AuroraPreview,
  BoxyPreview,
  CassettePreview,
  ClearPreview,
  CompactPreview,
  DiscordPreview,
  EdgePreview,
  GalleryPreview,
  MacOSPreview,
  MinimalPreview,
  TurntablePreview,
  RingPreview,
  ShellPreview,
} from './SkinPreviews'

/**
 * Skin kayıt defteri.
 *
 * Yeni skin = bu dosyada bir bileşen + `SKIN_REGISTRY`'ye bir girdi, ayrıca
 * `coverShape.js` içindeki `SKIN_COVER_SUPPORT` satırı ve iki dilde
 * `skins.<id>` çevirisi. Eksik olanı `skins.test.js` yakalar.
 *
 * Her bileşen aynı sözleşmeyi alır (`p`):
 *   track, isPlaying, progress, progressMs, durationMs, config, accent,
 *   shellBg, textColor, mutedColor, theme,
 *   coverProps  → <Cover {...coverProps} size={..} /> (biçim skine göre çözülmüş)
 *   blurProps   → <SkinCard {...blurProps} />
 */

function Compact(p) {
  const { track, isPlaying, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,20rem)] max-w-none rounded-xl border border-white/10 px-3 py-2.5 shadow-xl"
      background={shellBg}
      {...blurProps}
    >
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

function Boxy(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-2xl border border-white/10 p-4 shadow-2xl"
      background={shellBg}
      {...blurProps}
    >
      <div className="flex items-center gap-4">
        <Cover {...coverProps} size={72} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-sm" style={{ color: mutedColor }}>
            {track.artists}
          </p>
          <div className="mt-2 flex items-center gap-3">
            {/* Çubuk esnesin: aksi halde daralıp süre rakamları yapışıyordu. */}
            <div className="min-w-0 flex-1">
              <ProgressBar
                progress={progress}
                color={accent}
                progressMs={progressMs}
                durationMs={durationMs}
                timeColor={mutedColor}
              />
            </div>
            {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

function Gallery(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, mutedColor, coverProps, blurProps } = p
  const vinyl = coverProps.shape === 'vinyl'
  return (
    <SkinCard className="w-[var(--kart-genislik,16rem)] rounded-2xl shadow-2xl" background={shellBg} {...blurProps} allowGlow={false}>
      <div className={`relative ${vinyl ? 'flex justify-center p-3' : ''}`}>
        {/* Plak diski kartın tam kenarına dayandığında kesilmiş gibi
            duruyordu; yuvarlak kapakta biraz içeri alıyoruz. */}
        <Cover {...coverProps} size={vinyl ? 232 : 256} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="truncate text-sm font-semibold text-white">{track.name}</p>
          <p className="truncate text-xs text-white/75">{track.artists}</p>
        </div>
      </div>
      <div className="p-3">
        <ProgressBar
          progress={progress}
          color={accent}
          progressMs={progressMs}
          durationMs={durationMs}
          timeColor={mutedColor}
        />
        {!config.hideVisualizer && (
          <div className="mt-2 flex justify-center">
            <Visualizer playing={isPlaying} color={accent} size="lg" />
          </div>
        )}
      </div>
    </SkinCard>
  )
}

function Minimal(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,20rem)] max-w-none rounded-xl px-4 py-3" background={shellBg} {...blurProps}>
      <div className="mb-2 flex items-center justify-between">
        <p className="truncate text-sm font-semibold" style={{ color: textColor }}>
          {track.name} <span style={{ color: mutedColor }}>· {track.artists}</span>
        </p>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
      <ProgressBar
        progress={progress}
        color={accent}
        height={3}
        progressMs={progressMs}
        durationMs={durationMs}
        timeColor={mutedColor}
      />
    </SkinCard>
  )
}

function MacOS(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,20rem)] max-w-none rounded-2xl border border-white/10 p-3 shadow-2xl backdrop-blur-xl"
      background={shellBg}
      {...blurProps}
    >
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
          <div className="mt-1.5">
            <ProgressBar
              progress={progress}
              color={accent}
              height={3}
              progressMs={progressMs}
              durationMs={durationMs}
              timeColor={mutedColor}
            />
          </div>
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

function Shell(p) {
  const { track, isPlaying, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-full border border-white/10 py-2 pl-2 pr-6 shadow-xl"
      background={shellBg}
      {...blurProps}
    >
      <div className="flex items-center gap-4">
        <Cover {...coverProps} size={48} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} size="lg" />}
      </div>
    </SkinCard>
  )
}

function Discord(p) {
  const { track, progress, progressMs, durationMs, shellBg, textColor, mutedColor, theme, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,20rem)] max-w-none rounded-xl p-3 shadow-xl"
      background={theme === 'light' ? shellBg : '#232428'}
      {...blurProps}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: mutedColor }}>
        Listening to Music
      </p>
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={56} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: textColor }}>
            {track.name}
          </p>
          {track.artists && (
            <p className="truncate text-xs" style={{ color: mutedColor }}>
              by {track.artists}
            </p>
          )}
          {track.album && (
            <p className="truncate text-xs" style={{ color: mutedColor }}>
              on {track.album}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar
          progress={progress}
          color="#5865f2"
          height={4}
          progressMs={progressMs}
          durationMs={durationMs}
          timeColor={mutedColor}
        />
      </div>
    </SkinCard>
  )
}

/* ------------------------------------------------------------ yeni skinler */

/**
 * Şeffaf minimal — kabuk yok. Yayın görüntüsünün üstüne doğrudan biner;
 * okunabilirlik yumuşak gölgeden gelir (koyu temada koyu, açık temada beyaz).
 */
function Clear(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, textColor, mutedColor, theme, coverProps } = p
  const shadow =
    theme === 'light'
      ? '0 1px 6px rgba(255,255,255,0.85), 0 0 2px rgba(255,255,255,0.7)'
      : '0 1px 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.55)'
  return (
    <div className="w-[var(--kart-genislik,24rem)] max-w-none px-1 py-1" style={{ textShadow: shadow }}>
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
      <div className="mt-2">
        <ProgressBar
          progress={progress}
          color={accent}
          height={2}
          progressMs={progressMs}
          durationMs={durationMs}
          timeColor={mutedColor}
          trackColor={theme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.28)'}
        />
      </div>
    </div>
  )
}

/**
 * İlerleme halkası — kapak halkanın içinde; halka parça ilerledikçe dolar ve
 * ucunda küçük bir işaret taşır. Kapak "Kare" seçiliyse yuvarlak fotoğraf,
 * "Plak" seçiliyse dönen plak olarak çizilir.
 */
function Ring(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, theme, coverProps, blurProps } = p
  const size = RING_SIZE
  const stroke = RING_STROKE
  const r = (size - stroke) / 2
  const pr = clamp01(progress)
  const { circ, offset } = ringDash(r, pr)
  const inner = size - stroke * 2 - 6
  const vinyl = coverProps.shape === 'vinyl'
  const cx = size / 2
  // İşaret, döndürülmüş grubun içinde çizilir (bkz. ringGeometry.js).
  const head = ringHead(cx, r, pr)
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-2xl border border-white/10 py-3 pl-3 pr-5 shadow-xl"
      background={shellBg}
      {...blurProps}
    >
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="absolute inset-0" aria-hidden>
            <g transform={`rotate(-90 ${cx} ${cx})`}>
              <circle
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={theme === 'light' ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.22)'}
                strokeWidth={stroke}
              />
              <circle
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={accent}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 300ms linear' }}
              />
              {pr > 0 && pr < 1 && (
                <circle data-ring-head cx={head.x} cy={head.y} r={stroke * 0.9} fill={textColor} />
              )}
            </g>
          </svg>
          <div
            className="absolute flex items-center justify-center"
            style={{ inset: stroke + 3, width: inner, height: inner }}
          >
            {vinyl ? (
              <Cover {...coverProps} shape="vinyl" size={inner} />
            ) : track.cover ? (
              <img
                src={track.cover}
                alt=""
                className="h-full w-full rounded-full object-cover"
                style={coverProps.glow ? { boxShadow: glowShadow(accent) } : undefined}
              />
            ) : (
              <div className="h-full w-full rounded-full" style={{ background: accent, opacity: 0.35 }} />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            {Number(durationMs) > 0 && (
              <span className="font-mono text-[11px]" style={{ ...TIME_TEXT, color: textColor }}>
                {clock(progressMs)} / {clock(durationMs)}
              </span>
            )}
            {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** Gradyan cam — kapağın baskın renginden türeyen degrade, buzlu cam yüzey. */
function Aurora(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, textColor, mutedColor, theme, coverProps, blurProps } = p
  const base = theme === 'light' ? 'rgba(255,255,255,0.86)' : 'rgba(14,16,28,0.84)'
  const background = [
    `radial-gradient(120% 150% at 0% 0%, ${withAlpha(accent, 0.55)}, transparent 58%)`,
    `radial-gradient(110% 130% at 100% 100%, ${withAlpha('#7c3aed', 0.4)}, transparent 62%)`,
    base,
  ].join(', ')
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-3xl border border-white/25 p-3.5"
      background={background}
      style={{ boxShadow: `0 10px 30px ${withAlpha(accent, 0.25)}, inset 0 1px 0 rgba(255,255,255,0.28)` }}
      {...blurProps}
    >
      <div className="flex items-center gap-3.5">
        <Cover {...coverProps} size={60} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <ProgressBar
                progress={progress}
                color={textColor}
                height={3}
                progressMs={progressMs}
                durationMs={durationMs}
                timeColor={mutedColor}
                trackColor={theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.22)'}
              />
            </div>
            {!config.hideVisualizer && <Visualizer playing={isPlaying} color={textColor} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** Renkli kenarlık — koyu kart, vurgu renginde kalın çerçeve ve sol şerit. */
function Edge(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-xl py-3 pl-3 pr-4"
      background={shellBg}
      style={{
        border: `2px solid ${accent}`,
        borderLeftWidth: 7,
        boxShadow: `0 0 18px ${withAlpha(accent, 0.35)}`,
      }}
      {...blurProps}
      keepBorder
    >
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <ProgressBar
                progress={progress}
                color={accent}
                height={3}
                progressMs={progressMs}
                durationMs={durationMs}
                timeColor={mutedColor}
              />
            </div>
            {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** Pikap — dönen plak; çalarken iğne plağın üstünde, duraklayınca kalkıp kenara çekilir. */
function Turntable(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,24rem)] max-w-none rounded-xl p-3" background={shellBg} {...blurProps}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
          <div className="absolute left-1 top-1">
            <Cover {...coverProps} shape="vinyl" size={92} />
          </div>
          <div
            aria-hidden
            data-igne={isPlaying ? 'plakta' : 'kalkik'}
            className="absolute rounded-full"
            style={{
              right: 3,
              top: 3,
              width: 3,
              height: 58,
              background: textColor,
              boxShadow: `0 0 6px ${withAlpha(accent, 0.8)}`,
              transformOrigin: '50% 0',
              transform: `rotate(${isPlaying ? 28 : 0}deg)`,
              transition: 'transform 600ms ease-in-out',
            }}
          />
          <div aria-hidden className="absolute rounded-full" style={{ right: 0, top: 0, width: 9, height: 9, background: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" style={{ color: textColor }}>
            {track.name}
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            {track.artists}
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <ProgressBar progress={progress} color={accent} height={3} progressMs={progressMs} durationMs={durationMs} timeColor={mutedColor} />
            </div>
            {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** Kaset makarası: bant sarıldıkça çapı değişir, göbeği çalarken döner */
function Makara({ cap, playing, renk }) {
  return (
    <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
      <div className="flex items-center justify-center rounded-full" style={{ width: cap, height: cap, background: 'rgba(0,0,0,0.65)', transition: `width ${PROGRESS_TRANSITION_MS}ms linear, height ${PROGRESS_TRANSITION_MS}ms linear` }}>
        <div
          className="resonance-spin flex items-center justify-center rounded-full"
          style={{ width: 16, height: 16, border: `3px dashed ${renk}`, animationPlayState: playing ? 'running' : 'paused' }}
        />
      </div>
    </div>
  )
}

/** Retro kaset — bant soldan sağa sarılır: makara çapları parçanın ilerleyişini gösterir. */
function Cassette(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, blurProps } = p
  const oran = clamp01(progress)
  const cap = (o) => Math.round(20 + 24 * o)
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-lg p-2.5"
      background={shellBg}
      style={{ border: `2px solid ${withAlpha(accent, 0.7)}` }}
      {...blurProps}
      keepBorder
    >
      <div className="rounded px-2.5 py-1.5" style={{ background: withAlpha(accent, 0.18), borderBottom: `3px double ${accent}` }}>
        <p className="truncate font-mono text-sm font-bold" style={{ color: textColor }}>
          {track.name}
        </p>
        <p className="truncate font-mono text-xs" style={{ color: mutedColor }}>
          {track.artists}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-1 rounded-full px-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <Makara cap={cap(1 - oran)} playing={isPlaying} renk={accent} />
          <Makara cap={cap(oran)} playing={isPlaying} renk={accent} />
        </div>
        <div className="min-w-0 flex-1">
          <ProgressBar progress={progress} color={accent} height={3} progressMs={progressMs} durationMs={durationMs} timeColor={mutedColor} />
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

/**
 * `id`: yapılandırmada saklanan değer, `skins.<id>` çeviri anahtarı ve
 * `SKIN_COVER_SUPPORT` anahtarı — üçü hep aynı.
 */
export const SKIN_REGISTRY = [
  { id: 'compact', Component: Compact, Preview: CompactPreview },
  { id: 'boxy', Component: Boxy, Preview: BoxyPreview },
  { id: 'gallery', Component: Gallery, Preview: GalleryPreview },
  { id: 'minimal', Component: Minimal, Preview: MinimalPreview, isNew: true },
  { id: 'macos', Component: MacOS, Preview: MacOSPreview },
  { id: 'shell', Component: Shell, Preview: ShellPreview },
  { id: 'discord', Component: Discord, Preview: DiscordPreview },
  { id: 'clear', Component: Clear, Preview: ClearPreview, isNew: true },
  { id: 'ring', Component: Ring, Preview: RingPreview, isNew: true },
  { id: 'aurora', Component: Aurora, Preview: AuroraPreview, isNew: true },
  { id: 'edge', Component: Edge, Preview: EdgePreview, isNew: true },
  { id: 'turntable', Component: Turntable, Preview: TurntablePreview, isNew: true },
  { id: 'cassette', Component: Cassette, Preview: CassettePreview, isNew: true },
]

export const DEFAULT_SKIN_ID = 'compact'

/** Bilinmeyen kimlik (silinmiş/yeni skin) varsayılana düşer, widget boş kalmaz. */
export function getSkin(id) {
  return SKIN_REGISTRY.find((s) => s.id === id) || SKIN_REGISTRY.find((s) => s.id === DEFAULT_SKIN_ID)
}
