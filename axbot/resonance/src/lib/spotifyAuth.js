import {
  hostBaseUrl,
  isHostAvailable,
  openExternal,
  requestSpotifyAuthorizeUrl,
  submitSpotifyManualCode,
  submitSpotifyRefreshToken,
} from './hostBridge'

// Uygulama `/resonance` alt yolundan servis edildiği için callback de o yolun
// altında olmak zorunda; eski `${origin}/callback` fallback'i 404'e düşüp
// yetkilendirmeyi sessizce bozuyordu.
const REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/resonance/callback`

// Host (Rust) üzerinden bağlanıldığında token değişimi orada yapılır; Spotify
// Dashboard'a kaydedilmesi gereken adres budur.
//
// Sunucu iki yolu da karşılıyor. Dashboard'da kayıtlı olmayanla gidilirse
// Spotify "redirect_uri: Not matching configuration" deyip akışı kesiyor, bu
// yüzden hangisinin kullanılacağı seçilebilir olmalı.
// Sunucunun gerçekten karşıladığı yollar (src-tauri: SPOTIFY_CALLBACK_PATHS).
// Dashboard'da hangisi kayıtlıysa o seçilebilsin.
export const BROKER_REDIRECT_URIS = [
  `${hostBaseUrl()}/resonance/callback`,
  `${hostBaseUrl()}/callback`,
  `${hostBaseUrl()}/`,
  `${hostBaseUrl()}/api/player/spotify/callback`,
]

const BROKER_URI_KEY = 'resonance_spotify_redirect_uri'

/// Dashboard'da hangi adres kayıtlıysa o kullanılabilmeli: yol serbest,
/// tek koşul uygulamanın kendi adresi olması (kod başka sunucuya gitmesin).
/// Yalnız sunucunun karşıladığı yollar geçerli — başka bir yola düşen kod
/// sessizce kaybolurdu.
export function isValidBrokerRedirect(uri) {
  return BROKER_REDIRECT_URIS.includes(String(uri || '').trim())
}

export function getBrokerRedirectUri() {
  const saved = localStorage.getItem(BROKER_URI_KEY)
  return isValidBrokerRedirect(saved) ? saved : BROKER_REDIRECT_URIS[0]
}

export function setBrokerRedirectUri(uri) {
  if (isValidBrokerRedirect(uri)) localStorage.setItem(BROKER_URI_KEY, uri)
}

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
  // Panel/overlay kontrol çubuğu için (oynat/duraklat/ileri/geri — Premium ister)
  'user-modify-playback-state',
].join(' ')

const STORAGE_KEY = 'resonance_spotify_tokens'
const VERIFIER_KEY = 'resonance_pkce_verifier'
const CLIENT_ID_KEY = 'resonance_spotify_client_id'

// A user-supplied Client ID (entered on the Connections > Music page) always
// wins — this lets each person link their own Spotify app instead of sharing
// one Client ID (and its Development Mode restrictions) app-wide.
export function getClientId() {
  return localStorage.getItem(CLIENT_ID_KEY) || import.meta.env.VITE_SPOTIFY_CLIENT_ID || ''
}

export function setClientId(clientId) {
  localStorage.setItem(CLIENT_ID_KEY, clientId.trim())
}

export function getRedirectUri() {
  return REDIRECT_URI
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

export function isSpotifyConfigured() {
  return Boolean(getClientId())
}

/// Host varsa yetkilendirmeyi ona devrederiz: PKCE doğrulayıcı Rust belleğinde
/// tutulur, onay sistem tarayıcısında verilir ve token değişimi host'ta biter.
/// Host yoksa (Resonance tek başına açıldıysa) klasik tarayıcı içi PKCE akışı.
export async function redirectToSpotifyAuthorize() {
  if (await isHostAvailable()) {
    const { url } = await requestSpotifyAuthorizeUrl(getClientId(), getBrokerRedirectUri())
    // Açma başarısızsa hata yukarı çıksın; sessiz kalmasın.
    await openExternal(url)
    return
  }
  const verifier = randomString(64)
  const challenge = base64UrlEncode(await sha256(verifier))
  sessionStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

/// Onay adresini üretir ama açmaz — kullanıcı elle açıp dönüş linkini
/// yapıştırabilsin diye. Tarayıcı açma mekanizmasına hiç bağlı değil.
export async function getSpotifyAuthorizeUrl() {
  const { url } = await requestSpotifyAuthorizeUrl(getClientId(), getBrokerRedirectUri())
  return url
}

/// Hazır refresh token ile bağlanır — onay akışı ve redirect adresi gerekmez.
export function connectSpotifyWithRefreshToken(refreshToken) {
  return submitSpotifyRefreshToken(getClientId(), refreshToken)
}

/// Adres çubuğundan kopyalanan dönüş linkini (veya sadece kodu) gönderir.
export function connectSpotifyWithPastedUrl(value) {
  return submitSpotifyManualCode(value)
}

export async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Spotify token exchange failed: ${res.status} ${errBody}`)
  }

  const tokens = await res.json()
  saveTokens(tokens)
  return tokens
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status}`)
  }

  const tokens = await res.json()
  if (!tokens.refresh_token) tokens.refresh_token = refreshToken
  saveTokens(tokens)
  return tokens
}

// Refreshes an access token from an explicit refresh token + client id,
// without touching localStorage. Used by the /overlay page when a Browser
// Source URL carries its own embedded Spotify credentials — this is what
// lets the URL work inside OBS, whose browser profile is entirely separate
// from your regular one and can't see tokens saved there.
export async function refreshAccessTokenStandalone({ refreshToken, clientId }) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status}`)
  }

  const tokens = await res.json()
  return {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }
}

function saveTokens(tokens) {
  const record = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export function getStoredTokens() {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

export function getRefreshToken() {
  return getStoredTokens()?.refresh_token || null
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY)
}

export async function getValidAccessToken() {
  const tokens = getStoredTokens()
  if (!tokens) return null

  if (Date.now() < tokens.expires_at - 30_000) {
    return tokens.access_token
  }

  if (!tokens.refresh_token) {
    clearTokens()
    return null
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token)
    return refreshed.access_token
  } catch {
    clearTokens()
    return null
  }
}
