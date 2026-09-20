import { createContext, useContext, useEffect, useState } from 'react'

const ProfileContext = createContext(null)
const USERNAME_KEY = 'resonance_username'
const BIO_KEY = 'resonance_bio'
const JOINED_KEY = 'resonance_joined_at'

export function ProfileProvider({ children }) {
  const [username, setUsernameState] = useState(() => localStorage.getItem(USERNAME_KEY) || '')
  const [bio, setBioState] = useState(() => localStorage.getItem(BIO_KEY) || '')
  const [joinedAt] = useState(() => {
    const existing = localStorage.getItem(JOINED_KEY)
    if (existing) return existing
    const now = new Date().toISOString()
    localStorage.setItem(JOINED_KEY, now)
    return now
  })

  useEffect(() => {
    if (username) localStorage.setItem(USERNAME_KEY, username)
  }, [username])

  useEffect(() => {
    localStorage.setItem(BIO_KEY, bio)
  }, [bio])

  const setUsername = (name) => setUsernameState(name.trim())
  const setBio = (value) => setBioState(value)

  const resetAllData = () => {
    localStorage.clear()
    // Uygulama `/resonance` altından servis ediliyor; kök adres ana panele
    // gidiyordu, Resonance'a değil.
    window.location.href = '/resonance/dashboard/home'
  }

  return (
    <ProfileContext.Provider
      value={{ username, setUsername, hasUsername: Boolean(username), bio, setBio, joinedAt, resetAllData }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
