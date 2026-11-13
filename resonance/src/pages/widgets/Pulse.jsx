import { useEffect, useMemo, useRef, useState } from 'react'
import { copyText } from '../../lib/clipboard'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Copy, Check, Plus } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { OptionGrid } from '../../components/ui/OptionGrid'
import { ToggleRow } from '../../components/ui/Toggle'
import { Slider } from '../../components/ui/Slider'
import { NowPlayingWidget, PALETLER } from '../../components/widget/NowPlayingWidget'
import { Lyrics, SOZ_TEMALARI } from '../../components/widget/Lyrics'
import { TransportBar } from '../../components/widget/TransportBar'
import { CdPreview, CirclePreview, DiscPreview, HexagonPreview, PolaroidPreview, SquarePreview, VinylPreview, NonePreview } from '../../components/widget/SkinPreviews'
import { SKIN_REGISTRY } from '../../components/widget/skins'
import { HowToUse } from '../../components/widget/HowToUse'
import {
  MAX_CORNER_RADIUS,
  MIN_CORNER_RADIUS,
  effectiveCover,
  halkaDestekli,
  isCoverSupported,
  normalizeCoverShape,
  resolveRadius,
} from '../../lib/coverShape'
import { useConfig } from '../../context/ConfigContext'
import { useYtmd } from '../../context/YtmdContext'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { useNowPlaying } from '../../hooks/useNowPlaying'
import { REVEAL_OPTIONS } from '../../lib/widgetAnimations'
import { getYtmdToken, getYtmdHost, getYtmdPort } from '../../lib/ytmdAuth'
import { getRefreshToken, getClientId } from '../../lib/spotifyAuth'
import { encodeOverlayData } from '../../lib/overlayData'
import { isHostAvailable } from '../../lib/hostBridge'

const COVERS = [
  { value: 'square', key: 'square', preview: <SquarePreview /> },
  { value: 'circle', key: 'circle', preview: <CirclePreview /> },
  { value: 'hexagon', key: 'hexagon', preview: <HexagonPreview /> },
  { value: 'polaroid', key: 'polaroid', preview: <PolaroidPreview /> },
  { value: 'vinyl', key: 'vinyl', preview: <VinylPreview /> },
  { value: 'disc', key: 'disc', preview: <DiscPreview /> },
  { value: 'cd', key: 'cd', preview: <CdPreview /> },
  { value: 'none', key: 'none', preview: <NonePreview /> },
]

const FONTS = [
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Space Grotesk', label: 'Space Grotesk' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'Roboto Mono', label: 'Roboto Mono' },
  ...['Oxanium', 'Tektur', 'Josefin Sans', 'Great Vibes', 'Kaushan Script', 'Luckiest Guy', 'Lilita One', 'Cinzel Decorative', 'Metal Mania', 'Courier Prime', 'Rubik', 'Manrope', 'Sora', 'Lexend', 'Barlow Condensed', 'Bebas Neue', 'Anton', 'Orbitron', 'Exo 2', 'Rajdhani', 'Pixelify Sans', 'Press Start 2P', 'VT323', 'Caveat', 'Kalam', 'Playfair Display', 'Fredoka'].map((value) => ({ value, label: value })),
]

function Section({ title, children, className = '' }) {
  return (
    <Card className={className}>
      <h3 className="mb-4 text-lg font-semibold text-white">{title}</h3>
      {children}
    </Card>
  )
}

function SubLabel({ children }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </p>
  )
}

/** Kart genişliğini denemek için örnek şarkı adları */
const ORNEK_ADLAR = {
  kisa: { name: 'Yol', artists: 'Sanatçı' },
  uzun: { name: 'Bu Çok Uzun Bir Şarkı Adı: Gecenin Sonunda Yeniden Doğan Şehir (Akustik Canlı Kayıt)', artists: 'Çok Uzun Adlı Bir Sanatçı, Konuk Sanatçı ve Orkestrası' },
}

