import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  CSSProperties,
} from "react";
import { DEFAULT_END_MARGIN, extractYoutubeId } from "../../lib/youtube";
import { resolveEndRule } from "../../lib/endRules";
import {
  API_BASE,
  mediaUrl,
  OverlaySettings,
  ScreenId,
  isObsMode,
  patchSettings,
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
import ResonanceLyrics from "./ResonanceLyrics";
import { useNowPlaying } from "../../lib/useNowPlaying";
import { usePreviewQuality } from "../../lib/previewQuality";
import { clearNotice, pushNotice } from "../../lib/notices";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useObsSourceActive } from "../../lib/obsSourceActive";
import { useSiradakiYayin } from "./useSiradakiYayin";
import {
  canliOturum,
  getCreditsSession,
  mergeAutoCreditSections,
  subscribeCreditsSession,
} from "../../lib/creditsSession";
import { type Konum } from "../../lib/surukle";
import YerindeMetin from "./YerindeMetin"; import { useKabukDuzenleme } from "./useKabukDuzenleme"; import { useKabukBitis } from "./useKabukBitis"; import { useKabukMedya } from "./useKabukMedya"; import { useKabukSayac } from "./useKabukSayac";

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
  /** Önizlemede sürüklemeden tıklanan parça */
  onPartSelect?: (key: string) => void;
  /** Panel/OBS yayın aç-kapa olunca video/iframe cache-bust */
  mediaEpoch?: number;
};

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function clamp(n: number, min: number, max: number) {
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
  onPartSelect,
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
  const siradaki = useSiradakiYayin(screen === "starting" || screen === "ending");

  const countdownActive = isEndScreen && timerWanted;
  const minuteTimerArmed = isEndScreen && !effTarget && effMinutes > 0;
  const { timerEpoch } = useKabukSayac({ countdownActive, effMinutes, effTarget, endedRef, initial, isEndScreen, liveSettings, minuteTimerArmed, obs, screen, setNow, setSynced, settings, sourceActive });

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
  const { seekAt, seekTo } = useKabukMedya({ audioNode, audioRef, audioSrc, endedRef, holdPlaybackRef, obs, preview, settings, settingsRef, sourceActive, videoBitisiyleBitirRef, videoNode, videoRef, videoSrc });
  const { bitisiTetikle, countdown, medyaTurBitti, videoBitisiyleBitir } = useKabukBitis({ audioNode, effMinutes, effTarget, endRule, endRuleRef, endedRef, isEndScreen, now, obs, onCountdownEnd, screen, settings, settingsRef, sourceActive, timerEpoch, videoBitisiyleBitirRef, videoNode, videoSrc });
  const { metniKaydet, onPointerMove, onPointerUp, renderDraggable, setVisible } = useKabukDuzenleme({ displaySettings, dragKey, dragStart, edit, localPositions, onLivePatch, onPartSelect, onPositionsPersist, resizeKey, resizeStart, screen, setGuides, setLocalPositions, setLocalSizes, setSynced, settingsRef, wrapRef });

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
    lyrics: "Şarkı Sözleri",
  };
  const hiddenKeys = Object.keys(HIDDEN_LABELS).filter((k) => displaySettings.visible?.[k] === false);

  return (
    <div
      ref={wrapRef}
      data-ceviri="yok"
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
            data-bicim={settings.logoShape === "kare" || settings.logoShape === "yuvarlakKare" ? settings.logoShape : undefined}
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

        {siradaki &&
          renderDraggable(
            "siradaki",
            <p className="stream-sub" {...textProps("sub")}>
              {siradaki}
            </p>,
            s.positions?.siradaki || { x: 50, y: 72 }
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

        {screen !== "chat" &&
          s.lyricsEnabled === true &&
          renderDraggable("lyrics", <ResonanceLyrics placeholder={edit} />, { x: 50, y: 72 })}
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
