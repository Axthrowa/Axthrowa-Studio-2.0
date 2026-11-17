/** Resonance skinleri (ikinci yarı): plak, kaset, hap, ada, şerit, albüm, kenar, gameboy, HUD, not, neon, dalga, afiş, terminal, LCD, bilet */
import { Cover } from './Cover'
import { Visualizer } from './Visualizer'
import { DurumNoktasi, Kayan, PROGRESS_TRANSITION_MS, ProgressBar, SkinCard, TIME_TEXT, clock, sagDalga, withAlpha } from './skinParts'
import { clamp01 } from '../../lib/ringGeometry'

/** Pikap — dönen plak; çalarken iğne plağın üstünde, duraklayınca kalkıp kenara çekilir. */
export function Turntable(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,24rem)] max-w-none rounded-xl p-3" background={shellBg} {...blurProps}>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
          <div className="absolute left-1 top-1">
            <Cover {...coverProps} size={92} />
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
            <Kayan metin={track.name} />
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}>
            <Kayan metin={track.artists} album />
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <ProgressBar progress={progress} color={accent} height={3} progressMs={progressMs} durationMs={durationMs} timeColor={mutedColor} />
            </div>
            {sagDalga(config, durationMs) && <Visualizer playing={isPlaying} color={accent} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** Kaset makarası: bant sarıldıkça çapı değişir, göbeği çalarken döner */
export function Makara({ cap, playing, renk }) {
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
export function Cassette(p) {
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
          <Kayan metin={track.name} />
        </p>
        <p className="truncate font-mono text-xs" style={{ color: mutedColor }}>
          <Kayan metin={track.artists} album />
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
        {sagDalga(config, durationMs) && <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

/** Hap: tek satır, tam yuvarlak; alt kenarda ince ilerleme */
export function Pill(p) {
  const { track, isPlaying, progress, accent, shellBg, textColor, mutedColor, config, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,22rem)] max-w-none rounded-full border border-white/10 py-1.5 pl-1.5 pr-5 shadow-xl" background={shellBg} {...blurProps}>
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight" style={{ color: textColor }}><Kayan metin={track.name} /></p>
          <p className="truncate text-[11px] leading-tight" style={{ color: mutedColor }}><Kayan metin={track.artists} album /></p>
          <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-white/15">
            <div className="h-full ease-linear" style={{ width: `${Math.round(progress * 100)}%`, background: accent, transition: `width ${PROGRESS_TRANSITION_MS}ms linear` }} />
          </div>
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

/** Ada: siyah, yatay kapsül; solda kapak, sağda çubuklar */
export function Island(p) {
  const { track, isPlaying, accent, config, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,20rem)] max-w-none rounded-[28px] px-3 py-2 shadow-2xl" background="rgba(0,0,0,0.96)" {...blurProps}>
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={34} />
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[13px] font-semibold text-white"><Kayan metin={track.name} /></p>
          <p className="truncate text-[11px] text-white/60"><Kayan metin={track.artists} album /></p>
        </div>
        {config.hideVisualizer ? <DurumNoktasi playing={isPlaying} color={accent} /> : <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

/** Şerit: alt bant biçiminde geniş, ince; solda renk çubuğu */
export function Strip(p) {
  const { track, isPlaying, progress, progressMs, durationMs, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,34rem)] max-w-none rounded-sm py-1.5 pr-3 shadow-xl" background={shellBg} style={{ borderLeft: `6px solid ${accent}` }} {...blurProps} keepBorder>
      <div className="flex items-center gap-3 pl-2.5">
        <Cover {...coverProps} size={30} />
        <DurumNoktasi playing={isPlaying} color={accent} />
        <p className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide" style={{ color: textColor }}><Kayan metin={`${track.name} — ${track.artists}`} /></p>
        {durationMs > 0 && <span className="shrink-0 text-xs" style={{ ...TIME_TEXT, color: mutedColor }}>{clock(progressMs)}</span>}
        <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/15">
          <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: accent }} />
        </div>
      </div>
    </SkinCard>
  )
}

/** Kapak odaklı: büyük kapak, üstüne koyu geçişle yazı */
export function AlbumFocus(p) {
  const { track, progress, accent, coverProps } = p
  return (
    <div className="relative w-[var(--kart-genislik,16rem)] max-w-none overflow-hidden rounded-2xl shadow-2xl" style={{ aspectRatio: '1 / 1', background: 'rgba(15,16,21,.9)' }}>
      {coverProps.src && <img src={coverProps.src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,.88))' }}>
        <p className="truncate text-base font-bold text-white"><Kayan metin={track.name} /></p>
        <p className="truncate text-xs text-white/70"><Kayan metin={track.artists} album /></p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/20">
          <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: accent }} />
        </div>
      </div>
    </div>
  )
}

