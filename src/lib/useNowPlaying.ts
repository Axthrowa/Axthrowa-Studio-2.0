import { useEffect, useRef, useState } from "react";
import { NowPlaying, fetchNowPlaying } from "./api";
import { subscribeOverlaySync } from "./overlaySyncHub";

/**
 * Panel ve overlay ekranlarının paylaştığı "şu an çalan" kaynağı.
 *
 * Veriyi Rust tutar (Spotify'ı kendisi yoklar, YouTube Music'i Resonance
 * köprüsünden alır), burada yalnızca okunur. İlerleme çubuğu yoklamalar
 * arasında istemcide yürütülür; aksi halde saniyede bir zıplardı.
 */
export function useNowPlaying(enabled = true, pollMs = 5000) {
  const [track, setTrack] = useState<NowPlaying | null>(null);
  const [progress, setProgress] = useState(0);
  const baseRef = useRef({ progress: 0, at: 0, playing: false, duration: 0 });

  useEffect(() => {
    if (!enabled) {
      setTrack(null);
      return;
    }
    let cancelled = false;

    const poll = async () => {
      try {
        const np = await fetchNowPlaying();
        if (cancelled) return;
        setTrack(np && np.title ? np : null);
        // Örnek, kaynağın yoklandığı anda alındı; buraya gelene kadar
        // saniyeler geçmiş olabilir. Yaşı eklemezsek her yoklamada çubuk
        // eski değere geri düşüyor ve şarkı saniyesi takılıyordu.
        const sampledAt = Number(np?.updatedAt) || 0;
        const age = sampledAt > 0 ? Math.max(0, Date.now() - sampledAt) : 0;
        const raw = (np?.progress || 0) + (np?.isPlaying ? age : 0);
        const dur = np?.duration || 0;
        const started = dur > 0 ? Math.min(raw, dur) : raw;
        baseRef.current = {
          progress: started,
          at: Date.now(),
          playing: Boolean(np?.isPlaying),
          duration: dur,
        };
        setProgress(started);
      } catch {
        /* sunucu kısa süreliğine düşerse son bilinen durumu koru */
      }
    };

    void poll();
    let timer = 0;
    let tick = 0;

    // Sekme/pencere gizliyken (panel tepsiye küçültülmüş, OBS kaynağı kapalı)
    // ne yoklama ne de ilerleme sayacı çalışsın — boşuna CPU ve bellek.
    const start = () => {
      if (timer || document.hidden) return;
      timer = window.setInterval(() => void poll(), pollMs);
      tick = window.setInterval(() => {
        const b = baseRef.current;
        if (!b.playing) return;
        const next = b.progress + (Date.now() - b.at);
        setProgress(b.duration ? Math.min(next, b.duration) : next);
      }, 1000);
    };
    const stop = () => {
      window.clearInterval(timer);
      window.clearInterval(tick);
      timer = 0;
      tick = 0;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void poll();
        start();
      }
    };

    // Sunucu her değişimde yayın yapıyor; yoklama yalnız yedek kalsın.
    const unsubscribe = subscribeOverlaySync({
      onMessage: (ev) => {
        try {
          if (JSON.parse(ev.data)?.type === "now-playing") void poll();
        } catch {
          /* ilgisiz mesaj */
        }
      },
    });

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      stop();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, pollMs]);

  return { track, progress };
}
