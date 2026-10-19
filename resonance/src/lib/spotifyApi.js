import { getValidAccessToken } from './spotifyAuth'

const BASE = 'https://api.spotify.com/v1'

async function request(path) {
  const token = await getValidAccessToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 204) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Spotify API error: ${res.status} ${body}`)
  }
  return res.json()
}

export function getMe() {
  return request('/me')
}

export function getCurrentlyPlaying() {
  return request('/me/player/currently-playing?additional_types=track,episode')
}

// Bypasses localStorage-based token lookup — used when an access token was
// obtained via an embedded (URL-carried) refresh token instead.
export async function getCurrentlyPlayingWithToken(accessToken) {
  const res = await fetch(`${BASE}/me/player/currently-playing?additional_types=track,episode`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Spotify API error: ${res.status} ${body}`)
  }
  return res.json()
}

export function getRecentlyPlayed(limit = 50) {
  return request(`/me/player/recently-played?limit=${limit}`)
}
