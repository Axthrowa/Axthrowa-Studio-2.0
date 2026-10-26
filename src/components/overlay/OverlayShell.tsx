import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
  CSSProperties,
  PointerEvent as REPointerEvent,
} from "react";
import { DEFAULT_END_MARGIN, extractYoutubeId } from "../../lib/youtube";
import { nextLoopState, resolveEndRule, shouldCountLoop } from "../../lib/endRules";
import {
  API_BASE,
  mediaUrl,
  OverlaySettings,
  ScreenId,
  isObsMode,
  patchSettings,
  saveSettings,
  tickerDurationSec,
} from "../../lib/api";
import { useOverlaySync } from "../../lib/useOverlaySync";
import { SOCIAL_META } from "../../lib/socials";
import { FONT_STACKS, TextStyle, TextStyleKey } from "../../lib/textStyles";
import ParticleCanvas from "./ParticleCanvas";
import YoutubeBg from "./YoutubeBg";
import CreditsRoller, { sectionsFromSettings } from "./CreditsRoller";
import AudioVisualizer from "./AudioVisualizer";
import NowPlayingWidget from "./NowPlayingWidget";
import ResonanceNowPlaying from "./ResonanceNowPlaying";
import { useNowPlaying } from "../../lib/useNowPlaying";
import { usePreviewQuality } from "../../lib/previewQuality";
import { clearNotice, pushNotice } from "../../lib/notices";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useObsSourceActive } from "../../lib/obsSourceActive";
import {
  canliOturum,
  getCreditsSession,
  mergeAutoCreditSections,
  subscribeCreditsSession,
} from "../../lib/creditsSession";
import { readStartingCountdownEnd, STARTING_END_STORAGE_KEY } from "../../lib/streamAutomation";
import { esikAsildi, suruklenmisKonum, type Konum } from "../../lib/surukle";
import YerindeMetin from "./YerindeMetin";

type Props = {
  screen: ScreenId;
  initial?: OverlaySettings;
  showCredits?: boolean;
  showVisualizer?: boolean;
  onCountdownEnd?: (settings: OverlaySettings) => void;
  /** Panel canlı önizleme: dışarıdan gelen ayarlar anında yansır */
  liveSettings?: OverlaySettings;
  forceEdit?: boolean;
  onPositionsPersist?: (positions: Record<string, { x: number; y: number }>) => void;
  /** Önizlemeden görünürlük vb. patch */
  onLivePatch?: (patch: OverlaySettings) => void;
  /** Panel/OBS yayın aç-kapa olunca video/iframe cache-bust */
  mediaEpoch?: number;
};

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const EMPTY_OBJ: Record<string, never> = {};

