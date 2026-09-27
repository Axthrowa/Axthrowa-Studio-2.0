import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getStoredTokens, clearTokens, isSpotifyConfigured } from '../lib/spotifyAuth'
import { getMe } from '../lib/spotifyApi'
import { disconnectSpotify, getPlayerStatus, isHostAvailable, notifyHostChanged } from '../lib/hostBridge'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  // Host modunda Spotify oturumu Rust tarafında durur; onay sistem
  // tarayıcısında verildiği için bağlantıyı yoklayarak öğreniriz.
  const [hostMode, setHostMode] = useState(false)
  const [hostStatus, setHostStatus] = useState(null)

  const refreshUser = useCallback(async () => {
    if (await isHostAvailable()) {
      setHostMode(true)
      try {
        const status = await getPlayerStatus()
        setHostStatus(status)
        setUser(
          status?.spotify?.connected
            ? { display_name: status.spotify.displayName || 'Spotify' }
            : null,
        )
        setAuthError(null)
      } catch (err) {
        setAuthError(err.message)
      } finally {
        setLoading(false)
      }
      return
    }

    setHostMode(false)
    if (!getStoredTokens()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const me = await getMe()
      setUser(me)
      setAuthError(null)
    } catch (err) {
      clearTokens()
      setUser(null)
      setAuthError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  // Tarayıcıdaki onay bitince panele dönmek yeterli olsun diye kısa aralıkla
  // yoklarız; "Bağlan"a bastıktan sonra elle yenileme gerekmez.
  useEffect(() => {
    if (!hostMode) return undefined
    const timer = setInterval(refreshUser, 4000)
    return () => clearInterval(timer)
  }, [hostMode, refreshUser])

  const logout = async () => {
    if (hostMode) {
      await disconnectSpotify().catch(() => {})
      setUser(null)
      refreshUser()
      notifyHostChanged('spotify')
      return
    }
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        hostMode,
        hostStatus,
        isAuthenticated: Boolean(user),
        configured: hostMode ? Boolean(hostStatus?.spotify?.clientId) : isSpotifyConfigured(),
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
