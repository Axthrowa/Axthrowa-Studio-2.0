import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Save, Search } from "lucide-react";
import { MotionConfig } from "framer-motion";
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
import { DEFAULT_SOCIALS } from "../../lib/socials";
import MusicBridge from "../../components/panel/MusicBridge";
import LayoutEditor from "../../components/panel/LayoutEditor";
import NavTabBar from "../../components/panel/NavTabBar";
import KomutPaleti, { PALET_AC_OLAYI } from "../../components/panel/KomutPaleti";
import { BildirimMerkezi, BildirimYigini, Kbd } from "@/components/ui";
import { OVERLAY_PENCERESI, menuGrubuBul, type MenuSayfasi } from "../../lib/anaMenu";
import PencereBasligi from "@/components/axthrowa/PencereBasligi";
import SesliDinleyiciCercevesi from "../../components/panel/SesliDinleyiciCercevesi";
import StreamHealthCard from "../../components/panel/StreamHealthCard";
import ProfileSwitcher from "../../components/panel/ProfileSwitcher";
import PanelTimer from "../../components/panel/PanelTimer";
import CloseRequestModal from "../../components/panel/CloseRequestModal";
import DashboardUstSerit, { useDashboardBolumu } from "../../components/panel/DashboardUstSerit";
import { runObsAction, type ActionRow } from "../../lib/obsActions";
import { resonanceLinkAllowed } from "../../lib/embedMessages";
// Kontrol Merkezi yalnız o sekme açılınca yüklenir (ana paketi büyütmesin)
const MusicPanel = lazy(() => import("../../components/panel/MusicPanel"));
const BotSessions = lazy(() => import("../../components/panel/BotSessions"));
const BotEkrani = lazy(() => import("../../components/panel/BotEkrani"));
const AppSettingsPage = lazy(() => import("../../components/panel/AppSettingsPage"));
const SoundBoardPanel = lazy(() => import("../../components/panel/SoundBoardPanel"));
const AxBotHost = lazy(() => import("../../components/panel/AxBotHost"));
const ProfileDashboard = lazy(() => import("../../components/panel/ProfileDashboard"));
const ConnectionsHub = lazy(() => import("../../components/panel/ConnectionsHub"));
const ObsControlHub = lazy(() => import("../../components/studio/ObsControlHub"));
const HotkeysPage = lazy(() => import("../../components/panel/HotkeysPage"));
const CanliEkrani = lazy(() => import("../../components/control/CanliEkrani"));
const ObsStudioPanel = lazy(() => import("../../components/panel/ObsStudioPanel"));
import { en, tr, type MsgKey } from "../../i18n/messages";
import {
  applyArayuzToDom,
  applyThemeToDom,
  loadAppPrefs,
  resolveHareket,
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
  resolveEndingScene,
  resolveStartingScene,
  runEndingEndAction,
  runStartingEndAction,
  seedStartingCountdown,
} from "../../lib/streamAutomation";
import { ruleStopStream } from "../../lib/endRules";
import { obsControl } from "../../lib/obsControl";
import { clearPlatformChats, clearResultToast, temizlenebilirPlatformlar } from "../../lib/clearPlatformChats";
import { endSession, fetchDashboard, startSession } from "../../lib/api/botApi";
import { loadObsSaved, saveObsSaved } from "../../lib/obsPersist";
import { pickObsConnection, sameObsConnection } from "../../lib/obsConnection";
import { suggestSceneMap, type SceneRole } from "../../lib/sceneSuggest";
import { getBotConfig, saveBotConfig } from "../../lib/sohbetBot";
import { notifyDiscordLive } from "../../lib/sohbetBot/platformActions";
import { useCreditsCollector } from "../../lib/useCreditsCollector";
import { useGlobalHotkeys, eventToSpec, canonicalizeHotkeySpec } from "../../lib/globalHotkeys";
import { useVideoDownload } from "../../lib/useVideoDownload";
import { clearNotice, pushNotice, useNotices } from "../../lib/notices";
import { yayinSagligiIzle } from "../../lib/yayinSagligi";
import { getStreamHealth } from "../../lib/obs";
import { bildir } from "../../lib/bildirimler";
import UpdateModal from "@/components/axthrowa/UpdateModal";
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

