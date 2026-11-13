import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NowPlayingWidget } from '../components/widget/NowPlayingWidget'
import { Lyrics, sozYuksekligi } from '../components/widget/Lyrics'
import { useConfig, DEFAULT_CONFIG } from '../context/ConfigContext'
import { useNowPlaying } from '../hooks/useNowPlaying'
import { decodeOverlayData, ACTIVE_OVERLAY_ID } from '../lib/overlayData'
import { sarkiBitti } from '../lib/lyrics'
import { hostBaseUrl, loadOverlayConfig } from '../lib/hostBridge'
import { useObsSahnesi } from '../hooks/useObsSahnesi'
import { sahneEylemi } from '../lib/sahneKurali'
import { SKIN_REGISTRY } from '../components/widget/skins'

/** Önizlemede gösterilen örnek parça (kapak: gömülü degrade, ağa çıkmaz) */
export const ORNEK_PARCA = {
  id: 'ornek',
  name: 'Örnek Şarkı',
  artists: 'Resonance',
  album: 'Önizleme',
  cover:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="32" cy="32" r="12" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/><circle cx="32" cy="32" r="3" fill="#fff"/></svg>',
    ),
  durationMs: 200000,
  source: 'spotify',
}

/** Örnek parçanın ilerlemesi: süre çubuğu ve dalga gerçek gibi akar */
function useOrnekIlerleme(acik) {
  const [ms, setMs] = useState(60000)
  useEffect(() => {
    if (!acik) return undefined
    const t = setInterval(() => setMs((m) => (m + 1000 >= ORNEK_PARCA.durationMs ? 0 : m + 1000)), 1000)
    return () => clearInterval(t)
  }, [acik])
  return ms
}

