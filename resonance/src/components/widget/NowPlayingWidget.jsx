import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useDominantColor } from '../../hooks/useDominantColor'
import { useWidgetVisibility } from '../../hooks/useWidgetVisibility'
import { getAnimationVariants } from '../../lib/widgetAnimations'
import { effectiveCover, resolveRadius } from '../../lib/coverShape'
import { getSkin } from './skins'

function useAccentColor(config, coverUrl) {
  const dominant = useDominantColor(config.colorMode === 'magic' ? coverUrl : null)
  if (config.colorMode === 'magic') return dominant
  return config.tintColor || '#8b5cf6'
}

export function NowPlayingWidget({
  track,
  isPlaying,
  progressMs = 0,
  config,
  preview = false,
  /** Pulse animasyon demosu: true/false görünürlüğü geçici ezer */
  demoVisible,
  onVisibilityChange,
}) {
  const placeholderTrack = !track
    ? {
        id: 'nothing-playing',
        name: config.nothingPlayingTitle || 'Nothing Playing',
        artists: config.nothingPlayingArtist || '',
        album: '',
        cover: config.nothingPlayingCoverUrl || undefined,
        durationMs: 0,
      }
    : null
  const displayTrack = track || placeholderTrack

  const accent = useAccentColor(config, displayTrack?.cover)
  const theme = config.colorMode === 'light' ? 'light' : 'dark'
  const { initial, animate, exit, transition, exitTransition } = getAnimationVariants(
    config.revealAnimation,
    config.exitAnimation,
  )
  const progress = track ? Math.min(progressMs / Math.max(track.durationMs || 1, 1), 1) : 0
  const fontFamily = `"${config.font || 'Poppins'}", system-ui, sans-serif`
  const autoVisible = useWidgetVisibility(track, isPlaying, config, preview)
  const visible = typeof demoVisible === 'boolean' ? demoVisible : autoVisible

  // Üst çerçeve (Giriş/Bitiş/Mola) boyut + görünürlüğü buradan okusun;
  // aksi halde ebeveyn kendi `isPlaying` kuralıyla temayı OBS'te yutuyordu.
  useEffect(() => {
    onVisibilityChange?.(Boolean(visible), {
      hasTrack: Boolean(track),
      isPlaying: Boolean(isPlaying),
    })
  }, [visible, track, isPlaying, onVisibilityChange])

  const shellBg = theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(15,16,21,0.88)'
  const textColor = theme === 'light' ? '#111114' : '#ffffff'
  const mutedColor = theme === 'light' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)'

  // Animasyon ayarı / demo sırasında key sabit kalsın ki exit unmount ile oynasın;
  // yalnız track değişince remount (reveal).
  const motionKey = track ? track.id : 'empty'

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={motionKey}
          initial={initial}
          animate={animate}
          exit={{ ...exit, transition: exitTransition }}
          transition={transition}
          style={{
            fontFamily,
            color: textColor,
            // Yazı gölgesi rengi (yalnız "arka planı gizle" açıkken kullanılır)
            '--bare-shadow':
              theme === 'light'
                ? '0 1px 6px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.75)'
                : '0 1px 6px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.55)',
            // `will-change` kalıcı olarak koyulmuyor: widget'ı sürekli ayrı
            // katmana alıp yazıları bulanıklaştırıyor ve titretiyordu. Framer
            // Motion animasyon sırasında kendisi ekliyor.
          }}
        >
          <Skin
            skin={config.skin}
            track={displayTrack}
            isPlaying={isPlaying}
            progress={progress}
            progressMs={progressMs}
            durationMs={displayTrack?.durationMs || 0}
            config={config}
            accent={accent}
            shellBg={shellBg}
            textColor={textColor}
            mutedColor={mutedColor}
            theme={theme}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Seçili skini çizer. Kapak biçimi burada, skinin desteklediği kümeye göre
 * çözülür (`effectiveCover`); skin bileşenleri ham `config.cover`'a bakmaz.
 */
function Skin(props) {
  const { skin, track, isPlaying, config, accent } = props
  const { Component } = getSkin(skin)
  const coverProps = {
    src: track.cover,
    shape: effectiveCover(skin, config.cover),
    radius: resolveRadius(config),
    glow: config.coverGlow,
    playing: isPlaying,
    accentColor: accent,
  }
  const blurProps = {
    blur: config.coverBlur,
    coverSrc: track.cover,
    bare: config.hideBackground === true,
    allowGlow: Boolean(config.coverGlow),
  }
  return <Component {...props} coverProps={coverProps} blurProps={blurProps} />
}
