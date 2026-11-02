import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Save } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  API_BASE,
  fetchServerInfo,
  fetchSettings,
  patchSettings,
  importLibraryFile,
  OverlaySettings,
  overlayUrl,
  saveSettings,
  ScreenId,
  sendPlayerCommand,
} from "../../lib/api";
import { bindingName, buildHotkeyPlan, conflictFailures, migrateHotkeyDefaults } from "../../lib/hotkeyPlan";
import { wasHandledByNative } from "../../lib/globalHotkeys";
import { copyText } from "../../lib/clipboard";
import { obsHatasiniCevir } from "../../lib/obsErrors";
import { SOCIAL_META } from "../../lib/socials";
import { DEFAULT_END_MARGIN } from "../../lib/youtube";
import LazyMount from "../../components/panel/LazyMount";
import LivePreview from "../../components/panel/LivePreview";
import MusicBridge from "../../components/panel/MusicBridge";
import MusicPanel from "../../components/panel/MusicPanel";
import VideoTrimBar from "../../components/panel/VideoTrimBar";
import VideoScrubber from "../../components/panel/VideoScrubber";
import TextStyleEditor from "../../components/panel/TextStyleEditor";
import BotSessions from "../../components/panel/BotSessions";
import CopyUrl from "@/components/axthrowa/CopyUrl";
import HotkeyInput from "../../components/panel/HotkeyInput";
import LayoutEditor from "../../components/panel/LayoutEditor";
import NavTabBar, { applyTabOrder, CANLI_SEKME, HAZIRLIK_SEKME, type StudioModul } from "../../components/panel/NavTabBar";
import DurumCubugu from "../../components/panel/DurumCubugu";
import PencereBasligi from "@/components/axthrowa/PencereBasligi";
import AppSettingsPage from "../../components/panel/AppSettingsPage";
import SettingsSection from "../../components/panel/SettingsSection";
import SoundBoardPanel from "../../components/panel/SoundBoardPanel";
import StreamAxtHost from "../../components/panel/StreamAxtHost";
import SesliDinleyiciCercevesi from "../../components/panel/SesliDinleyiciCercevesi";
import ProfileDashboard from "../../components/panel/ProfileDashboard";
import ConnectionsHub from "../../components/panel/ConnectionsHub";
import StreamHealthCard from "../../components/panel/StreamHealthCard";
import ObsControlHub from "../../components/studio/ObsControlHub";
import HotkeysPage from "../../components/panel/HotkeysPage";
import ProfileSwitcher from "../../components/panel/ProfileSwitcher";
import PanelTimer from "../../components/panel/PanelTimer";
import CloseRequestModal from "../../components/panel/CloseRequestModal";
import EdgePanel from "../../components/panel/EdgePanel";
import DashboardUstSerit, { useDashboardBolumu } from "../../components/panel/DashboardUstSerit";
import TemplatePicker from "../../components/panel/TemplatePicker";
import { runObsAction, type ActionRow } from "../../lib/obsActions";
import { resonanceLinkAllowed } from "../../lib/embedMessages";
// Kontrol Merkezi yalnız o sekme açılınca yüklenir (ana paketi büyütmesin)
const ControlCenter = lazy(() => import("../../components/control/ControlCenter"));
const ObsStudioPanel = lazy(() => import("../../components/panel/ObsStudioPanel"));
import { en, tr, type MsgKey } from "../../i18n/messages";
import {
  applyThemeToDom,
  loadAppPrefs,
  saveAppPrefs,
  type AppPrefs,
} from "../../lib/appPrefs";
import {
  DEFAULT_TABS,
  LEFT_SECTIONS_CHAT,
  LEFT_SECTIONS_SCENE,
  RIGHT_SECTIONS,
  loadPanelLayout,
  savePanelLayout,
  visibleOrdered,
  type NavId,
  type PanelLayout,
} from "../../lib/panelLayout";
import {
  loadSoundboard,
  playSoundPad,
  stopAllSounds,
  type SoundPad,
} from "../../lib/soundboard";
import { useChatCommandBridge } from "../../lib/useChatCommandBridge";
import {
  isObsConnected,
  listInputs,
  listScenes,
  listTransitions,
  onObsConnection,
  refreshOurBrowserSources,
  switchScene,
  toggleAudioInputsMuted,
  toggleInputMute,
} from "../../lib/obs";
import { useObs } from "../../lib/obs/ObsContext";
import {
  clearStartingCountdown,
  obsConnectionFrom,
  resolveGameScene,
  resolveStartingScene,
  runEndingEndAction,
  runStartingEndAction,
  seedStartingCountdown,
} from "../../lib/streamAutomation";
import { ruleStopStream } from "../../lib/endRules";
import { obsControl } from "../../lib/obsControl";
import { clearPlatformChats, clearResultToast } from "../../lib/clearPlatformChats";
import { endSession, fetchDashboard, startSession } from "../../lib/api/botaxt";
import { loadObsSaved, saveObsSaved } from "../../lib/obsPersist";
import { pickObsConnection, sameObsConnection } from "../../lib/obsConnection";
import { suggestSceneMap, type SceneRole } from "../../lib/sceneSuggest";
import { getBotConfig, saveBotConfig } from "../../lib/smartBot";
import { notifyDiscordLive } from "../../lib/smartBot/platformActions";
import { ANIM_OPTIONS, EFFECT_OPTIONS } from "../../lib/textStyles";
import { useCreditsCollector } from "../../lib/useCreditsCollector";
import { useGlobalHotkeys, eventToSpec, canonicalizeHotkeySpec } from "../../lib/globalHotkeys";
import { useVideoDownload } from "../../lib/useVideoDownload";
import { clearNotice, pushNotice, useNotices } from "../../lib/notices";
import { yayinSagligiIzle } from "../../lib/yayinSagligi";
import { getStreamHealth } from "../../lib/obs";
import { isErrorLike, pushAppAlert } from "../../lib/appAlert";
import AppAlertModal from "@/components/axthrowa/AppAlertModal";
import UpdateModal from "@/components/axthrowa/UpdateModal";
import { Toast } from "@/components/axthrowa/Toast";
import KarsilamaEkrani from "@/components/axthrowa/LisansEkrani";
import { gunluk } from "../../lib/gunluk";
import { olay } from "../../lib/analitik";
import { useAxthrowaStore, useAxthrowaStoreKoprusu } from "../../store/useAxthrowaStore";
import {
  clearCreditsSession,
  creditsSessionCounts,
  getCreditsSession,
  subscribeCreditsSession,
} from "../../lib/creditsSession";

/** Önizlemede gizlenebilen parçalar ve okunur adları */
const PART_LABELS_TR: Record<string, string> = {
  logo: "Logo",
  eyebrow: "Üst yazı",
  title: "Başlık",
  sub: "Alt yazı",
  countdown: "Geri sayım",
  socials: "Sosyal hesaplar",
  ticker: "Kayan yazı",
  credits: "Emeği geçenler",
  nowPlaying: "Şimdi Çalıyor",
};
const PART_LABELS_EN: Record<string, string> = {
  logo: "Logo",
  eyebrow: "Eyebrow",
  title: "Title",
  sub: "Subtitle",
  countdown: "Countdown",
  socials: "Socials",
  ticker: "Ticker",
  credits: "Credits",
  nowPlaying: "Now Playing",
};
const PART_KEYS = Object.keys(PART_LABELS_TR);

/** Müzik paylaşımında kopyalanan alanlar ve hedef ekranlar */
const MUSIC_KEYS = ["bgAudioPath", "audioLoop", "musicSound", "musicVolume", "musicShared"];
const MUSIC_SHARE_SCREENS: ScreenId[] = ["starting", "ending", "brb"];

/** OBS bağlantısı + sahne/ses kısayolları tüm sekmelerde aynı olsun */
const OBS_SHARE_SCREENS: ScreenId[] = ["starting", "ending", "brb", "chat"];

/** Sayı alanlarını güvenli aralığa sıkıştırır — boş/NaN girişte varsayılana döner. */
function clampInt(raw: string, min: number, max: number, fallback: number) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const DEFAULT_SOCIALS = Object.fromEntries(
  Object.keys(SOCIAL_META).map((k) => [k, { enabled: k === "twitch", handle: "" }])
);

const ROL_AD: Record<SceneRole, string> = { starting: "Giriş", ending: "Çıkış", brb: "Mola", game: "Oyun" };

