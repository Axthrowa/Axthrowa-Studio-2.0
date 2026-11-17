import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { Home, Bell, LayoutGrid, Link2, User, ChevronDown, AudioWaveform } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

const NAV = [
  { sectionKey: 'sidebar.dashboard' },
  { to: '/dashboard/home', labelKey: 'sidebar.home', icon: Home },
  { to: '/dashboard/whats-new', labelKey: 'sidebar.whatsNew', icon: Bell },
  {
    labelKey: 'sidebar.widgets',
    icon: LayoutGrid,
    children: [
      { to: '/dashboard/widgets/overview', labelKey: 'sidebar.overview' },
      { to: '/dashboard/widgets/pulse', labelKey: 'sidebar.pulse' },
    ],
  },
  {
    labelKey: 'sidebar.connections',
    icon: Link2,
    children: [
      { to: '/dashboard/connections/music', labelKey: 'sidebar.music' },
      { to: '/dashboard/connections/social', labelKey: 'sidebar.social' },
    ],
  },
  {
    labelKey: 'sidebar.account',
    icon: User,
    children: [
      { to: '/dashboard/account/profile', labelKey: 'sidebar.profile' },
      { to: '/dashboard/account/settings', labelKey: 'sidebar.settings' },
    ],
  },
]

function NavGroup({ item, t, onNavigate }) {
  const [open, setOpen] = useState(true)
  const Icon = item.icon
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-white"
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{t(item.labelKey)}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="ml-6 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-4">
          {item.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive ? 'text-white' : 'text-[var(--color-text-muted)] hover:text-white'
                }`
              }
            >
              {t(child.labelKey)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Yan panelin konum sınıfları.
 *
 * Eskiden `lg:sticky lg:translate-x-0` sabitti: geniş ekranda (≥1024 px)
 * üstteki düğme hiçbir şey yapmıyordu, panel hep açık kalıyordu. Şimdi kapalıyken
 * geniş ekranda `fixed` + ekran dışı (akıştan çıkar, içerik genişler), açıkken
 * `sticky` (akışta) — düğme her genişlikte çalışır.
 */
export function sidebarPositionClasses(open) {
  return open
    ? 'translate-x-0 lg:sticky lg:top-0 lg:h-screen'
    : '-translate-x-full lg:fixed lg:inset-y-0 lg:left-0'
}

export function Sidebar({ open, onNavigate }) {
  const { t } = useLanguage()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col gap-1 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-transform duration-200 ${sidebarPositionClasses(open)}`}
    >
      <div className="mb-4 flex items-center gap-2 px-2 py-2">
        <AudioWaveform className="h-6 w-6 text-[var(--color-accent)]" />
        <span className="text-lg font-bold text-white">Resonance</span>
      </div>
      {NAV.map((item, i) => {
        if (item.sectionKey) {
          return (
            <p
              key={i}
              className="mb-1 mt-3 px-3 text-xs font-semibold axt-etiket text-[var(--color-text-muted)]"
            >
              {t(item.sectionKey)}
            </p>
          )
        }
        if (item.children) return <NavGroup key={item.labelKey} item={item} t={t} onNavigate={onNavigate} />
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-[var(--color-surface-2)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
          </NavLink>
        )
      })}
    </aside>
  )
}
