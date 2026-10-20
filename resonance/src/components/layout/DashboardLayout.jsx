import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAuth } from '../../context/AuthContext'
import { WelcomeModal } from '../WelcomeModal'

const SIDEBAR_KEY = 'resonance_sidebar_open'

/** Tailwind `lg` eşiği (1024 px): panel bu genişlikten itibaren içerikle yan yana durur. */
export function isWide() {
  try {
    return window.matchMedia('(min-width: 1024px)').matches
  } catch {
    return true
  }
}

export function initialSidebarOpen() {
  if (!isWide()) return false
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== '0'
  } catch {
    return true
  }
}

export function DashboardLayout() {
  // Küçük pencerede yan panel içeriğin ÜSTÜNE biner (fixed); varsayılan açık
  // olunca ayarları örtüyordu. Bu yüzden: dar ekranda hep kapalı başlar, geniş
  // ekranda kullanıcının son seçimi hatırlanır.
  const [sidebarOpen, setSidebarOpen] = useState(() => initialSidebarOpen())
  const toggleSidebar = () =>
    setSidebarOpen((o) => {
      const next = !o
      if (isWide()) {
        try {
          localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
        } catch {
          /* */
        }
      }
      return next
    })
  const closeIfNarrow = () => {
    if (!isWide()) setSidebarOpen(false)
  }
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[var(--color-text-muted)]">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <WelcomeModal />
      {/* Dar ekranda açık panelin arkası karartılır; tıklayınca kapanır. */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onNavigate={closeIfNarrow} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
