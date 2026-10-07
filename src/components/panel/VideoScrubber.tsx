import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl } from "../../lib/api";
import {
  ALTYAZISIZ_PLAYER_VARS,
  altyaziKapat,
  DEFAULT_END_MARGIN,
  EndScreenInfo,
  extractYoutubeId,
  fetchEndScreenInfo,
  formatClock,
  loadYtApi,
  UNKNOWN_END_SCREEN,
  youtubeLoopPoint,
} from "../../lib/youtube";

/**
 * Eklenen videoları panelde oynatıp ileri/geri saran oynatıcı.
 *
 * Yerel dosya `<video>` ile, YouTube ise iframe API ile oynatılır; iki durumda
 * da denetimler aynı olsun diye ortak bir soyutlama (`ctl`) üzerinden
 * sürülüyor. Böylece "10 sn geri" düğmesi kaynak ne olursa olsun aynı işi
 * yapıyor ve kırpma noktalarını bulmak için videoyu gerçekten izleyebiliyoruz.
 */

type Props = {
  /** Yerel video dosya adı/yolu (YouTube kullanılacaksa boş bırak) */
  videoPath?: string | null;
  /** YouTube adresi (yerel yerine kullanılır) */
  youtubeUrl?: string | null;
  /** Kırpma başlangıcı — "başa dön" bu noktaya döner */
  start?: number;
  /** Kırpma bitişi (0 = videonun sonu) */
  end?: number;
  /** Süre okunduğunda üst bileşene bildir (YouTube kırpma barı için) */
  onDuration?: (seconds: number) => void;
  /** "Başlangıç / bitiş = şu an" düğmeleri; verilmezse düğmeler gizlenir */
  onSetStart?: (seconds: number) => void;
  onSetEnd?: (seconds: number) => void;
  /** "Yayına ver": bu videoyu aktif fon yapıp yayını bu saniyeden sürdür */
  onGoLive?: (seconds: number) => void;
  /** YouTube bitiş kartlarından kaçınmak için sondan atlanacak süre (sn) */
  endMargin?: number;
};

/* Panel tarafında ikon kütüphanesi yok; gereken beş simgeyi yerinde çiziyoruz. */
const ICON = "h-4 w-4";

