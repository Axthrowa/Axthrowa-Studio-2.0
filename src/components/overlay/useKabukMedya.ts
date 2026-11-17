/** OverlayShell'den ayrıldı (TEK-4, davranış aynı): video ve fon müziği oynatma, sarma ve döngü. */
import { useEffect } from "react";
import { OverlaySettings } from "../../lib/api";

export type UseKabukMedyaGirdisi = {
  audioNode: HTMLAudioElement | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioSrc: string | null;
  endedRef: React.RefObject<boolean>;
  holdPlaybackRef: React.RefObject<boolean>;
  obs: boolean;
  preview: boolean;
  settings: OverlaySettings;
  settingsRef: React.RefObject<OverlaySettings>;
  sourceActive: boolean;
  videoBitisiyleBitirRef: React.RefObject<boolean>;
  videoNode: HTMLVideoElement | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoSrc: string;
};

export function useKabukMedya({ audioNode, audioRef, audioSrc, endedRef, holdPlaybackRef, obs, preview, settings, settingsRef, sourceActive, videoBitisiyleBitirRef, videoNode, videoRef, videoSrc }: UseKabukMedyaGirdisi) {

  useEffect(() => {
    const el = videoNode;
    if (!el) return;

    if (!videoSrc) {
      el.pause();
      el.removeAttribute("src");
      try {
        el.load();
      } catch {
        /* */
      }
      return;
    }

    let disposed = false;
    el.pause();
    el.src = videoSrc;
    el.preload = "auto";
    // Otomatik oynatma kilidi: önce sessiz başla, oynatma tutunca sesi aç.
    el.muted = true;
    el.load();

    const start = Number(settingsRef.current.bgVideoStart) || 0;
    const end = Number(settingsRef.current.bgVideoEnd) || 0;
    // Bitişi video belirliyorsa döngüye almıyoruz, yoksa son hiç gelmez.
    el.loop = !videoBitisiyleBitirRef.current && !(end > start);

    const startPlayback = () => {
      if (disposed || holdPlaybackRef.current) return;
      if (start > 0 && Math.abs(el.currentTime - start) > 0.05) {
        try {
          el.currentTime = start;
        } catch {
          /* seek edilemiyorsa baştan oynasın */
        }
      }
      el.volume = Math.min(1, Math.max(0, (settingsRef.current.videoVolume ?? 100) / 100));
      el.play()
        .then(() => {
          if (!disposed && settingsRef.current.videoSound) el.muted = false;
        })
        .catch(() => {
          if (disposed || holdPlaybackRef.current) return;
          el.muted = true;
          el.play().catch(() => {});
        });
    };

    // Fon videosu duraklamamalı: sarma, sahne değişimi veya kısa bir kaynak
    // kesintisi sonrası oynatma düşerse kendini toparlasın. Sayaç, tarayıcı
    // gerçekten reddediyorsa sonsuz denemeyi engelliyor.
    let resumeTries = 0;
    let resumeTimer: { id?: number } = {};
    const onPlaying = () => {
      resumeTries = 0;
    };
    const onPause = () => {
      // Bitiş tetiklendiyse (endedRef) videoyu diriltmiyoruz: son karede
      // kalsın, yayın kapanıyor / sahne değişiyor.
      // Play-once (Giriş→oyun / Çıkış→stop): tarayıcı ended öncesi pause
      // atınca resume videoyu başa sarıp onEnded'i yutuyordu.
      // Sahne görünür değilken bilerek duraklattık — tekrar başlatma.
      if (
        disposed ||
        el.ended ||
        endedRef.current ||
        videoBitisiyleBitirRef.current ||
        holdPlaybackRef.current ||
        resumeTries >= 5
      ) {
        return;
      }
      resumeTries += 1;
      if (resumeTimer.id) window.clearTimeout(resumeTimer.id);
      resumeTimer.id = window.setTimeout(() => {
        if (
          !disposed &&
          !endedRef.current &&
          !videoBitisiyleBitirRef.current &&
          !holdPlaybackRef.current &&
          el.paused
        ) {
          el.play().catch(() => {});
        }
      }, 400);
    };

    // Dosya önbellekteyse loadeddata bu satıra gelmeden ateşlenmiş olabilir.
    if (el.readyState >= 2) startPlayback();
    // canplay yedeği: bazı WebView sürümlerinde loadeddata gelmiyor.
    el.addEventListener("loadeddata", startPlayback);
    el.addEventListener("canplay", startPlayback);
    el.addEventListener("pause", onPause);
    el.addEventListener("playing", onPlaying);

    // Başlangıçta kaynak gizliyse hemen durdur (başka sahnede yüklendiyse).
    if (holdPlaybackRef.current) {
      el.pause();
      el.muted = true;
    }

    return () => {
      disposed = true;
      if (resumeTimer.id) window.clearTimeout(resumeTimer.id);
      el.removeEventListener("loadeddata", startPlayback);
      el.removeEventListener("canplay", startPlayback);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("playing", onPlaying);
    };
  }, [videoNode, videoSrc]);

  // OBS sahne görünürlüğü: gizliyken dur; görünür olunca baştan oynat.
  useEffect(() => {
    const el = videoNode;
    if (!el || !videoSrc || !obs) return;
    if (!sourceActive) {
      el.pause();
      el.muted = true;
      return;
    }
    const start = Number(settingsRef.current.bgVideoStart) || 0;
    try {
      if (start >= 0) el.currentTime = start;
    } catch {
      /* */
    }
    el.volume = Math.min(1, Math.max(0, (settingsRef.current.videoVolume ?? 100) / 100));
    el.muted = true;
    el.play()
      .then(() => {
        if (settingsRef.current.videoSound) el.muted = false;
      })
      .catch(() => {
        el.muted = true;
        el.play().catch(() => {});
      });
  }, [sourceActive, videoNode, videoSrc, obs]);

  useEffect(() => {
    const el = videoNode;
    if (!el || !videoSrc) return;
    const start = Number(settings.bgVideoStart) || 0;
    const end = Number(settings.bgVideoEnd) || 0;
    // `videoBitisiyleBitir` daha aşağıda hesaplanıyor; ref üzerinden okuyoruz.
    el.loop = !videoBitisiyleBitirRef.current && !(end > start);
    if (start > 0 && el.readyState >= 2 && el.currentTime < start - 0.05) {
      try {
        el.currentTime = start;
      } catch {
        /* */
      }
    }
  }, [videoNode, videoSrc, settings.bgVideoStart, settings.bgVideoEnd, settings.endingMinutes, settings.targetDate]);

  useEffect(() => {
    const el = videoNode;
    if (!el || !videoSrc) return;
    el.volume = Math.min(1, Math.max(0, (settings.videoVolume ?? 100) / 100));
    if (holdPlaybackRef.current) {
      el.muted = true;
      el.pause();
      return;
    }
    el.muted = !settings.videoSound;
    // Sesi açmak oynatmayı durdurabilir (autoplay ilkesi) — tekrar dene.
    if (el.paused) el.play().catch(() => {});
  }, [videoNode, settings.videoSound, settings.videoVolume, videoSrc, sourceActive]);

  // Panelden "yayına ver" denince önizlemedeki konuma atla.
  // İstek anından bu yana geçen süreyi ekliyoruz: OBS'te açık kalan bir kaynak,
  // düğmeye basıldıktan saniyeler sonra ayarı görürse videoyu geriden değil
  // panelin şu an olduğu yerden sürdürsün.
  const seekAt = Number(settings.videoSeekAt) || 0;
  const seekTo = Number(settings.videoSeek) || 0;
  useEffect(() => {
    const el = videoNode;
    if (!el || !seekAt) return;
    const age = (Date.now() - seekAt) / 1000;
    // Eski bir istek (yeniden yüklenen kaynak) videoyu geri sarmasın.
    if (age < 0 || age > 60) return;
    const target = seekTo + age;
    // Atlamadan sonra oynatma bazen tutmuyor (sekme gizliyken reddedilen
    // play(), tarayıcının seek sırasında duraklatması). Birkaç kez deneyip
    // 'seeked' olayında da tetikliyoruz.
    const kick = () => {
      void el.play().catch(() => {});
    };
    const timers: number[] = [];
    const apply = () => {
      try {
        el.currentTime = target;
      } catch {
        return; /* meta henüz yok */
      }
      el.addEventListener("seeked", kick, { once: true });
      kick();
      timers.push(window.setTimeout(kick, 300), window.setTimeout(kick, 1200));
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      el.removeEventListener("loadedmetadata", apply);
      el.removeEventListener("seeked", kick);
    };
  }, [videoNode, seekAt, seekTo]);

  // OBS sahne değişiminde kaynak gizlenip geri geldiğinde video duraklamış
  // kalabiliyor; görünür olunca kaldığı yerden sürsün.
  //
  // Panel önizlemesinde ayrıca gizlenince duraklatıyoruz: uygulama tepsideyken
  // kimsenin bakmadığı bir videoyu çözmek boşuna CPU/GPU. OBS tarayıcı kaynağı
  // `preview` olmadığı için yayın çıktısı duraklamıyor.
  useEffect(() => {
    const kick = () => {
      const el = videoNode;
      if (!el || !el.src) return;
      if (document.hidden || holdPlaybackRef.current) {
        if ((preview || holdPlaybackRef.current) && !el.paused) el.pause();
        return;
      }
      if (el.paused || el.readyState < 2) {
        try {
          el.load();
        } catch {
          /* */
        }
        void el.play().catch(() => {});
      } else if (el.paused) {
        void el.play().catch(() => {});
      }
    };
    const onVisible = () => kick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("obs-source-visible", kick);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("obs-source-visible", kick);
    };
  }, [videoNode, preview, sourceActive]);

  useEffect(() => {
    const el = audioNode;
    if (!el) return;
    if (!audioSrc) {
      el.pause();
      el.removeAttribute("src");
      try {
        el.load();
      } catch {
        /* */
      }
      return;
    }
    if (el.dataset.src !== audioSrc) {
      el.dataset.src = audioSrc;
      el.src = audioSrc;
      el.load();
    }
    el.loop = !videoBitisiyleBitirRef.current && settings.audioLoop !== false;
    const enabled = settings.musicSound !== false;
    if (holdPlaybackRef.current || !enabled) {
      el.muted = true;
      el.pause();
      return;
    }
    el.muted = false;
    el.volume = Math.min(1, Math.max(0, (settings.musicVolume ?? 70) / 100));
    el.play().catch(() => {});
  }, [
    audioNode,
    audioSrc,
    settings.audioLoop,
    settings.musicVolume,
    settings.musicSound,
    sourceActive,
  ]);

  // Sekme değişince / unmount: tüm medyayı kes
  useEffect(() => {
    return () => {
      const v = videoRef.current;
      const a = audioRef.current;
      if (v) {
        v.pause();
        v.muted = true;
        try {
          v.removeAttribute("src");
          v.load();
        } catch {
          /* */
        }
      }
      if (a) {
        a.pause();
        try {
          a.removeAttribute("src");
          a.load();
        } catch {
          /* */
        }
      }
    };
  }, []);
  return { seekAt, seekTo };
}
