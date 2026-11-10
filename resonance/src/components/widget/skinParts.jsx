/** Skinlerin ortak yapı taşları — `skins.jsx` ve `NowPlayingWidget.jsx` kullanır. */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useMuzikSeviyesi } from '../../hooks/useMuzikSeviyesi'

/** Her skinde geçerli görünüm ayarları: skinlerin imzası değişmesin diye bağlamla gelir */
export const GorunumBaglami = createContext({})

/**
 * Başlık ya da sanatçı. Sığmıyorsa (ayar açıksa) kayar; sanatçı satırı istenirse albümü de yazar.
 * Kaydırma hızı sabittir: yazı uzadıkça tur süresi uzar.
 */
export function Kayan({ metin, album = false }) {
  const { marquee, albumAdi } = useContext(GorunumBaglami)
  const yazi = album && albumAdi ? `${metin} · ${albumAdi}` : metin
  const el = useRef(null)
  const [tasma, setTasma] = useState(0)
  useEffect(() => {
    if (!marquee) return setTasma(0)
    const olc = () => {
      const k = el.current
      if (k?.parentElement) setTasma(Math.max(0, k.scrollWidth - k.parentElement.clientWidth))
    }
    olc()
    // Yazı tipi geç yüklenince genişlik değişir
    const t = setTimeout(olc, 600)
    return () => clearTimeout(t)
  }, [yazi, marquee])
  return (
    <span
      ref={el}
      className="inline-block max-w-none whitespace-nowrap"
      style={tasma > 4 ? { '--kayan': `-${tasma}px`, animation: `resonance-kayan ${Math.max(7, tasma / 12 + 5)}s linear infinite` } : undefined}
    >
      {yazi}
    </span>
  )
}

/** Oynatma durumu noktası: çalarken yanar */
export function DurumNoktasi({ playing, color }) {
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: playing ? color : 'rgba(255,255,255,.3)', boxShadow: playing ? `0 0 8px ${color}` : 'none' }} />
}

