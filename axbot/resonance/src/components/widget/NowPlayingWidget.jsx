import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useDominantColor } from '../../hooks/useDominantColor'
import { useWidgetVisibility } from '../../hooks/useWidgetVisibility'
import { getAnimationVariants } from '../../lib/widgetAnimations'
import { effectiveCover, halkaDestekli, resolveRadius } from '../../lib/coverShape'
import { sarkiBitti } from '../../lib/lyrics'
import { getSkin } from './skins'
import { GorunumBaglami } from './skinParts'

/** Hazır renk paletleri: kart zemini, yazı ve vurgu birlikte değişir. Boş: seçili renk kipi. */
export const PALETLER = {
  obsidyen: { ad: 'Obsidyen', zemin: 'rgba(10,10,12,0.94)', yazi: '#f5f5f5', soluk: 'rgba(245,245,245,0.6)', vurgu: '#a1a1aa' },
  gece: { ad: 'Gece mavisi', zemin: 'rgba(11,18,42,0.92)', yazi: '#e6edff', soluk: 'rgba(230,237,255,0.62)', vurgu: '#60a5fa' },
  kutup: { ad: 'Kutup ışığı', zemin: 'rgba(7,24,28,0.92)', yazi: '#e6fffb', soluk: 'rgba(230,255,251,0.62)', vurgu: '#2dd4bf' },
  orman: { ad: 'Orman', zemin: 'rgba(12,28,18,0.92)', yazi: '#eafbe9', soluk: 'rgba(234,251,233,0.62)', vurgu: '#4ade80' },
  amber: { ad: 'Kehribar', zemin: 'rgba(32,20,6,0.93)', yazi: '#fff3dc', soluk: 'rgba(255,243,220,0.62)', vurgu: '#fbbf24' },
  gul: { ad: 'Gül', zemin: 'rgba(36,10,22,0.92)', yazi: '#ffe8f1', soluk: 'rgba(255,232,241,0.62)', vurgu: '#f472b6' },
  cam: { ad: 'Cam', zemin: 'rgba(255,255,255,0.12)', yazi: '#ffffff', soluk: 'rgba(255,255,255,0.72)', vurgu: '#ffffff' },
}

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

  const palet = PALETLER[config.palet]
  const renk = useAccentColor(config, displayTrack?.cover)
  const accent = palet?.vurgu || renk
  const theme = config.colorMode === 'light' ? 'light' : 'dark'
  const { initial, animate, exit, transition, exitTransition } = getAnimationVariants(
    config.revealAnimation,
    config.exitAnimation,
  )
  const progress = track ? Math.min(progressMs / Math.max(track.durationMs || 1, 1), 1) : 0
  const fontFamily = `"${config.font || 'Poppins'}", system-ui, sans-serif`
  // Parça sonuna gelip sıradaki başlamadıysa kaynak hâlâ "çalıyor" diyebilir: bu da durmuş sayılır
  const autoVisible = useWidgetVisibility(track, isPlaying && !sarkiBitti(track, progressMs), config, preview)
  // Parça bitince kart çıkış animasyonuyla kapanır, sıradaki parça giriş animasyonuyla açılır. Eskiden "duraklayınca
  // gizle" kapalıyken kart son saniyede donup kalıyor, yeni parça gelince geçiş bir anlık oluyordu.
  const parcaBitti = !preview && sarkiBitti(track, progressMs)
  const visible = typeof demoVisible === 'boolean' ? demoVisible : autoVisible && !parcaBitti

  // Üst çerçeve (Giriş/Bitiş/Mola) boyut + görünürlüğü buradan okusun;
  // aksi halde ebeveyn kendi `isPlaying` kuralıyla temayı OBS'te yutuyordu.
  useEffect(() => {
    onVisibilityChange?.(Boolean(visible), {
      hasTrack: Boolean(track),
      isPlaying: Boolean(isPlaying),
    })
  }, [visible, track, isPlaying, onVisibilityChange])

  const shellBg = palet?.zemin || (theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(15,16,21,0.88)')
  const textColor = palet?.yazi || (theme === 'light' ? '#111114' : '#ffffff')
  const mutedColor = palet?.soluk || (theme === 'light' ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.6)')

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
            ...(Number(config.cardWidth) > 0 ? { '--kart-genislik': `${Number(config.cardWidth)}px` } : {}),
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
  const { skin, track, isPlaying, progress, config, accent } = props
  const { Component } = getSkin(skin)
  const shape = effectiveCover(skin, config.cover)
  const coverProps = {
    src: track.cover,
    shape,
    ring: config.coverRing === true && halkaDestekli(skin, shape),
    progress,
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
  const gorunum = {
    marquee: config.marquee !== false,
    albumAdi: config.showAlbum ? track.album : '',
    kalanSure: config.timeRemaining === true,
    // Süre etiketleri arasındaki ses dalgası (varsayılan açık)
    zamanDalgasi: config.timeWave !== false,
    oynuyor: Boolean(isPlaying),
    hareketliZemin: config.animatedBg && config.animatedBg !== 'yok' ? config.animatedBg : '',
    zeminRengi: accent,
  }
  return (
    <GorunumBaglami.Provider value={gorunum}>
      <Component {...props} coverProps={coverProps} blurProps={blurProps} />
    </GorunumBaglami.Provider>
  )
}
