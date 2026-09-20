import { useEffect, useState } from "react";

type ObsStudio = {
  onVisibilityChange?: (visible: boolean) => void;
  onActiveChange?: (active: boolean) => void;
};

/**
 * OBS tarayıcı kaynağının şu an programda/görünür olup olmadığı.
 *
 * Giriş / çıkış / mola overlay'leri başka sahnedeyken arka planda video
 * çalmasın; sahneye geçilince oynatma başlasın.
 *
 * Kaynaklar: Page Visibility API + obs-browser olayları
 * (`obsSourceVisibleChanged` / `obsSourceActiveChanged`).
 */
export function useObsSourceActive(enabled: boolean): boolean {
  const [active, setActive] = useState(() => {
    if (!enabled) return true;
    // OBS Browser Source: bilinmeyen durumda gizli varsay — yanlışlıkla
    // arka planda sayaç/video başlamasın. İlk olay veya görünürlük düzeltir.
    if (typeof window !== "undefined" && (window as unknown as { obsstudio?: unknown }).obsstudio) {
      return !document.hidden;
    }
    return !document.hidden;
  });

  useEffect(() => {
    if (!enabled) {
      setActive(true);
      return undefined;
    }

    let pageVisible = !document.hidden;
    let sourceVisible = true;
    let sourceActive = true;

    const sync = () => {
      setActive(pageVisible && sourceVisible && sourceActive);
    };

    const onPageVis = () => {
      pageVisible = !document.hidden;
      sync();
    };

    const onObsVisible = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (typeof d === "boolean") sourceVisible = d;
      else if (d && typeof d.visible === "boolean") sourceVisible = d.visible;
      sync();
    };

    const onObsActive = (ev: Event) => {
      const d = (ev as CustomEvent).detail;
      if (typeof d === "boolean") sourceActive = d;
      else if (d && typeof d.active === "boolean") sourceActive = d.active;
      sync();
    };

    document.addEventListener("visibilitychange", onPageVis);
    window.addEventListener("obsSourceVisibleChanged", onObsVisible as EventListener);
    window.addEventListener("obsSourceActiveChanged", onObsActive as EventListener);

    // Eski OBS sürümleri
    const studio = (window as unknown as { obsstudio?: ObsStudio }).obsstudio;
    const prevVis = studio?.onVisibilityChange;
    const prevAct = studio?.onActiveChange;
    if (studio) {
      studio.onVisibilityChange = (v) => {
        sourceVisible = !!v;
        sync();
        prevVis?.(v);
      };
      studio.onActiveChange = (a) => {
        sourceActive = !!a;
        sync();
        prevAct?.(a);
      };
    }

    sync();

    return () => {
      document.removeEventListener("visibilitychange", onPageVis);
      window.removeEventListener("obsSourceVisibleChanged", onObsVisible as EventListener);
      window.removeEventListener("obsSourceActiveChanged", onObsActive as EventListener);
      if (studio) {
        studio.onVisibilityChange = prevVis;
        studio.onActiveChange = prevAct;
      }
    };
  }, [enabled]);

  return active;
}
