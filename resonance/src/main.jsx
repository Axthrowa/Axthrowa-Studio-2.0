import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'

import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import { ProfileProvider } from './context/ProfileContext'
import { ConfigProvider } from './context/ConfigContext'
import { YtmdProvider } from './context/YtmdContext'

import { DashboardLayout } from './components/layout/DashboardLayout'
import Login from './pages/Login'
import Callback from './pages/Callback'
import Overlay from './pages/Overlay'
import Home from './pages/Home'
import Pro from './pages/Pro'
import Pulse from './pages/widgets/Pulse'
import WidgetsOverview from './pages/widgets/Overview'
import MusicConnections from './pages/connections/Music'
import SocialConnections from './pages/connections/Social'
import Profile from './pages/account/Profile'
import AccountSettings from './pages/account/Settings'
import WhatsNew from './pages/WhatsNew'

// The Spotify PKCE code_verifier lives in sessionStorage, which is scoped
// per-origin. If the app is opened on a host that doesn't match the
// configured redirect URI (e.g. "localhost" vs "127.0.0.1" — different
// origins to the browser even though they point at the same machine), the
// verifier written before authorizing won't be readable on /callback and
// the token exchange fails with a 400. Normalize to the redirect URI's host
// up front so the whole flow stays on one origin.
function redirectedToCanonicalHost() {
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI
  if (!redirectUri) return false
  try {
    const target = new URL(redirectUri)
    const here = window.location
    if (target.hostname === here.hostname) return false
    const canonical = ['localhost', '127.0.0.1']
    if (!canonical.includes(target.hostname) || !canonical.includes(here.hostname)) return false

    const url = new URL(here.href)
    url.hostname = target.hostname
    if (target.port) url.port = target.port
    window.location.replace(url.toString())
    return true
  } catch {
    return false
  }
}

if (!redirectedToCanonicalHost()) {
  renderApp()
}

function renderApp() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter basename="/resonance">
        <LanguageProvider>
          <ThemeProvider>
            <ProfileProvider>
              <AuthProvider>
                <ConfigProvider>
                  <YtmdProvider>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard/home" replace />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/callback" element={<Callback />} />
                        <Route path="/overlay" element={<Overlay />} />
                        <Route path="/lyrics" element={<Overlay lyricsOnly />} />

                        <Route path="/dashboard" element={<DashboardLayout />}>
                          <Route path="home" element={<Home />} />
                          <Route path="pro" element={<Pro />} />
                          <Route path="whats-new" element={<WhatsNew />} />
                          <Route path="widgets/overview" element={<WidgetsOverview />} />
                          <Route path="widgets/pulse" element={<Pulse />} />
                          <Route path="connections/music" element={<MusicConnections />} />
                          <Route path="connections/social" element={<SocialConnections />} />
                          <Route path="account/profile" element={<Profile />} />
                          <Route path="account/settings" element={<AccountSettings />} />
                        </Route>

                        <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
                      </Routes>
                  </YtmdProvider>
                </ConfigProvider>
              </AuthProvider>
            </ProfileProvider>
          </ThemeProvider>
        </LanguageProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