/** Yan sütun: dikey, dar; yayın kenarına yaslanır */
export function Sidebar(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,11rem)] max-w-none rounded-xl border border-white/10 p-3 shadow-xl" background={shellBg} {...blurProps}>
      <div className="flex flex-col items-center gap-2 text-center">
        <Cover {...coverProps} size={120} />
        <div className="w-full min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: textColor }}><Kayan metin={track.name} /></p>
          <p className="truncate text-xs" style={{ color: mutedColor }}><Kayan metin={track.artists} album /></p>
        </div>
        <div className="w-full">
          <ProgressBar progress={progress} color={accent} height={3} progressMs={progressMs} durationMs={durationMs} timeColor={mutedColor} />
        </div>
        {!config.hideVisualizer && <Visualizer playing={isPlaying} color={accent} />}
      </div>
    </SkinCard>
  )
}

/** El konsolu: dört tonlu yeşil ekran; temanın rengini kullanmaz */
export function Gameboy(p) {
  const { track, progress, isPlaying, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,20rem)] max-w-none rounded-lg p-2" background="#306230" {...blurProps} blur={false} keepBorder>
      <div className="flex items-center gap-2.5 rounded p-2" style={{ background: '#9bbc0f', color: '#0f380f', fontFamily: '"Pixelify Sans", "VT323", monospace', boxShadow: 'inset 0 0 0 2px #8bac0f' }}>
        {coverProps.shape !== 'none' && coverProps.src && <img src={coverProps.src} alt="" className="h-11 w-11 shrink-0 rounded-sm" style={{ imageRendering: 'pixelated', filter: 'grayscale(1) sepia(1) hue-rotate(40deg) saturate(2.4) brightness(.8)' }} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold"><Kayan metin={track.name} /></p>
          <p className="truncate text-xs"><Kayan metin={track.artists} album /></p>
          <div className="mt-1 flex items-center gap-1 text-[10px]">
            <span>{isPlaying ? '▶' : '❚❚'}</span>
            <div className="h-1.5 flex-1" style={{ background: '#8bac0f', outline: '1px solid #0f380f' }}>
              <div className="h-full" style={{ width: `${Math.round(progress * 100)}%`, background: '#0f380f' }} />
            </div>
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** HUD: kesik köşeli oyun arayüzü paneli */
export function Hud(p) {
  const { track, isPlaying, progress, progressMs, durationMs, accent, textColor, coverProps } = p
  return (
    <div
      className="w-[var(--kart-genislik,24rem)] max-w-none p-[1px]"
      style={{ background: accent, clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)' }}
    >
      <div className="flex items-center gap-3 p-2.5" style={{ background: 'rgba(2,6,23,.94)', clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)' }}>
        {coverProps.shape !== 'none' && <Cover {...coverProps} size={46} />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            <DurumNoktasi playing={isPlaying} color={accent} /> Şimdi çalıyor
          </p>
          <p className="truncate text-sm font-bold uppercase" style={{ color: textColor }}><Kayan metin={track.name} /></p>
          <p className="truncate text-xs text-white/60"><Kayan metin={track.artists} album /></p>
          <ProgressBar progress={progress} color={accent} height={2} progressMs={progressMs} durationMs={durationMs} times={false} />
        </div>
      </div>
    </div>
  )
}

/** Yapışkan not: sarı kağıt, el yazısı, hafif eğik */
export function Sticky(p) {
  const { track, progressMs, durationMs, coverProps } = p
  return (
    <div className="w-[var(--kart-genislik,16rem)] max-w-none p-3 shadow-xl" style={{ background: 'linear-gradient(180deg,#fde68a,#fcd34d)', color: '#3f2d06', transform: 'rotate(-1.2deg)', fontFamily: '"Kalam", "Caveat", cursive' }}>
      <div className="flex items-center gap-2.5">
        {coverProps.shape !== 'none' && coverProps.src && <img src={coverProps.src} alt="" className="h-12 w-12 shrink-0 rotate-2 border-2 border-white shadow" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight"><Kayan metin={track.name} /></p>
          <p className="truncate text-sm leading-tight"><Kayan metin={track.artists} album /></p>
          {durationMs > 0 && <p className="text-xs opacity-70">{clock(progressMs)} / {clock(durationMs)}</p>}
        </div>
      </div>
    </div>
  )
}

/** Neon: vurgu renginde ışıyan çerçeve */
export function Neon(p) {
  const { track, isPlaying, progress, progressMs, durationMs, config, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard
      className="w-[var(--kart-genislik,24rem)] max-w-none rounded-2xl border p-3"
      background={shellBg}
      {...blurProps}
      allowGlow
      keepBorder
      style={{ borderColor: accent, boxShadow: `0 0 14px ${withAlpha(accent, 0.7)}, inset 0 0 14px ${withAlpha(accent, 0.22)}` }}
    >
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" style={{ color: textColor, textShadow: `0 0 8px ${withAlpha(accent, 0.9)}` }}>
            <Kayan metin={track.name} />
          </p>
          <p className="truncate text-xs" style={{ color: mutedColor }}><Kayan metin={track.artists} album /></p>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <ProgressBar progress={progress} color={accent} height={3} progressMs={progressMs} durationMs={durationMs} />
            </div>
            {sagDalga(config, durationMs) && <Visualizer playing={isPlaying} color={accent} />}
          </div>
        </div>
      </div>
    </SkinCard>
  )
}

/** Her çubuğun yüksekliği (%). Sabit desen: gerçek ses verisi yok, ilerlemeyi gösterir. */
export const DALGA = Array.from({ length: 44 }, (_, i) =>
  Math.round(30 + 70 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))),
)

/** Dalga: ilerleme, ses dalgası biçiminde dolar */
export function Wave(p) {
  const { track, progress, progressMs, durationMs, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,26rem)] max-w-none rounded-2xl border border-white/10 p-3 shadow-xl" background={shellBg} {...blurProps}>
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: textColor }}><Kayan metin={track.name} /></p>
          <p className="truncate text-xs" style={{ color: mutedColor }}><Kayan metin={track.artists} album /></p>
        </div>
        {durationMs > 0 && (
          <span className="shrink-0 text-[11px]" style={{ ...TIME_TEXT, color: mutedColor }}>{clock(progressMs)} / {clock(durationMs)}</span>
        )}
      </div>
      <div aria-hidden className="mt-2.5 flex h-8 items-center justify-between">
        {DALGA.map((yukseklik, i) => (
          <span
            key={i}
            data-dalga={i / DALGA.length < progress ? 'dolu' : 'bos'}
            className="w-[3px] rounded-full"
            style={{ height: `${yukseklik}%`, background: i / DALGA.length < progress ? accent : withAlpha('#ffffff', 0.22) }}
          />
        ))}
      </div>
    </SkinCard>
  )
}

