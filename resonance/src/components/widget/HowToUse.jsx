import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * "Resonance'ı nasıl kullanırım?" rehberi.
 *
 * Eskiden bu satırdaki "Başlarken" düğmesi harici bir OBS belge sayfasına
 * gidiyordu (`target=_blank`). Uygulama içinde (gömülü çerçeve) yeni pencere
 * açılmadığı için düğme hiçbir şey yapmıyor gibi görünüyordu. Rehber artık
 * uygulamanın içinde, Resonance'a özel adımlarla açılır.
 */

export const HOWTO = {
  tr: {
    title: "Resonance nasıl kullanılır?",
    intro:
      'Resonance, çalan şarkıyı (Spotify veya YouTube Music) yayın ekranında gösteren kart. Kurulum üç adım: müziği bağla, görünümü seç, OBS\'e ekle.',
    steps: [
      {
        title: 'Müzik kaynağını bağla',
        body: 'Soldaki menüden Bağlantılar → Müzik\'e git. Spotify için kendi Spotify uygulamanın Client ID\'sini gir ve Bağlan\'a bas; YouTube Music için YouTube Music Desktop\'ı aç, Companion Server ve Authorization requests\'i etkinleştirip Bağlan\'a bas. Bağlanınca Resonance çalan şarkıyı kendiliğinden gösterir.',
      },
      {
        title: 'Görünümü seç',
        body: 'Bu sayfada oynatıcı görünümünü (Kompakt, Halka, Aurora…), kapak biçimini (Kare/Plak), renkleri, yazı tipini ve giriş/çıkış animasyonunu seç. Değişiklikler önizlemede anında görünür ve kendiliğinden kaydedilir. "Arka planı gizle" kartın zeminini kaldırıp yalnız yazıları bırakır.',
      },
      {
        title: 'OBS\'e ekle',
        body: 'Aşağıdaki OBS adresini kopyala. OBS\'te Kaynaklar → + → Tarayıcı de, adresi yapıştır, genişlik 800, yükseklik 300 yaz. "Görünür değilken kaynağı kapat"ı işaretleme. Kart şeffaf zeminle gelir; yayın sahnene istediğin yere sürükle.',
      },
      {
        title: 'Giriş / Çıkış / Mola ekranlarında',
        body: 'Ayrı bir OBS kaynağı gerekmez: AxthrowA Studio\'nun Giriş, Çıkış ve Mola ekranlarında "Şimdi Çalıyor" kartı zaten seçtiğin görünümle çıkar. Konumunu ve görünürlüğünü o ekranın ayarlarından değiştirirsin.',
      },
    ],
    troubleshootTitle: 'Kart görünmüyorsa',
    troubleshoot: [
      'Bir şarkı çalıyor olmalı. Varsayılan olarak müzik durunca kart gizlenir ("Duraklayınca gizle").',
      'Sohbet/Müzik sekmesinde "Spotify istek sınırına takıldı (429)" yazıyorsa Spotify geçici olarak sınırlamıştır; süre dolunca kart kendiliğinden döner.',
      'OBS adresi AxthrowA Studio açıkken çalışır; uygulamayı kapattıysan kart da kaybolur.',
      'Görünüm değiştirdin ama OBS\'te eski görünüyorsa OBS\'te kaynağa sağ tıkla → Yenile.',
    ],
    obsAddress: 'OBS adresi',
    obsDoc: 'OBS Tarayıcı Kaynağı belgesi',
    close: 'Kapat',
  },
  en: {
    title: 'How to use Resonance',
    intro:
      "Resonance is a card that shows the currently playing song (Spotify or YouTube Music) on your stream. Setup takes three steps: connect your music, pick a look, add it to OBS.",
    steps: [
      {
        title: 'Connect your music source',
        body: "Go to Connections → Music in the left menu. For Spotify, enter your own Spotify app's Client ID and press Connect; for YouTube Music, open YouTube Music Desktop, enable Companion Server and Authorization requests, then press Connect. Once connected Resonance shows the playing song automatically.",
      },
      {
        title: 'Pick a look',
        body: 'On this page choose the player skin (Compact, Ring, Aurora…), cover style (Square/Vinyl), colors, font and reveal/exit animation. Changes show in the preview instantly and save automatically. "Hide background" removes the card background and keeps only text.',
      },
      {
        title: 'Add it to OBS',
        body: 'Copy the OBS address below. In OBS choose Sources → + → Browser, paste the address, set width 800 and height 300. Leave "Shutdown source when not visible" unchecked. The card has a transparent background; drag it wherever you like.',
      },
      {
        title: 'On the Starting / Ending / BRB screens',
        body: 'No separate OBS source is needed: the Starting, Ending and BRB screens of the stream manager already show the "Now Playing" card with the look you picked. Position and visibility are set in that screen\'s settings.',
      },
    ],
    troubleshootTitle: "If the card doesn't show",
    troubleshoot: [
      'A song must be playing. By default the card hides when music stops ("Hide on pause").',
      'If it says "Spotify rate limit (429)", Spotify has temporarily limited the app; the card returns by itself when the wait ends.',
      'The OBS address works while the stream manager is running; closing the app hides the card.',
      'If OBS still shows the old look, right-click the source in OBS → Refresh.',
    ],
    obsAddress: 'OBS address',
    obsDoc: 'OBS Browser Source docs',
    close: 'Close',
  },
}

export function howToFor(language) {
  return HOWTO[language] || HOWTO.en
}

export function HowToUse({ open, onClose, language = 'tr', obsUrl = '' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const c = howToFor(language)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="relative my-4 w-full max-w-xl rounded-2xl bg-[var(--color-surface-2)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={c.close}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 className="pr-8 text-lg font-semibold text-white">{c.title}</h3>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{c.intro}</p>

        <ol className="mt-4 space-y-4">
          {c.steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--color-text-muted)]">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {obsUrl && (
          <div className="mt-4 rounded-lg bg-[var(--color-surface-3)] px-3 py-2">
            <p className="text-xs text-[var(--color-text-muted)]">{c.obsAddress}</p>
            <p className="mt-0.5 break-all font-mono text-xs text-white">{obsUrl}</p>
          </div>
        )}

        <p className="mt-5 text-sm font-semibold text-white">{c.troubleshootTitle}</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
          {c.troubleshoot.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between gap-3">
          <a
            href="https://obsproject.com/kb/browser-source"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--color-text-muted)] underline hover:text-white"
          >
            {c.obsDoc}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            {c.close}
          </button>
        </div>
      </div>
    </div>
  )
}
