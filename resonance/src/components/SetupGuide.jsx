import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Bağlantı kurulumunu adım adım, çizimle anlatan rehber.
 *
 * Gerçek ekran görüntüsü yerine basit SVG şemalar kullanıyoruz: uygulamalar
 * arayüzlerini değiştirdiğinde eskimeyen, tema rengine uyan ve pakete birkaç
 * KB ekleyen bir çözüm. Amaç "hangi ekranda, neye tıklayacağım" sorusunu
 * tek bakışta yanıtlamak.
 */

const FRAME = 'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]'

/* --------------------------------------------------------------- çizimler */

function Art({ children, label }) {
  return (
    <svg viewBox="0 0 220 120" role="img" aria-label={label} className={`h-[104px] w-full ${FRAME}`}>
      {children}
    </svg>
  )
}

const win = { fill: 'var(--color-surface)', stroke: 'var(--color-border)' }
const line = 'var(--color-text-muted)'
const hi = 'var(--color-accent)'

/** Pencere çerçevesi + başlık çubuğu */
function Window({ title }) {
  return (
    <>
      <rect x="8" y="8" width="204" height="104" rx="6" {...win} strokeWidth="1" />
      <rect x="8" y="8" width="204" height="16" rx="6" fill="var(--color-surface-2)" />
      <circle cx="17" cy="16" r="2.5" fill="#f87171" />
      <circle cx="25" cy="16" r="2.5" fill="#fbbf24" />
      <circle cx="33" cy="16" r="2.5" fill="#34d399" />
      {title && (
        <text x="44" y="19" fontSize="7" fill={line}>
          {title}
        </text>
      )}
    </>
  )
}

function Bar({ x, y, w, h = 5, fill = line, opacity = 0.5, rx = 2 }) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} opacity={opacity} />
}

function Btn({ x, y, w = 34, label, accent }) {
  return (
    <>
      <rect x={x} y={y} width={w} height="14" rx="4" fill={accent ? hi : 'var(--color-surface-2)'} />
      <text
        x={x + w / 2}
        y={y + 9.5}
        fontSize="6.5"
        textAnchor="middle"
        fill={accent ? '#08131c' : line}
        fontWeight="600"
      >
        {label}
      </text>
    </>
  )
}

/** Vurgu halkası — "buraya tıkla" */
function Focus({ x, y, w, h }) {
  return <rect x={x} y={y} width={w} height={h} rx="4" fill="none" stroke={hi} strokeWidth="1.6" />
}

function CreateAppArt() {
  return (
    <Art label="Spotify Dashboard'da yeni uygulama oluşturma">
      <Window title="developer.spotify.com/dashboard" />
      <Bar x={18} y={36} w={70} h={7} />
      <Btn x={150} y={33} w={52} label="Create app" accent />
      <Focus x={148} y={31} w={56} h={18} />
      <Bar x={18} y={56} w={184} h={16} opacity={0.12} />
      <Bar x={18} y={78} w={184} h={16} opacity={0.12} />
    </Art>
  )
}

function RedirectArt() {
  return (
    <Art label="Redirect URI ekleme ve kaydetme">
      <Window title="Settings" />
      <text x={18} y={40} fontSize="7" fill={line}>
        Redirect URIs
      </text>
      <rect x="18" y="45" width="140" height="15" rx="4" fill="var(--color-surface-2)" />
      <text x={23} y={55} fontSize="5.6" fill={hi}>
        http://127.0.0.1:8843/resonance/callback
      </text>
      <Btn x={164} y={45} w={38} label="Add" />
      <Focus x={16} y={43} w={190} h={19} />
      <Btn x={164} y={90} w={38} label="Save" accent />
      <Focus x={162} y={88} w={42} h={18} />
    </Art>
  )
}

function ClientIdArt() {
  return (
    <Art label="Client ID'yi kopyalama">
      <Window title="Uygulaman" />
      <text x={18} y={44} fontSize="7" fill={line}>
        Client ID
      </text>
      <rect x="18" y="50" width="150" height="14" rx="4" fill="var(--color-surface-2)" />
      <text x={23} y={59.5} fontSize="6" fill={hi}>
        c84b0524e2c548…
      </text>
      <Btn x={172} y={50} w={30} label="Copy" />
      <Focus x={16} y={48} w={190} h={18} />
      <text x={18} y={80} fontSize="6" fill={line} opacity="0.7">
        Client Secret gerekmez
      </text>
    </Art>
  )
}

function PasteArt() {
  return (
    <Art label="Client ID'yi uygulamaya yapıştırma">
      <Window title="Resonance — Bağlantılar" />
      <text x={18} y={40} fontSize="7" fill={line}>
        Client ID
      </text>
      <rect x="18" y="45" width="184" height="15" rx="4" fill="var(--color-surface-2)" />
      <Bar x={23} y={50} w={90} fill={hi} opacity={0.8} />
      <Focus x={16} y={43} w={190} h={19} />
      <Btn x={18} y={80} w={54} label="Bağlan" accent />
    </Art>
  )
}

