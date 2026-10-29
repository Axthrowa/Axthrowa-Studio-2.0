/**
 * Rust → React olay köprüsü. Rust `app.emit("ad", veri)` / `emit_to("main", …)` gönderir; bileşen bu hook'la
 * dinler, kaldırılınca dinleme biter. Tarayıcıda (OBS sayfası, uzak panel) Tauri yoktur: hiçbir şey yapmaz.
 * React → Rust yönü için komutlar `invoke` ile çağrılır; OBS komutları `lib/obsControl.ts`'te hazır.
 *
 *   useAxthrowaEvents<string>("hotkey-trigger", (id) => …);
 */
import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";

export function useAxthrowaEvents<T = unknown>(ad: string, isle: (veri: T) => void): void {
  // Her çizimde yeni işleyici gelse de dinleyici yeniden kurulmasın
  const isleyici = useRef(isle);
  isleyici.current = isle;

  useEffect(() => {
    if (!isTauri()) return;
    let birak: (() => void) | undefined;
    let bitti = false;
    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen<T>(ad, (e) => isleyici.current(e.payload)))
      .then((f) => {
        // Dinleme kurulmadan bileşen kalktıysa hemen bırak
        if (bitti) f();
        else birak = f;
      })
      .catch(() => {});
    return () => {
      bitti = true;
      birak?.();
    };
  }, [ad]);
}