const ROL_AD: Record<SceneRole, string> = { starting: "Giriş", ending: "Çıkış", brb: "Mola", game: "Oyun" };

const SahneAyarlari = lazy(() => import("../../components/panel/SahneAyarlari"));

export default function PanelPage() {
  const { connect: obsConnect, connected: obsCtxConnected } = useObs();
  // Yayın sağlığı uyarıları: hangi sekme açık olursa olsun (pencere arkadayken de) izlenir
  useEffect(
    () =>
      yayinSagligiIzle(
        async () => (isObsConnected() ? getStreamHealth() : null),
        (u) => ("temizle" in u ? clearNotice(u.id) : pushNotice({ id: u.id, level: u.seviye, text: u.metin, hint: u.ipucu })),
        () => localStorage.getItem("studio.saglikSesi") !== "0"
      ),
    []
  );
  const [screen, setScreen] = useState<ScreenId>("starting");
  // Müzik / Ayarlar ekran ayarlarından bağımsız; ScreenId şemasını kirletmez.
  const [activeNav, setActiveNav] = useState<NavId | ScreenId>("control");
  // Bot sekmesinde açılacak AxBoT sayfası (Dashboard'daki "Bot'ta yönet" platformlar sayfasını açar)
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
  const kisayolYakalaniyor = useCallback(() => hotkeyCaptureRef.current, []);
  hotkeyCaptureRef.current = hotkeyCapture;
  const [settings, setSettings] = useState<OverlaySettings>({ socials: DEFAULT_SOCIALS });
  const musicTab = activeNav === "music";
  const controlTab = activeNav === "control";
  const yayinTab = activeNav === "yayin";
  const botTab = activeNav === "bot";
  const chatTab = activeNav === "chat";
  // Canlı Chat sekmesi AxBoT'un Multi-Chat'ini gösterir; panelin kendi
  // sohbet KATMANI ayarlarına (OBS overlay tasarımı) bu bayrakla dönülür.
  const [chatOverlaySettings, setChatOverlaySettings] = useState(false);
  const profileTab = activeNav === "profile" || activeNav === "obs";
  const soundsTab = activeNav === "sounds";
  const hotkeysTab = activeNav === "hotkeys";
  const settingsTab = activeNav === "settings";
  const sayfaDali = profileTab ? "profile" : controlTab ? "control" : yayinTab ? "yayin" : musicTab ? "music" : botTab ? "bot" : chatTab ? "chat" : soundsTab ? "sounds" : hotkeysTab ? "hotkeys" : settingsTab ? "settings" : "sahne";

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
    applyArayuzToDom(prefs);
    saveAppPrefs(prefs);
  }, [prefs]);

  // "Sistem" seçiliyken işletim sistemi tercihi değişirse hemen uygula
  const [, sistemHareketDegisti] = useState(0);
  useEffect(() => {
    if (prefs.hareket !== "sistem") return;
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const degisti = () => {
      applyArayuzToDom(prefs);
      sistemHareketDegisti((n) => n + 1);
    };
    mq.addEventListener("change", degisti);
    return () => mq.removeEventListener("change", degisti);
  }, [prefs]);
  const hareket = resolveHareket(prefs.hareket);

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
  const [obsConnected, setObsConnected] = useState(false);
  const [dashBolum, setDashBolum] = useDashboardBolumu();
  const [masterBusy, setMasterBusy] = useState(false);
  const [menuGizli, setMenuGizli] = useState(() => {
    try {
      return localStorage.getItem("studio.panel.menuGizli") === "1";
    } catch {
      return false;
    }
  });
  const menuGizle = () =>
    setMenuGizli((g) => {
      try {
        localStorage.setItem("studio.panel.menuGizli", g ? "0" : "1");
      } catch {
        /* saklanamadı: bu oturumda yine geçerli */
      }
      return !g;
    });
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

  // Eski tek satırlık bildirimler ortak bildirim standardına gider (A5): tür metinden anlaşılır
  const showToast = useCallback((m: string) => void bildir(m), []);

  useChatCommandBridge({ onToast: showToast });

  useEffect(
    () => () => {
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
      let sunucuOkundu = false;
      try {
        panelObs = ((await fetchSettings("panel")).obs as Record<string, unknown>) || null;
        sunucuOkundu = true;
      } catch {
        /* sunucu yanıt vermezse yerel yedek kullanılır */
      }
      const cfg = pickObsConnection({
        panel: panelObs,
        saved: loadObsSaved(),
        slice: settingsRef.current.obs,
      });
      // Sunucu kapalıyken yazılmaz: eski yedekteki şifre kasaya taşınmadan silinmesin
      if (sunucuOkundu) saveObsSaved(cfg);
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
    // Bitiş anı OBS'teki Giriş ekranına da gider: sayaç her yayında baştan (ör. 5:00) başlar
    const bitis = seedStartingCountdown(holdMin);
    void patchSettings("starting", { countdownEndsAt: bitis }).catch(() => {});

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
    setActiveNav("ending");
    setScreen("ending");
    try {
      await obsControl.stopStreamSequence(resolveEndingScene(settingsRef.current.obs || {}));
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
      // Kısayolda soru sorulmaz: bağlı tüm platformlar temizlenir
      const r = await clearPlatformChats((await temizlenebilirPlatformlar()).filter((p) => p.bagli).map((p) => p.id));
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
          await obsControl.stopStreamSequence(resolveEndingScene(settingsRef.current.obs || {}));
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

  // Açık sayfa menüde gizlendiyse ilk görünen sayfaya geç
  useEffect(() => {
    if (activeNav === "obs" || visibleTabs.includes(String(activeNav))) return;
    const next = visibleTabs[0];
    if (!next) return;
    setActiveNav(next as NavId);
    if (next === "starting" || next === "ending" || next === "brb" || next === "chat") setScreen(next);
  }, [activeNav, visibleTabs]);

  useEffect(() => {
    if (activeNav === "obs") {
      setActiveNav("profile");
    }
  }, [activeNav]);

  useEffect(() => {
    if (forceNavRef.current && visibleTabs.includes(forceNavRef.current)) {
      forceNavRef.current = null;
    }
  }, [visibleTabs]);

  const sayfaMeta = DEFAULT_TABS.find((tab) => tab.id === activeNav);
  const botGrubu = botTab ? menuGrubuBul("bot", botSekme) : null;
  const sayfaAdi =
    botGrubu === "etkilesim"
      ? tt("nav.grup.etkilesim")
      : botGrubu === "sahne"
        ? tt("nav.overlaylar")
        : (sayfaMeta?.labelKey && tt(sayfaMeta.labelKey as MsgKey)) || sayfaMeta?.label || String(activeNav);
  const sahneSekmesi = activeNav === "starting" || activeNav === "ending" || activeNav === "brb";

  const sayfaAdiBul = useCallback(
    (s: MenuSayfasi) => {
      const meta = DEFAULT_TABS.find((t) => t.id === s.nav);
      const key = (s.adAnahtari || meta?.labelKey || "") as MsgKey;
      const table = prefs.locale === "en" ? en : tr;
      return (key && table[key]) || meta?.label || s.nav;
    },
    [prefs.locale]
  );

  const sayfaAc = useCallback(({ nav: id, botSayfa }: MenuSayfasi) => {
    setActiveNav(id);
    setBotSekme(botSayfa);
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
  }, []);

  // Aynı bileşenler kendi sayfasında ve Canlı ekranına eklenen panelde çizilir
  const muzikPaneli = (
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
  );
  const sesPaneli = (
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
  );
  const kisayolPaneli = (
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
  );
  const sahneOrtak = { PART_LABELS, bgFiles, clearChatHk, clearChatNow, creditCounts, fetchKickChatroom, handlePreviewCountdownEnd, hiddenParts, indirme, indirmeMetni, indirmeSuruyor, inputs, logoFiles, musicFiles, notices, obsConnected, obsUrl, openExternal, panelsPinned, particleFiles, particleKeys, pickBackground, pickLocalVideo, pickLogo, previewOn, refreshBackgrounds, refreshLogos, refreshMusic, refreshParticles, refreshVideos, resonanceOverlayUrl, restoreAllParts, restorePart, scenes, screen, secOrder, sectionHidden, setActiveNav, setClearChatHk, setCreditCounts, setHotkeyCapture, setPanelsPinned, setParticleFiles, setPreviewOn, settings, showToast, transitions, tt, update, videoFiles };
  const yerelPanel = (id: string): React.ReactNode => {
    const kaydirmali = (icerik: React.ReactNode) => <div className="custom-scrollbar h-full overflow-y-auto">{icerik}</div>;
    if (id === "ek:muzik") return kaydirmali(muzikPaneli);
    if (id === "ek:ses") return kaydirmali(sesPaneli);
    if (id === "ek:kisayol") return kaydirmali(kisayolPaneli);
    if (id === "ek:obs") return kaydirmali(<ObsStudioPanel onToast={showToast} />);
    const ekran = { "ek:giris": "starting", "ek:cikis": "ending", "ek:mola": "brb" }[id];
    if (ekran) return kaydirmali(<SahneAyarlari {...sahneOrtak} screen={ekran as typeof screen} />);
    return null;
  };

  return (
    <MotionConfig reducedMotion={hareket === "acik" ? "never" : "always"}>
      <CloseRequestModal />
    {/* Özel pencere başlığı (masaüstünde) + altında panel; panel kalan yüksekliği doldurur */}
    <div className="flex h-screen w-full flex-col overflow-hidden bg-axthrowa-dark">
    {/* Üst şerit (pencere başlığı + durum): arayüz yenilemesinden; altındaki ekranlar 1.6.13 */}
    <PencereBasligi title={tt("brand.title")}>
      {/* Sol menüyü daralt/genişlet: yalnız simgeler kalır, içeriğe yer açar; tercih bu bilgisayarda saklanır */}
      <button
        type="button"
        aria-pressed={menuGizli}
        aria-label={tt(menuGizli ? "menu.goster" : "menu.gizle")}
        title={tt(menuGizli ? "menu.goster" : "menu.gizle")}
        onClick={menuGizle}
        className="flex h-6 w-7 shrink-0 items-center justify-center rounded-ui-2 text-ui-fg2 transition-colors duration-ui hover:bg-ui-s2 hover:text-ui-fg"
      >
        {menuGizli ? <PanelLeftOpen aria-hidden className="h-4 w-4" /> : <PanelLeftClose aria-hidden className="h-4 w-4" />}
      </button>
      {/* Üst şeritte yalnız marka ve arama: ortada geniş arama düğmesi komut paletini açar */}
      <button
        type="button"
        aria-label={tt("palet.baslik")}
        onClick={() => window.dispatchEvent(new Event(PALET_AC_OLAYI))}
        className="mx-auto flex h-6 w-full max-w-[420px] items-center gap-2 rounded-ui-2 border border-ui-line bg-ui-s1 px-2.5 text-xs text-ui-fg2 transition-colors duration-ui hover:bg-ui-s2 hover:text-ui-fg"
      >
        <Search aria-hidden className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{tt("palet.baslik")}</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <BildirimMerkezi />
    </PencereBasligi>
    <KomutPaleti visibleTabs={visibleTabs} labelFor={sayfaAdiBul} onSayfa={sayfaAc} onToast={showToast} kapali={kisayolYakalaniyor} />
    <UpdateModal />
    <KarsilamaEkrani />
    <div className="panel-shell flex !min-h-0 w-full flex-1 flex-row overflow-hidden bg-panel-bg text-white">
      <MusicBridge />
      <NavTabBar
        dar={menuGizli}
        visibleTabs={visibleTabs}
        activeNav={String(activeNav)}
        botSayfa={botSekme}
        customizeLabel={tt("nav.customize")}
        editLayout={editLayout}
        onToggleEdit={() => setEditLayout((v) => !v)}
        labelFor={sayfaAdiBul}
        onSelect={sayfaAc}
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
          {/* Canlı ekranının düğmesi kendi üst şeridinde */}
          {chatTab || musicTab || soundsTab ? (
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

      {/* Sayfa geçişi: yalnız gösterilen dal değişince yeniden takılır; aynı daldaki sekmeler (Giriş/Çıkış/Mola) durumunu korur */}
      <div key={sayfaDali} className="studio-sayfa-gir flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="flex-1 p-6 text-sm text-panel-muted">Yükleniyor…</div>}>
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
              onBotPlatformlar={() => {
                setBotSekme("platforms");
                setActiveNav("bot");
              }}
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
          <CanliEkrani
            onToast={showToast}
            canli={liveOn}
            mesgul={masterBusy}
            onYayin={() => void runMasterStream()}
            yerelPanel={yerelPanel}
            onBot={(sayfa) => {
              setBotSekme(sayfa);
              setActiveNav("bot");
            }}
            onObsBagla={() => {
              setDashBolum("baglantilar");
              setActiveNav("profile");
            }}
          />
        </Suspense>
      ) : yayinTab ? (
        <Suspense fallback={<div className="flex-1 p-6 text-sm text-panel-muted">Yükleniyor…</div>}>
          <ObsStudioPanel onToast={showToast} />
        </Suspense>
      ) : musicTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {muzikPaneli}
        </div>
      ) : botTab ? (
        botGrubu === "bot" ? (
          <BotEkrani sayfa={botSekme} onSayfa={setBotSekme} onToast={showToast} onOpenMusic={() => setActiveNav("music")} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {botGrubu === "sahne" ? (
              <div role="tablist" aria-label={tt("nav.overlaylar")} className="flex shrink-0 gap-1 border-b border-white/10 px-3 py-2">
                {OVERLAY_PENCERESI.map((s) => {
                  const acik = (botSekme || "overlays") === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={acik}
                      className={`h-9 whitespace-nowrap rounded-md px-3.5 text-sm font-semibold transition-colors ${acik ? "bg-white/10 text-white" : "text-panel-muted hover:text-white"}`}
                      onClick={() => setBotSekme(s.id)}
                    >
                      {s.ad}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <AxBotHost onToast={showToast} tab={botSekme || "overlays"} embed onOpenMusic={() => setActiveNav("music")} />
          </div>
        )
      ) : chatTab && !chatOverlaySettings ? (
        // Canlı Chat = AxBoT'un Multi-Chat'i (çapraz sohbet, izleyici kartları).
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
          <AxBotHost onToast={showToast} tab="multichat" embed onOpenMusic={() => {
            setActiveNav("music");
          }} />
        </div>
      ) : soundsTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        {sesPaneli}
        </div>
      ) : hotkeysTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {kisayolPaneli}
        </div>
      ) : settingsTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <AppSettingsPage
          prefs={prefs}
          onPrefs={setPrefs}
          version={__STUDIO_SURUM__}
          layout={layout}
        />
        </div>
      ) : (
        <SahneAyarlari {...sahneOrtak} />
      )}
      </Suspense>
      </div>

      {/* AxBoT sesli komut dinleyicisi: sekmeden bağımsız, arka planda */}
      <SesliDinleyiciCercevesi />

      <BildirimYigini />
      </div>
    </div>
    </div>
    </MotionConfig>
  );
}


