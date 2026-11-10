import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";

/**
 * Giriş / Çıkış / Mola ekranlarındaki şarkı sözleri. Görünüm Resonance'tan gelir:
 * "şimdi çalıyor" kartı gibi Resonance'ın kendi sayfası gömülür, ayarlar tek yerdedir.
 */
export default function ResonanceLyrics({ placeholder }: { placeholder?: boolean }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Çerçevenin açacağı yol sınanır; Resonance'sız sunucu Studio'nun index.html'ini döndürür
    fetch(`${API_BASE}/resonance/lyrics`, { cache: "no-store" })
      .then(async (r) => r.ok && (await r.text()).includes("<title>Resonance</title>"))
      .then((resonance) => !cancelled && setReady(resonance))
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: 900,
        height: 180,
        pointerEvents: "none",
        outline: placeholder ? "1px dashed rgba(255,255,255,.25)" : undefined,
      }}
    >
      {placeholder && (
        <span style={{ position: "absolute", left: 8, top: 6, fontSize: 12, color: "rgba(255,255,255,.6)" }}>Şarkı sözleri</span>
      )}
      {ready && (
        <iframe
          title="Şarkı Sözleri"
          src={`${API_BASE}/resonance/lyrics?p=aktif&embed=1`}
          style={{ width: "100%", height: "100%", border: 0, background: "transparent", colorScheme: "normal" }}
          sandbox="allow-scripts allow-same-origin"
          scrolling="no"
        />
      )}
    </div>
  );
}
