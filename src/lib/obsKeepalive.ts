import { useEffect } from "react";
import { API_BASE, isObsMode } from "./api";

/**
 * OBS tarayıcı kaynağı toparlama.
 *
 * OBS kapatılıp açılınca kaynaklar bazen uygulama ayaktayken bile siyah
 * kalıyor (CEF ilk isteği kaçırıyor / donmuş bellek). Panel tarafı
 * WebSocket ile "Yenile" basıyor; burada da sayfa ayaktaysa soft/hard
 * toparlama yapılır — video/YouTube ve bfcache için.
 */
export function useObsKeepalive() {
  useEffect(() => {
    if (!isObsMode()) return undefined;

    let cancelled = false;
    let wasDown = false;
    let checking = false;
    let everOk = false;

    const reloadOnce = () => {
      const key = "obs_keepalive_reload_at";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last < 12_000) return;
      sessionStorage.setItem(key, String(Date.now()));
      location.reload();
    };

    const softKick = () => {
      window.dispatchEvent(new Event("obs-source-visible"));
    };

    const check = async () => {
      if (cancelled || checking) return;
      checking = true;
      try {
        const r = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
        if (!r.ok) throw new Error("health");
        if (wasDown && everOk) reloadOnce();
        wasDown = false;
        everOk = true;
      } catch {
        wasDown = true;
      } finally {
        checking = false;
      }
    };

    const onVisible = () => {
      if (document.hidden) return;
      softKick();
      void check();
    };

    const onPageShow = (ev: PageTransitionEvent) => {
      softKick();
      if (ev.persisted) reloadOnce();
      else void check();
    };

    // İlk açılışta sunucu henüz yoksa: gelene kadar yokla, sonra soft kick.
    // (CEF hata sayfasındaysa bu kod hiç çalışmaz — panel OBS yenilemesi şart.)
    void (async () => {
      for (let i = 0; i < 40 && !cancelled; i++) {
        try {
          const r = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
          if (r.ok) {
            everOk = true;
            softKick();
            return;
          }
        } catch {
          /* */
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    })();

    void check();
    const timer = window.setInterval(() => void check(), 4000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow as EventListener);
    window.addEventListener("focus", softKick);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow as EventListener);
      window.removeEventListener("focus", softKick);
    };
  }, []);
}
