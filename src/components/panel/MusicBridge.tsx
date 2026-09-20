import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";

/**
 * YouTube Music köprüsü — panelde **her zaman** açık kalır.
 *
 * YTMD Companion Server'a bağlanan soket tarayıcıda yaşıyor: veriyi
 * uygulamaya taşıyan da o. Köprü yalnız Müzik sekmesindeki Resonance
 * çerçevesinde çalıştığı için, kullanıcı Giriş/Çıkış/Mola sekmesine geçince
 * akış kesiliyor ve o ekranlardaki "şimdi çalıyor" kartı boş kalıyordu.
 *
 * Burada gizli, tek bir Resonance overlay çerçevesi tutuyoruz: uygulama açık
 * olduğu sürece veri akmaya devam eder. Yalnızca kaynak YouTube Music iken
 * yüklenir — Spotify'ı Rust kendisi yokluyor, orada köprüye gerek yok.
 */
export default function MusicBridge() {
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/player/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setNeeded(data?.source === "youtube-music");
      } catch {
        /* sunucu kısa süreliğine düşerse son durumu koru */
      }
    };
    void check();
    // Kaynak panelden değiştirilebiliyor; seyrek yoklamak yeterli.
    const timer = window.setInterval(() => void check(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!needed) return null;

  return (
    <iframe
      title="Müzik köprüsü"
      src={`${API_BASE}/resonance/overlay?p=aktif`}
      aria-hidden
      tabIndex={-1}
      sandbox="allow-scripts allow-same-origin"
      // Görünmez ama çalışır durumda: `display:none` bazı tarayıcılarda
      // çerçeveyi askıya alabildiği için ekran dışına taşıyoruz.
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        width: 320,
        height: 200,
        border: 0,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
