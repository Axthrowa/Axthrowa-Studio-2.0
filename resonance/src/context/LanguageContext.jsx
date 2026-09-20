import { createContext, useContext, useEffect, useState } from 'react'
import { translations } from '../i18n/translations'

const LanguageContext = createContext(null)
const STORAGE_KEY = 'resonance_language'

function resolve(dict, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), dict)
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem(STORAGE_KEY) || 'tr')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const t = (path) => {
    const value = resolve(translations[language], path)
    if (value !== undefined) return value
    const fallback = resolve(translations.en, path)
    return fallback !== undefined ? fallback : path
  }

  const toggleLanguage = () => setLanguage((l) => (l === 'tr' ? 'en' : 'tr'))

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
