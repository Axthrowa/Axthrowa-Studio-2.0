import { createContext, useContext, useEffect, useState } from 'react'
import { saveOverlayConfig } from '../lib/hostBridge'
import { migrateCoverConfig } from '../lib/coverShape'

const ConfigContext = createContext(null)
const PROFILES_KEY = 'resonance_profiles'
const ACTIVE_KEY = 'resonance_active_profile'

/**
 * `/overlay` sayfası yapılandırmayı **okur**, asla yazmaz.
 *
 * Sayfa OBS'te ayrı bir tarayıcı profilinde açılıyor; oradaki `localStorage`
 * boş olduğu için varsayılan profille başlıyor. Yazmasına izin verilirse
 * kullanıcının seçtiği temayı varsayılanla ezer.
 */
function saltOkunurSayfa() {
  return /\/(overlay|lyrics)$/.test(window.location.pathname.replace(/\/+$/, ''))
}

export const DEFAULT_CONFIG = {
  musicService: 'spotify',
  skin: 'compact',
  cover: 'square',
  coverGlow: false,
  /** Yuvarlak kapakların çevresine ilerleme halkası. */
  coverRing: false,
  coverBlur: false,
  /** Skin arka planını (kabuk, degrade, bulanık kapak, gölge) gizle. */
  hideBackground: false,
  nothingPlayingCoverUrl: '',
  colorMode: 'magic',
  tintColor: '#22d3b8',
  revealAnimation: 'fade',
  exitAnimation: 'fade',
  font: 'Poppins',
  nothingPlayingTitle: 'Nothing Playing',
  nothingPlayingArtist: 'Waiting for the next track...',
  /** Overlay'de parça yokken "çalmıyor" kartını göster (varsayılan: gizle). */
  showNothingPlaying: false,
  hideOnPause: false,
  hideOnPauseDelay: 5,
  songChangeOnly: false,
  songChangeVisibleDuration: 5,
  hideVisualizer: false,
  /** Kart genişliği (px); 0 = temanın varsayılanı. Şarkı adı uzunluğu kartı değiştirmez. */
  cardWidth: 0,
  /** Senkron şarkı sözlerini kartın altında göster. */
  showLyrics: false,
  /** Sözleri kaydır (ms; + ileri). */
  lyricsOffsetMs: 0,
  /** Söz görünümü: giriş/çıkış/mola ekranları ve ayrı OBS kaynağı aynı ayarı kullanır. */
  lyricsFontSize: 26,
  lyricsSideSize: 18,
  lyricsColor: '#ffffff',
  /** Yalnız o anki satır (önceki/sonraki gizli). */
  lyricsSingleLine: false,
  /** Söz görünümü (bkz. SOZ_TEMALARI) */
  lyricsTheme: 'klasik',
  /** Kaç satır: 'uc' önceki-şimdi-sonraki, 'iki' şimdi-sonraki, 'tek' yalnız şimdi */
  lyricsLayout: 'uc',
  lyricsAlign: 'center',
  /** Boş: kartın yazı tipi */
  lyricsFont: '',
  lyricsBgOpacity: 0.75,
  /** Zamanı olmayan sözleri süreye yayarak göster */
  lyricsPlain: true,
  /** Sığmayan başlık kayar */
  marquee: true,
  showAlbum: false,
  timeRemaining: false,
  /** Süre etiketleri arasında ses dalgası */
  timeWave: true,
  /** Kart arka planı: yok, aurora, akis, nabiz, nefes */
  animatedBg: 'yok',
  /** Hazır renk paleti; boş: renk kipi */
  palet: '',
}

function makeProfile(name) {
  return {
    id: crypto.randomUUID(),
    name,
    config: { ...DEFAULT_CONFIG },
  }
}

/** Eski localStorage kayıtlarında yeni anahtarlar eksik olabiliyor (`undefined sn`). */
function normalizeConfig(config) {
  return migrateCoverConfig({
    ...DEFAULT_CONFIG,
    ...(config && typeof config === 'object' ? config : {}),
  })
}