/** Afiş: üstte büyük kapak, altta ortalı yazı */
export function Poster(p) {
  const { track, progress, progressMs, durationMs, accent, shellBg, textColor, mutedColor, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,13rem)] max-w-none rounded-2xl border border-white/10 p-3 shadow-xl" background={shellBg} {...blurProps} allowGlow={Boolean(coverProps.glow)}>
      <div className="flex justify-center"><Cover {...coverProps} size={168} /></div>
      <div className="mt-3 text-center">
        <p className="truncate text-base font-bold leading-tight" style={{ color: textColor }}><Kayan metin={track.name} /></p>
        <p className="truncate text-xs" style={{ color: mutedColor }}><Kayan metin={track.artists} album /></p>
      </div>
      <div className="mt-2">
        <ProgressBar progress={progress} color={accent} height={3} progressMs={progressMs} durationMs={durationMs} times={false} />
      </div>
    </SkinCard>
  )
}

/** Terminal: komut satırı görünümü, ilerleme karakterlerle */
export function Terminal(p) {
  const { track, isPlaying, progress, progressMs, durationMs, accent } = p
  const dolu = Math.round(clamp01(progress) * 20)
  return (
    <div className="w-[var(--kart-genislik,24rem)] max-w-none rounded-lg border border-white/15 bg-[#0b0f14] p-3 font-mono text-xs shadow-xl" style={{ color: '#d1d5db' }}>
      <p style={{ color: accent }}>$ {isPlaying ? 'now-playing' : 'paused'}</p>
      <p className="mt-1 truncate font-bold text-white"><Kayan metin={track.name} /></p>
      <p className="truncate opacity-75"><Kayan metin={track.artists} album /></p>
      <p className="mt-1 truncate" style={{ color: accent }}>
        [{'#'.repeat(dolu)}{'-'.repeat(20 - dolu)}]{durationMs > 0 ? ` ${clock(progressMs)}/${clock(durationMs)}` : ''}
      </p>
    </div>
  )
}