function YtmdRunningArt() {
  return (
    <Art label="YouTube Music Desktop uygulaması açık">
      <Window title="YouTube Music Desktop" />
      <circle cx="40" cy="70" r="16" fill={line} opacity="0.25" />
      <path d="M35 63 L50 70 L35 77 Z" fill={hi} />
      <Bar x={64} y={62} w={100} h={6} />
      <Bar x={64} y={74} w={70} h={5} opacity={0.35} />
    </Art>
  )
}

function YtmdSettingsArt() {
  return (
    <Art label="Ayarlar > Entegrasyonlar">
      <Window title="Settings" />
      <rect x="14" y="30" width="58" height="76" rx="4" fill="var(--color-surface-2)" />
      <Bar x={20} y={38} w={44} />
      <Bar x={20} y={50} w={44} />
      <rect x="17" y="60" width="52" height="13" rx="3" fill={hi} opacity="0.22" />
      <text x={21} y={69} fontSize="6" fill={hi} fontWeight="600">
        Integrations
      </text>
      <Focus x={16} y={59} w={54} h={15} />
      <Bar x={20} y={80} w={44} />
      <Bar x={82} y={40} w={110} h={7} />
      <Bar x={82} y={56} w={90} opacity={0.3} />
      <Bar x={82} y={68} w={100} opacity={0.3} />
    </Art>
  )
}

function YtmdTogglesArt() {
  return (
    <Art label="Companion Server ve yetkilendirme isteklerini açma">
      <Window title="Integrations" />
      <text x={18} y={44} fontSize="6.5" fill={line}>
        Companion Server
      </text>
      <rect x="170" y="37" width="24" height="12" rx="6" fill={hi} />
      <circle cx="188" cy="43" r="4.5" fill="#08131c" />
      <Focus x={166} y={34} w={32} h={18} />
      <text x={18} y={72} fontSize="6.5" fill={line}>
        Authorization requests
      </text>
      <rect x="170" y="65" width="24" height="12" rx="6" fill={hi} />
      <circle cx="188" cy="71" r="4.5" fill="#08131c" />
      <Focus x={166} y={62} w={32} h={18} />
      <text x={18} y={92} fontSize="5.6" fill={line} opacity="0.75">
        Her bağlantıdan sonra kendini kapatır
      </text>
    </Art>
  )
}

function YtmdCodeArt() {
  return (
    <Art label="Eşleşme kodunu onaylama">
      <Window title="YouTube Music Desktop" />
      <rect x="52" y="34" width="116" height="66" rx="6" fill="var(--color-surface-2)" />
      <text x={110} y={50} fontSize="6.5" textAnchor="middle" fill={line}>
        Resonance bağlanmak istiyor
      </text>
      <text x={110} y={72} fontSize="17" textAnchor="middle" fill={hi} fontWeight="700">
        1234
      </text>
      <Btn x={92} y={82} w={36} label="Allow" accent />
      <Focus x={90} y={80} w={40} h={18} />
    </Art>
  )
}

/* ------------------------------------------------------------------ rehber */

function Steps({ steps }) {
  return (
    <ol className="mt-3 space-y-3">
      {steps.map((s, i) => (
        <li key={s.title} className="grid grid-cols-[1.4rem_1fr] gap-2">
          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-[#08131c]">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">{s.title}</p>
            {s.body && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{s.body}</p>}
            <div className="mt-1.5">{s.art}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function SetupGuide({ title, steps, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mt-3 rounded-xl border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-white"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3">{<Steps steps={steps} />}</div>}
    </div>
  )
}

export const SPOTIFY_STEPS = (redirectUri) => [
  {
    title: 'Kendi Spotify uygulamanı oluştur',
    body: 'Dashboard > Create app. İsim ve açıklama serbest.',
    art: <CreateAppArt />,
  },
  {
    title: 'Redirect URI ekle, sonra Save',
    body: `Settings > Redirect URIs alanına ${redirectUri} yaz, Add'e bas, en altta Save'e bas. Save'e basmazsan Spotify kaydetmez.`,
    art: <RedirectArt />,
  },
  {
    title: "Client ID'yi kopyala",
    body: 'Uygulamanın sayfasındaki Client ID yeter; Client Secret gerekmez.',
    art: <ClientIdArt />,
  },
  {
    title: 'Buraya yapıştır ve Bağlan',
    body: 'Onay ekranı sistem tarayıcında açılır; onayladıktan sonra bu sayfa kendiliğinden güncellenir.',
    art: <PasteArt />,
  },
]

export const YTMD_STEPS = [
  {
    title: 'YouTube Music Desktop açık olsun',
    body: 'Resmî masaüstü uygulaması (th-ch/youtube-music) çalışır durumda olmalı.',
    art: <YtmdRunningArt />,
  },
  {
    title: 'Ayarlar > Integrations',
    body: 'Uygulamanın ayarlarında Integrations bölümünü aç.',
    art: <YtmdSettingsArt />,
  },
  {
    title: 'Companion Server ve Authorization requests aç',
    body: 'İkisi de açık olmalı. Authorization requests her bağlantıdan sonra kendini kapatır — yeniden bağlanırken tekrar aç.',
    art: <YtmdTogglesArt />,
  },
  {
    title: 'Bağlan ve kodu onayla',
    body: 'Bağlan dediğinde YouTube Music Desktop bir kod gösterir; onayladığında eşleşme tamamlanır.',
    art: <YtmdCodeArt />,
  },
]