export default function OverlayShell({
  screen,
  initial = {},
  showCredits,
  showVisualizer,
  onCountdownEnd,
  liveSettings,
  forceEdit,
  onPositionsPersist,
  onLivePatch,
  mediaEpoch: mediaEpochProp = 0,
}: Props) {
  const obs = isObsMode();
  useObsKeepalive();
  const sourceActive = useObsSourceActive(obs);
  const holdPlaybackRef = useRef(false);
  holdPlaybackRef.current = obs && !sourceActive;
  const edit = forceEdit || !obs;
  const { settings: synced, setSettings: setSynced, mediaEpoch: syncEpoch } = useOverlaySync(screen, initial, {
    enabled: !liveSettings,
  });
  const mediaEpoch = mediaEpochProp || syncEpoch || 0;
  const settings = liveSettings ?? synced;
  const [guides, setGuides] = useState<{ v?: number; h?: number }>({});
  const endedRef = useRef(false);
  // Çıkış ekranında süre girilmediyse bitişi video belirler. Değer sayaç
  // hesabından sonra atanıyor; video efektleri buradan okuyor.
  const videoBitisiyleBitirRef = useRef(false);
  const { preview } = usePreviewQuality();
  // <video>/<audio> koşullu render ediliyor; arka plan tipi değişince öğe
  // yeniden monte oluyordu. Düz useRef ile efektler tekrar çalışmadığı için
  // src hiç atanmıyor, video sessizce siyah kalıyordu. Callback ref + state
  // sayesinde her montajda kaynak yeniden bağlanır.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
  const [audioNode, setAudioNode] = useState<HTMLAudioElement | null>(null);
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoNode(el);
  }, []);
  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    setAudioNode(el);
  }, []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragKey = useRef<string | null>(null);
  /** Sürüklemenin başlangıcı: öğenin konumu + imlecin ilk yeri (göreli hareket için). */
  const dragStart = useRef<{ bas: Konum; px: number; py: number; moved: boolean; son: Konum } | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [localPositions, setLocalPositions] = useState(settings.positions || {});
  const [localSizes, setLocalSizes] = useState(settings.sizes || {});
  const [now, setNow] = useState(Date.now());
  const resizeKey = useRef<string | null>(null);
  const resizeStart = useRef({
    x: 0,
    y: 0,
    size: 100,
    cx: 0,
    cy: 0,
    dist: 1,
  });

  useEffect(() => {
    setLocalPositions(settings.positions || {});
  }, [settings.positions]);

  useEffect(() => {
    setLocalSizes(settings.sizes || {});
  }, [settings.sizes]);

  const displaySettings: OverlaySettings = {
    ...settings,
    positions: localPositions || settings.positions,
    sizes: { ...(settings.sizes || {}), ...(localSizes || {}) },
  };

  // Saniyelik tik yalnızca gerçekten geri sayım varken çalışsın; aksi hâlde
  // katmandaki her şey boşuna saniyede bir yeniden render ediliyordu.
  // OBS'te dakika sayacı yalnız kaynak aktifken aksın.
  // Bitiş kuralı: `obs.endRules[ekran]` varsa o, yoksa eski alanlardan
  // türetilir (giriş: sabit 5 dk · mola/çıkış: dakika alanları · hedef saat).
  // Eski kayıtlar bu yüzden birebir aynı davranıyor. Bkz. lib/endRules.ts.
  const endScreen = screen === "starting" || screen === "ending" ? screen : "brb";
  const endRule = useMemo(
    () =>
      resolveEndRule(endScreen, settings.obs, {
        endingMinutes: settings.endingMinutes,
        brbMinutes: settings.brbMinutes,
        targetDate: settings.targetDate,
      }),
    [endScreen, settings.obs, settings.endingMinutes, settings.brbMinutes, settings.targetDate]
  );
  const endRuleRef = useRef(endRule);
  endRuleRef.current = endRule;
  // Etkin süre/hedef: aşağıdaki geri sayım mantığının tek kaynağı.
  const effMinutes = endRule.minutes;
  const effTarget = endRule.useTargetDate ? endRule.targetDate : "";
  const timerWanted = !!effTarget || effMinutes > 0;
  const isEndScreen = screen === "starting" || screen === "brb" || screen === "ending";

  const countdownActive = isEndScreen && timerWanted;
  const minuteTimerArmed = isEndScreen && !effTarget && effMinutes > 0;
  useEffect(() => {
    if (!countdownActive) return;
    if (obs && minuteTimerArmed && !sourceActive) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countdownActive, obs, minuteTimerArmed, sourceActive]);

  // Dakika sayacı. Giriş: Dashboard’dan yazılan bitiş damgası korunur (yenilemede sıfırlanmaz).
  const [timerEpoch, setTimerEpoch] = useState(0);
  useEffect(() => {
    if (!isEndScreen) return;
    if (effTarget) return;
    const mins = effMinutes;
    if (!mins) return;
    const key = `${screen}_end_${mins}`;

    if (screen === "starting") {
      const persisted = readStartingCountdownEnd();
      if (persisted > Date.now()) {
        try {
          sessionStorage.setItem(key, String(persisted));
          localStorage.setItem(STARTING_END_STORAGE_KEY, String(persisted));
        } catch {
          /* */
        }
        setNow(Date.now());
        return;
      }
      if (obs && !sourceActive) {
        setNow(Date.now());
        setTimerEpoch((n) => n + 1);
        return;
      }
      const end = Date.now() + mins * 60_000;
      try {
        sessionStorage.setItem(key, String(end));
        localStorage.setItem(STARTING_END_STORAGE_KEY, String(end));
      } catch {
        /* */
      }
      endedRef.current = false;
      setNow(Date.now());
      setTimerEpoch((n) => n + 1);
      return;
    }

    if (obs) {
      if (sourceActive) {
        const existing = Number(sessionStorage.getItem(key) || 0);
        if (!existing || existing < Date.now()) {
          sessionStorage.setItem(key, String(Date.now() + mins * 60_000));
          endedRef.current = false;
        }
        setNow(Date.now());
        setTimerEpoch((n) => n + 1);
      } else {
        setNow(Date.now());
        setTimerEpoch((n) => n + 1);
      }
      return;
    }

    const existing = Number(sessionStorage.getItem(key) || 0);
    if (!existing || existing < Date.now()) {
      sessionStorage.setItem(key, String(Date.now() + mins * 60_000));
      endedRef.current = false;
      setNow(Date.now());
      setTimerEpoch((n) => n + 1);
    }
  }, [
    obs,
    sourceActive,
    screen,
    effMinutes,
    effTarget,
  ]);

  // Seed from initial once if sync empty
  useEffect(() => {
    if (liveSettings) return;
    if (initial && Object.keys(initial).length > 0) {
      setSynced((s: OverlaySettings) => (Object.keys(s).length ? s : initial));
    }
  }, [initial, liveSettings, setSynced]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent || "#7c5cff");
    document.documentElement.style.setProperty("--title-color", settings.textColor || "#fff");
    document.documentElement.style.setProperty("--eyebrow-color", settings.eyebrowColor || "#b39dff");
    document.documentElement.style.setProperty("--sub-color", settings.subColor || "#c9cddb");
    document.documentElement.style.setProperty("--countdown-color", settings.countdownColor || "#fff");
    document.documentElement.style.setProperty("--ticker-color", settings.tickerColor || "#9aa0b4");
    document.documentElement.style.setProperty("--logo-zoom", String((settings.logoZoom || 100) / 100));
    document.documentElement.style.setProperty("--logo-pan-x", `${settings.logoPanX || 0}%`);
    document.documentElement.style.setProperty("--logo-pan-y", `${settings.logoPanY || 0}%`);

    const styles = (settings.textStyles || {}) as Record<string, TextStyle>;
    (["eyebrow", "title", "sub", "countdown", "ticker", "credits"] as TextStyleKey[]).forEach((key) => {
      const st = styles[key] || {};
      const size = (st.size ?? (key === "credits" ? settings.creditsSize : undefined) ?? 100) / 100;
      document.documentElement.style.setProperty(`--${key}-fx-scale`, String(size));
      if (st.color) {
        if (key === "title") document.documentElement.style.setProperty("--title-color", st.color);
        if (key === "eyebrow") document.documentElement.style.setProperty("--eyebrow-color", st.color);
        if (key === "sub") document.documentElement.style.setProperty("--sub-color", st.color);
        if (key === "countdown") document.documentElement.style.setProperty("--countdown-color", st.color);
        if (key === "ticker") document.documentElement.style.setProperty("--ticker-color", st.color);
      }
    });
  }, [settings]);

  const textProps = (key: TextStyleKey, opts?: { noAnim?: boolean }) => {
    const st = ((settings.textStyles || {})[key] || {}) as TextStyle;
    const fontId = st.font || settings.font || "system";
    const style: CSSProperties = {};
    if (fontId && FONT_STACKS[fontId]) style.fontFamily = FONT_STACKS[fontId];
    const fallbackColor =
      key === "eyebrow"
        ? settings.eyebrowColor
        : key === "title"
          ? settings.textColor
          : key === "sub"
            ? settings.subColor
            : key === "countdown"
              ? settings.countdownColor
              : key === "ticker"
                ? settings.tickerColor
                : undefined;
    const color = st.color || fallbackColor;
    if (color) {
      style.color = color;
      // Metalik efekt yazıyı geçişle boyar (renk şeffaf); geçiş seçilen renkten
      // türer, yoksa renk değiştirmek hiçbir şey yapmıyordu.
      (style as any)["--fx-mid"] = color;
      (style as any)["--fx-dark"] = `color-mix(in srgb, ${color} 55%, #000)`;
      if (key === "countdown") (style as any)["--countdown-color"] = color;
      if (key === "title") (style as any)["--title-color"] = color;
      if (key === "eyebrow") (style as any)["--eyebrow-color"] = color;
      if (key === "sub") (style as any)["--sub-color"] = color;
      if (key === "ticker") (style as any)["--ticker-color"] = color;
    }
    const accent = st.accentColor || settings.accent || "#7c5cff";
    (style as any)["--accent"] = accent;
    return {
      style,
      "data-fx": st.effect && st.effect !== "none" ? st.effect : undefined,
      "data-anim":
        !opts?.noAnim && st.anim && st.anim !== "none" ? st.anim : undefined,
    };
  };

  const particleTypes = settings.particleTypes || EMPTY_OBJ;
  const particleSizes = settings.particleSizes || EMPTY_OBJ;
  const particleColors = settings.particleColors || EMPTY_OBJ;
  const particleGlow = settings.particleGlow || EMPTY_OBJ;

  const videoSrc = useMemo(() => {
    const base = mediaUrl(settings.bgVideoPath);
    if (!base) return "";
    if (!mediaEpoch) return base;
    return `${base}${base.includes("?") ? "&" : "?"}t=${mediaEpoch}`;
  }, [settings.bgVideoPath, mediaEpoch]);
  const audioSrc = useMemo(() => mediaUrl(settings.bgAudioPath), [settings.bgAudioPath]);
  const bgImageSrc = useMemo(() => {
    if (settings.bgImagePath) {
      const p = String(settings.bgImagePath);
      const bare = !p.includes(":") && !p.includes("/") && !p.includes("\\");
      if (bare || /\/assets\/backgrounds\//i.test(p.replace(/\\/g, "/"))) {
        return mediaUrl(p, "backgrounds");
      }
      return mediaUrl(p);
    }
    if (settings.bgImage && String(settings.bgImage).startsWith("data:")) return settings.bgImage as string;
    if (settings.bgImage && String(settings.bgImage).startsWith("http")) return settings.bgImage as string;
    if (settings.bgImage) return mediaUrl(settings.bgImage, "backgrounds");
    return null;
  }, [settings.bgImagePath, settings.bgImage]);

  const [liveCredits, setLiveCredits] = useState(() => getCreditsSession());
  useEffect(() => subscribeCreditsSession(() => setLiveCredits(getCreditsSession())), []);

  const creditSections = useMemo(() => {
    const base = sectionsFromSettings(settings);
    if (screen !== "ending" || settings.creditsAuto === false) return base;
    return mergeAutoCreditSections(
      base,
      canliOturum(settings.creditsLive, liveCredits),
      true,
      settings.creditsOnlyLive !== false
    );
  }, [settings.creditsSections, settings.credits, settings.creditsAuto, settings.creditsOnlyLive, settings.creditsLive, screen, liveCredits]);
  const cdStyle = settings.countdownStyle || "boxes";

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

  const countdown = useMemo(() => {
    void timerEpoch;
    // Hedef tarih ve dakika artık kuraldan geliyor (giriş ekranı eski
    // davranışta targetDate'i yok sayıyordu; bu, kuraldan türetiliyor).
    let target = effTarget ? new Date(effTarget).getTime() : NaN;
    const mins = isEndScreen ? effMinutes : 0;

    if (
      isNaN(target) &&
      mins > 0 &&
      (screen === "brb" || screen === "ending" || screen === "starting")
    ) {
      if (screen === "starting") {
        const persisted = readStartingCountdownEnd();
        if (persisted > Date.now()) {
          target = persisted;
        } else if (obs && !sourceActive) {
          const total = mins * 60;
          return {
            mode: "count" as const,
            total,
            hours: Math.floor(total / 3600),
            minutes: Math.floor((total % 3600) / 60),
            seconds: total % 60,
            totalMinutes: mins,
            pending: true,
          };
        }
      }
      if (isNaN(target)) {
      // OBS'te sahne henüz aktif değil → ayarlanan süreyi sabit göster, sayma.
      if (obs && !sourceActive) {
        const total = mins * 60;
        return {
          mode: "count" as const,
          total,
          hours: Math.floor(total / 3600),
          minutes: Math.floor((total % 3600) / 60),
          seconds: total % 60,
          totalMinutes: mins,
          pending: true,
        };
      }
      const key = `${screen}_end_${mins}`;
      const end = Number(sessionStorage.getItem(key) || 0);
      if (end > Date.now()) {
        target = end;
      } else if (end > 0) {
        return { mode: "badge" as const, ended: true };
      } else {
        const total = mins * 60;
        return {
          mode: "count" as const,
          total,
          hours: Math.floor(total / 3600),
          minutes: Math.floor((total % 3600) / 60),
          seconds: total % 60,
          totalMinutes: mins,
          pending: true,
        };
      }
      }
    }
    if (isNaN(target)) {
      // Hiç sayaç kurulmamış. `ended` bayrağı şart: sayaç bitmiş gibi
      // davranırsak ekran açılır açılmaz sahne geçişi/yayın durdurma tetiklenir.
      if (screen === "ending" || screen === "brb" || screen === "starting") {
        return { mode: "badge" as const, ended: false };
      }
      return { mode: "hidden" as const };
    }
    const diff = target - now;
    if (diff <= 0) return { mode: "badge" as const, ended: true };
    const total = Math.floor(diff / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return {
      mode: "count" as const,
      total,
      hours,
      minutes,
      seconds,
      totalMinutes: Math.floor(total / 60),
    };
  }, [
    effTarget,
    effMinutes,
    isEndScreen,
    now,
    screen,
    obs,
    sourceActive,
    timerEpoch,
  ]);

  /** Ekranın bitiş eylemini (sahne geçişi / yayın durdurma) bir kez çalıştırır. */
  const bitisiTetikle = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onCountdownEnd?.(settingsRef.current);
  }, [onCountdownEnd]);

  // Video tur sayacı ("video N kez dönünce bitsin"). Hedef 1 ise eski
  // davranış: ilk bitişte tamamdır.
  const loopsSeenRef = useRef(0);
  const lastLoopAtRef = useRef(0);
  /**
   * Videonun bir turu tamamlandı. Hedefe ulaşıldıysa ekranı bitirir, değilse
   * videoyu kırpma başlangıcına sarıp sürdürür.
   */
  const medyaTurBitti = useCallback(
    (el: HTMLVideoElement | null, start: number) => {
      // `timeupdate` (bitişe 0.2 sn kala) ve `ended` aynı turu bildirebilir.
      if (!shouldCountLoop(lastLoopAtRef.current, Date.now())) return;
      lastLoopAtRef.current = Date.now();
      const st = nextLoopState(loopsSeenRef.current, endRuleRef.current.loops);
      loopsSeenRef.current = st.seen;
      if (st.done) {
        try {
          el?.pause();
        } catch {
          /* */
        }
        bitisiTetikle();
        return;
      }
      if (el) {
        try {
          el.currentTime = start;
          void el.play().catch(() => {});
        } catch {
          /* meta yoksa sonraki olay yeniden dener */
        }
      }
    },
    [bitisiTetikle]
  );
  // Kaynak, kural ya da OBS görünürlüğü değişince sayaç sıfırlansın.
  useEffect(() => {
    loopsSeenRef.current = 0;
    lastLoopAtRef.current = 0;
  }, [videoSrc, endRule.mode, endRule.loops, sourceActive]);

  // Sayaç bitişi. Yalnızca bu oturumda sayacın "çalışır" hâlinde görüldükten
  // sonra bitişe geçince tetikle — sayfa açılırken zaten bitmiş sayaç OBS'te
  // rastgele sahne değiştirmesin.
  const sayacBitti =
    countdown.mode === "badge" &&
    !!countdown.ended &&
    !(obs && !sourceActive) &&
    !(countdown as { pending?: boolean }).pending;
  const sayacCalisiyor =
    countdown.mode === "badge" &&
    !countdown.ended &&
    !(countdown as { pending?: boolean }).pending;
  const armedForEndRef = useRef(false);
  useEffect(() => {
    if (countdown.mode === "count" || sayacCalisiyor) {
      armedForEndRef.current = true;
      endedRef.current = false;
    }
    if (sayacBitti) {
      if (!armedForEndRef.current) {
        // Açılışta zaten bitmiş sayaç: OBS sahnesini zorla değiştirme.
        // endedRef'i kilitleme — video/müzik bitişi hâlâ sahne geçirebilsin.
        return;
      }
      bitisiTetikle();
    }
  }, [sayacBitti, sayacCalisiyor, countdown.mode, bitisiTetikle]);

  /**
   * Video/müzik bitince aksiyon (Giriş→oyun sahnesi / Çıkış→yayın kapat).
   * Panel önizlemesinde `onCountdownEnd` yok — döngü bozulmasın.
   */
  const mediaBitisiyleBitir = useMemo(() => {
    if (!onCountdownEnd) return false;
    // Kullanıcı bir bitiş kuralı seçtiyse medya bitişi yalnızca o kural
    // istiyorsa etkin olur; dakika sayacı çalışıyor olması artık medya
    // bitişini engellemiyor ("süre veya video bitişi" ilk gerçekleşende biter).
    if (endRule.explicit) return endRule.usesMedia;
    if (screen === "ending") {
      if (settings.obs?.stopStreamOnEnd === false) return false;
      // Dakika/tarih sayacı aktifken medya bitişi yayın kapatmasın —
      // önce geri sayım bitsin (panel metniyle aynı).
      // Sayaç yoksa veya süresi dolmuşsa (badge) video/müzik bitişi yedek tetik.
      if (countdown.mode === "count") return false;
      return true;
    }
    if (screen === "starting") {
      // 5 dk sayacı çalışırken medya bitişi erken oyun sahnesine geçmesin.
      if (countdown.mode === "count") return false;
      return settings.obs?.autoSwitchOnStartingMediaEnd !== false;
    }
    return false;
  }, [
    onCountdownEnd,
    screen,
    settings.obs?.stopStreamOnEnd,
    settings.obs?.autoSwitchOnStartingMediaEnd,
    countdown.mode,
    endRule.explicit,
    endRule.usesMedia,
  ]);
  // Eski adla aynı ref — video loop / Youtube playOnce buradan okuyor.
  const videoBitisiyleBitir = mediaBitisiyleBitir;
  videoBitisiyleBitirRef.current = videoBitisiyleBitir;

  // Medya bitiş aksiyonu açıkken loop bayrağını güncel tut.
  useEffect(() => {
    const a = audioNode;
    if (a) a.loop = !videoBitisiyleBitir && settings.audioLoop !== false;
    const v = videoNode;
    if (v) {
      const start = Number(settings.bgVideoStart) || 0;
      const end = Number(settings.bgVideoEnd) || 0;
      v.loop = !videoBitisiyleBitir && !(end > start);
    }
  }, [audioNode, videoNode, videoBitisiyleBitir, settings.audioLoop, settings.bgVideoStart, settings.bgVideoEnd]);

  const onPointerDown = (key: string, bas: Konum) => (e: REPointerEvent) => {
    if (!edit) return;
    // Yerinde yazı düzenlerken imleç metni seçsin, öğe sürüklenmesin
    if ((e.target as HTMLElement).closest?.('[contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    dragKey.current = key;
    dragStart.current = { bas, px: e.clientX, py: e.clientY, moved: false, son: bas };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: REPointerEvent) => {
    if (!edit) return;
    if (resizeKey.current) {
      const key = resizeKey.current;
      const start = resizeStart.current;
      if (key === "ticker") {
        const dx = e.clientX - start.x;
        const next = clamp(Math.round(start.size + dx * 0.12), 50, 100);
        if (onLivePatch) onLivePatch({ tickerWidth: next });
        else setSynced((s: any) => ({ ...s, tickerWidth: next }));
        return;
      }
      const dist = Math.hypot(e.clientX - start.cx, e.clientY - start.cy);
      const ratio = start.dist > 4 ? dist / start.dist : 1;
      const next = clamp(Math.round(start.size * ratio), 30, 280);
      setLocalSizes((prev: any) => ({ ...(prev || {}), [key]: next }));
      return;
    }
    if (!dragKey.current || !dragStart.current) return;
    const key = dragKey.current;
    const st = dragStart.current;
    const dx = e.clientX - st.px;
    const dy = e.clientY - st.py;
    if (!st.moved && !esikAsildi(dx, dy)) return;
    st.moved = true;
    const rect = wrapRef.current?.getBoundingClientRect();
    const { konum, kilavuz } = suruklenmisKonum(st.bas, dx, dy, rect?.width || 0, rect?.height || 0);
    st.son = konum;
    setGuides(kilavuz);
    setLocalPositions((prev: any) => ({ ...(prev || {}), [key]: konum }));
  };

  const persistSizes = async (sizes: Record<string, number>) => {
    if (onLivePatch) {
      onLivePatch({ sizes });
      return;
    }
    setSynced((s: any) => ({ ...s, sizes }));
    try {
      await patchSettings(screen, { sizes });
      await saveSettings(screen, { ...settingsRef.current, sizes });
    } catch {
      /* */
    }
  };

  const onPointerUp = async (e: REPointerEvent) => {
    if (resizeKey.current) {
      const key = resizeKey.current;
      resizeKey.current = null;
      if (key === "ticker") {
        const w = Number(settingsRef.current.tickerWidth) || 96;
        if (onLivePatch) onLivePatch({ tickerWidth: w });
        else {
          void patchSettings(screen, { tickerWidth: w });
          void saveSettings(screen, { ...settingsRef.current, tickerWidth: w });
        }
        return;
      }
      setLocalSizes((prev: any) => {
        const sizes = { ...(settingsRef.current.sizes || {}), ...(prev || {}) };
        void persistSizes(sizes);
        return sizes;
      });
      return;
    }
    if (!dragKey.current) return;
    const key = dragKey.current;
    const st = dragStart.current;
    dragKey.current = null;
    dragStart.current = null;
    setGuides({});
    // Sürüklemeden bırakılan tık konumu DEĞİŞTİRMEZ (eskiden öğe tıklanan yere atlıyordu)
    if (!st?.moved) return;
    const positions = { ...(settingsRef.current.positions || {}), ...(localPositions || {}), [key]: st.son };
    setLocalPositions(positions);
    if (onPositionsPersist) {
      onPositionsPersist(positions);
      return;
    }
    setSynced((s: any) => ({ ...s, positions }));
    try {
      await patchSettings(screen, { positions });
      await saveSettings(screen, { ...settingsRef.current, positions });
    } catch {
      /* */
    }
  };

  /** Önizlemede yerinde düzenlenen yazıyı kaydeder (panelde canlı yama, aksi hâlde sunucu). */
  const metniKaydet = async (alan: "eyebrow" | "title" | "sub" | "ticker" | "liveText", deger: string) => {
    if (onLivePatch) {
      onLivePatch({ [alan]: deger });
      return;
    }
    setSynced((s: any) => ({ ...s, [alan]: deger }));
    try {
      await patchSettings(screen, { [alan]: deger });
      await saveSettings(screen, { ...settingsRef.current, [alan]: deger });
    } catch {
      /* */
    }
  };

  const setVisible = async (key: string, show: boolean) => {
    const visible = { ...(settingsRef.current.visible || {}), [key]: show };
    if (onLivePatch) {
      onLivePatch({ visible });
      return;
    }
    setSynced((s: any) => ({ ...s, visible }));
    try {
      await patchSettings(screen, { visible });
      await saveSettings(screen, { ...settingsRef.current, visible });
    } catch {
      /* */
    }
  };

  const renderDraggable = (key: string, content: ReactNode, defaultPos = { x: 50, y: 50 }) => {
    // Konum kullanıcıya ait: kenara dayamak ya da kasten yarısını dışarı
    // taşırmak isteyebilir. Buraya sınırlama koymuyoruz.
    const pos = displaySettings.positions?.[key] || defaultPos;
    const size = (displaySettings.sizes?.[key] || 100) / 100;
    const visible = displaySettings.visible?.[key] !== false;
    if (!visible || content == null) return null;
    const tickerW =
      key === "ticker"
        ? Math.min(100, Math.max(50, Number(displaySettings.tickerWidth) || 92))
        : null;

    return (
      <div
        key={key}
        className={`draggable ${edit ? "dragging-ready" : ""}`}
        data-key={key}
        onPointerDown={onPointerDown(key, pos)}
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: tickerW != null ? `${tickerW}%` : undefined,
          transform: `translate(-50%, -50%) scale(${key === "ticker" ? 1 : size})`,
          cursor: edit ? "move" : "default",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {edit && (
          <>
            <button
              type="button"
              className="drag-hide-btn"
              title="Önizlemeden kaldır"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                void setVisible(key, false);
              }}
            >
              ×
            </button>
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <div
                key={corner}
                className="drag-resize-handle"
                data-corner={corner}
                title="Boyutlandır"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const el = (e.currentTarget as HTMLElement).parentElement;
                  const rect = el?.getBoundingClientRect();
                  const cx = rect ? rect.left + rect.width / 2 : e.clientX;
                  const cy = rect ? rect.top + rect.height / 2 : e.clientY;
                  const dist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
                  resizeKey.current = key;
                  resizeStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    size:
                      key === "ticker"
                        ? Number(displaySettings.tickerWidth) || 96
                        : displaySettings.sizes?.[key] || 100,
                    cx,
                    cy,
                    dist,
                  };
                  (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                }}
              />
            ))}
          </>
        )}
        {content}
      </div>
    );
  };

  const s = displaySettings;
  // Şu an çalan bilgisi Rust'taki tek kayıttan gelir (Spotify'ı o yoklar,
  // YouTube Music'i Resonance köprüsü besler) — her ekran aynı anı gösterir.
  const nowPlayingOn = screen !== "chat" && s.nowPlayingEnabled !== false;
  // Resonance kuruluysa kartı o çizer — kullanıcının seçtiği tema birebir
  // yansısın diye. Kurulu değilse yerleşik sade karta düşeriz.
  const [resonanceDown, setResonanceDown] = useState(false);
  const useResonanceCard = s.nowPlayingTheme !== false && !resonanceDown;
  // Resonance kartı kendi verisini çekiyor; burada ayrıca yoklama yapmak
  // her overlay'de gereksiz istek ve 250 ms'de bir yeniden çizim demekti.
  const { track: npTrack, progress: npProgress } = useNowPlaying(
    nowPlayingOn && !useResonanceCard
  );
  const bgStyle = s.transparent ? "dark" : s.bgStyle || "mix";
  const ytId = extractYoutubeId(s.youtubeUrl || "");
  const creditsSpeed = Number(s.creditsSpeed) || 40;
  const creditsGap = Number(s.creditsGap) || 3;
  const socialEntries = Object.entries(s.socials || {}).filter(([, val]: any) => {
    const handle = String(val?.handle || "").trim();
    return !!handle && !!val?.enabled;
  });

  const renderCountdown = () => {
    const cdProps = textProps("countdown");
    if (countdown.mode !== "count") {
      // Çıkış ekranında kırmızı noktalı rozet gösterme
      if (countdown.mode === "badge" && screen !== "ending") {
        return (
          <div className="live-badge" style={cdProps.style} data-fx={cdProps["data-fx"]} data-anim={cdProps["data-anim"]}>
            <span className="dot" />
            <span className="live-text">
              <YerindeMetin deger={s.liveText || "CANLI YAYINDA"} aktif={edit} onKaydet={(v) => void metniKaydet("liveText", v)} />
            </span>
          </div>
        );
      }
      return null;
    }
    const h = pad(countdown.hours!);
    const m = pad(countdown.minutes!);
    const sec = pad(countdown.seconds!);
    const mmTotal = pad(Math.min(99, countdown.totalMinutes!));

    if (cdStyle === "minimal") {
      return (
        <div
          className="countdown countdown-minimal"
          style={cdProps.style}
          data-fx={cdProps["data-fx"]}
          data-anim={cdProps["data-anim"]}
        >
          <span className="cd-fixed">{pad(countdown.totalMinutes!)}</span>
          <span className="cd-colon">:</span>
          <span className="cd-fixed">{sec}</span>
        </div>
      );
    }
    // boxes (default)
    const showH = (countdown.hours || 0) > 0;
    return (
      <div
        className="countdown countdown-boxes"
        style={cdProps.style}
        data-fx={cdProps["data-fx"]}
        data-anim={cdProps["data-anim"]}
      >
        {showH && (
          <>
            <div className="cd-box">
              <span className="cd-num cd-fixed">{h}</span>
              <span className="cd-label">Saat</span>
            </div>
            <span className="cd-sep">:</span>
          </>
        )}
        <div className="cd-box">
          <span className="cd-num cd-fixed">{showH ? m : mmTotal}</span>
          <span className="cd-label">Dakika</span>
        </div>
        <span className="cd-sep">:</span>
        <div className="cd-box">
          <span className="cd-num cd-fixed">{sec}</span>
          <span className="cd-label">Saniye</span>
        </div>
      </div>
    );
  };

  const HIDDEN_LABELS: Record<string, string> = {
    logo: "Logo",
    eyebrow: "Üst etiket",
    title: "Başlık",
    sub: "Alt başlık",
    countdown: "Geri sayım",
    socials: "Sosyal",
    ticker: "Alt not",
    credits: "Jenerik",
    visualizer: "Visualizer",
    nowPlaying: "Şimdi Çalıyor",
  };
  const hiddenKeys = Object.keys(HIDDEN_LABELS).filter((k) => displaySettings.visible?.[k] === false);

  return (
    <div
      ref={wrapRef}
      className={`obs-canvas-wrap ${edit ? "edit-mode" : ""}`}
      data-bg={bgStyle === "image" || bgStyle === "custom" ? "custom" : bgStyle}
      data-font={settings.font || "system"}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {(bgStyle === "image" || bgStyle === "custom") && bgImageSrc && (
        <img className="bg-image" src={bgImageSrc} alt="" />
      )}

      {bgStyle === "youtube" && ytId && (
        <YoutubeBg
          key={`${ytId}-${mediaEpoch}`}
          videoId={ytId}
          start={Number(settings.youtubeStart) || 0}
          end={Number(settings.youtubeEnd) || 0}
          sound={!!settings.videoSound}
          volume={Number(settings.videoVolume) || 100}
          quality={settings.youtubeQuality || "hd1080"}
          endMargin={
            settings.youtubePlayToEnd
              ? -1
              : Number(settings.youtubeEndMargin) > 0
                ? Number(settings.youtubeEndMargin)
                : DEFAULT_END_MARGIN
          }
          seekTo={seekTo}
          seekAt={seekAt}
          playOnce={videoBitisiyleBitir}
          playLoops={endRule.loops}
          onEnded={bitisiTetikle}
          playbackActive={!obs || sourceActive}
          onDuration={(seconds) => {
            const dur = Math.round(seconds * 10) / 10;
            if (!(dur > 1)) return;
            const cur = Number(settingsRef.current.youtubeDuration) || 0;
            if (Math.abs(cur - dur) < 0.6) return;
            const patch: OverlaySettings = { youtubeDuration: dur };
            // İlk kez süre geldiyse kırpma bitişini videonun sonuna ayarla
            const end = Number(settingsRef.current.youtubeEnd) || 0;
            if (!(end > 0) || end > dur + 1) {
              patch.youtubeEnd = dur;
            }
            if (onLivePatch) onLivePatch(patch);
            else {
              setSynced((s: any) => ({ ...s, ...patch }));
              void patchSettings(screen, patch);
            }
          }}
        />
      )}

      {videoSrc && bgStyle === "video" && (
        <video
          key={`bg-video-${mediaEpoch}`}
          id="bgVideo"
          ref={attachVideo}
          autoPlay
          playsInline
          muted
          preload="auto"
          disablePictureInPicture
          onTimeUpdate={(e) => {
            const start = Number(settings.bgVideoStart) || 0;
            const end = Number(settings.bgVideoEnd) || 0;
            const el = e.currentTarget;
            const t = el.currentTime;
            const dur = Number(el.duration);
            if (end > start && t >= end - 0.05) {
              // Kırpma sonu da "video bitti" sayılır.
              if (videoBitisiyleBitir) {
                medyaTurBitti(el, start);
              } else {
                el.currentTime = start;
              }
            } else if (
              videoBitisiyleBitir &&
              Number.isFinite(dur) &&
              dur > 0 &&
              t >= dur - 0.2
            ) {
              // Bazı WebView'lerde loop/seek yüzünden `ended` gelmiyor.
              medyaTurBitti(el, start);
            } else if (start > 0 && t < start - 0.2) {
              el.currentTime = start;
            }
          }}
          onEnded={(e) => {
            if (videoBitisiyleBitirRef.current) {
              medyaTurBitti(e.currentTarget, Number(settingsRef.current.bgVideoStart) || 0);
            }
          }}
          onError={() => {
            const ad = String(videoSrc).split(/[/\\]/).pop() || "";
            pushNotice({
              id: "bg-video",
              level: "error",
              text: `Arka plan videosu oynatılamıyor: ${decodeURIComponent(ad)}`,
              hint: "Dosya silinmiş ya da biçimi desteklenmiyor olabilir — MP4 (H.264) olarak dönüştürüp tekrar ekle.",
            });
          }}
          onPlaying={() => clearNotice("bg-video")}
        />
      )}

      {audioSrc && (
        <audio
          ref={attachAudio}
          autoPlay
          playsInline
          onEnded={() => {
            if (videoBitisiyleBitirRef.current) bitisiTetikle();
          }}
          onError={() => {
            const ad = String(audioSrc).split(/[/\\]/).pop() || "";
            pushNotice({
              id: "bg-audio",
              level: "warn",
              text: `Fon müziği çalınamıyor: ${decodeURIComponent(ad)}`,
              hint: "Dosya silinmiş ya da biçimi desteklenmiyor olabilir.",
            });
          }}
          onPlaying={() => clearNotice("bg-audio")}
        />
      )}

      {settings.particles !== false && !settings.transparent && (
        <ParticleCanvas
          accent={settings.accent}
          types={particleTypes}
          sizes={particleSizes}
          colors={particleColors}
          glow={particleGlow}
          density={Number(settings.particleDensity) || 100}
          assetsBase={`${API_BASE}/assets/particles`}
        />
      )}
      {!settings.transparent && <div className="vignette" />}

      {guides.v != null && <div className="snap-guide v" style={{ left: `${guides.v}%` }} />}
      {guides.h != null && <div className="snap-guide h" style={{ top: `${guides.h}%` }} />}

      <div className="obs-overlay">
        {renderDraggable(
          "logo",
          <div
            className={`logo-ring ${settings.logoFit === false ? "" : "fit"} ${settings.logoFrame === false ? "no-frame" : ""}`}
            style={
              settings.logoAccentColor
                ? ({ ["--accent" as string]: settings.logoAccentColor } as CSSProperties)
                : undefined
            }
            data-fx={
              settings.logoEffect && settings.logoEffect !== "none" ? settings.logoEffect : undefined
            }
            data-anim={
              settings.logoAnim && settings.logoAnim !== "none" ? settings.logoAnim : undefined
            }
          >
            {(() => {
              const src =
                settings.logo && String(settings.logo).startsWith("data:")
                  ? settings.logo
                  : mediaUrl(settings.logoFile || settings.logoPath || settings.logo);
              return src ? <img src={src} alt="" /> : <span>▶</span>;
            })()}
          </div>,
          { x: 50, y: 22 }
        )}

        {s.eyebrow &&
          renderDraggable(
            "eyebrow",
            <p className="eyebrow" {...textProps("eyebrow")}>
              <YerindeMetin deger={s.eyebrow} aktif={edit} onKaydet={(v) => void metniKaydet("eyebrow", v)} bosOlabilir />
            </p>,
            s.positions?.eyebrow || { x: 50, y: 36 }
          )}

        {s.title &&
          renderDraggable(
            "title",
            <h1 className="stream-title" {...textProps("title")}>
              <YerindeMetin deger={s.title} aktif={edit} onKaydet={(v) => void metniKaydet("title", v)} />
            </h1>,
            s.positions?.title || { x: 50, y: 44 }
          )}

        {s.sub &&
          renderDraggable(
            "sub",
            <p className="stream-sub" {...textProps("sub")}>
              <YerindeMetin deger={s.sub} aktif={edit} onKaydet={(v) => void metniKaydet("sub", v)} bosOlabilir />
            </p>,
            s.positions?.sub || { x: 50, y: 52 }
          )}

        {/* Çıkış: OBS'te sayaç yok. Panelde yalnızca aktif geri sayım (kırmızı rozet yok). */}
        {!(obs && screen === "ending") &&
          !(screen === "ending" && countdown.mode !== "count") &&
          renderDraggable("countdown", renderCountdown(), {
            x: 50,
            y: 64,
          })}

        {renderDraggable(
          "socials",
          <div className="socials">
            {socialEntries.map(([key, val]: any) => {
              const meta = SOCIAL_META[key];
              if (!meta) return null;
              return (
                <div className="social-badge" key={key}>
                  <span className="dot-icon" style={{ background: meta.color }}>
                    <svg viewBox="0 0 24 24" fill={meta.iconFill}>
                      <path d={meta.path} />
                    </svg>
                  </span>
                  <span>{val.handle}</span>
                </div>
              );
            })}
          </div>,
          { x: 50, y: 80 }
        )}

        {s.ticker &&
          (() => {
            const tp = textProps("ticker");
            const dur = tickerDurationSec(s.tickerSpeed ?? 12);
            const fade = Math.min(40, Math.max(0, Number(s.tickerFade) ?? 12));
            return renderDraggable(
              "ticker",
              <div
                className="ticker-wrap"
                style={
                  {
                    width: "100%",
                    ["--ticker-fade" as any]: `${fade}%`,
                  } as CSSProperties
                }
              >
                <p
                  key={`tick-${dur}`}
                  className="ticker"
                  style={{
                    ...tp.style,
                    animationDuration: `${dur}s`,
                  }}
                >
                  <span className="ticker-fx" style={tp.style} data-fx={tp["data-fx"]} data-anim={tp["data-anim"]}>
                    <YerindeMetin deger={s.ticker} aktif={edit} onKaydet={(v) => void metniKaydet("ticker", v)} bosOlabilir />
                  </span>
                </p>
              </div>,
              { x: 50, y: 90 }
            );
          })()}

        {showCredits &&
          s.creditsEnabled !== false &&
          creditSections.length > 0 &&
          renderDraggable(
            "credits",
            <CreditsRoller
              sections={creditSections}
              speedSec={creditsSpeed}
              gapSec={creditsGap}
              fallbackStyle={((settings.textStyles || {}) as any).credits}
              fallbackFont={settings.font}
            />,
            { x: 50, y: 88 }
          )}

        {showVisualizer &&
          settings.visualizer !== false &&
          renderDraggable("visualizer", <AudioVisualizer audio={audioNode} bars={24} />, {
            x: 50,
            y: 82,
          })}

        {nowPlayingOn &&
          renderDraggable(
            "nowPlaying",
            useResonanceCard ? (
              <ResonanceNowPlaying
                placeholder={edit}
                hideWhenIdle={s.nowPlayingOnlyWhilePlaying !== false}
                onUnavailable={() => setResonanceDown(true)}
              />
            ) : (
              <NowPlayingWidget
                track={npTrack}
                progress={npProgress}
                accent={s.accent}
                // OBS'te boş kart görünmesin; panelde konumlandırmak için gerekli.
                placeholder={edit}
              />
            ),
            { x: 16, y: 88 }
          )}
      </div>

      {edit && hiddenKeys.length > 0 && (
        <div className="hidden-items-bar">
          <span className="hidden-items-label">Gizliler:</span>
          {hiddenKeys.map((k) => (
            <button key={k} type="button" className="hidden-item-chip" onClick={() => void setVisible(k, true)}>
              + {HIDDEN_LABELS[k] || k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