function Play({ className = ICON }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function Pause({ className = ICON }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function SkipBack({ className = ICON }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
    </svg>
  );
}

/** Geri sarma oku (yön için yatay aynalanır) */
function Rewind({ className = ICON, forward = false }: { className?: string; forward?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={forward ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function VolumeIcon({ className = ICON, muted }: { className?: string; muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M18.36 5.64a9 9 0 0 1 0 12.73" />
        </>
      )}
    </svg>
  );
}

function Broadcast({ className = ICON }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M7.8 16.2a6 6 0 0 1 0-8.4" />
      <path d="M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2" />
      <path d="M19.1 4.9a10 10 0 0 1 0 14.2" />
    </svg>
  );
}

const SKIP = 10;
const SPEEDS = [0.5, 1, 1.5, 2];

export default function VideoScrubber({
  videoPath,
  youtubeUrl,
  start = 0,
  end = 0,
  onDuration,
  onSetStart,
  onSetEnd,
  onGoLive,
  endMargin = DEFAULT_END_MARGIN,
}: Props) {
  const ytId = extractYoutubeId(youtubeUrl || "");
  const src = ytId ? null : mediaUrl(videoPath);
  const isYt = !!ytId;

  const videoRef = useRef<HTMLVideoElement>(null);
  const ytHostRef = useRef<HTMLDivElement>(null);
  const ytRef = useRef<any>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // Son sarma isteği. YouTube oynatıcısı `seekTo`dan sonra konumu birkaç yüz
  // ms gecikmeyle bildiriyor; art arda basılan "10 sn ileri" bu yüzden hep
  // aynı yerden hesaplanıp tek adım atıyordu.
  const lastSeek = useRef<{ t: number; at: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [liveAt, setLiveAt] = useState(0);

  const onDurationRef = useRef(onDuration);
  onDurationRef.current = onDuration;
  // Yayındaki davranışın aynısı önizlemede de geçerli olsun diye güncel
  // değerleri ref'te tutuyoruz; oynatıcı efekti yeniden kurulmasın.
  const loopRef = useRef({ start, endMargin });
  loopRef.current = { start, endMargin };
  const endScreen = useRef<EndScreenInfo>(UNKNOWN_END_SCREEN);

  /* ------------------------------------------- kaynaktan bağımsız denetim */

  const ctl = useCallback(
    () => ({
      seek(t: number) {
        const clamped = Math.max(0, duration > 0 ? Math.min(t, duration) : t);
        if (isYt) ytRef.current?.seekTo?.(clamped, true);
        else if (videoRef.current) videoRef.current.currentTime = clamped;
        lastSeek.current = { t: clamped, at: Date.now() };
        setTime(clamped);
      },
      play() {
        if (isYt) ytRef.current?.playVideo?.();
        else void videoRef.current?.play().catch(() => setError("Oynatılamadı"));
      },
      pause() {
        if (isYt) ytRef.current?.pauseVideo?.();
        else videoRef.current?.pause();
      },
      now(): number {
        const pending = lastSeek.current;
        if (pending && Date.now() - pending.at < 700) return pending.t;
        if (isYt) return Number(ytRef.current?.getCurrentTime?.() || 0);
        return videoRef.current?.currentTime || 0;
      },
    }),
    [isYt, duration]
  );

  const skip = (delta: number) => ctl().seek(ctl().now() + delta);
  const toggle = () => (playing ? ctl().pause() : ctl().play());

  /* ------------------------------------------------------ yerel oynatıcı */

  useEffect(() => {
    if (isYt) return;
    const v = videoRef.current;
    if (!v || !src) return;
    setReady(false);
    setError("");
    setTime(0);
    setDuration(0);

    const onMeta = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        setDuration(v.duration);
        onDurationRef.current?.(v.duration);
      }
      setReady(true);
    };
    const onTime = () => {
      const pending = lastSeek.current;
      if (pending && Date.now() - pending.at < 300) return;
      if (!dragging.current) setTime(v.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => setError("Video açılamadı");

    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("error", onErr);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("error", onErr);
    };
  }, [isYt, src]);

  useEffect(() => {
    if (!isYt && videoRef.current) videoRef.current.playbackRate = speed;
  }, [isYt, speed]);

  useEffect(() => {
    if (!isYt && videoRef.current) videoRef.current.muted = muted;
  }, [isYt, muted]);

  /* ---------------------------------------------------- YouTube oynatıcı */

  useEffect(() => {
    if (!isYt || !ytId) return;
    let cancelled = false;
    let poll: number | undefined;
    setReady(false);
    setError("");
    setTime(0);
    setDuration(0);

    const mount = async () => {
      endScreen.current = UNKNOWN_END_SCREEN;
      void fetchEndScreenInfo(ytId).then((info) => {
        if (!cancelled) endScreen.current = info;
      });
      await loadYtApi();
      if (cancelled || !ytHostRef.current) return;
      ytHostRef.current.innerHTML = "";
      const el = document.createElement("div");
      ytHostRef.current.appendChild(el);

      ytRef.current = new window.YT.Player(el, {
        videoId: ytId,
        playerVars: {
          autoplay: 0,
          // Kendi denetimlerimiz var; YouTube'unki çift kumanda olurdu.
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          // Sessiz başlayan oynatıcıda YouTube altyazıyı kendiliğinden açıyordu.
          ...ALTYAZISIZ_PLAYER_VARS,
          origin: window.location.origin,
        },
        events: {
          onReady: (ev: any) => {
            if (cancelled) return;
            const p = ev.target;
            p.mute();
            altyaziKapat(p);
            // Kırpma önizlemesi avuç içi kadar bir kutu. Aynı anda canlı
            // önizleme de aynı videoyu çözüyor; ikisini birden 1080p tutmak
            // panelin CPU yükünün büyük kısmıydı.
            try {
              p.setPlaybackQuality?.("small");
            } catch {
              /* oynatıcı desteklemiyorsa varsayılanla devam */
            }
            const d = Number(p.getDuration?.() || 0);
            if (d > 0) {
              setDuration(d);
              onDurationRef.current?.(d);
            }
            setReady(true);
          },
          onStateChange: (ev: any) => {
            if (cancelled) return;
            const S = window.YT.PlayerState;
            setPlaying(ev.data === S.PLAYING);
            if (ev.data === S.PLAYING) altyaziKapat(ev.target);
            const d = Number(ev.target.getDuration?.() || 0);
            if (d > 0) {
              setDuration((prev) => (Math.abs(prev - d) > 0.5 ? d : prev));
              onDurationRef.current?.(d);
            }
          },
          onError: () => {
            if (!cancelled) setError("YouTube videosu açılamadı");
          },
        },
      });

      poll = window.setInterval(() => {
        const p = ytRef.current;
        if (!p?.getCurrentTime || dragging.current) return;
        const pending = lastSeek.current;
        if (pending && Date.now() - pending.at < 700) return;
        const t = Number(p.getCurrentTime()) || 0;
        const d = Number(p.getDuration?.() || 0);
        // Yayında olduğu gibi bitiş kartlarına girmeden başa sar. Elle o
        // bölgeye sarabilmek için yalnız oynarken devreye giriyor.
        const loopAt = youtubeLoopPoint(
          d,
          loopRef.current.start,
          0,
          loopRef.current.endMargin,
          endScreen.current
        );
        const isPlaying = p.getPlayerState?.() === window.YT?.PlayerState?.PLAYING;
        if (isPlaying && loopAt > 0 && t >= loopAt) {
          const back = Math.max(0, loopRef.current.start || 0);
          p.seekTo(back, true);
          lastSeek.current = { t: back, at: Date.now() };
          setTime(back);
          return;
        }
        setTime(t);
      }, 250);
    };

    void mount();
    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      try {
        ytRef.current?.destroy?.();
      } catch {
        /* zaten yıkılmış olabilir */
      }
      ytRef.current = null;
    };
  }, [isYt, ytId]);

  useEffect(() => {
    if (!isYt) return;
    try {
      ytRef.current?.setPlaybackRate?.(speed);
    } catch {
      /* bazı videolar hızı reddeder */
    }
  }, [isYt, speed]);

  useEffect(() => {
    if (!isYt) return;
    try {
      if (muted) ytRef.current?.mute?.();
      else {
        ytRef.current?.unMute?.();
        ytRef.current?.setVolume?.(80);
      }
    } catch {
      /* oynatıcı henüz hazır değil */
    }
  }, [isYt, muted]);

  /* -------------------------------------------------------- sürme çubuğu */

  const posToTime = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || duration <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return pct * duration;
    },
    [duration]
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setTime(posToTime(e.clientX));
    };
    const up = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      ctl().seek(posToTime(e.clientX));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [posToTime, ctl]);

  if (!src && !ytId) return null;

  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const startPct = duration > 0 ? Math.min(100, ((start || 0) / duration) * 100) : 0;
  const endPct = duration > 0 && end > start ? Math.min(100, (end / duration) * 100) : 100;
  const btn =
    "flex h-8 items-center justify-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs font-medium text-white transition-all hover:border-white/[0.15] hover:bg-white/[0.08] active:scale-95 disabled:opacity-40";

  return (
    <div
      className="space-y-3 rounded-2xl border border-white/[0.08] bg-black/40 p-4 shadow-glass"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          skip(-5);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          skip(5);
        } else if (e.key === " ") {
          e.preventDefault();
          toggle();
        }
      }}
    >
      {/* Panel sütunu genişleyince oynatıcı sayfayı yutmasın diye yükseklik sınırlı. */}
      <div className="relative mx-auto aspect-video max-h-[220px] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-black">
        {isYt ? (
          <div ref={ytHostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
        ) : (
          <video
            ref={videoRef}
            src={src || undefined}
            className="h-full w-full object-contain"
            muted
            playsInline
            preload="metadata"
            onClick={toggle}
          />
        )}
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-xs text-panel-muted">
            yükleniyor…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Sürme çubuğu — kırpma aralığı arkada soluk vurgulu */}
      <div
        ref={barRef}
        className="relative h-3 cursor-pointer rounded-full border border-white/[0.06] bg-white/[0.06]"
        onPointerDown={(e) => {
          if (duration <= 0) return;
          dragging.current = true;
          setTime(posToTime(e.clientX));
        }}
      >
        <div
          className="absolute top-0 h-full bg-panel-accent/25"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <div
          className="absolute top-0 h-full rounded-full bg-panel-accent/80 shadow-glow-sm"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pure-white bg-panel-accent shadow-glow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] text-panel-muted">
        <span className="text-white font-semibold">{formatClock(time)}</span>
        <span>{duration > 0 ? formatClock(duration) : "—"}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={btn}
          title="Kırpma başına dön"
          onClick={() => ctl().seek(start || 0)}
        >
          <SkipBack />
        </button>
        <button type="button" className={btn} title="10 sn geri" onClick={() => skip(-SKIP)}>
          <Rewind />
          {SKIP}
        </button>
        <button type="button" className={`${btn} px-3.5 bg-panel-accent/20 border-panel-accent/40 text-panel-accent hover:bg-panel-accent/30`} title="Oynat / duraklat" onClick={toggle}>
          {playing ? <Pause /> : <Play />}
        </button>
        <button type="button" className={btn} title="10 sn ileri" onClick={() => skip(SKIP)}>
          <Rewind forward />
          {SKIP}
        </button>
        <button
          type="button"
          className={btn}
          title={muted ? "Sesi aç" : "Sesi kapat"}
          onClick={() => setMuted((m) => !m)}
        >
          <VolumeIcon muted={muted} />
        </button>
        <select
          className="h-8 rounded-xl border border-white/[0.09] bg-[#12151e] px-2 text-xs font-semibold text-white outline-none focus:border-panel-accent/60"
          value={speed}
          title="Oynatma hızı"
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>

      {onGoLive && (
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-panel-accent/40 bg-panel-accent/90 text-xs font-bold text-[#08131c] shadow-glow-sm transition-all hover:bg-panel-accent active:scale-95"
          onClick={() => {
            onGoLive(Math.round(ctl().now() * 10) / 10);
            setLiveAt(Date.now());
          }}
        >
          <Broadcast />
          Bu kareyi yayına ver
        </button>
      )}
      {liveAt > 0 && (
        <p className="text-[10px] text-panel-accent">
          Yayına verildi — OBS bu saniyeden devam ediyor.
        </p>
      )}

      {(onSetStart || onSetEnd) && (
        <div className="flex flex-wrap gap-1.5">
          {onSetStart && (
            <button
              type="button"
              className={btn}
              onClick={() => onSetStart(Math.round(ctl().now() * 10) / 10)}
            >
              Başlangıç = şu an
            </button>
          )}
          {onSetEnd && (
            <button
              type="button"
              className={btn}
              onClick={() => onSetEnd(Math.round(ctl().now() * 10) / 10)}
            >
              Bitiş = şu an
            </button>
          )}
        </div>
      )}

      <p className="text-[10px] text-panel-muted">
        Önizleme yalnız burada oynar; yayına gitmez. ← → 5 sn, boşluk oynat/duraklat.
      </p>
    </div>
  );
}