function normalizeProfiles(list) {
  if (!Array.isArray(list) || !list.length) return [makeProfile('Main')]
  return list.map((p) => ({
    ...p,
    id: p.id || crypto.randomUUID(),
    name: p.name || 'Profile',
    config: normalizeConfig(p.config),
  }))
}

function loadProfiles() {
  const raw = localStorage.getItem(PROFILES_KEY)
  if (raw) {
    try {
      return normalizeProfiles(JSON.parse(raw))
    } catch {
      /* fall through to default */
    }
  }
  return [makeProfile('Main')]
}

export function ConfigProvider({ children }) {
  const [profiles, setProfiles] = useState(loadProfiles)
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY))

  useEffect(() => {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
  }, [profiles])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  // Self-heal: if activeId is missing or points at a profile that no longer
  // exists (e.g. first-ever load, or the active profile was deleted), fall
  // back to the first available profile.
  useEffect(() => {
    if (profiles.length && !profiles.some((p) => p.id === activeId)) {
      setActiveId(profiles[0].id)
    }
  }, [profiles, activeId])

  const activeProfile = profiles.find((p) => p.id === activeId) || profiles[0]

  // Yapılandırmayı uygulamanın kendi sunucusuna (Rust) yaz.
  //
  // Bu iş eskiden yalnızca Pulse sayfasındaki bir efektte yapılıyordu. O sayfa
  // açık değilken — ör. tema Müzik sayfasından değiştirilince — kayıt sunucuya
  // hiç gitmiyordu. Panel önizlemesi aynı tarayıcının `localStorage`'ını
  // gördüğü için değişikliği hemen gösteriyor, OBS ise ayrı bir tarayıcı
  // profili olduğu için yalnızca sunucudan okuyabiliyor ve eski temada
  // kalıyordu. Yazmayı buraya alarak "hangi sayfa açık" sorusunu tamamen
  // devre dışı bırakıyoruz.
  useEffect(() => {
    if (!activeProfile || saltOkunurSayfa()) return undefined
    let iptal = false
    let zamanlayici
    let deneme = 0

    const yaz = () => {
      // Rust her kaydı ayrıca `aktif` anahtarına yansıtıyor, tek çağrı yeterli.
      saveOverlayConfig(activeProfile.id, { config: activeProfile.config }).catch(() => {
        // Açılışta sunucu henüz ayakta olmayabiliyor. Eski kod burada
        // `isHostAvailable()`'ın 15 sn önbelleklenmiş olumsuz yanıtına
        // güvenip kaydı sessizce düşürüyordu; artık yeniden deniyoruz.
        if (iptal || deneme >= 4) return
        deneme += 1
        zamanlayici = setTimeout(yaz, 1000 * deneme)
      })
    }

    // Kaydırıcılar sürüklenirken her değişimde istek atmasın.
    zamanlayici = setTimeout(yaz, 250)
    return () => {
      iptal = true
      clearTimeout(zamanlayici)
    }
  }, [activeProfile])

  const addProfile = (name) => {
    const profile = makeProfile(name || `Profile ${profiles.length + 1}`)
    setProfiles((prev) => [...prev, profile])
    setActiveId(profile.id)
    return profile
  }

  const deleteProfile = (id) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id)
      return next.length ? next : [makeProfile('Main')]
    })
  }

  const updateConfig = (patch) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeId
          ? { ...p, config: normalizeConfig({ ...p.config, ...patch }) }
          : p,
      ),
    )
  }

  const renameProfile = (id, name) => {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  return (
    <ConfigContext.Provider
      value={{
        profiles,
        activeProfile,
        activeId,
        setActiveId,
        addProfile,
        deleteProfile,
        updateConfig,
        renameProfile,
      }}
    >
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider')
  return ctx
}