/** `lyricsOnly`: /resonance/lyrics — yalnız senkron sözler (ayrı OBS kaynağı). */
export default function Overlay({ lyricsOnly = false }) {
  const [params] = useSearchParams()
  const profileId = params.get('profile')
  const { profiles } = useConfig()
  const [, forceTick] = useState(0)

  // A self-contained Browser Source URL may carry embedded config (`data=`).
  // OBS uses an isolated profile so that snapshot used to be necessary — but
  // when the host app is running we prefer the live `aktif` config so theme /
  // animation / color changes apply without regenerating the URL. Embedded
  // `data` is kept only as a credential + offline fallback.
  const portable = useMemo(() => decodeOverlayData(params.get('data')), [params])

  // Kısa adres: `?p=<profil>` veya parametresiz → aktif tema.
  // `data=` olsa bile host'tan okumayı dene; aksi halde OBS'e yapıştırılan
  // uzun URL temayı donmuş bir kopyada kilitliyordu.
  const shortId = params.get('p') || ACTIVE_OVERLAY_ID
  const [hosted, setHosted] = useState(null)
  const [configReady, setConfigReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    // Tema yalnız açılışta okunursa, Resonance'ta skin değiştirildiğinde
    // Giriş/Çıkış/Mola ekranları eski temada kalıyordu (OBS kaynağını elle
    // yenilemek gerekiyordu). Düzenli yoklayıp *gerçekten* değiştiyse
    // uyguluyoruz — aynı veride setState yok, boşuna yeniden çizim olmasın.
    let lastJson = ''
    const sync = async () => {
      try {
        const d = await loadOverlayConfig(shortId)
        if (cancelled) return
        const json = JSON.stringify(d)
        if (json !== lastJson) {
          lastJson = json
          setHosted(d)
        }
      } catch {
        /* sunucu kısa süre yanıt vermezse mevcut tema korunur */
      } finally {
        if (!cancelled) setConfigReady(true)
      }
    }
    void sync()

    // Anında güncelleme: uygulama tema değişince WebSocket'ten haber veriyor.
    // Yoklama yalnız yedek — bağlantı kopmuşsa devreye girsin diye seyrek.
    let ws = null
    let retry
    const connect = () => {
      if (cancelled) return
      try {
        ws = new WebSocket(`${hostBaseUrl().replace(/^http/, 'ws')}/ws/overlay-sync`)
      } catch {
        return
      }
      ws.onmessage = (ev) => {
        try {
          if (JSON.parse(ev.data)?.type === 'overlay-config') void sync()
        } catch {
          /* ilgisiz mesaj */
        }
      }
      ws.onclose = () => {
        if (!cancelled) retry = setTimeout(connect, 3000)
      }
    }
    connect()

    const timer = setInterval(sync, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
      clearTimeout(retry)
      try {
        ws?.close()
      } catch {
        /* */
      }
    }
  }, [shortId])

  const profile = profiles.find((p) => p.id === profileId) || profiles[0]
  // Host cevabı gelmeden localStorage varsayılanına (compact) düşme —
  // OBS'te yanlış temanın bir anlığına / kalıcı görünmesine yol açıyordu.
  const rawConfig = hosted?.config || (configReady ? portable?.config || profile?.config : null)
  const temelConfig = rawConfig ? { ...DEFAULT_CONFIG, ...rawConfig } : null
  // R5: OBS sahnesine göre gizle / göster / başka tema (`?sahne=` OBS dışında denemek için)
  const sahne = useObsSahnesi(params.get('sahne') || '')
  const sahneKurali =
    temelConfig && !lyricsOnly ? sahneEylemi(temelConfig.sceneRules, sahne, (id) => SKIN_REGISTRY.some((s) => s.id === id)) : null
  const config = sahneKurali?.skin ? { ...temelConfig, skin: sahneKurali.skin } : temelConfig
  const overrides = { ytmd: portable?.ytmd || null, spotify: portable?.spotify || null }
  const canli = useNowPlaying(
    config?.musicService || DEFAULT_CONFIG.musicService,
    overrides,
  )
  // `?ornek=1`: bot panelinin önizlemesi ve OBS test kipi. Şarkı çalmıyorsa örnek parça çalıyormuş gibi görünür
  const ornek = params.get('ornek') === '1'
  const ornekKipi = ornek && !(canli.track && canli.isPlaying)
  const ornekIlerleme = useOrnekIlerleme(ornekKipi)
  const track = ornekKipi ? ORNEK_PARCA : canli.track
  const isPlaying = ornekKipi ? true : canli.isPlaying
  const progressMs = ornekKipi ? ornekIlerleme : canli.progressMs

  useEffect(() => {
    document.body.classList.add('overlay-transparent')
    document.documentElement.classList.add('overlay-transparent')
    const onStorage = () => forceTick((t) => t + 1)
    window.addEventListener('storage', onStorage)
    return () => {
      document.body.classList.remove('overlay-transparent')
      document.documentElement.classList.remove('overlay-transparent')
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Gömülü kullanımda (Giriş/Çıkış/Mola ekranları bu sayfayı iframe olarak
  // kullanıyor) kartın gerçek boyutunu üst pencereye bildiriyoruz. Sabit
  // ölçülü bir çerçevede tema değişince kart yarım kalıyordu.
  const boxRef = useRef(null)
  const lastSizeRef = useRef({ width: 420, height: 150 })
  const stateRef = useRef({
    hasTrack: false,
    isPlaying: false,
    visible: false,
  })
  stateRef.current.hasTrack = Boolean(track)
  stateRef.current.isPlaying = Boolean(isPlaying)

  const postState = (extra = {}) => {
    const el = boxRef.current
    if (!el || window.parent === window) return
    const r = el.getBoundingClientRect()
    let width = Math.ceil(r.width)
    // Sözler kartın altına taşar (kartı yukarı itmesinler); üst çerçeve onları da kapsasın
    let height = Math.max(Math.ceil(r.height), el.scrollHeight)
    // Kart gizlenince kutu 0×0 oluyor; ebeveyn çerçevesini çökertme —
    // müzik yeniden başlayınca tema görünmez / kesik kalıyordu.
    if (width >= 40 && height >= 20) {
      lastSizeRef.current = { width, height }
    } else {
      width = lastSizeRef.current.width
      height = lastSizeRef.current.height
    }
    window.parent.postMessage(
      {
        source: 'resonance-overlay',
        type: 'state',
        width,
        height,
        // Kart ilk çocuk; yalnız söz sayfasında kart yok
        kart: lyricsOnly ? 0 : el.firstElementChild?.offsetHeight || 0,
        hasTrack: stateRef.current.hasTrack,
        isPlaying: stateRef.current.isPlaying,
        visible: stateRef.current.visible,
        ...extra,
      },
      '*',
    )
  }

  useEffect(() => {
    const el = boxRef.current
    if (!el || window.parent === window) return undefined
    postState()
    const ro = new ResizeObserver(() => postState())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    postState()
  }, [track, isPlaying])

  // Sözler kartın genişliğini alır; kart gizliyken kutunun genişliği sıfır olur
  const [kartGorunur, setKartGorunur] = useState(true)
  const onVisibilityChange = useCallback((visible) => {
    stateRef.current.visible = Boolean(visible)
    setKartGorunur(Boolean(visible))
    postState({ visible: Boolean(visible) })
  }, [])

  return (
    // Kart üste sabit: ortalanınca söz satırı değiştikçe ve sözler açılıp kapanınca kart yer değiştiriyordu
    <div className={`flex min-h-screen justify-center bg-transparent ${lyricsOnly ? 'items-center' : 'items-start'}`}>
      <div ref={boxRef} className="relative inline-flex min-h-[1px] min-w-[1px] flex-col items-center">
        {config && !lyricsOnly && (
          <NowPlayingWidget
            track={track}
            isPlaying={isPlaying}
            progressMs={progressMs}
            config={config}
            demoVisible={sahneKurali?.gizle ? false : ornekKipi || sahneKurali?.goster ? true : undefined}
            onVisibilityChange={onVisibilityChange}
          />
        )}
        {config && (lyricsOnly || config.showLyrics) && (
          // Kartın altında, kartın genişliğinde. Yer baştan ayrılır: satır gelip gidince kart yerinden oynamaz
          <div
            className={lyricsOnly ? 'w-screen px-4' : 'mt-2'}
            style={lyricsOnly ? undefined : { width: kartGorunur ? 0 : 420, minWidth: kartGorunur ? '100%' : undefined, minHeight: sozYuksekligi(config) }}
          >
            {track && isPlaying && !ornekKipi && !sahneKurali?.gizle && !sarkiBitti(track, progressMs) && (
              <Lyrics track={track} progressMs={progressMs} config={config} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