export default function PanelPage() {
  const { connect: obsConnect, connected: obsCtxConnected } = useObs();
  // Yayın sağlığı uyarıları: hangi sekme açık olursa olsun (pencere arkadayken de) izlenir
  useEffect(
    () =>
      yayinSagligiIzle(
        async () => (isObsConnected() ? getStreamHealth() : null),
        (u) => ("temizle" in u ? clearNotice(u.id) : pushNotice({ id: u.id, level: u.seviye, text: u.metin, hint: u.ipucu })),
        () => localStorage.getItem("yya.saglikSesi") !== "0"
      ),
    []
  );
  const [screen, setScreen] = useState<ScreenId>("starting");
  // Müzik / Ayarlar ekran ayarlarından bağımsız; ScreenId şemasını kirletmez.
  const [activeNav, setActiveNav] = useState<NavId | ScreenId>(() => {
    try {
      return localStorage.getItem("yya.modul") === "hazirlik" ? "starting" : "control";
    } catch {
      return "control";
    }
  });
  const [modul, setModul] = useState<StudioModul>(() => {
    try {
      return localStorage.getItem("yya.modul") === "hazirlik" ? "hazirlik" : "canli";
    } catch {
      return "canli";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("yya.modul", modul);
    } catch {
      /* depolama kapalı */
    }
  }, [modul]);
  // Bot sekmesinde açılacak StreamAxT sayfası (Dashboard'daki "Bot'ta yönet" platformlar sayfasını açar)
  const [botSekme, setBotSekme] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (activeNav !== "bot") setBotSekme(undefined);
  }, [activeNav]);
  const [layout, setLayout] = useState<PanelLayout>(() => loadPanelLayout());
  const [prefs, setPrefs] = useState<AppPrefs>(() => loadAppPrefs());
  const [editLayout, setEditLayout] = useState(false);
  const [hotkeyCapture, setHotkeyCapture] = useState(false);
  const [sfxPads, setSfxPads] = useState<SoundPad[]>(() => loadSoundboard());
  const [clearChatHk, setClearChatHk] = useState("");
  // Ses paneli: "tüm sesleri durdur" kısayolu (panel ayarında saklanır)
  const [sfxStopHk, setSfxStopHk] = useState("");
  const tt = useCallback(
    (key: MsgKey) => {
      const table = prefs.locale === "en" ? en : tr;
      return table[key] || tr[key] || key;
    },
    [prefs.locale]
  );
  const PART_LABELS = prefs.locale === "en" ? PART_LABELS_EN : PART_LABELS_TR;
  const hotkeyCaptureRef = useRef(false);
  hotkeyCaptureRef.current = hotkeyCapture;
  const [settings, setSettings] = useState<OverlaySettings>({ socials: DEFAULT_SOCIALS });
  const musicTab = activeNav === "music";
  const controlTab = activeNav === "control";
  const yayinTab = activeNav === "yayin";
  const botTab = activeNav === "bot";
  const chatTab = activeNav === "chat";
  // Canlı Chat sekmesi StreamAxT'nin Multi-Chat'ini gösterir; panelin kendi
  // sohbet KATMANI ayarlarına (OBS overlay tasarımı) bu bayrakla dönülür.
  const [chatOverlaySettings, setChatOverlaySettings] = useState(false);
  const profileTab = activeNav === "profile" || activeNav === "obs";
  const soundsTab = activeNav === "sounds";
  const hotkeysTab = activeNav === "hotkeys";
  const settingsTab = activeNav === "settings";

  useEffect(() => {
    const sync = () => setSfxPads(loadSoundboard());
    window.addEventListener("soundboard-changed", sync);
    return () => window.removeEventListener("soundboard-changed", sync);
  }, []);

  useEffect(() => {
    fetchSettings("chat")
      .then((s) => setClearChatHk(String(s.clearChatHotkey || "")))
      .catch(() => {});
    fetchSettings("panel")
      .then((s) => setSfxStopHk(String(s.sfxStopHotkey || "")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    applyThemeToDom(prefs.theme);
    saveAppPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    savePanelLayout(layout);
  }, [layout]);

  useEffect(() => {
    applyThemeToDom(prefs.theme);
    if (!prefs.openObsOnLaunch) return;
    try {
      if (!isTauri()) return;
      void invoke("launch_obs", { path: prefs.obsExePath || null }).catch(() => {});
    } catch {
      /* */
    }
    // Yalnız ilk açılış
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [server, setServer] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [obsConnected, setObsConnected] = useState(false);
  const [dashBolum, setDashBolum] = useDashboardBolumu();
  const [masterBusy, setMasterBusy] = useState(false);
  // OBS'te elle başlatılan yayın da görünsün: durum store'da, Rust ve OBS olaylarıyla güncellenir
  useAxthrowaStoreKoprusu();
  const liveOn = useAxthrowaStore((s) => s.isLive);
  const setLiveOn = useAxthrowaStore((s) => s.setLive);
  const [scenes, setScenes] = useState<string[]>([]);
  const scenesCountRef = useRef(0);
  scenesCountRef.current = scenes.length;
  const [transitions, setTransitions] = useState<string[]>([]);
  const [inputs, setInputs] = useState<{ name: string; kind: string }[]>([]);
  const [particleFiles, setParticleFiles] = useState<string[]>([]);
  const [musicFiles, setMusicFiles] = useState<string[]>([]);
  const [logoFiles, setLogoFiles] = useState<string[]>([]);
  const [videoFiles, setVideoFiles] = useState<string[]>([]);
  const [bgFiles, setBgFiles] = useState<string[]>([]);
  const [creditCounts, setCreditCounts] = useState(() => creditsSessionCounts());
  const notices = useNotices();
  /**
   * Önizleme kapatılabilir: gömülü overlay video çözüyor, parçacık tuvali
   * çiziyor ve panelin CPU/RAM yükünün büyük kısmını o üretiyor. Uzun
   * yayınlarda ayarları kurduktan sonra önizlemeye ihtiyaç kalmıyor.
   *
   * Ayar `localStorage`'da: bu bir panel tercihi, overlay ayarı değil —
   * `settings` içine koymak onu OBS'e de yayınlardı.
   */
  // Yan paneller kenara gizlensin mi? (varsayılan: gizli — önizleme tam genişlik).
  // Anahtar v2: kullanıcı "fare yaklaşınca açılsın" istedi; eski "sabit" kaydı
  // (çoğu zaman yanlışlıkla basılmış) bir kez yok sayılır, düğme yine çalışır.
  const [panelsPinned, setPanelsPinned] = useState(() => {
    try {
      return localStorage.getItem("panel.yanPanelSabit.v2") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("panel.yanPanelSabit.v2", panelsPinned ? "1" : "0");
    } catch {
      /* depolama kapalı */
    }
  }, [panelsPinned]);

  const [previewOn, setPreviewOn] = useState(() => {
    try {
      return localStorage.getItem("panel.onizleme") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("panel.onizleme", previewOn ? "1" : "0");
    } catch {
      /* özel mod / kısıtlı depolama */
    }
  }, [previewOn]);
  const saveTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Sekmeler arası ortak OBS/kısayol — diskteki eski kopya UI'yi ezmesin */
  const obsSharedRef = useRef<Record<string, unknown> | null>(null);
  const overlayRefreshTimers = useRef<number[]>([]);
  /** goLive ile zorlanan sekme — layout gizlemiş olsa bile geri itilmesin */
  const forceNavRef = useRef<NavId | null>(null);
  const startingSwitchDoneRef = useRef(false);
  const endingStopDoneRef = useRef(false);
  const streamWatchArmedRef = useRef(false);

  /** OBS açılınca / yeniden bağlanınca overlay tarayıcı kaynaklarını yenile. */
  const scheduleOverlayRefresh = useCallback((base?: string) => {
    for (const t of overlayRefreshTimers.current) window.clearTimeout(t);
    overlayRefreshTimers.current = [];
    const run = () => {
      void refreshOurBrowserSources({
        base: base || server?.base || API_BASE || "http://127.0.0.1:8843",
      }).catch(() => {});
    };
    // CEF bazen WebSocket'ten sonra ayağa kalkıyor — birkaç dalga.
    overlayRefreshTimers.current = [
      window.setTimeout(run, 600),
      window.setTimeout(run, 2200),
      window.setTimeout(run, 5500),
    ];
  }, [server?.base]);

  // Yayın boyunca abone / bağış / takip olaylarını jenerik oturumuna yaz
  useCreditsCollector(true);
  useEffect(() => subscribeCreditsSession(() => setCreditCounts(creditsSessionCounts())), []);

  // OBS bağlantısı koparsa sahne kısayolları sessizce çalışmaz hâle geliyordu:
  // `obsConnected` yalnızca kendi `connect` çağrımıza göre ayarlandığı için
  // bayrak `true` kalıyordu. Artık soket olaylarını dinliyoruz.
  useEffect(() => {
    setObsConnected(obsCtxConnected);
  }, [obsCtxConnected]);
  useEffect(
    () =>
      onObsConnection((baglandi, sebep) => {
        setObsConnected(baglandi);
        if (baglandi) {
          clearNotice("obs");
          scheduleOverlayRefresh();
          return;
        }
        // `sebep` yoksa bağlantıyı kullanıcı kendisi kesti — uyarı gerekmez.
        if (!sebep) return;
        // Ham protokol metni yerine ne yapılacağını söyleyen çeviri.
        const cevrili = obsHatasiniCevir(String(sebep), Number(settingsRef.current?.obs?.port) || undefined);
        pushNotice({
          id: "obs",
          level: "error",
          text: cevrili.metin,
          hint: cevrili.ipucu,
        });
      }),
    [scheduleOverlayRefresh]
  );

  useEffect(
    () => () => {
      for (const t of overlayRefreshTimers.current) window.clearTimeout(t);
    },
    []
  );

  // Her bildirimde yeni bir zamanlayıcı bırakılıyordu; hızlı yazarken
  // onlarca timer birikiyor ve mesaj titriyordu.
  const showToast = useCallback((m: string) => {
    const text = String(m || "").trim();
    if (!text) return;
    if (isErrorLike(text)) {
      pushAppAlert({ message: text });
      return;
    }
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 2200);
  }, []);

  useChatCommandBridge({ onToast: showToast });

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    },
    []
  );

  const persistNow = useCallback(async (s: ScreenId, data: OverlaySettings) => {
    // Çıkış ayarının tamamı kaydedilirken canlı jenerik listesi panelin güncel oturumundan yazılır (bayatı ezmesin)
    await saveSettings(s, s === "ending" ? { ...data, creditsLive: getCreditsSession() } : data);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s" || e.altKey) return;
      if (hotkeyCaptureRef.current) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      e.preventDefault();
      void persistNow(screen, settings)
        .then(() => showToast(tt("brand.saved")))
        .catch(() => showToast("Kaydedilemedi — sunucu kapalı olabilir"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persistNow, screen, settings, showToast, tt]);

  const scheduleSave = useCallback(
    (data: OverlaySettings) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      // OBS'e yansıma süresi bu gecikme + WebSocket yayını kadar. 140 ms
      // tuş vuruşlarını hâlâ birleştiriyor ama gözle fark edilmiyor.
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void persistNow(screen, data)
          .then(() => showToast("Otomatik kaydedildi"))
          .catch(() => showToast("Kaydedilemedi — sunucu kapalı olabilir"));
      }, 140);
    },
    [persistNow, screen, showToast]
  );

  // Aynı müziği tüm yayın ekranlarında çalmak için kopyalanan alanlar.
  // Ayarlar ekran başına tutuluyor; paylaşımı sunucuya yazarken yapıyoruz ki
  // OBS'teki her ekran kendi ayarından aynı parçayı okusun.
  const mirrorMusic = useCallback(
    async (data: OverlaySettings) => {
      const targets = MUSIC_SHARE_SCREENS.filter((s) => s !== screen);
      const patch: OverlaySettings = {};
      for (const key of MUSIC_KEYS) patch[key] = data[key] ?? null;
      await Promise.all(
        targets.map((s) =>
          patchSettings(s, patch).catch(() => {
            /* sunucu kapalıysa sessiz geç; kaydetme uyarısı zaten çıkıyor */
          })
        )
      );
    },
    [screen]
  );

  // Kısayol / OBS WebSocket ayarları sekme değişince sıfırlanmasın —
  // Giriş'te atadığın F1, Çıkış / Mola / Chat'te de aynı kalsın.
  const mirrorObs = useCallback(
    async (data: OverlaySettings) => {
      if (!data.obs || typeof data.obs !== "object") return;
      obsSharedRef.current = data.obs as Record<string, unknown>;
      const targets = OBS_SHARE_SCREENS.filter((s) => s !== screen);
      await Promise.all(
        targets.map((s) =>
          patchSettings(s, { obs: data.obs }).catch(() => {
            /* */
          })
        )
      );
    },
    [screen]
  );

  const update = useCallback(
    (patch: OverlaySettings) => {
      setSettings((s) => {
        const next = { ...s, ...patch };
        if (patch.obs && typeof patch.obs === "object") {
          next.obs = { ...(s.obs || {}), ...patch.obs };
          obsSharedRef.current = next.obs as Record<string, unknown>;
        }
        scheduleSave(next);
        if (next.musicShared && MUSIC_KEYS.some((k) => k in patch)) {
          void mirrorMusic(next);
        }
        if (patch.obs) {
          void mirrorObs(next);
        }
        return next;
      });
    },
    [scheduleSave, mirrorMusic, mirrorObs]
  );

  const reload = useCallback(async (s: ScreenId) => {
    try {
      const data = await fetchSettings(s);
      // Mutlak video yollarını kütüphane adına indir (oturumlar arası kalıcılık)
      let bgVideoPath = data.bgVideoPath;
      if (typeof bgVideoPath === "string" && (bgVideoPath.includes("/") || bgVideoPath.includes("\\"))) {
        bgVideoPath = bgVideoPath.replace(/\\/g, "/").split("/").pop() || bgVideoPath;
      }
      let bgImagePath = data.bgImagePath;
      if (
        typeof bgImagePath === "string" &&
        (bgImagePath.includes("assets/backgrounds") || bgImagePath.includes("assets\\backgrounds"))
      ) {
        bgImagePath = bgImagePath.replace(/\\/g, "/").split("/").pop() || bgImagePath;
      }
      // Ortak OBS: oturumda bilinen kısayolları koru; yoksa bu ekrandan tohumla.
      const obsHam =
        (obsSharedRef.current as OverlaySettings["obs"]) ||
        (data.obs as OverlaySettings["obs"]) ||
        undefined;

      // Eski F1-F4 varsayılanları artık kodda atanmıyor. Mevcut kullanıcıların
      // kısayolu kaybolmasın diye bir kez diske açıkça yazıyoruz; sonrasında
      // temizlerlerse gerçekten temizlenmiş kalır.
      const goc = obsHam ? migrateHotkeyDefaults(obsHam) : null;
      const obs = goc ? ({ ...obsHam, ...goc } as OverlaySettings["obs"]) : obsHam;
      if (goc && obs) {
        obsSharedRef.current = obs as Record<string, unknown>;
        void Promise.all(
          OBS_SHARE_SCREENS.map((t) => patchSettings(t, { obs }).catch(() => {}))
        );
      }
      if (obs && !obsSharedRef.current) {
        obsSharedRef.current = obs as Record<string, unknown>;
        const targets = OBS_SHARE_SCREENS.filter((x) => x !== s);
        void Promise.all(
          targets.map((t) => patchSettings(t, { obs }).catch(() => {}))
        );
      } else if (obsSharedRef.current) {
        void patchSettings(s, { obs: obsSharedRef.current }).catch(() => {});
      }
      setSettings({
        ...data,
        bgVideoPath,
        bgImagePath,
        obs,
        socials: { ...DEFAULT_SOCIALS, ...(data.socials || {}) },
      });
    } catch {
      setSettings({ socials: DEFAULT_SOCIALS });
    }
  }, []);

  // Önizlemede kapatılan parçalar. Kullanıcı bir şeyi gizleyince kenar
  // çubuğundaki onay kutusunu aramak zorunda kalmasın diye önizlemenin altında
  // tek tıkla geri getirilebilir duruyorlar.
  const hiddenParts = useMemo(
    () =>
      PART_KEYS.filter((k) =>
        k === "nowPlaying"
          ? settings.nowPlayingEnabled === false || settings.visible?.nowPlaying === false
          : settings.visible?.[k] === false
      ),
    [settings.visible, settings.nowPlayingEnabled]
  );

  const restorePart = useCallback(
    (key: string) => {
      const patch: OverlaySettings = {
        visible: { ...(settings.visible || {}), [key]: true },
      };
      if (key === "nowPlaying") patch.nowPlayingEnabled = true;
      update(patch);
    },
    [settings.visible, update]
  );

  const restoreAllParts = useCallback(() => {
    const visible = { ...(settings.visible || {}) };
    for (const k of PART_KEYS) visible[k] = true;
    update({ visible, nowPlayingEnabled: true });
  }, [settings.visible, update]);

  const obsUrl = useMemo(() => {
    const base = server?.baseUrl || API_BASE;
    return overlayUrl(base, screen === "chat" ? "chat" : screen);
  }, [screen, server]);

  const refreshParticles = useCallback(() => {
    fetch(`${API_BASE}/api/particles`)
      .then((r) => r.json())
      .then(setParticleFiles)
      .catch(() => setParticleFiles([]));
  }, []);

  const refreshMusic = useCallback(() => {
    fetch(`${API_BASE}/api/music`)
      .then((r) => r.json())
      .then((list) => setMusicFiles(Array.isArray(list) ? list : []))
      .catch(() => setMusicFiles([]));
  }, []);

  const refreshLogos = useCallback(() => {
    fetch(`${API_BASE}/api/logos`)
      .then((r) => r.json())
      .then((list) => setLogoFiles(Array.isArray(list) ? list : []))
      .catch(() => setLogoFiles([]));
  }, []);

  const refreshVideos = useCallback(() => {
    fetch(`${API_BASE}/api/videos`)
      .then((r) => r.json())
      .then((list) => setVideoFiles(Array.isArray(list) ? list : []))
      .catch(() => setVideoFiles([]));
  }, []);

  // YouTube arka planını yerele indirme. Biten dosyaya kendiliğinden geçiyoruz:
  // indirmenin tek amacı zaten oynatıcı arayüzünden kurtulmak.
  const indirmeBitti = useCallback(
    (dosya: string) => {
      refreshVideos();
      update({
        bgVideoPath: dosya,
        bgVideoStart: 0,
        bgVideoEnd: 0,
        bgStyle: "video",
        lastVideoSource: "video",
        youtubeUrl: "",
      });
      showToast("Video yerele indirildi — artık yerel dosyadan oynuyor");
    },
    [refreshVideos, update, showToast]
  );
  const indirme = useVideoDownload(indirmeBitti);
  const indirmeSuruyor =
    indirme.durum.phase === "araclar" ||
    indirme.durum.phase === "indiriliyor" ||
    indirme.durum.phase === "birlestiriliyor";
  const indirmeMetni =
    indirme.durum.phase === "araclar"
      ? indirme.durum.message || "İndirme aracı hazırlanıyor…"
      : indirme.durum.phase === "birlestiriliyor"
        ? "Görüntü ve ses birleştiriliyor…"
        : `%${Math.round(Math.max(0, indirme.durum.percent))}${
            indirme.durum.message ? ` — ${indirme.durum.message}` : ""
          }`;

  const refreshBackgrounds = useCallback(() => {
    fetch(`${API_BASE}/api/backgrounds`)
      .then((r) => r.json())
      .then((list) => setBgFiles(Array.isArray(list) ? list : []))
      .catch(() => setBgFiles([]));
  }, []);

  /** Sahne / geçiş / ses girişi listelerini OBS'ten yeniden yükler. */
  const refreshObsLists = useCallback(async () => {
    let list: string[] = [];
    try {
      const snap = await obsControl.scenes();
      if (snap.scenes?.length) list = snap.scenes;
    } catch {
      /* JS istemcisine düş */
    }
    if (!list.length) {
      try {
        list = await listScenes();
      } catch {
        /* */
      }
    }
    if (list.length) setScenes(list);
    try {
      setTransitions(await listTransitions());
    } catch {
      /* */
    }
    try {
      setInputs(await listInputs());
    } catch {
      /* */
    }
    // Sahne-rol eşleşmesi boşsa kısayollar hedefsiz kalıyordu: yalnız boş rolleri
    // ad benzerliğiyle doldur (kullanıcının seçtiğine dokunma).
    const oneri = suggestSceneMap(list, settingsRef.current.obs);
    if (oneri) {
      update({ obs: oneri.patch });
      showToast(`Sahneler eşleştirildi: ${oneri.filled.map((r) => ROL_AD[r]).join(", ")}`);
    }
    scheduleOverlayRefresh();
  }, [scheduleOverlayRefresh, update, showToast]);

  const tryAutoObs = useCallback(
    async (silent = true, need: { rust: boolean; js: boolean } = { rust: true, js: true }) => {
      // Bağlantı bilgisinin tek kaynağı: "Bağlantılar" kartının kaydettiği panel
      // ayarı. Eskiden ekran dilimindeki (şifresiz, eski adresli) kayıt
      // okunuyordu — kart "Bağlı" derken panel yanlış adrese gidiyordu.
      let panelObs: Record<string, unknown> | null = null;
      try {
        panelObs = ((await fetchSettings("panel")).obs as Record<string, unknown>) || null;
      } catch {
        /* sunucu yanıt vermezse yerel yedek kullanılır */
      }
      const cfg = pickObsConnection({
        panel: panelObs,
        saved: loadObsSaved(),
        slice: settingsRef.current.obs,
      });
      saveObsSaved(cfg);
      // Ekran dilimini hizala: kısayol/plan kodu dilimi okuyor.
      // Ama BOŞ şifre, dilimde duran dolu şifrenin üstüne yazılmaz: panel kartı
      // şifresiz kaldığında bu hizalama kullanıcının OBS şifresini siliyordu.
      const sliceObs = (settingsRef.current.obs || {}) as { password?: unknown };
      const slicePw = typeof sliceObs.password === "string" ? sliceObs.password.trim() : "";
      const wouldClearPassword = !cfg.password && !!slicePw;
      if (!sameObsConnection(settingsRef.current.obs, cfg) && !wouldClearPassword) {
        update({ obs: { host: cfg.host, port: cfg.port, password: cfg.password } });
      }
      // Yalnız kopuk olanı bağla: sağlam Rust bağlantısını her 5 sn'de sıfırlamak
      // (JS istemcisi bağlanamadığında) kısayolları ve OBS Kontrol'ü sürekli
      // "bağlı değil"e düşürüyordu.
      let ok = !need.rust || !need.js ? true : false;
      if (need.rust) {
        try {
          await obsControl.connect(cfg.host, cfg.port, cfg.password);
          ok = true;
        } catch {
          /* sessiz retry */
        }
      }
      if (need.js) {
        try {
          await obsConnect(cfg);
          ok = true;
        } catch {
          /* sessiz retry */
        }
      }
      if (!ok) {
        setObsConnected(isObsConnected());
        return false;
      }
      setObsConnected(true);
      await refreshObsLists();
      if (!silent) showToast("OBS bağlandı");
      return true;
    },
    [obsConnect, refreshObsLists, update, showToast]
  );

  useEffect(() => {
    void reload(screen);
    fetchServerInfo().then(setServer).catch(() => {});
    refreshParticles();
    refreshMusic();
    refreshLogos();
    refreshVideos();
    refreshBackgrounds();
  }, [screen, reload, refreshParticles, refreshMusic, refreshLogos, refreshVideos, refreshBackgrounds]);

  // Program açılınca OBS WebSocket'e sessiz otomatik bağlan; koparsa tekrar dene
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const loop = async () => {
      if (cancelled) return;
      let rustOk = false;
      try {
        rustOk = !!(await obsControl.status()).connected;
      } catch {
        rustOk = false;
      }
      if (!isObsConnected() || !rustOk) {
        await tryAutoObs(true, { rust: !rustOk, js: !isObsConnected() });
      } else if (scenesCountRef.current === 0) {
        // Kartla ya da başka yoldan bağlanılmış ama sahneler yüklenmemiş.
        await refreshObsLists();
      }
      if (!cancelled) timer = window.setTimeout(() => void loop(), 5000);
    };
    void loop();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [tryAutoObs, refreshObsLists]);

  const pickLogo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Görsel", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (typeof selected !== "string") return;
      const data = await importLibraryFile("logos", selected);
      if (data?.name) {
        // Dosya olarak kaydet — data URL JSON'u şişirmesin / kaybolmasın
        update({ logoFile: data.name, logo: null, logoPath: null });
        refreshLogos();
        showToast("Logo kaydedildi");
      }
    } catch {
      showToast("Logo seçilemedi");
    }
  };

  /** Kick chatroom kimliğini çeker; Tauri komutu yoksa HTTP API'ye düşer. */
  const fetchKickChatroom = useCallback(async () => {
    const slug = (settingsRef.current.kickSlug || "").trim();
    if (!slug) {
      showToast("Önce Kick kullanıcı adını gir");
      return;
    }
    try {
      const data = await invoke<any>("fetch_kick_chatroom", { slug });
      if (!data?.chatroomId) throw new Error("chatroom yok");
      update({ chatroomId: data.chatroomId });
      showToast("Kick chatroom alındı");
      return;
    } catch {
      /* Tauri dışı (tarayıcı) ortamda HTTP'ye düş */
    }
    try {
      const res = await fetch(
        `${API_BASE}/api/kick/chatroom?slug=${encodeURIComponent(slug)}`
      );
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json();
      if (!data?.chatroomId) throw new Error("chatroom yok");
      update({ chatroomId: data.chatroomId });
      showToast("Kick chatroom alındı");
    } catch (e) {
      showToast(`Kick bulunamadı: ${String((e as Error).message).slice(0, 60)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

  const pickLocalVideo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Video", extensions: ["mp4", "webm", "mov", "mkv", "m4v"] }],
      });
      if (typeof selected !== "string") return;
      const data = await importLibraryFile("videos", selected);
      if (data?.name) {
        update({
          bgVideoPath: data.name,
          bgVideoStart: 0,
          bgVideoEnd: 0,
          bgStyle: "video",
          lastVideoSource: "video",
        });
        refreshVideos();
        showToast("Video uygulama deposuna kopyalandı");
      }
    } catch {
      showToast("Video eklenemedi");
    }
  };

  const pickBackground = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Görsel / GIF", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (typeof selected !== "string") return;
      const data = await importLibraryFile("backgrounds", selected);
      if (data?.name) {
        update({ bgImagePath: data.name, bgImage: null, bgStyle: "image" });
        refreshBackgrounds();
        showToast("Arka plan (hareketli resim) kaydedildi");
      }
    } catch {
      showToast("Arka plan eklenemedi");
    }
  };

  const goScene = useCallback(
    async (sceneName: string, label?: string, navHint?: NavId) => {
      if (!sceneName) {
        showToast((label || "Sahne") + " atanmamış");
        return;
      }
      if (navHint === "starting" || navHint === "ending" || navHint === "brb" || navHint === "chat") {
        forceNavRef.current = navHint;
        setModul(navHint === "chat" ? "canli" : "hazirlik");
        setActiveNav(navHint);
        setScreen(navHint);
        if (navHint === "ending") {
          endingStopDoneRef.current = false;
          streamWatchArmedRef.current = true;
        }
        if (navHint === "starting") {
          startingSwitchDoneRef.current = false;
          seedStartingCountdown(5);
        }
      } else if (label) {
        const low = label.toLowerCase();
        if (low.includes("çıkış") || low.includes("ending") || low === "end") {
          endingStopDoneRef.current = false;
          streamWatchArmedRef.current = true;
          forceNavRef.current = "ending";
          setModul("hazirlik");
          setActiveNav("ending");
          setScreen("ending");
        }
      }
      try {
        if (!obsConnected) {
          await obsConnect({
            host: settingsRef.current.obs?.host || "127.0.0.1",
            port: Number(settingsRef.current.obs?.port) || 4455,
            password: settingsRef.current.obs?.password || "",
          });
          setObsConnected(true);
        }
        await switchScene({
          sceneName,
          transition: settingsRef.current.obs?.transition,
          transitionMs: settingsRef.current.obs?.transitionMs,
        });
        showToast((label || sceneName) + " → geçildi");
      } catch (e: any) {
        showToast("Sahne hatası: " + (e?.message || e));
      }
    },
    [obsConnected, obsConnect, showToast]
  );

  /** Profil → Yayını başlat: OBS giriş sahnesi + StartStream. Panel Dashboard’da kalır. */
  const goLiveFromProfile = useCallback(async () => {
    startingSwitchDoneRef.current = false;
    endingStopDoneRef.current = false;
    streamWatchArmedRef.current = true;
    // Çıkış jeneriği oturumu YENİ yayın başlarken sıfırlanır (bitişte değil):
    // çıkış ekranı kendi listesini gösterirken silinmemeli, ama bir sonraki
    // yayına önceki yayının bağış/takip/abone isimleri taşınmamalı.
    clearCreditsSession();
    setCreditCounts(creditsSessionCounts());

    const obs = settingsRef.current.obs || {};
    const scene = resolveStartingScene(obs);
    const cfg = obsConnectionFrom(obs);
    const game = resolveGameScene(obs);
    const holdMin = Math.max(1, Number(obs.startHoldMin) || 5);
    seedStartingCountdown(holdMin);

    try {
      await obsConnect(cfg);
      setObsConnected(true);
    } catch (first) {
      try {
        await obsControl.connect(cfg.host, cfg.port, cfg.password);
        setObsConnected(true);
      } catch (e: any) {
        const msg = String((e as Error)?.message || first || e);
        throw new Error(
          "OBS bağlanamadı: " +
            (/ACL/i.test(msg) ? "WebSocket yanıt vermiyor — OBS açık mı?" : msg)
        );
      }
    }

    if (scene) {
      try {
        await switchScene({
          sceneName: scene,
          transition: obs.transition,
          transitionMs: obs.transitionMs,
        });
      } catch {
        /* sahne listesi henüz gelmemiş olabilir */
      }
    }

    if (!scene) {
      showToast("Giriş sahnesi atanmamış — kısayollardan Giriş sahnesini seç");
    }
    if (!game) {
      showToast(
        "Uyarı: süre bitince geçilecek sahne seçili değil (Geri sayım → Süre bitince…)"
      );
    }

    try {
      await obsControl.startStreamSequence();
    } catch (e: any) {
      throw new Error(
        "StartStream: " + (e?.message || e) + " — OBS’te yayın zaten açık olabilir"
      );
    }

    setLiveOn(true);
    const bot = getBotConfig() as {
      channelName?: string;
      title?: string;
      discordWebhook?: string;
      discord?: { enabled?: boolean; webhookUrl?: string; goLiveMessage?: string };
    };
    const hook = bot.discord?.webhookUrl || bot.discordWebhook;
    if (hook && (bot.discord?.enabled === true || !!bot.discordWebhook)) {
      void notifyDiscordLive({
        webhookUrl: hook,
        enabled: true,
        message: bot.discord?.goLiveMessage,
        channel: bot.channelName,
        title: bot.title,
      }).catch(() => {});
    }
  }, [showToast, obsConnect]);

  const endLiveFromProfile = useCallback(async () => {
    streamWatchArmedRef.current = false;
    endingStopDoneRef.current = false;
    setLayout((prev) => {
      const hidden = (prev.tabs.hidden || []).filter((id) => id !== "ending");
      const order = prev.tabs.order?.includes("ending")
        ? prev.tabs.order
        : ["ending", ...(prev.tabs.order || [])];
      return { ...prev, tabs: { ...prev.tabs, order, hidden } };
    });
    forceNavRef.current = "ending";
    setModul("hazirlik");
    setActiveNav("ending");
    setScreen("ending");
    try {
      await obsControl.stopStreamSequence();
    } catch {
      /* OBS kapalıysa sessiz */
    }
    scheduleOverlayRefresh();
    setLiveOn(false);
    clearStartingCountdown();
  }, [scheduleOverlayRefresh]);

  const closeDbSessionQuiet = useCallback(async () => {
    try {
      const dash = await fetchDashboard();
      const sid = dash.active_session?.id;
      if (sid) await endSession(sid);
      saveBotConfig((prev) => ({ ...prev, streamStartedAt: null }));
    } catch {
      /* */
    }
  }, []);

  const runMasterStream = useCallback(async () => {
    if (masterBusy) return;
    setMasterBusy(true);
    try {
      if (liveOn) {
        gunluk.info("Yayın durduruluyor");
        await endLiveFromProfile();
        await closeDbSessionQuiet();
        gunluk.info("Yayın durduruldu");
        olay("yayin_bitti");
      } else {
        gunluk.info("Yayın başlatılıyor");
        await goLiveFromProfile();
        gunluk.info("Yayın başlatıldı");
        olay("yayin_basladi");
        try {
          await startSession();
        } catch {
          /* SQLite oturumu isteğe bağlı */
        }
      }
    } catch (e: any) {
      gunluk.error(`Yayın ${liveOn ? "durdurulamadı" : "başlatılamadı"}: ${e?.message || e}`);
      showToast(String(e?.message || e));
    } finally {
      setMasterBusy(false);
    }
  }, [
    masterBusy,
    liveOn,
    endLiveFromProfile,
    goLiveFromProfile,
    closeDbSessionQuiet,
    showToast,
  ]);

  /** Panel LivePreview: süre / medya bitişi */
  const handlePreviewCountdownEnd = useCallback(
    async (live: OverlaySettings) => {
      const scr = screen;
      if (scr === "starting") {
        if (startingSwitchDoneRef.current) return;
        startingSwitchDoneRef.current = true;
        try {
          const r = await runStartingEndAction(live);
          if (!r.done) showToast("Süre bitti — sahne geçişini OBS'teki sayfa yaptı");
          else if (r.result) showToast(`Süre bitti → ${r.result}`);
          else showToast("Süre bitti ama hedef sahne seçili değil");
        } catch (e: any) {
          startingSwitchDoneRef.current = false;
          showToast("Sahne geçişi: " + (e?.message || e));
        }
        return;
      }
      if (scr === "ending") {
        if (endingStopDoneRef.current) return;
        endingStopDoneRef.current = true;
        streamWatchArmedRef.current = false;
        try {
          const r = await runEndingEndAction(live);
          if (!r.done) {
            // Bitişi OBS'teki sayfa üstlendi; kural yayını kapatıyorsa
            // panelin oturum kaydı da kapanmalı (eskiden iki taraf da
            // StopStream gönderiyor, ikincisi hata verip oturum açık kalıyordu).
            showToast("Çıkış bitti — işlemi OBS'teki sayfa yaptı");
            if (ruleStopStream((live.obs || {}) as never)) await closeDbSessionQuiet();
          } else if (r.result.stopped) {
            showToast("Çıkış bitti — yayın kapatıldı");
            await closeDbSessionQuiet();
          } else {
            showToast("Çıkış bitti (otomatik kapat kapalı)");
          }
        } catch (e: any) {
          endingStopDoneRef.current = false;
          showToast("Çıkış aksiyonu: " + (e?.message || e));
        }
      }
    },
    [screen, showToast, closeDbSessionQuiet]
  );

  // Önizleme kapalı olsa bile Giriş/Çıkış süre bitişini panelden izle
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!streamWatchArmedRef.current) return;
      const obs = settingsRef.current.obs || {};

      if (!startingSwitchDoneRef.current) {
        const end = Number(sessionStorage.getItem("starting_end_5") || 0);
        if (end > 0 && end <= Date.now()) {
          startingSwitchDoneRef.current = true;
          void runStartingEndAction({ obs } as OverlaySettings)
            .then((r) => {
              if (r.done && r.result) showToast(`Süre bitti → ${r.result}`);
            })
            .catch((e) => {
              startingSwitchDoneRef.current = false;
              showToast("Sahne geçişi: " + (e?.message || e));
            });
        }
      }

      if (screen === "ending" && !endingStopDoneRef.current) {
        const mins = Number(settingsRef.current.endingMinutes) || 0;
        if (mins > 0) {
          const endE = Number(sessionStorage.getItem(`ending_end_${mins}`) || 0);
          if (endE > 0 && endE <= Date.now()) {
            endingStopDoneRef.current = true;
            streamWatchArmedRef.current = false;
            void runEndingEndAction(settingsRef.current)
              .then(async (r) => {
                if (r.done ? r.result.stopped : ruleStopStream((settingsRef.current.obs || {}) as never)) {
                  showToast(r.done ? "Çıkış bitti — yayın kapatıldı" : "Çıkış bitti — işlemi OBS'teki sayfa yaptı");
                  await closeDbSessionQuiet();
                }
              })
              .catch((e) => {
                endingStopDoneRef.current = false;
                showToast("Çıkış aksiyonu: " + (e?.message || e));
              });
          }
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, showToast, closeDbSessionQuiet]);

  /**
   * Sahne + ses kısayolları tek planda. Kurallar ve çakışma tespiti
   * `lib/hotkeyPlan.ts` içinde, saf ve test edilebilir hâlde.
   */
  const hotkeyPlan = useMemo(
    () =>
      buildHotkeyPlan({
        obs: settings.obs,
        sfxPads,
        clearChatHk,
        sfxStopHk,
      }),
    [settings.obs, sfxPads, clearChatHk, sfxStopHk]
  );

  const allHotkeys = hotkeyPlan.bindings;
  const sceneHotkeys = useMemo(
    () => allHotkeys.filter((b) => b.kind === "scene"),
    [allHotkeys]
  );
  const actionHotkeys = useMemo(
    () => allHotkeys.filter((b) => b.kind !== "scene"),
    [allHotkeys]
  );

  const hotkeysRef = useRef(sceneHotkeys);
  hotkeysRef.current = sceneHotkeys;
  const actionHotkeysRef = useRef(actionHotkeys);
  actionHotkeysRef.current = actionHotkeys;
  const sfxPadsRef = useRef(sfxPads);
  sfxPadsRef.current = sfxPads;

  const clearChatNow = useCallback(async () => {
    try {
      const r = await clearPlatformChats({
        twitchChannel: String(settingsRef.current.twitchChannel || ""),
        youtubeChannel: String(settingsRef.current.youtubeChannel || ""),
      });
      showToast(clearResultToast(r));
    } catch (e: any) {
      showToast(String(e?.message || e));
    }
  }, [showToast]);

  const runActionHotkey = useCallback(
    async (id: string) => {
      try {
        if (id.startsWith("sfx:")) {
          const padId = id.slice("sfx:".length);
          const pad = sfxPadsRef.current.find((p) => p.id === padId);
          if (!pad) {
            showToast("Ses bulunamadı");
            return;
          }
          playSoundPad(pad);
          showToast(`${tt("sfx.playing")}: ${pad.name}`);
          return;
        }
        if (id === "clearChat") {
          await clearChatNow();
          return;
        }
        if (id === "sfxStop") {
          stopAllSounds();
          showToast(tt("sfx.stopped"));
          return;
        }
        if (id === "stopStream") {
          await obsControl.stopStreamSequence();
          showToast("Çıkış sahnesi — yayın süre sonunda kapanacak");
          return;
        }
        if (id === "mic") {
          const mic = settingsRef.current.obs?.micInput;
          if (!mic) {
            showToast("Önce OBS’te mikrofon kaynağı seç");
            return;
          }
          const muted = await toggleInputMute(mic);
          showToast(muted ? "Mikrofon kapalı" : "Mikrofon açık");
          return;
        }
        if (id === "muteAll") {
          const obs = settingsRef.current.obs || {};
          const exceptMic = obs.muteAllExceptMic !== false;
          const exclude =
            exceptMic && obs.micInput ? [String(obs.micInput)] : [];
          const muted = await toggleAudioInputsMuted({ excludeNames: exclude });
          showToast(
            muted
              ? exceptMic
                ? "Mikrofon hariç sesler kapatıldı"
                : "Tüm sesler kapatıldı"
              : exceptMic
                ? "Mikrofon hariç sesler açıldı"
                : "Tüm sesler açıldı"
          );
          return;
        }
        if (id === "music") {
          await sendPlayerCommand("muteToggle");
          showToast("Müzik ses aç/kapa");
          return;
        }
        // OBS eylemleri (kaynak aç/kapa, kayıt, ses seviyesi, filtre…).
        // Asıl çalıştırıcı Rust; bu yol tarayıcıda açılan panel için yedek.
        if (id.startsWith("act:")) {
          const rowId = id.slice("act:".length);
          const rows: ActionRow[] = settingsRef.current.obs?.actionHotkeys || [];
          const row = rows.find((r) => r.id === rowId);
          if (!row) {
            showToast("Eylem bulunamadı");
            return;
          }
          showToast(await runObsAction(row));
          return;
        }
        if (id.startsWith("srcMute:")) {
          const rowId = id.slice("srcMute:".length);
          const rows: { id: string; input?: string }[] =
            settingsRef.current.obs?.sourceMuteHotkeys || [];
          const row = rows.find((r) => r.id === rowId);
          const input = (row?.input || "").trim();
          if (!input) {
            showToast("Kaynak seçilmemiş");
            return;
          }
          const muted = await toggleInputMute(input);
          showToast(muted ? `${input} kapalı` : `${input} açık`);
          return;
        }
      } catch (e: any) {
        showToast(String(e?.message || e));
      }
    },
    [clearChatNow, tt]
  );

  // İşletim sistemi düzeyinde kayıt: pencere tepsideyken veya OBS/oyun
  // öndeyken de çalışsın.
  const { registered: globalHotkeys, failures: nativeFailures, error: hotkeyError } = useGlobalHotkeys(
    allHotkeys,
    (id) => {
      if (
        id === "mic" ||
        id === "muteAll" ||
        id === "music" ||
        id === "clearChat" ||
        id === "sfxStop" ||
        id.startsWith("srcMute:") ||
        id.startsWith("sfx:")
      ) {
        void runActionHotkey(id);
        return;
      }
      const ent = hotkeysRef.current.find((h) => h.id === id);
      if (ent) {
        const hint =
          id === "starting" || id === "ending" || id === "brb" || id === "chat"
            ? (id as NavId)
            : undefined;
        void goScene(ent.scene || "", ent.label || "", hint);
      }
    },
    {
      paused: hotkeyCapture,
      // Rust'ta çalışan bir kısayol hata verdiğinde (OBS'e ulaşılamadı, kaynak yok…)
      // sessiz kalmasın.
      onError: ({ id, message }) => showToast(`Kısayol çalışmadı (${bindingName(id, [])}): ${message}`),
    }
  );

  // Rust'ın kayıt sonucu (yalnız Tauri, kayıttan sonra) + planın çakışma
  // hesabı (her ortamda, anında). Aynı kimlik ikisinde de varsa Rust'ınki
  // geçerli — gerçek sebebi o biliyor.
  const hotkeyFailures = useMemo(() => {
    const native = new Map(nativeFailures.map((f) => [f.id, f]));
    for (const f of conflictFailures(hotkeyPlan)) if (!native.has(f.id)) native.set(f.id, f);
    return [...native.values()];
  }, [nativeFailures, hotkeyPlan]);
  const globalHotkeysRef = useRef(globalHotkeys);
  globalHotkeysRef.current = globalHotkeys;

  useEffect(() => {
    const lastLocal = new Map<string, number>();
    const matchHotkey = (e: KeyboardEvent, spec: string) => {
      const want = canonicalizeHotkeySpec(spec);
      if (!want) return false;
      const got = eventToSpec(e);
      return !!got && got === want;
    };

    const onKey = (e: KeyboardEvent) => {
      if (hotkeyCaptureRef.current) return;
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Anahtar artık binding kimliği: aynı tuşu paylaşan iki binding'de
      // tuş metni üzerinden ayırt etmek mümkün değildi.
      const fire = (id: string) => {
        if (wasHandledByNative(id)) return false;
        const now = Date.now();
        const prev = lastLocal.get(id) || 0;
        if (now - prev < 400) return false;
        lastLocal.set(id, now);
        return true;
      };
      for (const ent of actionHotkeysRef.current) {
        if (!ent.spec.trim()) continue;
        if (globalHotkeysRef.current.has(ent.id)) continue;
        if (matchHotkey(e, ent.spec)) {
          if (!fire(ent.id)) return;
          e.preventDefault();
          void runActionHotkey(ent.id);
          return;
        }
      }
      for (const ent of hotkeysRef.current) {
        if (globalHotkeysRef.current.has(ent.id)) continue;
        if (matchHotkey(e, ent.spec)) {
          if (!fire(ent.id)) return;
          e.preventDefault();
          const hint =
            ent.id === "starting" ||
            ent.id === "ending" ||
            ent.id === "brb" ||
            ent.id === "chat"
              ? (ent.id as NavId)
              : undefined;
          void goScene(ent.scene || "", ent.label || "", hint);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goScene, runActionHotkey]);

  const copy = async (text: string) => {
    if (await copyText(text)) showToast("Kopyalandı");
    else showToast("Kopyalanamadı — adresi elle seçip kopyala");
  };

  const openExternal = async (url: string) => {
    // 1) Masaüstü kabuğu
    try {
      await invoke("open_in_browser", { url });
      showToast("Tarayıcıda açıldı");
      return;
    } catch {
      /* Tauri dışında veya komut yoksa aşağıya düş */
    }
    // 2) Yerel sunucu (WebView2 window.open'ı engellediğinde tek yol)
    try {
      const res = await fetch(`${API_BASE}/api/open-external`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (res.ok) {
        showToast("Tarayıcıda açıldı");
        return;
      }
    } catch {
      /* aşağıya düş */
    }
    // 3) Son çare: yeni sekme; engellenirse adresi panoya koy
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      await copy(url);
      showToast("Tarayıcı açılamadı — adres panoda");
    }
  };

  const resonanceOverlayUrl = `${(server?.baseUrl || API_BASE).replace(/\/$/, "")}/resonance/overlay`;

  const particleKeys = particleFiles.map((f) => f.replace(/\.(png|webp)$/i, ""));

  const sectionHidden = useCallback(
    (id: string) => {
      const key =
        screen === "chat" || screen === "ending" || screen === "brb" || screen === "starting"
          ? screen
          : "starting";
      const side =
        id === "obsUrl" ||
        id === "resonance" ||
        id === "obsWs" ||
        id === "sosyal";
      const oh = side ? layout.sections.side : layout.sections[key];
      return (oh?.hidden || []).includes(id);
    },
    [layout, screen]
  );

  const leftSectionOrder = useMemo(() => {
    const defs =
      screen === "chat"
        ? LEFT_SECTIONS_CHAT
        : screen === "ending"
          ? LEFT_SECTIONS_SCENE
          : LEFT_SECTIONS_SCENE.filter((s) => s.id !== "jenerik");
    const key =
      screen === "chat" || screen === "ending" || screen === "brb" || screen === "starting"
        ? screen
        : "starting";
    return visibleOrdered(layout.sections[key] || { order: [], hidden: [] }, defs.map((d) => d.id));
  }, [layout.sections, screen]);

  const rightSectionOrder = useMemo(
    () =>
      visibleOrdered(
        layout.sections.side || { order: [], hidden: [] },
        RIGHT_SECTIONS.map((d) => d.id)
      ),
    [layout.sections.side]
  );

  const secOrder = useCallback(
    (id: string, side = false) => {
      const list = side ? rightSectionOrder : leftSectionOrder;
      const i = list.indexOf(id);
      return { order: i < 0 ? 999 : i };
    },
    [leftSectionOrder, rightSectionOrder]
  );

  const visibleTabs = useMemo(
    () => visibleOrdered(layout.tabs, DEFAULT_TABS.map((t) => t.id)),
    [layout.tabs]
  );

  useEffect(() => {
    const kume = modul === "canli" ? CANLI_SEKME : HAZIRLIK_SEKME;
    if (kume.includes(String(activeNav)) && visibleTabs.includes(String(activeNav))) return;
    const next = kume.find((id) => visibleTabs.includes(id));
    if (!next || next === activeNav) return;
    setActiveNav(next as NavId);
    if (next === "starting" || next === "ending" || next === "brb" || next === "chat") setScreen(next);
  }, [modul, activeNav, visibleTabs]);

  useEffect(() => {
    if (activeNav === "obs") {
      setModul("hazirlik");
      setActiveNav("profile");
    }
  }, [activeNav]);

  useEffect(() => {
    if (forceNavRef.current && visibleTabs.includes(forceNavRef.current)) {
      forceNavRef.current = null;
    }
  }, [visibleTabs]);

  const sayfaMeta = DEFAULT_TABS.find((tab) => tab.id === activeNav);
  const sayfaAdi = (sayfaMeta?.labelKey && tt(sayfaMeta.labelKey as MsgKey)) || sayfaMeta?.label || String(activeNav);
  const sahneSekmesi = activeNav === "starting" || activeNav === "ending" || activeNav === "brb";
  const durumPort = (server?.baseUrl || API_BASE).split(":").pop()?.replace(/\D/g, "") || "8843";

  return (
    <>
      <CloseRequestModal />
    {/* Özel pencere başlığı (masaüstünde) + altında panel; panel kalan yüksekliği doldurur */}
    <div className="flex h-screen w-full flex-col overflow-hidden bg-axthrowa-dark">
    <PencereBasligi />
    <UpdateModal />
    <KarsilamaEkrani />
    <div className="panel-shell flex !min-h-0 w-full flex-1 flex-row overflow-hidden bg-panel-bg text-white">
      <MusicBridge />
      <NavTabBar
        brandTitle={tt("brand.title")}
        modul={modul}
        onModul={(m) => {
          setModul(m);
          const ids = m === "canli" ? CANLI_SEKME : HAZIRLIK_SEKME;
          if (ids.includes(String(activeNav)) && visibleTabs.includes(String(activeNav))) return;
          const next = (ids.find((id) => visibleTabs.includes(id)) || ids[0]) as NavId;
          setActiveNav(next);
          if (next === "starting" || next === "ending" || next === "brb" || next === "chat") setScreen(next);
        }}
        visibleTabs={visibleTabs}
        activeNav={String(activeNav)}
        layoutOrder={layout.tabs.order}
        dragHint={tt("nav.dragHint")}
        customizeLabel={tt("nav.customize")}
        editLayout={editLayout}
        onToggleEdit={() => setEditLayout((v) => !v)}
        labelFor={(id) => {
          const meta = DEFAULT_TABS.find((t) => t.id === id);
          const key = (meta?.labelKey || "") as MsgKey;
          const table = prefs.locale === "en" ? en : tr;
          return (key && table[key]) || meta?.label || id;
        }}
        onSelect={(id) => {
          setModul(CANLI_SEKME.includes(id) ? "canli" : "hazirlik");
          setActiveNav(id);
          forceNavRef.current = null;
          if (id === "starting" || id === "ending" || id === "brb" || id === "chat") {
            setScreen(id);
          }
          if (id === "ending") {
            endingStopDoneRef.current = false;
            streamWatchArmedRef.current = true;
          }
          if (id === "starting") {
            startingSwitchDoneRef.current = false;
          }
        }}
        onReorder={(order) => setLayout((prev) => applyTabOrder(prev, order))}
      >
        <LayoutEditor
          layout={layout}
          activeScreen={screen}
          activeNav={String(activeNav)}
          onChange={setLayout}
          onClose={() => setEditLayout(false)}
        />
      </NavTabBar>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[var(--dt-surface-2)] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-[13px] font-semibold text-white">{sayfaAdi}</h1>
          {sahneSekmesi ? (
            <PanelTimer
              timer={{
                screen,
                endingMinutes: settings.endingMinutes,
                brbMinutes: settings.brbMinutes,
                targetDate: settings.targetDate,
              }}
              render={(text) => <span className="font-mono text-[12px] tabular-nums text-white/70">{text}</span>}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProfileSwitcher onToast={showToast} />
          <button
            type="button"
            className="dt-btn"
            onClick={async () => {
              await persistNow(screen, settings);
              showToast(tt("brand.saved"));
            }}
          >
            <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>{tt("brand.saveNow")}</span>
          </button>
          {modul === "canli" ? (
            <button
              type="button"
              disabled={masterBusy}
              className={
                "inline-flex h-8 items-center rounded px-3 text-[13px] font-semibold transition-colors duration-150 disabled:opacity-60 " +
                (liveOn ? "bg-[var(--dt-live)] text-white" : "bg-[var(--dt-ok)] text-[#03291e]")
              }
              onClick={() => void runMasterStream()}
            >
              {masterBusy ? "…" : liveOn ? tt("brand.endLive") : tt("brand.goLive")}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
      {profileTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
          <DashboardUstSerit
            bolum={dashBolum}
            onBolum={setDashBolum}
            obsBagli={obsConnected}
            master={{
              live: liveOn,
              busy: masterBusy,
              onToggle: () => void runMasterStream(),
            }}
          />
          {dashBolum === "baglantilar" && (
            <ConnectionsHub
              onToast={showToast}
              obs={settings.obs}
              onObsPatch={(patch) => update({ obs: patch })}
              onObsConnected={() => void refreshObsLists()}
            />
          )}
          {dashBolum === "genel" && (
            <div className="mx-4 mb-3">
              <BotSessions
                onAc={() => {
                  setBotSekme("platforms");
                  setModul("hazirlik");
                  setActiveNav("bot");
                }}
              />
            </div>
          )}
          {dashBolum === "genel" && <StreamHealthCard />}
          {/* Sekme değişse de bağlı kalır: sadakat sayacı, metrikler ve oturum kapatma sürer */}
          <ProfileDashboard
            onToast={showToast}
            onEndLive={endLiveFromProfile}
            streamLive={liveOn}
            bolum={dashBolum}
          />
          {dashBolum === "obs" && (
          <div className="mx-4 mb-3">
            <ObsControlHub
              onToast={showToast}
              shortcuts={{
                obs: settings.obs || {},
                scenes,
                inputs,
                globalHotkeys,
                hotkeyError,
                hotkeyFailures,
                onListeningChange: setHotkeyCapture,
                onPatch: (patch) => update({ obs: { ...(settings.obs || {}), ...patch } }),
                onGoScene: (scene, label, hint) => void goScene(scene, label, hint),
                onAction: (id) => void runActionHotkey(id),
              }}
            />
          </div>
          )}
        </div>
      ) : controlTab ? (
        <Suspense fallback={<div className="flex-1 p-6 text-sm text-panel-muted">Yükleniyor…</div>}>
          <ControlCenter onToast={showToast} />
        </Suspense>
      ) : yayinTab ? (
        <Suspense fallback={<div className="flex-1 p-6 text-sm text-panel-muted">Yükleniyor…</div>}>
          <ObsStudioPanel onToast={showToast} />
        </Suspense>
      ) : musicTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          <MusicPanel
            baseUrl={server?.baseUrl || API_BASE}
            onToast={showToast}
            onOpenExternal={(url) => {
              // Müzik kartı mesajın hangi çerçeveden geldiğine bakmıyor;
              // yalnız Resonance'ın gerçekten açtırdığı adresler geçer.
              if (resonanceLinkAllowed(url)) return openExternal(url);
              showToast("Bu adres güvenlik nedeniyle açılmadı");
            }}
          />
        </div>
      ) : botTab ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <StreamAxtHost key={botSekme || "bot"} onToast={showToast} tab={botSekme} onOpenMusic={() => {
            setModul("canli");
            setActiveNav("music");
          }} />
        </div>
      ) : chatTab && !chatOverlaySettings ? (
        // Canlı Chat = StreamAxT'nin Multi-Chat'i (çapraz sohbet, izleyici kartları).
        // Panelin kendi sohbet KATMANI ayarlarına düğmeyle dönülür.
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 px-3 pt-1.5 text-[11px] text-panel-muted">
            <span className="ml-auto" />
            <button
              type="button"
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-semibold text-white/80 transition hover:bg-white/[0.08] hover:text-white"
              onClick={() => setChatOverlaySettings(true)}
            >
              Sohbet katmanı ayarları
            </button>
          </div>
          <StreamAxtHost onToast={showToast} tab="multichat" embed onOpenMusic={() => {
            setModul("canli");
            setActiveNav("music");
          }} />
        </div>
      ) : soundsTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <SoundBoardPanel
          onToast={showToast}
          onListeningChange={setHotkeyCapture}
          registeredHotkeys={globalHotkeys}
          hotkeyFailures={hotkeyFailures}
          stopHotkey={sfxStopHk}
          onStopHotkey={(v) => {
            setSfxStopHk(v);
            void patchSettings("panel", { sfxStopHotkey: v }).catch(() => {});
          }}
        />
        </div>
      ) : hotkeysTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          <HotkeysPage
            obs={(settings.obs || {}) as Record<string, any>}
            scenes={scenes}
            inputs={inputs}
            obsConnected={obsConnected}
            globalHotkeys={globalHotkeys}
            hotkeyFailures={hotkeyFailures}
            hotkeyError={hotkeyError}
            onListeningChange={setHotkeyCapture}
            onPatch={(patch) => update({ obs: patch })}
            onGoScene={(scene, label, hint) => void goScene(scene, label, hint)}
            onAction={(id) => void runActionHotkey(id)}
            onRunRow={(row) =>
              void runObsAction(row as ActionRow)
                .then((m) => showToast(m))
                .catch((e) => showToast(String(e?.message || e)))
            }
          />
        </div>
      ) : settingsTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <AppSettingsPage
          prefs={prefs}
          onPrefs={setPrefs}
          version={__YYA_SURUM__}
          layout={layout}
        />
        </div>
      ) : (
      <div
        className={
          "relative grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden py-4 " +
          (panelsPinned ? "px-4 xl:grid-cols-[380px_1fr_340px]" : "px-6")
        }
      >
        <EdgePanel
          side="left"
          pinned={panelsPinned}
          width={380}
          label="Ayar paneli — fareyi getir"
          className="custom-scrollbar flex flex-col gap-4 overflow-y-auto rounded-2xl border border-white/[0.05] bg-panel-card/50 p-4"
        >
          {screen !== "chat" && (
            <>
              {(screen === "starting" || screen === "ending" || screen === "brb") && (
                <TemplatePicker
                  screen={screen}
                  settings={settings}
                  onApply={update}
                  onToast={showToast}
                />
              )}
              {!sectionHidden("metin") && (
                <SettingsSection id="metin" title={tt("sec.metin")} style={secOrder("metin")}>
              <Field label={tt("field.eyebrow")} value={settings.eyebrow || ""} onChange={(v) => update({ eyebrow: v })} />
              <Field label={tt("field.title")} value={settings.title || ""} onChange={(v) => update({ title: v })} />
              <Field label={tt("field.sub")} value={settings.sub || ""} onChange={(v) => update({ sub: v })} />
              <Field label={tt("field.badge")} value={settings.liveText || ""} onChange={(v) => update({ liveText: v })} />
              <Field label={tt("field.ticker")} value={settings.ticker || ""} onChange={(v) => update({ ticker: v })} />
              {/* Yazı stilleri ait oldukları ayarın altında (eskiden ayrı "Yazı stilleri" bölümündeydi) */}
              <TextStyleEditor settings={settings} onChange={update} sadece={["eyebrow", "title", "sub", "ticker"]} />
                </SettingsSection>
              )}

              {!sectionHidden("geriSayim") && (
                <SettingsSection id="geriSayim" title={tt("sec.geriSayim")} style={secOrder("geriSayim")}>
              <TextStyleEditor settings={settings} onChange={update} sadece={["countdown"]} />
              <Field
                label="Geri sayım (datetime-local)"
                value={settings.targetDate || ""}
                onChange={(v) => update({ targetDate: v })}
                type="datetime-local"
              />
              <button
                className="w-full rounded-md bg-black/40 px-2 py-2 text-xs"
                onClick={() => {
                  const mins = Number(prompt("Kaç dakika sonra?", "10")) || 10;
                  const d = new Date(Date.now() + mins * 60_000);
                  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16);
                  update({ targetDate: local });
                }}
              >
                …veya X dakika sonra ayarla
              </button>

              {screen === "brb" && (
                <>
                  <Field
                    label="BRB dakika"
                    value={String(settings.brbMinutes ?? 5)}
                    onChange={(v) => {
                      sessionStorage.removeItem("brb_end_" + (settings.brbMinutes || 5));
                      sessionStorage.removeItem("brb_end_" + (Number(v) || 5));
                      update({ brbMinutes: Number(v) || 5 });
                    }}
                    type="number"
                  />
                  <Select
                    label="Mola ekranı açılınca OBS sahnesi"
                    value={settings.obs?.brbScene || settings.obs?.sceneMap?.brb || ""}
                    options={scenes}
                    onChange={(v) =>
                      update({
                        obs: {
                          ...(settings.obs || {}),
                          brbScene: v,
                          sceneMap: { ...(settings.obs?.sceneMap || {}), brb: v },
                        },
                      })
                    }
                  />
                  <Select
                    label="Mola bitince otomatik sahne"
                    value={settings.obs?.brbEndScene || settings.obs?.returnScene || ""}
                    options={scenes}
                    onChange={(v) =>
                      update({ obs: { ...(settings.obs || {}), brbEndScene: v, returnScene: v } })
                    }
                  />
                  <Field
                    label="Mola bitiş sahnesi (elle)"
                    value={settings.obs?.brbEndScene || settings.obs?.returnScene || ""}
                    onChange={(v) =>
                      update({ obs: { ...(settings.obs || {}), brbEndScene: v, returnScene: v } })
                    }
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.obs?.autoSwitchOnBrbEnd !== false}
                      onChange={(e) =>
                        update({ obs: { ...(settings.obs || {}), autoSwitchOnBrbEnd: e.target.checked } })
                      }
                    />
                    Süre bitince otomatik geç
                  </label>
                </>
              )}

              {screen === "starting" && (
                <>
                  <Select
                    label="Giriş ekranı açılınca OBS sahnesi"
                    value={settings.obs?.startingScene || settings.obs?.sceneMap?.starting || ""}
                    options={scenes}
                    onChange={(v) =>
                      update({
                        obs: {
                          ...(settings.obs || {}),
                          startingScene: v,
                          sceneMap: { ...(settings.obs?.sceneMap || {}), starting: v },
                        },
                      })
                    }
                  />
                  <div className="rounded-xl border border-panel-accent/30 bg-panel-elevated/60 px-3 py-2.5 text-sm">
                    <div className="font-medium text-panel-accent">Sabit geri sayım: 5:00</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-panel-muted">
                      Giriş sahnesine her geçişte 5 dakikadan geri sayar. Süre bitince OBS’de
                      atanmış <b className="text-white/80">Oyun</b> sahnesine geçer.
                    </p>
                    <PanelTimer
                      timer={{ screen }}
                      render={(text) => (
                        <div className="mt-2 font-display text-2xl tabular-nums text-white">{text}</div>
                      )}
                    />
                  </div>
                  <Select
                    label="Süre bitince şu sahneye geç"
                    value={
                      settings.obs?.sceneMap?.game ||
                      settings.obs?.sceneOnEnd ||
                      settings.obs?.returnScene ||
                      ""
                    }
                    options={scenes}
                    onChange={(v) =>
                      update({
                        obs: {
                          ...(settings.obs || {}),
                          sceneOnEnd: v,
                          returnScene: v,
                          sceneMap: { ...(settings.obs?.sceneMap || {}), game: v },
                        },
                      })
                    }
                  />
                  <Field
                    label="Sahne adı (elle)"
                    value={
                      settings.obs?.sceneMap?.game ||
                      settings.obs?.sceneOnEnd ||
                      settings.obs?.returnScene ||
                      ""
                    }
                    onChange={(v) =>
                      update({
                        obs: {
                          ...(settings.obs || {}),
                          sceneOnEnd: v,
                          returnScene: v,
                          sceneMap: { ...(settings.obs?.sceneMap || {}), game: v },
                        },
                      })
                    }
                  />
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.obs?.autoSwitchOnStartingMediaEnd !== false}
                      onChange={(e) =>
                        update({
                          obs: {
                            ...(settings.obs || {}),
                            autoSwitchOnStartingMediaEnd: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>
                      Sayaç yokken / bitmişken video-müzik bitince de oyun sahnesine geç
                      <span className="mt-0.5 block text-[11px] text-panel-muted">
                        5 dk sayacı çalışırken bu seçenek uygulanmaz; önce süre biter.
                      </span>
                    </span>
                  </label>
                </>
              )}

              {screen === "ending" && (
                <>
                  <Select
                    label="Çıkış ekranı açılınca OBS sahnesi"
                    value={
                      settings.obs?.endingScene ||
                      settings.obs?.sceneMap?.ending ||
                      ""
                    }
                    options={scenes}
                    onChange={(v) =>
                      update({
                        obs: {
                          ...(settings.obs || {}),
                          endingScene: v,
                          sceneMap: { ...(settings.obs?.sceneMap || {}), ending: v },
                        },
                      })
                    }
                  />
                  <Field
                    label="Çıkış süresi (dakika)"
                    value={
                      settings.endingMinutes === 0 || settings.endingMinutes === ""
                        ? ""
                        : String(settings.endingMinutes ?? "")
                    }
                    onChange={(v) => {
                      const eski = Number(settings.endingMinutes) || 0;
                      if (eski) sessionStorage.removeItem("ending_end_" + eski);
                      const temiz = String(v).trim();
                      if (!temiz) {
                        update({ endingMinutes: 0 });
                        return;
                      }
                      const n = Math.max(0, Number(temiz) || 0);
                      sessionStorage.removeItem("ending_end_" + n);
                      update({ endingMinutes: n });
                    }}
                    type="number"
                    placeholder="Boş = video/müzik bitince"
                  />
                  <p className="text-[11px] text-panel-muted">
                    Boş bırakırsan arka plan videosu veya fon müziği bitince bitiş aksiyonu
                    çalışır. Dakika girersen önce geri sayım biter.
                  </p>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.obs?.stopStreamOnEnd !== false}
                      onChange={(e) =>
                        update({ obs: { ...(settings.obs || {}), stopStreamOnEnd: e.target.checked } })
                      }
                    />
                    <span>
                      Video / müzik (veya süre) bitince yayını kapat
                      <span className="mt-0.5 block text-[11px] text-panel-muted">
                        OBS Stop Stream. Kapalıysa medya bitince yayın kapanmaz.
                      </span>
                    </span>
                  </label>
                </>
              )}
                </SettingsSection>
              )}

              <div className="rounded-md border border-panel-border/60 bg-black/20 px-2 py-1.5 text-[11px] text-panel-muted">
                Ayarlar bu ekrana özel ({screen === "starting" ? "Giriş" : screen === "ending" ? "Çıkış" : screen === "brb" ? "Mola" : screen}).
                Video / arka plan her sekmede ayrı kaydedilir.
              </div>

              {!sectionHidden("arkaPlan") && (
                <SettingsSection id="arkaPlan" title={tt("sec.arkaPlan")} style={secOrder("arkaPlan")}>
              <div>
                <label className="mb-1 block text-xs text-panel-muted">{tt("field.bg")}</label>
                <select
                  className="w-full rounded-md border border-panel-border bg-[#1c2030] px-2 py-2 text-sm text-white"
                  value={settings.bgStyle || "mix"}
                  onChange={(e) => update({ bgStyle: e.target.value })}
                >
                  <option value="mix">{tt("bg.mix")}</option>
                  <option value="accent">{tt("bg.accent")}</option>
                  <option value="dark">{tt("bg.dark")}</option>
                  <option value="image">{tt("bg.image")}</option>
                  <option value="video">{tt("bg.video")}</option>
                  <option value="youtube">{tt("bg.youtube")}</option>
                </select>
              </div>

              <button
                className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
                onClick={() => void pickBackground()}
              >
                + Hareketli / sabit arka plan ekle (GIF, WebP, PNG)
              </button>
              <p className="text-[11px] font-medium text-panel-muted">Arka plan görselleri</p>
              <p className="text-[11px] text-panel-muted">
                GIF ve animasyonlu WebP desteklenir. Sil = uygulama deposundan kalıcı siler.
              </p>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
                {bgFiles.length === 0 && (
                  <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz arka plan yok</p>
                )}
                {bgFiles.map((name) => {
                  const active =
                    settings.bgImagePath === name ||
                    (settings.bgImagePath || "").replace(/\\/g, "/").endsWith("/" + name);
                  return (
                    <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                        onClick={() => update({ bgImagePath: name, bgImage: null, bgStyle: "image" })}
                      >
                        {active ? "▶ " : ""}
                        {name}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-300"
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/backgrounds/delete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name }),
                          });
                          if (active) update({ bgImagePath: null });
                          refreshBackgrounds();
                          showToast("Arka plan silindi");
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  );
                })}
              </div>
              {settings.bgImagePath && (
                <p className="truncate text-[11px] text-panel-muted">
                  Aktif arka plan: {String(settings.bgImagePath).split(/[/\\]/).pop()}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-md px-2 py-2 text-sm ${
                    settings.bgStyle === "video"
                      ? "bg-panel-accent text-[color:var(--panel-cta-ink)] font-semibold"
                      : "bg-black/40"
                  }`}
                  onClick={() => {
                    if (!settings.bgVideoPath && videoFiles[0]) {
                      update({ bgStyle: "video", bgVideoPath: videoFiles[0], lastVideoSource: "video" });
                    } else {
                      update({ bgStyle: "video", lastVideoSource: "video" });
                    }
                  }}
                >
                  Yerel video
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md px-2 py-2 text-sm ${
                    settings.bgStyle === "youtube"
                      ? "bg-panel-accent text-[color:var(--panel-cta-ink)] font-semibold"
                      : "bg-black/40"
                  }`}
                  onClick={() => update({ bgStyle: "youtube", lastVideoSource: "youtube" })}
                >
                  YouTube
                </button>
              </div>
                </SettingsSection>
              )}

              {settings.bgStyle === "video" && settings.transparent && (
                <p className="rounded-md border border-panel-cta/40 bg-panel-cta/10 px-2 py-1.5 text-[11px] text-orange-100">
                  &quot;Şeffaf arka plan&quot; açıkken video gizlenir. Videoyu görmek için
                  şeffaflığı kapat.
                </p>
              )}

              {!sectionHidden("video") && (
                <SettingsSection id="video" title={tt("sec.video")} style={secOrder("video")}>
              <p className="text-[11px] text-panel-muted">
                Videolar <code className="text-white/70">assets/videos</code> içine kopyalanır. Sil =
                diskten de siler.
              </p>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
                {videoFiles.length === 0 && (
                  <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz yerel video yok</p>
                )}
                {videoFiles.map((name) => {
                  const active =
                    settings.bgVideoPath === name ||
                    (settings.bgVideoPath || "").replace(/\\/g, "/").endsWith("/" + name);
                  return (
                    <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                        onClick={() =>
                          update({
                            bgVideoPath: name,
                            bgVideoStart: 0,
                            bgVideoEnd: 0,
                            bgStyle: "video",
                            lastVideoSource: "video",
                          })
                        }
                      >
                        {active ? "▶ " : ""}
                        {name}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-300"
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/videos/delete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name }),
                          });
                          if (active) update({ bgVideoPath: null });
                          refreshVideos();
                          showToast("Video depodan silindi");
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className="w-full rounded-md bg-black/40 px-3 py-2 text-sm" onClick={() => void pickLocalVideo()}>
                + Yerel video ekle (uygulama deposu)
              </button>
              {/* OBS'in gömülü tarayıcısında donanımlı VP9/AV1 çözümü yok; bu
                  biçimler uygulamada akıcı oynarken OBS'te takılabiliyor. */}
              {/\.(webm|mkv)$/i.test(String(settings.bgVideoPath || "")) && (
                <p className="rounded-md border border-panel-cta/40 bg-panel-cta/10 px-2 py-1.5 text-[11px] text-orange-100">
                  Bu video <b>{String(settings.bgVideoPath).split(".").pop()?.toUpperCase()}</b>{" "}
                  biçiminde. OBS&apos;in tarayıcı kaynağı VP9/AV1&apos;i donanımla çözemediği için
                  uygulamada akıcı oynasa da OBS&apos;te takılabilir — özellikle 4K dosyalarda.
                  Takılma yaşarsan videoyu <b>MP4 (H.264)</b> olarak dönüştürüp ekle.
                </p>
              )}
              {settings.bgVideoPath && (
                <p className="truncate text-[11px] text-panel-muted">
                  Aktif yerel: {String(settings.bgVideoPath).split(/[/\\]/).pop()}
                </p>
              )}
              <LazyMount minHeight={220}>
                <VideoScrubber
                  videoPath={settings.bgVideoPath}
                  start={Number(settings.bgVideoStart) || 0}
                  end={Number(settings.bgVideoEnd) || 0}
                  onSetStart={(t) =>
                    update({ bgVideoStart: t, bgStyle: "video", lastVideoSource: "video" })
                  }
                  onSetEnd={(t) => update({ bgVideoEnd: t, bgStyle: "video", lastVideoSource: "video" })}
                  onGoLive={(t) => {
                    update({
                      bgStyle: "video",
                      lastVideoSource: "video",
                      videoSeek: t,
                      videoSeekAt: Date.now(),
                    });
                    showToast("Video yayına verildi");
                  }}
                />
              </LazyMount>
              <VideoTrimBar
                videoPath={settings.bgVideoPath}
                start={Number(settings.bgVideoStart) || 0}
                end={Number(settings.bgVideoEnd) || 0}
                onChange={(start, end) =>
                  update({ bgVideoStart: start, bgVideoEnd: end, bgStyle: "video", lastVideoSource: "video" })
                }
                label="Yerel kırpma"
              />

              <div className="rounded-md border border-panel-border/60 bg-[#141824] p-3">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={!!settings.videoSound}
                    onChange={(e) => update({ videoSound: e.target.checked })}
                  />
                  Video sesi açık
                </label>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="w-16 text-panel-muted">Seviye</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    value={settings.videoVolume ?? 100}
                    onChange={(e) => update({ videoVolume: Number(e.target.value) })}
                  />
                  <span className="w-10 text-right text-white">{settings.videoVolume ?? 100}%</span>
                </div>
                <p className="mt-1 text-[10px] text-panel-muted">
                  Yerel video ve YouTube aynı ses ayarını kullanır — hangisi fon ise o çalar.
                  Windows ses karıştırıcısında &quot;StreamAxT&quot; adıyla görünür
                  (ses çalarken; Edge WebView2 diye arama).
                </p>
              </div>
                </SettingsSection>
              )}


              {!sectionHidden("youtube") && (
                <SettingsSection id="youtube" title={tt("sec.youtube")} style={secOrder("youtube")}>
              <Field
                label="YouTube URL"
                value={settings.youtubeUrl || ""}
                onChange={(v) =>
                  update({
                    youtubeUrl: v,
                    youtubeDuration: null,
                    youtubeStart: 0,
                    youtubeEnd: 0,
                    bgStyle: v ? "youtube" : settings.bgStyle,
                    lastVideoSource: v ? "youtube" : settings.lastVideoSource,
                  })
                }
              />
              {!!settings.youtubeUrl && (
                <div className="space-y-1.5 rounded-md border border-panel-border/60 bg-black/20 p-2">
                  <p className="text-[11px] text-panel-muted">
                    YouTube oynatıcısı videonun başında başlık ile duraklat ikonunu, sonunda da
                    bitiş kartlarını kendi çiziyor. Videoyu yerele indirirsen bu arayüz hiç
                    olmaz, döngü de kesintisiz olur.
                  </p>
                  {indirmeSuruyor ? (
                    <>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/50">
                        <div
                          className="h-full rounded-full bg-panel-accent transition-[width] duration-200"
                          style={{
                            width:
                              indirme.durum.percent >= 0 ? `${indirme.durum.percent}%` : "100%",
                            opacity: indirme.durum.percent >= 0 ? 1 : 0.4,
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[11px] text-panel-muted">
                          {indirmeMetni}
                        </span>
                        <button
                          type="button"
                          className="rounded-md bg-black/40 px-2 py-1 text-[11px]"
                          onClick={() => indirme.iptalEt()}
                        >
                          İptal
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
                      onClick={() => void indirme.indir(String(settings.youtubeUrl))}
                    >
                      ⬇ İndir ve yerelde sakla
                    </button>
                  )}
                  {(indirme.durum.phase === "hata" || indirme.durum.phase === "iptal") && (
                    <p className="rounded-md border border-panel-cta/40 bg-panel-cta/10 px-2 py-1.5 text-[11px] text-orange-100">
                      {indirme.durum.message || "İndirme tamamlanamadı"}
                    </p>
                  )}
                </div>
              )}
              {!!settings.youtubeUrl && (
                <>
                  <LazyMount minHeight={220}>
                  <VideoScrubber
                    youtubeUrl={settings.youtubeUrl}
                    start={Number(settings.youtubeStart) || 0}
                    end={Number(settings.youtubeEnd) || 0}
                    onDuration={(d) => {
                      // Önizlemede süreyi zaten okuduk; kırpma barı tahmine
                      // düşmesin diye ayarlara yazıyoruz.
                      if (Math.abs((Number(settings.youtubeDuration) || 0) - d) > 0.5) {
                        update({ youtubeDuration: d });
                      }
                    }}
                    onSetStart={(t) =>
                      update({ youtubeStart: t, bgStyle: "youtube", lastVideoSource: "youtube" })
                    }
                    onSetEnd={(t) =>
                      update({ youtubeEnd: t, bgStyle: "youtube", lastVideoSource: "youtube" })
                    }
                    onGoLive={(t) => {
                      update({
                        bgStyle: "youtube",
                        lastVideoSource: "youtube",
                        videoSeek: t,
                        videoSeekAt: Date.now(),
                      });
                      showToast("YouTube videosu yayına verildi");
                    }}
                    endMargin={
                      Number(settings.youtubeEndMargin) > 0
                        ? Number(settings.youtubeEndMargin)
                        : DEFAULT_END_MARGIN
                    }
                  />
                  </LazyMount>
                  <VideoTrimBar
                    durationHint={
                      Number(settings.youtubeDuration) > 0
                        ? Number(settings.youtubeDuration)
                        : Math.max(
                            60,
                            Number(settings.youtubeEnd) || 0,
                            Number(settings.youtubeStart) || 0,
                            600
                          )
                    }
                    start={Number(settings.youtubeStart) || 0}
                    end={Number(settings.youtubeEnd) || 0}
                    onChange={(start, end) =>
                      update({
                        youtubeStart: start,
                        youtubeEnd: end,
                        bgStyle: "youtube",
                        lastVideoSource: "youtube",
                      })
                    }
                    label="YouTube kırpma"
                  />
                  {Number(settings.youtubeDuration) > 0 ? (
                    <p className="text-[11px] text-panel-muted">
                      Süre otomatik: {Math.floor(Number(settings.youtubeDuration) / 60)}:
                      {String(Math.floor(Number(settings.youtubeDuration) % 60)).padStart(2, "0")}
                    </p>
                  ) : (
                    <p className="text-[11px] text-panel-muted">Süre yükleniyor (önizleme / OBS açıkken)…</p>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-panel-muted">YouTube kalite</label>
                    <select
                      className="w-full rounded-md border border-panel-border bg-[#1c2030] px-2 py-2 text-sm text-white"
                      value={settings.youtubeQuality || "hd1080"}
                      onChange={(e) => update({ youtubeQuality: e.target.value, bgStyle: "youtube" })}
                    >
                      <option value="default">Otomatik</option>
                      <option value="small">360p</option>
                      <option value="medium">480p</option>
                      <option value="large">720p</option>
                      <option value="hd720">HD 720</option>
                      <option value="hd1080">Full HD 1080</option>
                      <option value="highres">En yüksek</option>
                    </select>
                  </div>
                  <label className="flex items-start gap-2 rounded-md border border-panel-border/60 bg-black/20 p-2 text-xs text-white">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!settings.youtubePlayToEnd}
                      onChange={(e) => update({ youtubePlayToEnd: !e.target.checked })}
                    />
                    <span>
                      Bitiş kartlarını engelle
                      <span className="mt-0.5 block text-[11px] text-panel-muted">
                        YouTube&apos;un bitiş kartları oynatıcının kendi içinde çiziliyor;
                        dışarıdan kapatan bir ayar ya da CSS yok. Tek çalışan yol o bölüme hiç
                        girmemek. Uygulama videonun kart bilgisini YouTube&apos;dan okuyor:
                        <b> kartı olmayan videolar hiç kısalmadan sonuna kadar oynar</b>, kartı
                        olanlar da tam kartın çıktığı saniyede başa sarar. Kapatırsan her video
                        sonuna kadar oynar ama varsa kartlar görünür.
                      </span>
                    </span>
                  </label>
                  <div className={settings.youtubePlayToEnd ? "opacity-40" : undefined}>
                    <label className="mb-1 block text-xs text-panel-muted">
                      Kart bilgisi okunamazsa sondan atlanacak süre (sn)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      disabled={!!settings.youtubePlayToEnd}
                      className="w-full rounded-md border border-panel-border bg-black/40 px-2 py-2 text-sm text-white"
                      value={
                        Number(settings.youtubeEndMargin) > 0
                          ? Number(settings.youtubeEndMargin)
                          : DEFAULT_END_MARGIN
                      }
                      onChange={(e) =>
                        update({
                          youtubeEndMargin: Math.min(
                            60,
                            Math.max(0.5, Number(e.target.value) || DEFAULT_END_MARGIN)
                          ),
                        })
                      }
                    />
                    <p className="mt-1 text-[10px] text-panel-muted">
                      Normalde kullanılmaz — video sonuna kadar ya da tam kartın çıktığı saniyeye
                      kadar oynar. Yalnızca YouTube&apos;a ulaşılamayıp kart bilgisi okunamadığında
                      bu kör pay devreye girer. Kartlar en erken bitişten 20 sn önce
                      çıkabildiği için varsayılan 20.
                    </p>
                  </div>

              <div className="rounded-md border border-panel-border/60 bg-[#141824] p-3">
                <label className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={!!settings.videoSound}
                    onChange={(e) => update({ videoSound: e.target.checked })}
                  />
                  Video sesi açık
                </label>
                <div className="mt-1.5 flex items-center gap-2 text-xs">
                  <span className="w-16 text-panel-muted">Seviye</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                    value={settings.videoVolume ?? 100}
                    onChange={(e) => update({ videoVolume: Number(e.target.value) })}
                  />
                  <span className="w-10 text-right text-white">{settings.videoVolume ?? 100}%</span>
                </div>
                <p className="mt-1 text-[10px] text-panel-muted">
                  Yerel video ve YouTube aynı ses ayarını kullanır — hangisi fon ise o çalar.
                </p>
              </div>

                </>
              )}
                </SettingsSection>
              )}

              {!sectionHidden("fonMuzigi") && (
                <SettingsSection id="fonMuzigi" title={tt("sec.fonMuzigi")} style={secOrder("fonMuzigi")}>
              <p className="text-[11px] text-panel-muted">
                Arka plan müziği uygulama deposunda saklanır; varsayılan olarak döngüde çalar. Sil =
                diskten siler.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
                {musicFiles.length === 0 && (
                  <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz müzik yok</p>
                )}
                {musicFiles.map((name) => {
                  const active =
                    settings.bgAudioPath === name ||
                    (settings.bgAudioPath || "").replace(/\\/g, "/").endsWith("/" + name);
                  return (
                    <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                        onClick={() =>
                          update({ bgAudioPath: name, audioLoop: settings.audioLoop !== false, musicSound: true })
                        }
                        title={name}
                      >
                        {active ? "▶ " : ""}
                        {name}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-300"
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/music/delete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name }),
                          });
                          if (active) update({ bgAudioPath: null });
                          refreshMusic();
                          showToast("Müzik silindi");
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-md bg-black/40 px-3 py-2 text-sm"
                  onClick={async () => {
                    try {
                      const selected = await open({
                        multiple: false,
                        filters: [
                          {
                            name: "Ses",
                            extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"],
                          },
                        ],
                      });
                      if (typeof selected !== "string") return;
                      const data = await importLibraryFile("music", selected);
                      refreshMusic();
                      if (data?.name) {
                        update({
                          bgAudioPath: data.name,
                          audioLoop: true,
                          musicSound: settings.musicSound !== false,
                        });
                        showToast("Fon müziği eklendi (döngü açık)");
                      }
                    } catch {
                      showToast("Müzik eklenemedi");
                    }
                  }}
                >
                  + Fon müziği ekle
                </button>
                {settings.bgAudioPath && (
                  <button
                    className="rounded-md bg-black/40 px-3 py-2 text-sm"
                    onClick={() => update({ bgAudioPath: null })}
                  >
                    Bu ekranda kapat
                  </button>
                )}
              </div>
              {settings.bgAudioPath && (
                <p className="truncate text-[11px] text-panel-muted">
                  Aktif: {String(settings.bgAudioPath).split(/[/\\]/).pop()}
                </p>
              )}

              <label className="flex items-start gap-2 rounded-md border border-panel-border/60 bg-black/20 p-2 text-xs text-white">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!settings.musicShared}
                  onChange={(e) => update({ musicShared: e.target.checked })}
                />
                <span>
                  Aynı müzik Giriş, Çıkış ve Mola ekranlarında çalsın
                  <span className="mt-0.5 block text-[11px] text-panel-muted">
                    Seçtiğin parça, döngü, ses açık/kapalı ve seviye üç ekrana birden yazılır.
                    OBS&apos;te üç sahne aynı anda açıksa sesi üst üste duyarsın — kaynak
                    ayarlarında &ldquo;Görünür değilken kaynağı kapat&rdquo;ı işaretle.
                  </span>
                </span>
              </label>

              {/* Video sesi artık ilgili videonun yanında; burada müzik kalıyor. */}
              <p className="text-[11px] font-medium text-panel-muted">Müzik sesi</p>
              <div className="space-y-3 rounded-md border border-panel-border/60 bg-[#141824] p-3">
                <div>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={settings.musicSound !== false}
                      onChange={(e) => update({ musicSound: e.target.checked })}
                    />
                    Müzik sesi açık
                  </label>
                  <label className="mt-1.5 flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={settings.audioLoop !== false}
                      disabled={
                        (screen === "starting" &&
                          settings.obs?.autoSwitchOnStartingMediaEnd !== false) ||
                        (screen === "ending" &&
                          settings.obs?.stopStreamOnEnd !== false &&
                          !settings.endingMinutes &&
                          !settings.targetDate)
                      }
                      onChange={(e) => update({ audioLoop: e.target.checked })}
                    />
                    Müziği döngüde çal (fon müziği)
                  </label>
                  {((screen === "starting" &&
                    settings.obs?.autoSwitchOnStartingMediaEnd !== false) ||
                    (screen === "ending" &&
                      settings.obs?.stopStreamOnEnd !== false &&
                      !settings.endingMinutes &&
                      !settings.targetDate)) && (
                    <p className="mt-1 text-[10px] text-panel-muted">
                      Medya bitiş aksiyonu açıkken müzik bir kez çalar (döngü kapalı).
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 text-xs">
                    <span className="w-16 text-panel-muted">Seviye</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      className="flex-1"
                      value={settings.musicVolume ?? 70}
                      onChange={(e) => update({ musicVolume: Number(e.target.value) })}
                    />
                    <span className="w-10 text-right text-white">{settings.musicVolume ?? 70}%</span>
                  </div>
                </div>
              </div>
                </SettingsSection>
              )}

              {!sectionHidden("logo") && (
                <SettingsSection id="logo" title={tt("sec.logo")} style={secOrder("logo")}>
              <p className="text-[11px] text-panel-muted">Dosya olarak kaydedilir; kapanınca kaybolmaz.</p>
              <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-panel-border/60 bg-black/20 p-1.5">
                {logoFiles.length === 0 && (
                  <p className="px-1 py-2 text-[11px] text-panel-muted">Henüz logo yok</p>
                )}
                {logoFiles.map((name) => {
                  const active = settings.logoFile === name;
                  return (
                    <div key={name} className="flex items-center gap-1.5 rounded px-1 py-1 hover:bg-black/30">
                      <button
                        type="button"
                        className={`min-w-0 flex-1 truncate text-left text-xs ${active ? "text-panel-accent" : ""}`}
                        onClick={() => update({ logoFile: name, logo: null, logoPath: null })}
                      >
                        {active ? "▶ " : ""}
                        {name}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[10px] text-red-300"
                        onClick={async () => {
                          await fetch(`${API_BASE}/api/logos/delete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name }),
                          });
                          if (active) update({ logoFile: null, logo: null });
                          refreshLogos();
                        }}
                      >
                        Sil
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className="w-full rounded-md bg-black/40 px-3 py-2 text-sm" onClick={() => void pickLogo()}>
                + Logo ekle / kaydet
              </button>
              {(settings.logoFile || settings.logo) && (
                <button
                  className="w-full rounded-md bg-black/40 px-3 py-2 text-xs"
                  onClick={() => update({ logoFile: null, logo: null, logoPath: null })}
                >
                  Bu ekranda logoyu kaldır
                </button>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.logoFit !== false} onChange={(e) => update({ logoFit: e.target.checked })} />
                Logo sığdır / kırp
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={settings.logoFrame !== false} onChange={(e) => update({ logoFrame: e.target.checked })} />
                Logo çerçevesi
              </label>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 text-panel-muted">Zoom</span>
                <input
                  type="range"
                  min={50}
                  max={250}
                  value={settings.logoZoom ?? 100}
                  onChange={(e) => update({ logoZoom: Number(e.target.value) })}
                  className="flex-1"
                />
                <span>{settings.logoZoom ?? 100}%</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 text-panel-muted">Kaydır X</span>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={settings.logoPanX ?? 0}
                  onChange={(e) => update({ logoPanX: Number(e.target.value) })}
                  className="flex-1"
                />
                <span>{settings.logoPanX ?? 0}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 text-panel-muted">Kaydır Y</span>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  value={settings.logoPanY ?? 0}
                  onChange={(e) => update({ logoPanY: Number(e.target.value) })}
                  className="flex-1"
                />
                <span>{settings.logoPanY ?? 0}</span>
              </div>
              <div>
                <label className="mb-1 block text-xs text-panel-muted">Logo efekt</label>
                <select
                  className="w-full rounded-md border border-panel-border bg-[#1c2030] px-2 py-2 text-sm text-white"
                  value={settings.logoEffect || "none"}
                  onChange={(e) => update({ logoEffect: e.target.value })}
                >
                  {EFFECT_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-panel-muted">Logo animasyon</label>
                <select
                  className="w-full rounded-md border border-panel-border bg-[#1c2030] px-2 py-2 text-sm text-white"
                  value={settings.logoAnim || "none"}
                  onChange={(e) => update({ logoAnim: e.target.value })}
                >
                  {ANIM_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-panel-muted">Logo vurgu rengi</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-12 cursor-pointer rounded border border-panel-border bg-[#1c2030]"
                    value={settings.logoAccentColor || settings.accent || "#7c5cff"}
                    onChange={(e) => update({ logoAccentColor: e.target.value })}
                  />
                  <button
                    type="button"
                    className="rounded-md bg-black/40 px-2 py-1.5 text-[11px] text-white"
                    onClick={() => update({ logoAccentColor: null })}
                  >
                    Genel accent
                  </button>
                </div>
              </div>
                </SettingsSection>
              )}

              {!sectionHidden("boyutlar") && (
                <SettingsSection id="boyutlar" title={tt("sec.boyutlar")} style={secOrder("boyutlar")}>
              <p className="text-[11px] text-panel-muted">Önizlemede köşeden de ölçeklenebilir.</p>
              {(["logo", "eyebrow", "title", "sub", "countdown", "socials", "ticker", "credits", "visualizer", "nowPlaying"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-20 text-panel-muted">{k}</span>
                  <input
                    type="range"
                    min={40}
                    max={220}
                    value={settings.sizes?.[k] || 100}
                    onChange={(e) =>
                      update({ sizes: { ...(settings.sizes || {}), [k]: Number(e.target.value) } })
                    }
                    className="flex-1"
                  />
                  <span>{settings.sizes?.[k] || 100}</span>
                </div>
              ))}
                </SettingsSection>
              )}

              {!sectionHidden("gorunurluk") && (
                <SettingsSection id="gorunurluk" title={tt("sec.gorunurluk")} style={secOrder("gorunurluk")}>
              <p className="text-[11px] text-panel-muted">Overlay öğelerini göster / gizle.</p>
              {(["logo", "eyebrow", "title", "sub", "countdown", "socials", "ticker", "credits"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.visible?.[k] !== false}
                    onChange={(e) =>
                      update({ visible: { ...(settings.visible || {}), [k]: e.target.checked } })
                    }
                  />
                  {PART_LABELS[k] || k}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.nowPlayingEnabled !== false && settings.visible?.nowPlaying !== false}
                  onChange={(e) =>
                    update({
                      nowPlayingEnabled: e.target.checked,
                      visible: { ...(settings.visible || {}), nowPlaying: e.target.checked },
                    })
                  }
                />
                Şimdi Çalıyor widget’ı
              </label>
              {settings.nowPlayingEnabled !== false && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.nowPlayingTheme !== false}
                      onChange={(e) => update({ nowPlayingTheme: e.target.checked })}
                    />
                    Resonance temasını kullan
                  </label>
                  <p className="text-[11px] text-panel-muted">
                    Açıkken Müzik sekmesinde seçtiğin tema/skin bu ekranda da aynen görünür.
                    Kapatırsan sade yerleşik kart kullanılır.
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.nowPlayingOnlyWhilePlaying !== false}
                      onChange={(e) => update({ nowPlayingOnlyWhilePlaying: e.target.checked })}
                    />
                    Yalnızca müzik çalarken göster
                  </label>
                  {settings.nowPlayingTheme !== false && (
                    <p className="text-[11px] text-panel-muted">
                      Kart boyutu temaya göre kendiliğinden ayarlanır. Büyütmek/küçültmek
                      için önizlemede karta tıklayıp boyut tutamacını kullan.
                    </p>
                  )}
                </>
              )}
                </SettingsSection>
              )}

              {!sectionHidden("parcacik") && (
                <SettingsSection id="parcacik" title={tt("sec.parcacik")} style={secOrder("parcacik")}>
              <p className="text-[11px] font-medium text-panel-muted">Parçacıklar</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.particles !== false}
                  onChange={(e) => update({ particles: e.target.checked })}
                />
                Parçacık animasyonu
              </label>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-20 text-panel-muted">Yoğunluk</span>
                <input
                  type="range"
                  min={20}
                  max={200}
                  value={settings.particleDensity ?? 100}
                  onChange={(e) => update({ particleDensity: Number(e.target.value) })}
                  className="flex-1"
                />
                <span>{settings.particleDensity ?? 100}%</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-md bg-black/40 px-2 py-2 text-xs"
                  onClick={async () => {
                    try {
                      const selected = await open({
                        multiple: false,
                        filters: [{ name: "Parçacık", extensions: ["png", "webp"] }],
                      });
                      if (typeof selected !== "string") return;
                      const res = await fetch(`${API_BASE}/media/file?path=${encodeURIComponent(selected)}`);
                      const blob = await res.blob();
                      const buf = await blob.arrayBuffer();
                      const name = selected.split(/[/\\]/).pop() || "particle.png";
                      const up = await fetch(`${API_BASE}/api/particles`, {
                        method: "POST",
                        headers: {
                          "Content-Type": blob.type || "image/png",
                          "X-Filename": name,
                        },
                        body: buf,
                      });
                      const data = await up.json();
                      setParticleFiles(data.files || []);
                      const key = name.replace(/\.(png|webp)$/i, "");
                      update({
                        particleTypes: { ...(settings.particleTypes || {}), [key]: true },
                        particles: true,
                      });
                      showToast("Parçacık eklendi");
                    } catch {
                      showToast("Parçacık eklenemedi");
                    }
                  }}
                >
                  + Parçacık ekle
                </button>
                <button className="rounded-md bg-black/40 px-2 py-2 text-xs" onClick={refreshParticles}>
                  Yenile
                </button>
              </div>
              {particleKeys.length === 0 && (
                <p className="text-[11px] text-panel-muted">Henüz parçacık yok — PNG/WEBP ekle</p>
              )}
              {particleKeys.map((key) => {
                const file = particleFiles.find((f) => f.replace(/\.(png|webp)$/i, "") === key) || `${key}.png`;
                return (
                  <div key={key} className="space-y-1 rounded border border-panel-border/60 p-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={`${API_BASE}/assets/particles/${file}`}
                        alt=""
                        className="h-8 w-8 object-contain"
                      />
                      <label className="flex flex-1 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={settings.particleTypes?.[key] !== false}
                          onChange={(e) =>
                            update({
                              particleTypes: { ...(settings.particleTypes || {}), [key]: e.target.checked },
                            })
                          }
                        />
                        {key}
                      </label>
                      <button
                        className="rounded bg-red-800/70 px-2 py-1 text-[10px]"
                        onClick={async () => {
                          if (!confirm(`${file} silinsin mi?`)) return;
                          const res = await fetch(`${API_BASE}/api/particles/delete`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: file }),
                          });
                          const data = await res.json();
                          setParticleFiles(data.files || []);
                          const nextTypes = { ...(settings.particleTypes || {}) };
                          delete nextTypes[key];
                          update({ particleTypes: nextTypes });
                          showToast("Parçacık silindi");
                        }}
                      >
                        Sil
                      </button>
                    </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-panel-muted">Boyut</span>
                        <input
                          type="range"
                          min={50}
                          max={400}
                          value={settings.particleSizes?.[key] || 100}
                          onChange={(e) =>
                            update({
                              particleSizes: { ...(settings.particleSizes || {}), [key]: Number(e.target.value) },
                            })
                          }
                          className="flex-1"
                        />
                        <span>{settings.particleSizes?.[key] || 100}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-panel-muted">Vurgu</span>
                        <input
                          type="color"
                          value={settings.particleColors?.[key] || settings.accent || "#7c5cff"}
                          onChange={(e) =>
                            update({
                              particleColors: { ...(settings.particleColors || {}), [key]: e.target.value },
                            })
                          }
                          className="h-7 w-10 cursor-pointer rounded border border-panel-border bg-transparent"
                        />
                        <label className="ml-auto flex items-center gap-1.5 text-[11px]">
                          <input
                            type="checkbox"
                            checked={settings.particleGlow?.[key] !== false}
                            onChange={(e) =>
                              update({
                                particleGlow: { ...(settings.particleGlow || {}), [key]: e.target.checked },
                              })
                            }
                          />
                          Glow
                        </label>
                      </div>
                  </div>
                );
              })}
                </SettingsSection>
              )}

              {screen === "ending" && !sectionHidden("jenerik") && (
                <SettingsSection id="jenerik" title={tt("sec.jenerik")} style={secOrder("jenerik")}>
                  <TextStyleEditor settings={settings} onChange={update} includeCredits sadece={["credits"]} />
                  <h3 className="text-sm font-semibold">Otomatik jenerik</h3>
                  <p className="text-[11px] text-panel-muted">
                    Panel açıkken Twitch/Kick/YouTube abone, bağış (Super Chat / bits) ve
                    takip/raid olayları jeneriğe yazılır. Bölüm başlıkları: Destekçiler, Yeni
                    Aboneler, Yeni Takipçiler.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={settings.creditsAuto !== false}
                      onChange={(e) => update({ creditsAuto: e.target.checked })}
                    />
                    Abone / takip / bağış otomatik ekle
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={settings.creditsOnlyLive !== false}
                      onChange={(e) => update({ creditsOnlyLive: e.target.checked })}
                    />
                    Yalnız bu yayında gelenleri göster (hiçbiri yoksa jenerik açılmaz)
                  </label>
                  <div className="rounded-md border border-panel-border/60 bg-black/20 px-2 py-2 text-[11px] text-panel-muted">
                    Bu oturum:{" "}
                    <span className="text-white/80">{creditCounts.donors}</span> destek ·{" "}
                    <span className="text-white/80">{creditCounts.subscribers}</span> abone ·{" "}
                    <span className="text-white/80">{creditCounts.followers}</span> takip/raid
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
                    onClick={() => {
                      clearCreditsSession();
                      setCreditCounts(creditsSessionCounts());
                      showToast("Otomatik jenerik listesi temizlendi");
                    }}
                  >
                    Oturum listesini temizle
                  </button>
                  <p className="text-[11px] text-panel-muted">
                    Manuel satırlar ve stiller yukarıdaki &quot;Jenerik bölümleri&quot;nden
                    düzenlenir.
                  </p>
                </SettingsSection>
              )}
            </>
          )}

          {screen === "chat" && !sectionHidden("chatAyarlari") && (
            <SettingsSection id="chatAyarlari" title={tt("sec.chatAyarlari")} style={secOrder("chatAyarlari")}>
              <div className="rounded-xl border border-panel-accent/30 bg-panel-soft px-2.5 py-2 text-[11px] leading-relaxed text-panel-accent/90">
                <p className="mb-1 font-semibold text-panel-accent">{tt("chat.tipsTitle")}</p>
                <p>{tt("chat.tipsBody")}</p>
              </div>
              <p className="text-[11px] text-panel-muted">
                Üç platform tek listede akar. Kanal alanlarını boş bırakırsan{" "}
                <b className="text-white/80">Giriş</b> ekranındaki sosyal hesap adları
                kullanılır. OBS Browser Source:{" "}
                <code className="text-white/70">/chat?obs=1</code>
              </p>
              <Field
                label={tt("chat.scale")}
                value={String(settings.chatScale ?? 100)}
                onChange={(v) => update({ chatScale: clampInt(v, 40, 200, 100) })}
                type="number"
              />
              <Field
                label={tt("chat.width")}
                value={String(settings.chatBoxWidth ?? 100)}
                onChange={(v) => update({ chatBoxWidth: clampInt(v, 20, 100, 100) })}
                type="number"
              />
              <Field
                label={tt("chat.height")}
                value={String(settings.chatBoxHeight ?? 100)}
                onChange={(v) => update({ chatBoxHeight: clampInt(v, 20, 100, 100) })}
                type="number"
              />
              <p className="text-[11px] text-panel-muted">{tt("chat.sizeHint")}</p>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 text-xs">{tt("chat.clearHotkey")}</span>
                <HotkeyInput
                  className="w-28 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-xs"
                  value={clearChatHk || settings.clearChatHotkey || ""}
                  placeholder="Ctrl+Shift+X"
                  onListeningChange={setHotkeyCapture}
                  onChange={(v) => {
                    setClearChatHk(v);
                    update({ clearChatHotkey: v });
                  }}
                />
              </div>
              <p className="text-[11px] text-panel-muted">{tt("chat.clearHotkeyHint")}</p>
              <button
                type="button"
                className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
                onClick={() => void clearChatNow()}
              >
                {tt("chat.clearNow")}
              </button>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.autoDetect !== false}
                  onChange={(e) => update({ autoDetect: e.target.checked })}
                />
                Kanalları otomatik algıla (Giriş → sosyal hesaplar)
              </label>

              <label className="mt-2 flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.enableKick !== false}
                  onChange={(e) => update({ enableKick: e.target.checked })}
                />
                Kick
              </label>
              {settings.enableKick !== false && (
                <>
                  <Field
                    label="Kick kullanıcı (boş = otomatik)"
                    value={settings.kickSlug || ""}
                    onChange={(v) => update({ kickSlug: v, chatroomId: null })}
                  />
                  <Field
                    label="Chatroom ID (otomatik)"
                    value={settings.chatroomId ? String(settings.chatroomId) : ""}
                    onChange={(v) => update({ chatroomId: v || null })}
                  />
                  <button
                    className="w-full rounded-md bg-black/40 px-3 py-2 text-sm"
                    onClick={() => void fetchKickChatroom()}
                  >
                    Kick chatroom çek
                  </button>
                </>
              )}

              <label className="mt-2 flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.enableTwitch !== false}
                  onChange={(e) => update({ enableTwitch: e.target.checked })}
                />
                Twitch
              </label>
              {settings.enableTwitch !== false && (
                <Field
                  label="Twitch kanal (boş = otomatik)"
                  value={settings.twitchChannel || ""}
                  onChange={(v) => update({ twitchChannel: v.replace(/^#/, "") })}
                />
              )}

              <label className="mt-2 flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.enableYoutube !== false}
                  onChange={(e) => update({ enableYoutube: e.target.checked })}
                />
                YouTube
              </label>
              {settings.enableYoutube !== false && (
                <>
                  <Field
                    label="YouTube kanal (@handle, boş = otomatik)"
                    value={settings.youtubeChannel || ""}
                    onChange={(v) => update({ youtubeChannel: v })}
                  />
                  <Field
                    label="veya canlı video URL / ID"
                    value={settings.youtubeVideoId || ""}
                    onChange={(v) => update({ youtubeVideoId: v })}
                  />
                  <p className="text-[11px] text-panel-muted">
                    Kanal yayındayken @handle yeterli; yayın bitip yeniden başlarsa video
                    kimliği kendiliğinden yenilenir.
                  </p>
                </>
              )}

              <hr className="border-panel-border" />
              <Field
                label="Maks. mesaj"
                value={String(settings.maxMessages || 60)}
                onChange={(v) => update({ maxMessages: clampInt(v, 5, 500, 60) })}
                type="number"
              />
              <Field
                label="Yazı boyutu (px)"
                value={String(settings.fontSize || 22)}
                onChange={(v) => update({ fontSize: clampInt(v, 10, 80, 22) })}
                type="number"
              />
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.showPlatformBadge !== false}
                  onChange={(e) => update({ showPlatformBadge: e.target.checked })}
                />
                Platform logosu (Twitch / Kick / YouTube)
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.showUserBadges !== false}
                  onChange={(e) => update({ showUserBadges: e.target.checked })}
                />
                Sohbet rozetleri (mod / abone / VIP)
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={!!settings.showTimestamps}
                  onChange={(e) => update({ showTimestamps: e.target.checked })}
                />
                Saat göster
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.highlightEvents !== false}
                  onChange={(e) => update({ highlightEvents: e.target.checked })}
                />
                Super Chat / abonelik / raid vurgusu
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.autoHideMessages !== false}
                  onChange={(e) => update({ autoHideMessages: e.target.checked })}
                />
                Mesajlar zamanla kaybolsun
              </label>
              {settings.autoHideMessages !== false && (
                <div>
                  <label className="mb-1 block text-xs text-panel-muted">
                    Kaybolma süresi (saniye)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={3}
                      max={60}
                      step={1}
                      className="flex-1"
                      value={Math.min(60, Math.max(3, Number(settings.messageHideSec) || 12))}
                      onChange={(e) => update({ messageHideSec: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      min={2}
                      max={180}
                      className="w-16 rounded-md border border-panel-border bg-[#1c2030] px-2 py-1 text-sm text-white"
                      value={Number(settings.messageHideSec) || 12}
                      onChange={(e) =>
                        update({ messageHideSec: clampInt(e.target.value, 2, 180, 12) })
                      }
                    />
                    <span className="text-xs text-panel-muted">sn</span>
                  </div>
                  <p className="mt-1 text-[11px] text-panel-muted">
                    Süre dolunca mesaj solar ve listeden çıkar (varsayılan 12 sn).
                  </p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={!!settings.fadeOldMessages}
                  onChange={(e) => update({ fadeOldMessages: e.target.checked })}
                />
                Liste üstü yumuşak maske (eski mesajlar soluk)
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.textShadow !== false}
                  onChange={(e) => update({ textShadow: e.target.checked })}
                />
                Yazı gölgesi (OBS'te okunurluk)
              </label>
              <label className="flex items-center gap-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={settings.bgTransparent !== false}
                  onChange={(e) => update({ bgTransparent: e.target.checked })}
                />
                Şeffaf arka plan
              </label>
            </SettingsSection>
          )}
        </EdgePanel>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[color:var(--panel-bg-deep)] shadow-glass">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-black/30 px-4 py-2.5 text-xs text-panel-muted">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full transition-colors ${
                  previewOn ? "bg-emerald-400 shadow-glow-sm" : "bg-neutral-500"
                }`}
              />
              <span className="font-display text-[11px] font-bold tracking-wider text-white">
                {previewOn ? tt("preview.on") : tt("preview.off")}
              </span>
              <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.2 text-[9px] font-mono text-panel-muted">
                1080P STUDIO
              </span>
            </div>
            <div className="flex items-center gap-4">
              <label
                className="flex cursor-pointer items-center gap-2 text-xs text-white/90 transition hover:text-white"
                title="Kapatınca video çözme ve parçacık çizimi durur; CPU/RAM belirgin düşer. Öğeleri sürükleyip konumlamak için açık olması gerekir."
              >
                <input
                  type="checkbox"
                  checked={previewOn}
                  onChange={(e) => setPreviewOn(e.target.checked)}
                  className="size-3.5 rounded border-white/20 text-panel-accent focus:ring-panel-accent/40"
                />
                <span className="text-[11px] font-medium">{tt("preview.toggle")}</span>
              </label>
              <button
                type="button"
                onClick={() => setPanelsPinned((v) => !v)}
                title={
                  panelsPinned
                    ? "Yan panelleri kenara gizle (önizleme büyür)"
                    : "Yan panelleri sabitle (hep açık kalsın)"
                }
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/80 transition hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white"
              >
                {panelsPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                <span>{panelsPinned ? "Panelleri gizle" : "Panelleri sabitle"}</span>
              </button>
              <a
                className="inline-flex items-center gap-1 rounded-lg border border-panel-accent/30 bg-panel-accent/15 px-2.5 py-1 text-[11px] font-semibold text-panel-accent transition hover:border-panel-accent/50 hover:bg-panel-accent/25"
                href={obsUrl}
                onClick={(e) => {
                  e.preventDefault();
                  void openExternal(obsUrl);
                }}
              >
                {tt("preview.openObs")}
              </a>
            </div>
          </div>
          {notices.length > 0 && (
            <div className="space-y-2 px-3 py-3">
              {notices.map((n) => (
                <Toast
                  key={n.id}
                  variant={n.level}
                  title={n.text}
                  className="text-xs"
                  onClose={() => clearNotice(n.id)}
                >
                  {n.hint}
                </Toast>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewOn || screen === "chat" ? (
              <LivePreview
                screen={screen}
                settings={settings}
                onPatch={update}
                onCountdownEnd={(live) => void handlePreviewCountdownEnd(live)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm text-panel-muted">
                  Önizleme kapalı — video çözme ve parçacık çizimi durdu.
                </p>
                <p className="text-[11px] text-panel-muted">
                  OBS çıktısı bundan etkilenmez. Öğeleri sürükleyerek konumlamak için
                  önizlemeyi tekrar aç.
                </p>
                <button
                  type="button"
                  className="rounded-md bg-panel-accent/80 px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => setPreviewOn(true)}
                >
                  Önizlemeyi aç
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-panel-border px-3 py-2">
            {hiddenParts.length === 0 ? (
              <span className="text-[11px] text-panel-muted">
                Gizlenen parça yok — kapattıkların buraya düşer, tek tıkla geri gelir.
              </span>
            ) : (
              <>
                <span className="text-[11px] text-panel-muted">Gizlenenler:</span>
                {hiddenParts.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="rounded-full border border-panel-border bg-black/40 px-2.5 py-1 text-[11px] text-white transition hover:border-panel-accent hover:text-panel-accent"
                    onClick={() => restorePart(k)}
                    title="Yeniden göster"
                  >
                    + {PART_LABELS[k] || k}
                  </button>
                ))}
                <button
                  type="button"
                  className="ml-auto rounded-full bg-panel-accent/90 px-2.5 py-1 text-[11px] font-semibold text-[#08131c]"
                  onClick={restoreAllParts}
                >
                  Tümünü geri getir
                </button>
              </>
            )}
          </div>
        </section>

        <EdgePanel
          side="right"
          pinned={panelsPinned}
          width={340}
          label="Görünüm paneli — fareyi getir"
          className="custom-scrollbar flex flex-col space-y-4 overflow-y-auto rounded-2xl border border-white/[0.05] bg-panel-card/50 p-4"
        >
          {!sectionHidden("obsUrl") && (
            <SettingsSection id="obsUrl" title={tt("sec.obsUrl")} style={secOrder("obsUrl", true)}>
          <p className="text-[11px] text-panel-muted">
            URL: <code className="text-white/80">http://127.0.0.1:8843/starting?obs=1</code> — uygulama açık olmalı. Genişlik 1920, Yükseklik 1080.
          </p>
          <CopyUrl
            url={obsUrl}
            onCopied={() => showToast("Kopyalandı")}
            onOpened={(u, s) => showToast(s === "opened" ? "Önizleme tarayıcıda açıldı" : s === "copied" ? "Tarayıcı açılamadı — adres kopyalandı" : "Önizleme açılamadı: " + u)}
          />
            </SettingsSection>
          )}

          {!sectionHidden("resonance") && (
            <SettingsSection id="resonance" title={tt("sec.resonance")} style={secOrder("resonance", true)}>
          <p className="text-[11px] text-panel-muted">
            Spotify / YouTube Music now-playing. Eklenti uygulamanın içinde, üstteki
            <b className="text-white/80"> Müzik</b> sekmesinde çalışır.
          </p>
          <button
            type="button"
            className="w-full rounded-md bg-panel-accent px-2 py-2 text-sm text-black"
            onClick={() => {
              setModul("canli");
              setActiveNav("music");
            }}
          >
            Müzik sekmesini aç
          </button>
          <CopyUrl
            url={resonanceOverlayUrl}
            onCopied={() => showToast("Kopyalandı")}
            onOpened={(u, s) => showToast(s === "opened" ? "Önizleme tarayıcıda açıldı" : s === "copied" ? "Tarayıcı açılamadı — adres kopyalandı" : "Önizleme açılamadı: " + u)}
          />
          <p className="text-[11px] text-panel-muted">
            Ayrı OBS kaynağı isterseniz yukarıdaki adresi kullan. Gerekmez — “Şimdi Çalıyor”
            widget’ı zaten Giriş/Mola/Çıkış ekranlarında.
          </p>
            </SettingsSection>
          )}

          {!sectionHidden("obsWs") && (
            <SettingsSection id="obsWs" title={tt("sec.obsWs")} style={secOrder("obsWs", true)}>
          <p className="text-xs text-panel-muted">
            {obsConnected
              ? "Bağlı — sahneler / hotkey’ler hazır"
              : "Bağlı değil — Dashboard → OBS WebSocket"}
          </p>

          <Select
            label="Sayaç bitince / dönüş sahnesi (oyun) — giriş sayacı"
            value={settings.obs?.sceneOnEnd || ""}
            options={scenes}
            onChange={(v) => update({ obs: { ...(settings.obs || {}), sceneOnEnd: v } })}
          />
          {!scenes.length && (
            <p className="text-[11px] text-panel-muted">Sahne listesi için Dashboard’dan OBS’e bağlan (veya sahne adını elle yaz)</p>
          )}
          <Field
            label="Oyun / dönüş sahne adı (elle)"
            value={settings.obs?.sceneOnEnd || settings.obs?.sceneMap?.game || ""}
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  sceneOnEnd: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), game: v },
                },
              })
            }
          />
          <Select
            label="BRB sahnesi (molaya geçince)"
            value={settings.obs?.brbScene || settings.obs?.sceneMap?.brb || ""}
            options={scenes}
            onChange={(v) =>
              update({
                obs: {
                  ...(settings.obs || {}),
                  brbScene: v,
                  sceneMap: { ...(settings.obs?.sceneMap || {}), brb: v },
                },
              })
            }
          />
          <Select
            label="Geçiş"
            value={settings.obs?.transition || ""}
            options={transitions}
            onChange={(v) => update({ obs: { ...(settings.obs || {}), transition: v } })}
          />
          <Field
            label="Geçiş ms"
            value={String(settings.obs?.transitionMs ?? 300)}
            onChange={(v) => update({ obs: { ...(settings.obs || {}), transitionMs: Number(v) || 300 } })}
            type="number"
          />
          <Select
            label="Mikrofon"
            value={settings.obs?.micInput || ""}
            options={inputs.map((i) => i.name)}
            onChange={(v) => update({ obs: { ...(settings.obs || {}), micInput: v, muteMicOnBrb: true } })}
          />
          <div className="mt-3 rounded-lg bg-white/[0.04] p-3 text-xs">
            <p className="text-panel-muted">
              Sahne, ses, kaynak görünürlüğü ve OBS kısayolları artık kendi sekmesinde.
            </p>
            <button
              type="button"
              className="mt-2 w-full rounded-md bg-panel-accent px-3 py-2 text-sm font-medium text-[#08131c]"
              onClick={() => {
                setModul("hazirlik");
                setActiveNav("hotkeys");
              }}
            >
              Kısayollar sekmesini aç
            </button>
          </div>
            </SettingsSection>
          )}

          {!sectionHidden("sosyal") && (
            <SettingsSection id="sosyal" title={tt("sec.sosyal")} style={secOrder("sosyal", true)}>
              <div className="space-y-2">
                {Object.keys(SOCIAL_META).map((key) => {
                  const isEnabled = !!settings.socials?.[key]?.enabled;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2.5 rounded-xl border p-2 transition-all ${
                        isEnabled
                          ? "border-panel-accent/40 bg-panel-accent/[0.05]"
                          : "border-white/[0.06] bg-black/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) =>
                          update({
                            socials: {
                              ...DEFAULT_SOCIALS,
                              ...settings.socials,
                              [key]: {
                                ...settings.socials?.[key],
                                enabled: e.target.checked,
                                handle: settings.socials?.[key]?.handle || "",
                              },
                            },
                          })
                        }
                        className="size-3.5 rounded border-white/20 text-panel-accent focus:ring-panel-accent/40"
                      />
                      <span className="w-16 truncate font-mono text-[11px] font-bold uppercase tracking-wider text-panel-muted">
                        {key}
                      </span>
                      <input
                        className="h-7 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 text-xs text-white placeholder:text-panel-muted outline-none transition-colors focus:border-panel-accent/60"
                        value={settings.socials?.[key]?.handle || ""}
                        placeholder="kullanıcı"
                        onChange={(e) =>
                          update({
                            socials: {
                              ...DEFAULT_SOCIALS,
                              ...settings.socials,
                              [key]: {
                                enabled: true,
                                handle: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </SettingsSection>
          )}
        </EdgePanel>
      </div>
      )}
      </div>

      {/* StreamAxT sesli komut dinleyicisi: sekmeden bağımsız, arka planda */}
      <SesliDinleyiciCercevesi />

      {toast && (
        <div className="fixed bottom-10 right-4 z-50 max-w-sm">
          <Toast key={toast}>{toast}</Toast>
        </div>
      )}
      <AppAlertModal />
      </div>
    </div>
    <DurumCubugu port={durumPort} />
    </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/85">{label}</label>
      <input
        type={type}
        className="yya-input h-9 w-full rounded-xl border border-white/[0.12] bg-black/50 px-3 text-sm font-medium text-white outline-none transition-all duration-150 focus:border-panel-accent/70 focus:ring-1 focus:ring-panel-accent/40"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/85">{label}</label>
      <select
        className="h-9 w-full rounded-xl border border-white/[0.12] bg-[#12151e] px-3 text-sm font-medium text-white outline-none transition-all duration-150 focus:border-panel-accent/70 focus:ring-1 focus:ring-panel-accent/40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
