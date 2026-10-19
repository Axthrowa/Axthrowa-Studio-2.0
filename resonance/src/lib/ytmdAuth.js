const APP_ID = 'resonancewidget'
const APP_NAME = 'Resonance'
const APP_VERSION = '1.0.0'

const HOST_KEY = 'resonance_ytmd_host'
const PORT_KEY = 'resonance_ytmd_port'
const TOKEN_KEY = 'resonance_ytmd_token'

export function getYtmdHost() {
  return localStorage.getItem(HOST_KEY) || '127.0.0.1'
}

export function getYtmdPort() {
  return localStorage.getItem(PORT_KEY) || '9863'
}

export function setYtmdConnection(host, port) {
  localStorage.setItem(HOST_KEY, host)
  localStorage.setItem(PORT_KEY, port)
}

export function getYtmdBaseUrl() {
  return `http://${getYtmdHost()}:${getYtmdPort()}/api/v1`
}

export function getYtmdToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearYtmdToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const UNREACHABLE_MESSAGE =
  "Couldn't reach YouTube Music Desktop. Make sure the app is running and its Companion Server is enabled in Settings > Integrations."

async function fetchOrUnreachable(url, options) {
  try {
    return await fetch(url, options)
  } catch {
    throw new Error(UNREACHABLE_MESSAGE)
  }
}

async function requestCode() {
  const res = await fetchOrUnreachable(`${getYtmdBaseUrl()}/auth/requestcode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: APP_ID, appName: APP_NAME, appVersion: APP_VERSION }),
  })
  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch {
      /* non-JSON error body */
    }
    if (body?.code === 'AUTHORIZATION_DISABLED') {
      throw new Error(
        'YouTube Music Desktop has new connection requests turned off. In the app, go to Settings > Integrations > Companion Server and enable "Authorization requests" (it turns itself back off after each use), then hit Connect again.',
      )
    }
    throw new Error(
      `Could not reach YouTube Music Desktop (HTTP ${res.status}). Make sure the app is running and its Companion Server is enabled in Settings.`,
    )
  }
  const data = await res.json()
  return data.code
}

async function requestToken(code) {
  const res = await fetchOrUnreachable(`${getYtmdBaseUrl()}/auth/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId: APP_ID, code }),
  })
  if (!res.ok) {
    throw new Error(
      `YouTube Music Desktop denied the connection request (HTTP ${res.status}). Approve the prompt in the app within 30 seconds.`,
    )
  }
  const data = await res.json()
  clearYtmdToken()
  localStorage.setItem(TOKEN_KEY, data.token)
  return data.token
}

// Requests a pairing code, then waits (up to ~30s) for the user to approve
// the connection inside the YouTube Music Desktop app itself.
export async function connectYtmd() {
  const code = await requestCode()
  return requestToken(code)
}