export default function Pulse() {
  const { t, language } = useLanguage()
  const { profiles, activeProfile, activeId, setActiveId, addProfile, updateConfig } = useConfig()
  const ytmd = useYtmd()
  const { isAuthenticated } = useAuth()
  const config = activeProfile?.config
  const { track, isPlaying, progressMs } = useNowPlaying(config?.musicService || 'auto')
  const liveSource = track?.source || config?.musicService || 'spotify'
  const [ornekAd, setOrnekAd] = useState(null)
  const [showUrl, setShowUrl] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [copied, setCopied] = useState(false)
  const connectedForSelectedService =
    liveSource === 'youtube-music' ? ytmd.connected : isAuthenticated

  const ANIMATION_OPTIONS = REVEAL_OPTIONS.map((o) => ({ value: o.value, label: t(`animations.${o.value}`) }))
  const SKIN_OPTIONS = SKIN_REGISTRY.map((s) => ({
    value: s.id,
    label: t(`skins.${s.id}`),
    preview: <s.Preview />,
    badge: s.isNew ? t('skins.new') : undefined,
  }))
  // Seçili skinin uygulamadığı kapak biçimi devre dışı görünür; eskiden tıklanıp
  // sessizce başka bir şeye çevriliyordu.
  // Köşe yuvarlaklığı yalnız skinin gerçekten kare çizdiği durumda anlamlı.
  const radiusActive = effectiveCover(config?.skin, config?.cover) === 'square'
  const COVER_OPTIONS = COVERS.map((c) => ({
    value: c.value,
    label: t(`covers.${c.key}`),
    preview: c.preview,
    disabled: !isCoverSupported(config?.skin, c.value),
    hint: isCoverSupported(config?.skin, c.value) ? undefined : t('pulse.coverUnsupported'),
  }))

  // Host ayaktayken OBS adresi her zaman kısa: `/resonance/overlay`
  // Tema/animasyon sunucudaki `aktif` kayıttan canlı okunur. Uzun `data=`
  // adresi yalnız host yokken (Resonance tek başına) yedektir — ve o zaman
  // bile OBS'te tema donar; bu yüzden arayüzde kısa olanı öne çıkarıyoruz.
  const [hostReady, setHostReady] = useState(false)
  const [demoVisible, setDemoVisible] = useState(undefined)
  const demoTimers = useRef([])

  const clearDemoTimers = () => {
    demoTimers.current.forEach((id) => clearTimeout(id))
    demoTimers.current = []
  }

  const playRevealDemo = () => {
    clearDemoTimers()
    setDemoVisible(false)
    demoTimers.current.push(setTimeout(() => setDemoVisible(true), 60))
    demoTimers.current.push(setTimeout(() => setDemoVisible(undefined), 1000))
  }

  const playExitDemo = () => {
    clearDemoTimers()
    setDemoVisible(true)
    demoTimers.current.push(setTimeout(() => setDemoVisible(false), 40))
    demoTimers.current.push(setTimeout(() => setDemoVisible(true), 420))
    demoTimers.current.push(setTimeout(() => setDemoVisible(undefined), 1000))
  }

  useEffect(() => () => clearDemoTimers(), [])

  const portableUrl = useMemo(() => {
    if (!activeProfile) return ''
    const params = new URLSearchParams({ profile: activeProfile.id })
    const portable = { config: activeProfile.config }
    if (ytmd.connected) {
      const token = getYtmdToken()
      if (token) {
        portable.ytmd = { token, host: getYtmdHost(), port: getYtmdPort() }
      }
    }
    if (isAuthenticated) {
      const refreshToken = getRefreshToken()
      const clientId = getClientId()
      if (refreshToken && clientId) {
        portable.spotify = { refreshToken, clientId }
      }
    }
    params.set('data', encodeOverlayData(portable))
    return `${window.location.origin}/resonance/overlay?${params.toString()}`
  }, [activeProfile, ytmd.connected, isAuthenticated])

  const shortUrl = `${window.location.origin}/resonance/overlay`
  const obsUrl = hostReady ? shortUrl : portableUrl

  useEffect(() => {
    let cancelled = false
    let deneme = 0
    const bak = () => {
      isHostAvailable(true)
        .then((ok) => {
          if (cancelled) return
          setHostReady(ok)
          if (!ok && deneme < 5) {
            deneme += 1
            setTimeout(bak, 800 * deneme)
          }
        })
        .catch(() => {
          if (!cancelled) setHostReady(false)
        })
    }
    bak()
    return () => {
      cancelled = true
    }
  }, [activeProfile])

  const set = (patch) => updateConfig(patch)

  // Kaynak otomatik: host çalan servisi seçer. Pulse buradan yalnızca
  // paneli o kaynağa hizalar; Rust'a kilitli kaynak yazılmaz.
  useEffect(() => {
    const src = track?.source
    if (src !== 'spotify' && src !== 'youtube-music') return
    if (config?.musicService === src) return
    set({ musicService: src })
  }, [track?.source, config?.musicService])

  const copyUrl = async () => {
    if (await copyText(obsUrl)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  if (!config) return null

  const onizlemeParcasi = ornekAd
    ? { ...(track || {}), id: 'ornek', durationMs: track?.durationMs || 200000, ...ORNEK_ADLAR[ornekAd] }
    : track

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <h1 className="text-3xl font-bold text-white">{t('pulse.title')}</h1>

      <div className="sticky top-20 z-20 mt-6 flex justify-center overflow-visible rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-12 backdrop-blur">
        <NowPlayingWidget
          track={onizlemeParcasi}
          isPlaying={ornekAd ? true : isPlaying}
          progressMs={ornekAd ? 60000 : progressMs}
          config={config}
          preview
          demoVisible={ornekAd ? true : demoVisible}
        />
      </div>
      <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SubLabel>Önizlemede şarkı adı</SubLabel>
          {[
            [null, 'Çalan şarkı'],
            ['kisa', 'Kısa ad'],
            ['uzun', 'Uzun ad'],
          ].map(([deger, ad]) => (
            <button
              key={ad}
              type="button"
              onClick={() => setOrnekAd(deger)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${ornekAd === deger ? 'bg-[var(--color-accent)] text-black' : 'bg-white/5 text-white'}`}
            >
              {ad}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <SubLabel>Kart genişliği (0 = temanın varsayılanı)</SubLabel>
          <Slider value={Number(config.cardWidth) || 0} min={0} max={720} step={10} suffix=" px" onChange={(v) => set({ cardWidth: v })} />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Kart genişliği sabittir: şarkı adı değişince kart ve yazılar yerinde kalır, sığmayan ad kısaltılır.</p>
        </div>
      </div>
      {config.showLyrics && (
        <div className="mx-auto mt-2 w-full max-w-[640px] rounded-2xl bg-black/60 p-4">
          <Lyrics track={track} progressMs={progressMs} config={config} preview />
        </div>
      )}
      <TransportBar isPlaying={isPlaying} musicService={liveSource} />
      {!track && (
        <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
          {t('pulse.previewHintAuto')}
        </p>
      )}

      <Section title={t('pulse.general')} className="mt-6">
        <SubLabel>
          {t('pulse.profiles')} <span className="ml-1 text-[var(--color-text-muted)]">({profiles.length})</span>
        </SubLabel>
        <Select
          value={activeId}
          onChange={setActiveId}
          options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Button variant="outline" className="mt-3 w-full" onClick={() => addProfile()}>
          <Plus className="h-4 w-4" />
          {t('pulse.addProfile')}
        </Button>

        <div className="mt-5">
          <SubLabel>{t('pulse.musicService')}</SubLabel>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <p className="text-sm font-medium text-white">
              {t('pulse.autoSource')} — {liveSource === 'youtube-music' ? t('pulse.youtubeMusic') : t('pulse.spotify')}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('pulse.autoSourceHint')}</p>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-white">
              <span
                className={`h-2 w-2 rounded-full ${connectedForSelectedService ? 'bg-emerald-400' : 'bg-[var(--color-text-muted)]'}`}
              />
              {connectedForSelectedService ? t('pulse.serviceConnected') : t('pulse.serviceNotConnected')}
            </span>
            <Button as={Link} to="/dashboard/connections/music" variant="outline">
              {t('pulse.manageConnection')}
            </Button>
          </div>
        </div>
      </Section>

      <Section title={t('pulse.obsSetup')} className="mt-6">
        <SubLabel>{t('pulse.browserSourceUrl')}</SubLabel>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-muted)]">
            {showUrl ? obsUrl : '•'.repeat(28)}
          </span>
          <button
            type="button"
            onClick={() => setShowUrl((s) => !s)}
            className="shrink-0 text-[var(--color-text-muted)] hover:text-white"
          >
            {showUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button variant="outline" className="mt-3 w-full" onClick={copyUrl}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t('pulse.copied') : t('pulse.copyToClipboard')}
        </Button>

        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          {hostReady ? t('pulse.obsUrlNoteShort') : t('pulse.obsUrlNote')}
        </p>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
          <span className="text-sm text-white">{t('pulse.learnHow')}</span>
          <Button variant="outline" onClick={() => setShowHowTo(true)}>
            {t('pulse.gettingStarted')}
          </Button>
        </div>
      </Section>

      <HowToUse open={showHowTo} onClose={() => setShowHowTo(false)} language={language} obsUrl={obsUrl} />

      <h2 className="mb-4 mt-8 text-xl font-semibold text-white">{t('pulse.customization')}</h2>

      <Section title={t('pulse.appearance')}>
        <SubLabel>{t('pulse.playerAppearance')}</SubLabel>
        <OptionGrid columns={5} value={config.skin} onChange={(v) => set({ skin: v })} options={SKIN_OPTIONS} />
        <div className="mt-5">
          <SubLabel>{t('pulse.coverAppearance')}</SubLabel>
          <OptionGrid
            columns={4}
            value={normalizeCoverShape(config.cover)}
            onChange={(v) => set({ cover: v })}
            options={COVER_OPTIONS}
          />
          {COVER_OPTIONS.some((o) => o.disabled) && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t('pulse.coverUnsupported')}</p>
          )}
        </div>
      </Section>

      <Section title={t('pulse.cover')} className="mt-6">
        <div className="divide-y divide-[var(--color-border)]">
          <div className="pb-4 pt-3 pl-1 pr-1">
            <SubLabel>{t('pulse.cornerRadius')}</SubLabel>
            <div className={radiusActive ? '' : 'pointer-events-none opacity-40'} aria-disabled={!radiusActive}>
              <Slider
                value={resolveRadius(config)}
                min={MIN_CORNER_RADIUS}
                max={MAX_CORNER_RADIUS}
                suffix="px"
                onChange={(v) => set({ coverRadius: v })}
              />
            </div>
            {!radiusActive && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t('pulse.radiusOnlySquare')}</p>
            )}
          </div>
          <ToggleRow
            title={t('pulse.coverGlow')}
            description={t('pulse.coverGlowDesc')}
            checked={config.coverGlow}
            onChange={(v) => set({ coverGlow: v })}
          />
          {halkaDestekli(config.skin, effectiveCover(config.skin, config.cover)) && (
            <ToggleRow
              title={t('pulse.coverRing')}
              description={t('pulse.coverRingDesc')}
              checked={config.coverRing === true}
              onChange={(v) => set({ coverRing: v })}
            />
          )}
          <ToggleRow
            title={t('pulse.hideBackground')}
            description={t('pulse.hideBackgroundDesc')}
            checked={config.hideBackground === true}
            onChange={(v) => set({ hideBackground: v })}
          />
          <ToggleRow
            title={t('pulse.coverBlur')}
            description={t('pulse.coverBlurDesc')}
            checked={config.coverBlur}
            onChange={(v) => set({ coverBlur: v })}
          />
          <ToggleRow
            title={t('pulse.lyrics')}
            description={t('pulse.lyricsDesc')}
            checked={config.showLyrics === true}
            onChange={(v) => set({ showLyrics: v })}
          />
          <ToggleRow
            title={t('pulse.requests')}
            description={t('pulse.requestsDesc')}
            checked={config.showRequests !== false}
            onChange={(v) => set({ showRequests: v })}
          />
          <div className="mt-2">
            <SubLabel>{t('pulse.lyricsOffset')}</SubLabel>
            <Slider
              value={Math.round((Number(config.lyricsOffsetMs) || 0) / 100) / 10}
              min={-5}
              max={5}
              step={0.5}
              suffix={t('pulse.seconds')}
              onChange={(v) => set({ lyricsOffsetMs: Math.round(v * 1000) })}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('pulse.lyricsUrl')} {`${window.location.origin}/resonance/lyrics`}
            </p>
            <SubLabel>Söz görünümü</SubLabel>
            <Select value={config.lyricsTheme || 'klasik'} onChange={(v) => set({ lyricsTheme: v })} options={Object.entries(SOZ_TEMALARI).map(([value, x]) => ({ value, label: x.ad }))} />
            <SubLabel>Satır sayısı</SubLabel>
            <Select
              value={config.lyricsSingleLine === true ? 'tek' : config.lyricsLayout || 'uc'}
              onChange={(v) => set({ lyricsLayout: v, lyricsSingleLine: false })}
              options={[{ value: 'uc', label: 'Önceki, şu anki, sonraki' }, { value: 'iki', label: 'Şu anki ve sonraki' }, { value: 'tek', label: 'Yalnız şu anki' }]}
            />
            <SubLabel>Hizalama</SubLabel>
            <Select value={config.lyricsAlign || 'center'} onChange={(v) => set({ lyricsAlign: v })} options={[{ value: 'left', label: 'Sola' }, { value: 'center', label: 'Ortaya' }, { value: 'right', label: 'Sağa' }]} />
            <SubLabel>Söz yazı tipi</SubLabel>
            <Select value={config.lyricsFont || ''} onChange={(v) => set({ lyricsFont: v })} options={[{ value: '', label: 'Kartla aynı' }, ...FONTS]} />
            {config.lyricsTheme === 'kart' && (
              <>
                <SubLabel>Kart saydamlığı</SubLabel>
                <Slider value={Math.round((Number(config.lyricsBgOpacity ?? 0.75)) * 100)} min={0} max={100} step={5} suffix=" %" onChange={(v) => set({ lyricsBgOpacity: v / 100 })} />
              </>
            )}
            <ToggleRow
              title="Zamanı olmayan sözleri de göster"
              description="Yalnız düz metin bulunan şarkılarda sözler süreye yayılarak yaklaşık gösterilir."
              checked={config.lyricsPlain !== false}
              onChange={(v) => set({ lyricsPlain: v })}
            />
            <SubLabel>{t('pulse.lyricsSize')}</SubLabel>
            <Slider value={Number(config.lyricsFontSize) || 26} min={14} max={72} step={1} suffix=" px" onChange={(v) => set({ lyricsFontSize: v })} />
            <SubLabel>{t('pulse.lyricsSideSize')}</SubLabel>
            <Slider value={Number(config.lyricsSideSize) || 18} min={10} max={56} step={1} suffix=" px" onChange={(v) => set({ lyricsSideSize: v })} />
            <SubLabel>{t('pulse.lyricsColor')}</SubLabel>
            <input
              type="color"
              aria-label={t('pulse.lyricsColor')}
              value={config.lyricsColor || '#ffffff'}
              onChange={(e) => set({ lyricsColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded border-0 bg-transparent"
            />
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t('pulse.lyricsScreens')}</p>
          </div>
        </div>
      </Section>

      <Section title={t('pulse.colors')} className="mt-6">
        <SubLabel>{t('pulse.theme')}</SubLabel>
        <div className="flex gap-2">
          {[
            { value: 'magic', label: t('pulse.magicColors') },
            { value: 'dark', label: t('pulse.darkMode') },
            { value: 'light', label: t('pulse.lightMode') },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ colorMode: opt.value })}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                config.colorMode === opt.value
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-white'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-5">
          <SubLabel>{t('pulse.tintColor')}</SubLabel>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={config.tintColor}
              onChange={(e) => set({ tintColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border)] bg-transparent"
            />
            <span className="text-sm text-[var(--color-text-muted)]">{config.tintColor}</span>
          </div>
        </div>
      </Section>

      <Section title="Kart ayrıntıları" className="mt-6">
        <SubLabel>Hazır renk paleti</SubLabel>
        <Select value={config.palet || ''} onChange={(v) => set({ palet: v })} options={[{ value: '', label: 'Yok (yukarıdaki renkler)' }, ...Object.entries(PALETLER).map(([value, x]) => ({ value, label: x.ad }))]} />
        <div className="mt-4">
          <SubLabel>Hareketli arka plan</SubLabel>
          <Select value={config.animatedBg || 'yok'} onChange={(v) => set({ animatedBg: v })} options={[{ value: 'yok', label: 'Yok' }, { value: 'aurora', label: 'Aurora' }, { value: 'akis', label: 'Akış' }, { value: 'nabiz', label: 'Nabız' }, { value: 'nefes', label: 'Nefes' }]} />
        </div>
        <div className="mt-3 divide-y divide-[var(--color-border)]">
          <ToggleRow title="Uzun başlık kaysın" description="Sığmayan şarkı adı ve sanatçı yavaşça kayar." checked={config.marquee !== false} onChange={(v) => set({ marquee: v })} />
          <ToggleRow title="Albüm adını göster" description="Sanatçının yanına albüm adını ekler." checked={config.showAlbum === true} onChange={(v) => set({ showAlbum: v })} />
          <ToggleRow title="Kalan süreyi göster" description="Toplam süre yerine kalan süreyi yazar." checked={config.timeRemaining === true} onChange={(v) => set({ timeRemaining: v })} />
          <ToggleRow title="Süreler arasında ses dalgası" description="Süre gösteren çubuklu görünümlerde iki süre arasına çalarken dalgalanan bir ses dalgası koyar." checked={config.timeWave !== false} onChange={(v) => set({ timeWave: v })} />
        </div>
      </Section>

      <Section title={t('pulse.animationsTitle')} className="mt-6">
        <SubLabel>{t('pulse.revealAnimation')}</SubLabel>
        <Select
          value={config.revealAnimation}
          onChange={(v) => {
            set({ revealAnimation: v })
            playRevealDemo()
          }}
          options={ANIMATION_OPTIONS}
        />
        <div className="mt-4">
          <SubLabel>{t('pulse.exitAnimation')}</SubLabel>
          <Select
            value={config.exitAnimation}
            onChange={(v) => {
              set({ exitAnimation: v })
              playExitDemo()
            }}
            options={ANIMATION_OPTIONS}
          />
        </div>
      </Section>

      <Section title={t('pulse.font')} className="mt-6">
        <Select value={config.font} onChange={(v) => set({ font: v })} options={FONTS} />
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t('pulse.customFontNote')}</p>
      </Section>

      <Section title={t('pulse.text')} className="mt-6">
        <SubLabel>{t('pulse.nothingPlayingTitleLabel')}</SubLabel>
        <input
          value={config.nothingPlayingTitle}
          onChange={(e) => set({ nothingPlayingTitle: e.target.value })}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
        />
        <div className="mt-4">
          <SubLabel>{t('pulse.nothingPlayingArtistLabel')}</SubLabel>
          <input
            value={config.nothingPlayingArtist}
            onChange={(e) => set({ nothingPlayingArtist: e.target.value })}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      </Section>

      <Section title={t('pulse.visibility')} className="mt-6">
        <div className="divide-y divide-[var(--color-border)]">
          <ToggleRow
            title={t('pulse.showNothingPlaying')}
            description={t('pulse.showNothingPlayingDesc')}
            checked={config.showNothingPlaying === true}
            onChange={(v) => set({ showNothingPlaying: v })}
          />
          <div>
            <ToggleRow
              title={t('pulse.hideOnPause')}
              description={t('pulse.hideOnPauseDesc')}
              checked={!!config.hideOnPause}
              onChange={(v) => set({ hideOnPause: v })}
            />
            {config.hideOnPause && (
              <div className="pb-4 pl-1 pr-1">
                <SubLabel>{t('pulse.hideDelay')}</SubLabel>
                <Slider
                  value={config.hideOnPauseDelay}
                  max={30}
                  suffix={t('pulse.seconds')}
                  onChange={(v) => set({ hideOnPauseDelay: v })}
                />
              </div>
            )}
          </div>
          <div>
            <ToggleRow
              title={t('pulse.songChangeOnly')}
              description={t('pulse.songChangeOnlyDesc')}
              checked={!!config.songChangeOnly}
              onChange={(v) => set({ songChangeOnly: v })}
            />
            {config.songChangeOnly && (
              <div className="pb-4 pl-1 pr-1">
                <SubLabel>{t('pulse.visibleDuration')}</SubLabel>
                <Slider
                  value={config.songChangeVisibleDuration}
                  max={30}
                  suffix={t('pulse.seconds')}
                  onChange={(v) => set({ songChangeVisibleDuration: v })}
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title={t('pulse.misc')} className="mt-6">
        <ToggleRow
          title={t('pulse.hideVisualizer')}
          description={t('pulse.hideVisualizerDesc')}
          checked={!!config.hideVisualizer}
          onChange={(v) => set({ hideVisualizer: v })}
        />
      </Section>
    </div>
  )
}