/** ms → 1:23 (bir saati geçen parçalarda 1:02:03) */
export function clock(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/**
 * `#rrggbb` rengini alfalı `rgba()`'ya çevirir.
 *
 * `color-mix()` yerine bunu kullanıyoruz: OBS'in gömülü tarayıcısı eski
 * Chromium sürümlerinde olabiliyor ve `color-mix` orada sessizce çalışmıyor.
 */
export function withAlpha(color, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(color || '').trim())
  if (!m) return color
  const n = parseInt(m[1], 16)
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/**
 * Çubuk/halka geçişi. Konum her 250 ms'de bir güncelleniyor; geçiş süresi bu
 * aralığa eşit ve doğrusal olmalı. Eskiden 1 sn'lik geçiş her güncellemede
 * yeniden başlıyor, çubuk sürekli "yetişmeye çalışıp" titriyordu.
 */
export const PROGRESS_TICK_MS = 250
export const PROGRESS_TRANSITION_MS = 300

/** Süre rakamları: küçük ve soluk yazıldığında net okunmuyordu. */
const TIME_TEXT = {
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
  letterSpacing: '0.02em',
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'geometricPrecision',
}

export function ProgressBar({
  progress,
  color,
  height = 4,
  progressMs = 0,
  durationMs = 0,
  timeColor,
  times = true,
  trackColor,
}) {
  // Süre bilinmiyorsa (bazı kaynaklar vermiyor) sayı göstermiyoruz —
  // "0:00 / 0:00" yazmak bilgi değil, gürültü.
  const { kalanSure, zamanDalgasi, oynuyor } = useContext(GorunumBaglami)
  const showTimes = times && Number(durationMs) > 0
  const pct = Math.min(1, Math.max(0, Number(progress) || 0)) * 100
  return (
    <div>
      <div
        className={`w-full overflow-hidden rounded-full ${trackColor ? '' : 'bg-white/15'}`}
        style={{ height, background: trackColor }}
      >
        <div
          className="h-full rounded-full ease-linear"
          style={{
            width: `${pct}%`,
            background: color,
            transition: `width ${PROGRESS_TRANSITION_MS}ms linear`,
          }}
        />
      </div>
      {showTimes && (
        <div
          className="mt-1 flex justify-between gap-3 font-mono text-[11px] leading-none"
          style={{ ...TIME_TEXT, color: timeColor || 'currentColor' }}
        >
          <span>{clock(gecenSn(progressMs) * 1000)}</span>
          {zamanDalgasi && <ZamanDalgasi renk={color} oynuyor={oynuyor} />}
          <span>{kalanSure ? `-${clock(kalanSn(progressMs, durationMs) * 1000)}` : clock(durationMs)}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Geçen ve kalan süre aynı saniye sınırında değişir: ayrı ayrı yuvarlanınca iki etiket farklı anlarda atlıyor,
 * kalan süre geçenden hızlı akıyormuş gibi görünüyordu. Geçen + kalan = toplam her an tutar.
 */
export const gecenSn = (progressMs) => Math.max(0, Math.floor((Number(progressMs) || 0) / 1000))
export const kalanSn = (progressMs, durationMs) =>
  Math.max(0, Math.round((Number(durationMs) || 0) / 1000) - gecenSn(progressMs))

/** İki süre etiketi arasındaki ses dalgası: çalarken dalgalanır, durunca alçak ve soluk kalır */
const DALGA_BOYLARI = [0.35, 0.7, 0.5, 1, 0.6, 0.85, 0.4, 0.95, 0.55, 0.75, 0.45, 0.9, 0.6, 0.8, 0.4, 0.65]

/** Gerçek seviye gelince her çubuk kendi boyu × seviye; komşular biraz farklı oynasın diye zamana bağlı küçük sapma */
export const cubukOlcegi = (boy, seviye, i, t = Date.now()) =>
  Math.max(0.12, boy * seviye * (0.7 + 0.3 * Math.sin(t / 90 + i * 1.7)))

export function ZamanDalgasi({ renk, oynuyor }) {
  const seviye = useMuzikSeviyesi(oynuyor)
  const ritim = seviye != null
  return (
    <span data-zaman-dalgasi className="flex min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden" style={{ height: 11 }} aria-hidden>
      {DALGA_BOYLARI.map((boy, i) => (
        <span
          key={i}
          className="w-[2px] shrink-0 rounded-full"
          style={{
            height: '100%',
            background: renk || 'currentColor',
            transform: `scaleY(${ritim ? cubukOlcegi(boy, seviye, i) : oynuyor ? boy : 0.2})`,
            opacity: oynuyor ? 0.85 : 0.35,
            // Ölçer varken müziğin seviyesi sürer; yoksa süs animasyonu
            transition: ritim ? 'transform 90ms linear' : undefined,
            animation: oynuyor && !ritim ? `resonance-zaman-dalga ${0.7 + (i % 4) * 0.15}s ease-in-out ${(i * 0.07).toFixed(2)}s infinite alternate` : 'none',
            '--dalga-boy': boy,
          }}
        />
      ))}
      <style>{`@keyframes resonance-zaman-dalga{from{transform:scaleY(calc(var(--dalga-boy) * .3))}to{transform:scaleY(var(--dalga-boy))}}`}</style>
    </span>
  )
}

export { TIME_TEXT }

/**
 * Her skinin ortak kabuğu.
 *
 * - "Cover Blur": kapağın bulanık kopyası, kabuğun **kendi** kırpma katmanında
 *   durur. Kabuk artık `overflow-hidden` değil; aksi halde kapak parlaması kart
 *   sınırında kesiliyor, açık olsa da görünmüyordu (`allowGlow`).
 * - `bare`: arka planı gizle (bkz. index.css `[data-bare]`).
 */
export function SkinCard({
  className,
  background,
  blur,
  coverSrc,
  style,
  bare = false,
  allowGlow = false,
  keepBorder = false,
  children,
}) {
  const { hareketliZemin, zeminRengi } = useContext(GorunumBaglami)
  const showBlur = blur && coverSrc && !bare
  return (
    <div
      data-bare={bare ? '1' : undefined}
      data-keep-border={bare && keepBorder ? '1' : undefined}
      className={`relative ${allowGlow ? '' : 'overflow-hidden'} ${className}`}
      style={showBlur ? style : { background, ...style }}
    >
      {showBlur && (
        <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }} aria-hidden>
          <div
            className="absolute inset-0 scale-125 bg-cover bg-center blur-2xl"
            style={{ backgroundImage: `url(${coverSrc})` }}
          />
          <div className="absolute inset-0" style={{ background }} />
        </div>
      )}
      {hareketliZemin && !bare && (
        <div className={`resonance-zemin resonance-zemin-${hareketliZemin}`} style={{ '--zemin-renk': zeminRengi }} aria-hidden />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}
