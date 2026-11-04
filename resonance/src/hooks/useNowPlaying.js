import { useCurrentlyPlaying } from './useCurrentlyPlaying'
import { useHostNowPlaying } from './useHostNowPlaying'
import { useYtmdNowPlaying } from './useYtmdNowPlaying'

// Üç kaynak var ve hangisinin kullanılacağı bağlama göre değişir:
//
// 1. `overrides` (OBS Browser Source URL'i kendi kimlik bilgisini taşıyor)
//    → doğrudan Spotify/YTMD, host'a hiç ihtiyaç yok.
// 2. Host erişilebilir (uygulama içinde çalışıyoruz) → görüntülenen veri
//    host'un tek kaydından gelir. YTMD soketi yine burada çalışır çünkü
//    veriyi host'a taşıyan köprü odur.
// 3. Host yok (Resonance tek başına) → eski davranış.
export function useNowPlaying(musicService, overrides = null) {
  const isYtmd = musicService === 'youtube-music'
  const hasOverride = Boolean(overrides?.spotify || overrides?.ytmd)

  const host = useHostNowPlaying(!hasOverride)
  const useHost = !hasOverride && host.available

  const spotify = useCurrentlyPlaying(1000, !isYtmd && !useHost, overrides?.spotify || null)
  // Köprü her zaman açık: seçili kaynak Spotify olsa bile YTMD çalıyorsa
  // host'a yazılsın, otomatik kaynak geçişi çalışsın.
  const ytmd = useYtmdNowPlaying(true, overrides?.ytmd || null, true)

  if (useHost) return { track: host.track, isPlaying: host.isPlaying, progressMs: host.progressMs }
  return isYtmd ? ytmd : spotify
}
