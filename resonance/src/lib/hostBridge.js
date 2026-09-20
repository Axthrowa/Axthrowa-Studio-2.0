// Resonance, Yayın Yönetim Aracı'nın yerel HTTP sunucusundan (varsayılan
// 127.0.0.1:8843) servis edilir. Bu modül o "host" ile konuşur.
//
// Neden gerekli: Spotify yetkilendirmesi artık tarayıcı `sessionStorage`'ında
// değil host tarafında (Rust) tamamlanıyor, "şu an çalan" bilgisi de tek
// merkezde toplanıyor. Böylece panel, Resonance ve OBS overlay'leri aynı
// veriyi görüyor — her biri ayrı ayrı Spotify'a bağlanmak zorunda kalmıyor.

const HOST_BASE = window.location.pathname.startsWith('/resonance')
  ? window.location.origin
  : import.meta.env.VITE_HOST_API || 'http://127.0.0.1:8843'

let availability = { known: false, value: false, checkedAt: 0 }

export function hostBaseUrl() {
  return HOST_BASE
}

async function hostFetch(path, options) {
  const res = await fetch(`${HOST_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `Host ${res.status}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export async function isHostAvailable(force = false) {
  const fresh = Date.now() - availability.checkedAt < 15_000
  if (!force && availability.known && fresh) return availability.value
  try {
    const res = await fetch(`${HOST_BASE}/api/health`, { cache: 'no-store' })
    availability = { known: true, value: res.ok, checkedAt: Date.now() }
  } catch {
    // Olumsuz sonucu uzun süre kilitleme: açılışta sunucu henüz
    // ayaktayken 15 sn boyunca kısa OBS adresine düşülüyordu.
    availability = { known: true, value: false, checkedAt: Date.now() - 12_000 }
  }
  return availability.value
}

export function getPlayerStatus() {
  return hostFetch('/api/player/status')
}

export function setPlayerSource(source) {
  return hostFetch('/api/player/source', {
    method: 'POST',
    body: JSON.stringify({ source }),
  })
}

export function playerCommand(action, source) {
  return hostFetch('/api/player/command', {
    method: 'POST',
    body: JSON.stringify({ action, source }),
  })
}

export function requestSpotifyAuthorizeUrl(clientId, redirectUri) {
  return hostFetch('/api/player/spotify/authorize', {
    method: 'POST',
    body: JSON.stringify({ clientId, redirectUri }),
  })
}

export function submitSpotifyManualCode(value) {
  return hostFetch('/api/player/spotify/manual', {
    method: 'POST',
    body: JSON.stringify({ value }),
  })
}

export function submitSpotifyRefreshToken(clientId, refreshToken) {
  return hostFetch('/api/player/spotify/token', {
    method: 'POST',
    body: JSON.stringify({ clientId, refreshToken }),
  })
}

export function disconnectSpotify() {
  return hostFetch('/api/player/spotify/disconnect', { method: 'POST' })
}

export function getRecentlyPlayedViaHost(limit = 50) {
  return hostFetch(`/api/player/spotify/recently-played?limit=${encodeURIComponent(limit)}`)
}

export function putYtmdSession({ host, port, token }) {
  return hostFetch('/api/player/ytmd/session', {
    method: 'POST',
    body: JSON.stringify({ host: String(host || ''), port: String(port || ''), token: token || '' }),
  })
}

export function saveOverlayConfig(id, data) {
  return hostFetch('/api/overlay-config', {
    method: 'POST',
    body: JSON.stringify({ id, data }),
  })
}

export function loadOverlayConfig(id) {
  return hostFetch(`/api/overlay-config?id=${encodeURIComponent(id)}`)
}

export function getNowPlaying() {
  return hostFetch('/api/now-playing')
}

export function putNowPlaying(nowPlaying) {
  return hostFetch('/api/now-playing', {
    method: 'POST',
    body: JSON.stringify(nowPlaying),
  })
}

export function openExternalViaHost(url) {
  return hostFetch('/api/open-external', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

// Spotify'ın onay sayfası iframe içinde açılamaz (X-Frame-Options), üstelik
// uygulama WebView2 içinde çalışırken `window.open` sessizce engelleniyor —
// hata da fırlatmadığı için "Bağlan"a basınca hiçbir şey olmuyordu.
// Bu yüzden açmayı önce host'a yaptırıyoruz.
export async function openExternal(url) {
  const embedded = window.parent && window.parent !== window
  if (embedded) {
    // Panel bir bildirim gösterebilsin
    window.parent.postMessage({ source: 'resonance', type: 'open-external', url }, '*')
  }
  try {
    await openExternalViaHost(url)
    return
  } catch {
    // Host yoksa (Resonance tek başına) normal sekmeye düş
  }
  if (embedded) return
  const win = window.open(url, '_blank', 'noopener')
  if (!win) {
    throw new Error(
      'Tarayıcı açılamadı. Adresi elle açın: ' + url,
    )
  }
}

export function notifyHostChanged(what) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'resonance', type: 'changed', what }, '*')
  }
}
