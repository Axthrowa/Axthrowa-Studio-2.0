/// Giriş/Çıkış/Mola ekranlarının okuduğu, o an seçili profilin anahtarı.
export const ACTIVE_OVERLAY_ID = 'aktif'

// Packs everything the /overlay page needs (widget config, and — for
// YouTube Music Desktop — the companion server connection) directly into the
// Browser Source URL. This is what makes the URL work when pasted into OBS's
// browser source: OBS uses a completely separate browser profile/storage
// from your regular browser, so it can never see localStorage state set up
// elsewhere. Encoding the needed state into the URL itself sidesteps that.
export function encodeOverlayData(data) {
  return btoa(encodeURIComponent(JSON.stringify(data)))
}

export function decodeOverlayData(str) {
  if (!str) return null
  try {
    return JSON.parse(decodeURIComponent(atob(str)))
  } catch {
    return null
  }
}
