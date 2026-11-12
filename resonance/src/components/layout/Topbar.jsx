import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PanelLeft, Sun, Moon, Bell, MessageCircle, Languages } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import { useLanguage } from '../../context/LanguageContext'
import { colorForName } from '../../lib/avatarColor'

export function Topbar({ onToggleSidebar }) {
  const { theme, toggleTheme } = useTheme()
  const { user, isAuthenticated, logout } = useAuth()
  const { username } = useProfile()
  const { t, toggleLanguage } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const avatarLetter = (username || 'R')[0].toUpperCase()
  const avatarColor = colorForName(username || 'R')

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 px-4 backdrop-blur">
      <button
        onClick={onToggleSidebar}
        aria-label="Menü"
        className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
          title={t('topbar.discord')}
        >
          <MessageCircle className="h-5 w-5" />
        </a>

        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
          title={t('topbar.language')}
        >
          <Languages className="h-5 w-5" />
        </button>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
          title={t('topbar.toggleTheme')}
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <div className="relative">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
            title={t('topbar.notifications')}
          >
            <Bell className="h-5 w-5" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm shadow-xl">
              <p className="font-medium text-white">{t('topbar.notifications')}</p>
              <p className="mt-1 text-[var(--color-text-muted)]">{t('topbar.notificationsEmpty')}</p>
            </div>
          )}
        </div>

        <div className="relative ml-1">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
            style={{ background: isAuthenticated ? undefined : avatarColor }}
          >
            {isAuthenticated ? (
              user?.images?.[0]?.url ? (
                <img src={user.images[0].url} alt="" className="h-full w-full bg-[var(--color-accent)] object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[var(--color-accent)]">
                  {(user?.display_name || 'U')[0]}
                </span>
              )
            ) : (
              avatarLetter
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm shadow-xl">
              <p className="truncate px-3 py-2 font-medium text-white">
                {isAuthenticated ? user?.display_name : username || t('topbar.guest')}
              </p>
              <Link
                to="/dashboard/account/profile"
                onClick={() => setMenuOpen(false)}
                className="block w-full rounded-lg px-3 py-2 text-left text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
              >
                {t('sidebar.profile')}
              </Link>
              {isAuthenticated && (
                <button
                  onClick={logout}
                  className="w-full rounded-lg px-3 py-2 text-left text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-white"
                >
                  {t('topbar.signOut')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
