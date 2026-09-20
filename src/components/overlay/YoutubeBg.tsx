import { useCallback, useEffect, useRef } from "react";
import {
  DEFAULT_END_MARGIN,
  EndScreenInfo,
  fetchEndScreenInfo,
  loadYtApi,
  UNKNOWN_END_SCREEN,
  youtubeLoopPoint,
} from "../../lib/youtube";
import { usePreviewQuality } from "../../lib/previewQuality";
import { clearNotice, pushNotice } from "../../lib/notices";
import { shouldCountLoop } from "../../lib/endRules";

/**
 * Döngü noktasına ne kadar erken varılacağı (sn).
 *
 * Yoklama 200 ms'de bir; arka plana alınmış bir sekmede tarayıcı bunu 1 sn'ye
 * kadar seyreltebiliyor. Pay bu gecikmeyi karşılar — kaçırılan tek bir örnek
 * bile videoyu bitiş ekranı bölgesine sokmasın.
 */
const LOOP_LEAD_SEC = 0.45;

/** Örtünün kalkması için üst üste kaç kez gerçek ilerleme görülmeli. */
const PROGRESS_SAMPLES = 2;

/**
 * YouTube iFrame API hata kodlarını okunur açıklamaya çevirir.
 *
 * Kod olmadan kullanıcı yalnızca siyah bir arka plan görüyor ve videonun
 * neden gelmediğini anlamıyordu — özellikle 101/150 (sahibi gömmeyi kapatmış)
 * durumunda bağlantı tarayıcıda sorunsuz açıldığı için hata sanılmıyordu.
 */
function ytHataMetni(code: number): { text: string; hint: string } {
  switch (code) {
    case 2:
      return { text: "YouTube video kimliği geçersiz.", hint: "Bağlantıyı tekrar kopyala." };
    case 5:
      return {
        text: "YouTube oynatıcısı bu videoyu açamadı.",
        hint: "Başka bir video dene ya da yerel dosya kullan.",
      };
    case 100:
      return {
        text: "YouTube videosu bulunamadı (kaldırılmış veya özel).",
        hint: "Başka bir bağlantı gir.",
      };
    case 101:
    case 150:
      return {
        text: "Video sahibi bu videonun başka sitelerde gömülmesini kapatmış.",
        hint: "Bu video arka plan olarak kullanılamaz; başka bir video seç.",
      };
    default:
      return { text: `YouTube oynatıcı hatası (kod ${code}).`, hint: "Bağlantıyı kontrol et." };
  }
}

type Props = {
  videoId: string;
  start?: number;
  end?: number;
  sound?: boolean;
  volume?: number;
  /** small | medium | large | hd720 | hd1080 | highres | default */
  quality?: string;
  /** Video süresi (sn) — kırpma barı için */
  onDuration?: (seconds: number) => void;
  /**
   * Bitiş ekranı bilgisi alınamadığında sondan atlanacak kör pay (sn).
   * Bilgi alınabildiğinde kullanılmaz — video kısalmadan oynar.
   * Varsayılan {@link DEFAULT_END_MARGIN}.
   */
  endMargin?: number;
  /** Panelden "yayına ver": bu konuma atla (sn) */
  seekTo?: number;
  /** İsteğin zaman damgası — değişince atlama tetiklenir */
  seekAt?: number;
  /**
   * Döngüye alma; videoyu bir kez oynatıp {@link onEnded} çağır.
   *
   * Çıkış ekranında süre girilmediğinde yayını video bitince kapatmak için
   * kullanılıyor: döngüde kalsa bitiş hiç gelmezdi.
   */
  playOnce?: boolean;
  /**
   * `playOnce` açıkken bitişin kaç tur sonra bildirileceği (varsayılan 1).
   * 3 verilirse video iki kez başa sarılır, üçüncü bitişte {@link onEnded}
   * çağrılır.
   */
  playLoops?: number;
  /** `playOnce` açıkken video sonuna varıldığında bir kez çağrılır. */
  onEnded?: () => void;
  /**
   * false iken oynatma durur (OBS sahnesi görünür değil).
   * Tekrar true olunca kırpma başlangıcından oynar.
   */
  playbackActive?: boolean;
};

