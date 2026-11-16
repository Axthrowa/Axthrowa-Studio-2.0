import { useEffect, useState } from 'react'

/** OBS tarayıcı kaynağının API'si; AxBoT çerçevesinin içindeysek üst pencereninki (aynı köken) */
function obsApi() {
  if (window.obsstudio) return { obs: window.obsstudio, pencere: window }
  try {
    if (window.parent !== window && window.parent.obsstudio) return { obs: window.parent.obsstudio, pencere: window.parent }
  } catch {
    /* başka kökenli üst pencere */
  }
  return null
}

/**
 * R5: OBS'te o an yayındaki sahne adı (`window.obsstudio`, sunucuya istek yok). OBS dışında boş.
 * OBS'te kaynağın "Sayfa izinleri" en az "Kullanıcı bilgisini okuma" olmalı (varsayılan).
 * `?sahne=Ad`: OBS dışında kuralları denemek için.
 */
export function useObsSahnesi(deneme = '') {
  const [ad, setAd] = useState(deneme)
  useEffect(() => {
    if (deneme) return undefined
    const api = obsApi()
    if (!api?.obs?.getCurrentScene) return undefined
    try {
      api.obs.getCurrentScene((s) => setAd(String(s?.name || '')))
    } catch {
      /* izin yok */
    }
    const dinle = (e) => setAd(String(e?.detail?.name || ''))
    api.pencere.addEventListener('obsSceneChanged', dinle)
    return () => api.pencere.removeEventListener('obsSceneChanged', dinle)
  }, [deneme])
  return ad
}