/** CD çalar: dönen disk ve yeşil ekran */
export function Lcd(p) {
  const { track, isPlaying, progressMs, durationMs, shellBg, coverProps, blurProps } = p
  return (
    <SkinCard className="w-[var(--kart-genislik,24rem)] max-w-none rounded-xl border border-white/10 p-2.5 shadow-xl" background={shellBg} {...blurProps} allowGlow={Boolean(coverProps.glow)}>
      <div className="flex items-center gap-3">
        <Cover {...coverProps} size={68} />
        <div className="min-w-0 flex-1 rounded-md px-2.5 py-1.5 font-mono" style={{ background: '#a7c957', color: '#14290f', boxShadow: 'inset 0 1px 4px rgba(0,0,0,.45)' }}>
          <p className="truncate text-sm font-bold leading-tight"><Kayan metin={track.name} /></p>
          <p className="truncate text-[11px] leading-tight"><Kayan metin={track.artists} album /></p>
          <p className="mt-0.5 flex justify-between text-[11px] font-bold leading-tight" style={TIME_TEXT}>
            <span>{isPlaying ? 'PLAY' : 'PAUSE'}</span>
            {durationMs > 0 && <span>{clock(progressMs)} / {clock(durationMs)}</span>}
          </p>
        </div>
      </div>
    </SkinCard>
  )
}

/** Bilet: kesik çizgiyle ayrılmış koçan */
export function Ticket(p) {
  const { track, progress, progressMs, durationMs, accent, coverProps } = p
  return (
    <div className="flex w-[var(--kart-genislik,24rem)] max-w-none overflow-hidden rounded-lg shadow-xl" style={{ background: '#fbf5e6', color: '#1f2937' }}>
      {coverProps.shape !== 'none' && (
        <div className="flex shrink-0 items-center justify-center border-r-2 border-dashed border-black/30 p-2.5" style={{ background: accent }}>
          <Cover {...coverProps} size={60} />
        </div>
      )}
      <div className="min-w-0 flex-1 p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Şimdi çalıyor</p>
        <p className="truncate text-sm font-extrabold leading-tight"><Kayan metin={track.name} /></p>
        <p className="truncate text-xs"><Kayan metin={track.artists} album /></p>
        <div className="mt-1.5">
          <ProgressBar progress={progress} color="#1f2937" height={2} progressMs={progressMs} durationMs={durationMs} times={false} />
        </div>
      </div>
    </div>
  )
}