/** YouTube arka plan: kart/end-screen gizli, kırpma döngüsü, kalite */
export default function YoutubeBg({
  videoId,
  start = 0,
  end = 0,
  sound = false,
  volume = 100,
  quality = "hd1080",
  endMargin = DEFAULT_END_MARGIN,
  onDuration,
  seekTo = 0,
  seekAt = 0,
  playOnce = false,
  playLoops = 1,
  onEnded,
  playbackActive = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const optsRef = useRef({ start, end, sound, volume, quality, endMargin });
  optsRef.current = { start, end, sound, volume, quality, endMargin };
  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;
  // Ref üzerinden okuyoruz: bu değerler değiştiğinde oynatıcıyı yeniden
  // kurmak videoyu baştan başlatırdı.
  const playOnceRef = useRef(playOnce);
  playOnceRef.current = playOnce;
  const playLoopsRef = useRef(playLoops);
  playLoopsRef.current = playLoops;
  /** Tamamlanan tur sayısı — hedefe ulaşınca bitiş bildirilir. */
  const turSayaci = useRef(0);
  const sonTurAt = useRef(0);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const playbackActiveRef = useRef(playbackActive);
  playbackActiveRef.current = playbackActive;
  const bitisBildirildi = useRef(false);
  const reportedDur = useRef(0);
  // Örtü artık zamanlayıcıyla değil, gerçek oynatma ilerlemesiyle kalkıyor.
  // Sabit süreli örtü, otomatik oynatma gecikince YouTube'un poster karesini
  // ve ortadaki büyük oynat/duraklat simgesini açıkta bırakıyordu.
  const coverHeld = useRef(true);
  const progress = useRef({ last: -1, hits: 0 });
  // Videonun bitiş perdesi gerçekten var mı, varsa ne zaman açılıyor. Yanıt
  // gelene kadar kör pay geçerli; geldikten sonra video kısalmadan oynar.
  const endScreen = useRef<EndScreenInfo>(UNKNOWN_END_SCREEN);
  // Panel önizlemesi gizlendiğinde video çözme duruyor; yoklama da onunla
  // birlikte susmalı, yoksa duraklamayı "takılma" sanıp geri oynatıyor.
  const hiddenPaused = useRef(false);
  const { preview } = usePreviewQuality();

  /** Örtüyü anında kapat ve yeniden gerçek ilerleme görülene dek tut. */
  const armCover = useCallback(() => {
    const alreadyCovered = coverHeld.current;
    coverHeld.current = true;
    progress.current = { last: -1, hits: 0 };
    const el = coverRef.current;
    if (!el) return;
    if (alreadyCovered) {
      el.style.opacity = "1";
      return;
    }
    // Görünürden kapalıya geçerken geçişi atla: 0.3 sn'lik solma sırasında
    // YouTube'un oynat/duraklat simgesi bir an göze çarpıyordu.
    el.style.transition = "none";
    el.style.opacity = "1";
    void el.offsetHeight;
    el.style.transition = "";
  }, []);

  const releaseCover = useCallback(() => {
    coverHeld.current = false;
    const el = coverRef.current;
    if (!el) return;
    el.style.transition = "";
    el.style.opacity = "0";
  }, []);

  useEffect(() => {
    let cancelled = false;
    let poll: number | undefined;
    // Yeni video → bitiş yeniden bildirilebilir olsun.
    bitisBildirildi.current = false;
    turSayaci.current = 0;
    sonTurAt.current = 0;

    const applyQuality = (player: any) => {
      // Önizleme kutusu ~500 px genişliğinde; orada hd1080 çözmek çıktıya
      // hiçbir şey katmadan kare başına ~9 kat piksel demek. Yayın çıktısı
      // (`preview` değil) ayarlanan kaliteyi olduğu gibi kullanır.
      const q = preview ? "medium" : optsRef.current.quality || "default";
      try {
        if (q && q !== "default" && typeof player.setPlaybackQuality === "function") {
          player.setPlaybackQuality(q);
        }
      } catch {
        /* */
      }
    };

    const syncAudio = (player: any) => {
      try {
        if (optsRef.current.sound) {
          player.unMute();
          player.setVolume(Math.max(0, Math.min(100, optsRef.current.volume ?? 100)));
          // OBS'te kullanıcı etkileşimi yok; sesi açmak otomatik oynatma
          // ilkesine takılıp videoyu duraklatabiliyor ve ortada YouTube'un
          // büyük oynat düğmesi kalıyordu. Tutmadıysa sessize dönüp devam et.
          window.setTimeout(() => {
            try {
              if (player.getPlayerState?.() !== window.YT?.PlayerState?.PLAYING) {
                player.mute();
                player.playVideo();
              }
            } catch {
              /* oynatıcı yıkılmış olabilir */
            }
          }, 600);
        } else {
          player.mute();
        }
      } catch {
        /* */
      }
    };

    /**
     * Video sonuna varıldı. Normalde başa sarıyoruz; `playOnce` kipinde
     * bunun yerine son kareyi tutup bitişi bir kez bildiriyoruz.
     */
    const loopToStart = (p: any, loopAt = 0) => {
      if (playOnceRef.current) {
        if (bitisBildirildi.current) return;
        // Aynı turu hem sona yakın konum yoklaması hem ENDED olayı
        // bildirebiliyor; ikincisini saymıyoruz.
        if (!shouldCountLoop(sonTurAt.current, Date.now())) return;
        sonTurAt.current = Date.now();
        turSayaci.current += 1;
        // Hedef tura ulaşılmadıysa bitirmiyoruz: aşağıdaki normal döngü
        // videoyu başa sarıp sürdürür.
        if (turSayaci.current >= Math.max(1, Math.round(playLoopsRef.current) || 1)) {
          bitisBildirildi.current = true;
          // Kartların çıkmasını engellemek için örtüyü indirip duraklat.
          armCover();
          try {
            p.pauseVideo();
          } catch {
            /* */
          }
          onEndedRef.current?.();
          return;
        }
      }
      const wanted = Math.max(0, optsRef.current.start || 0);
      // Başlangıç döngü noktasının ötesindeyse oraya dönmek videoyu doğrudan
      // kart bölgesine sokardı; o durumda videonun başına dönüyoruz.
      const s = loopAt > 0 && wanted >= loopAt ? 0 : wanted;
      armCover();
      try {
        p.seekTo(s, true);
        p.playVideo();
      } catch {
        /* */
      }
    };

    const reportDuration = (p: any) => {
      try {
        const d = Number(p.getDuration?.() || 0);
        if (d > 1 && Math.abs(d - reportedDur.current) > 0.5) {
          reportedDur.current = d;
          onDurationRef.current?.(d);
        }
      } catch {
        /* */
      }
    };

    const mount = async () => {
      // Yeni video: eski hata bildirimi geçerli değil. Bu video da hata
      // verirse `onError` tekrar yazacak.
      clearNotice("yt-bg");
      endScreen.current = UNKNOWN_END_SCREEN;
      void fetchEndScreenInfo(videoId).then((info) => {
        if (!cancelled) endScreen.current = info;
      });
      await loadYtApi();
      if (cancelled || !hostRef.current) return;
      // Video değiştiğinde örtü önceki oynatmadan kalkmış olabilir.
      armCover();
      hostRef.current.innerHTML = "";
      reportedDur.current = 0;
      const el = document.createElement("div");
      el.id = `ytbg-${videoId}-${Date.now()}`;
      hostRef.current.appendChild(el);

      playerRef.current = new window.YT.Player(el, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          loop: 0,
          cc_load_policy: 0,
          start: Math.max(0, Math.floor(optsRef.current.start || 0)),
          origin: window.location.origin,
        },
        events: {
          onReady: (ev: any) => {
            const p = ev.target;
            applyQuality(p);
            reportDuration(p);
            if (!playbackActiveRef.current) {
              try {
                p.pauseVideo();
              } catch {
                /* */
              }
              return;
            }
            p.playVideo();
            window.setTimeout(() => syncAudio(p), 400);
            window.setTimeout(() => reportDuration(p), 1200);
          },
          onStateChange: (ev: any) => {
            const p = ev.target;
            const S = window.YT.PlayerState;
            if (ev.data === S.PLAYING) {
              applyQuality(p);
              syncAudio(p);
              reportDuration(p);
              // Örtüyü burada kaldırmıyoruz: PLAYING olayı ilk kare
              // çizilmeden önce gelebiliyor ve o aralıkta oynat/duraklat
              // simgesi görünüyordu. Yoklama ilerlemeyi doğrulayınca kalkar.
            }
            // ENDED → kartlar çıkmadan hemen başa sar + örtü
            if (ev.data === S.ENDED) {
              loopToStart(p);
            }
            // Duraklama/kuyruk: YouTube ortada büyük simge gösterir — ört.
            if (ev.data === S.CUED || ev.data === S.PAUSED) {
              armCover();
            }
          },
          onError: (ev: any) => {
            const { text, hint } = ytHataMetni(Number(ev?.data));
            pushNotice({ id: "yt-bg", level: "error", text, hint });
            releaseCover();
          },
        },
      });

      let stalled = 0;
      poll = window.setInterval(() => {
        if (hiddenPaused.current) return;
        const p = playerRef.current;
        if (!p || typeof p.getCurrentTime !== "function") return;
        reportDuration(p);
        // Fon videosu duraklı kalmamalı: duraklarsa YouTube ortada büyük
        // oynat düğmesi gösteriyor. Kendi kendine toparlansın.
        // Sahne gizliyken bilerek duraklatıldıysa dokunma.
        if (!playbackActiveRef.current) {
          try {
            const S = window.YT?.PlayerState;
            const st = p.getPlayerState?.();
            if (S && st === S.PLAYING) p.pauseVideo();
          } catch {
            /* */
          }
          return;
        }
        let state: number | undefined;
        try {
          state = p.getPlayerState?.();
          const S = window.YT?.PlayerState;
          if (S && (state === S.PAUSED || state === S.CUED)) {
            stalled += 1;
            armCover();
            if (stalled >= 2) {
              stalled = 0;
              p.playVideo();
            }
          } else {
            stalled = 0;
          }
        } catch {
          /* */
        }
        const endAt = Number(optsRef.current.end) || 0;
        const startAt = Number(optsRef.current.start) || 0;
        try {
          const t = p.getCurrentTime();

          // Örtü yalnızca kareler gerçekten akmaya başlayınca kalkar.
          if (coverHeld.current) {
            const S = window.YT?.PlayerState;
            const pr = progress.current;
            if (S && state === S.PLAYING && t > pr.last + 0.02) {
              pr.hits += 1;
              if (pr.hits >= PROGRESS_SAMPLES) releaseCover();
            } else {
              pr.hits = 0;
            }
            pr.last = t;
          }

          const dur = Number(p.getDuration?.() || 0);
          const loopAt = youtubeLoopPoint(
            dur,
            startAt,
            endAt,
            optsRef.current.endMargin,
            endScreen.current
          );
          // Koşul artık başlangıca bağlı değil: kırpma başlangıcı geç bir
          // saniyedeyse bile kartlara girmeden döneriz.
          if (loopAt > 0 && t >= loopAt - LOOP_LEAD_SEC) {
            loopToStart(p, loopAt);
          }
        } catch {
          /* */
        }
      }, 200);
    };

    void mount();
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* */
      }
      playerRef.current = null;
    };
  }, [videoId, armCover, releaseCover, preview]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || typeof p.seekTo !== "function") return;
    try {
      armCover();
      p.seekTo(Math.max(0, start || 0), true);
      p.playVideo();
    } catch {
      /* */
    }
  }, [start, end, armCover]);

  /**
   * Panel tepsiye alındığında önizleme videosunu duraklat.
   *
   * Önizlemedeki YouTube iframe'i pencere gizliyken de kare çözmeye devam
   * ediyordu; uygulamanın arka plandaki CPU/GPU yükünün büyük kısmı buydu.
   * Yalnızca önizleme için geçerli: OBS tarayıcı kaynağı `preview` değil, o
   * yüzden yayın çıktısı hiç etkilenmiyor.
   */
  useEffect(() => {
    if (!preview) return;
    const onVisibility = () => {
      hiddenPaused.current = document.hidden;
      const p = playerRef.current;
      if (!p) return;
      try {
        if (document.hidden) {
          p.pauseVideo?.();
        } else {
          // Duraklamış kare üzerinde YouTube büyük oynat simgesi gösteriyor.
          armCover();
          p.playVideo?.();
        }
      } catch {
        /* oynatıcı yıkılmış olabilir */
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      hiddenPaused.current = false;
    };
  }, [preview, armCover]);

  // OBS: kaynak görünür / soft kick — YouTube'u yeniden oynat.
  useEffect(() => {
    if (preview) return;
    const kick = () => {
      if (!playbackActive) return;
      const p = playerRef.current;
      if (!p) return;
      try {
        armCover();
        p.playVideo?.();
      } catch {
        /* */
      }
    };
    const onVis = () => {
      if (!document.hidden) kick();
    };
    window.addEventListener("obs-source-visible", kick);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("obs-source-visible", kick);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [preview, armCover, playbackActive]);

  // Sahne aktif değilken dur; aktif olunca baştan oynat.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (!playbackActive) {
        p.pauseVideo?.();
        return;
      }
      armCover();
      p.seekTo?.(Math.max(0, start || 0), true);
      p.playVideo?.();
    } catch {
      /* */
    }
  }, [playbackActive, start, armCover]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (sound) {
        p.unMute();
        p.setVolume(Math.max(0, Math.min(100, volume ?? 100)));
      } else {
        p.mute();
      }
    } catch {
      /* */
    }
  }, [sound, volume]);

  // Panelden gelen anlık konum. İstekten bu yana geçen süreyi ekliyoruz ki
  // yayın, panelin şu an gösterdiği kareden devam etsin.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !seekAt || typeof p.seekTo !== "function") return;
    const age = (Date.now() - seekAt) / 1000;
    if (age < 0 || age > 60) return;
    try {
      armCover();
      p.seekTo(seekTo + age, true);
      p.playVideo();
    } catch {
      /* oynatıcı henüz hazır değil */
    }
  }, [seekAt, seekTo, armCover]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || preview) return; // önizleme kalitesi kutuya göre sabit
    try {
      if (quality && quality !== "default" && typeof p.setPlaybackQuality === "function") {
        p.setPlaybackQuality(quality);
      }
    } catch {
      /* */
    }
  }, [quality, preview]);

  return (
    <div className="yt-bg-wrap">
      <div className="yt-bg-host" ref={hostRef} />
      {/* Yalnızca geçiş anlarını (açılış, döngü, duraklama) örter — kalıcı
          maske yok, video kırpılmadan tam boy görünür. */}
      <div className="yt-bg-cover" ref={coverRef} aria-hidden />
    </div>
  );
}
