import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Save, Search } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  API_BASE,
  fetchSettings,
  patchSettings,
  OverlaySettings,
  ScreenId,
} from "../../lib/api";
import { copyText } from "../../lib/clipboard";
import { DEFAULT_SOCIALS } from "../../lib/socials";
import MusicBridge from "../../components/panel/MusicBridge";
import LayoutEditor from "../../components/panel/LayoutEditor";
import NavTabBar from "../../components/panel/NavTabBar";
import KomutPaleti, { PALET_AC_OLAYI } from "../../components/panel/KomutPaleti";
import { BildirimMerkezi, BildirimYigini, Kbd } from "@/components/ui";
import { EKRANLAR, OVERLAY_PENCERESI, menuGrubuBul } from "../../lib/anaMenu";
import { kurulumGerekli } from "../../lib/kurulum";
import type { Kip } from "../../lib/canliYerlesim";
import PencereBasligi from "@/components/axthrowa/PencereBasligi";
import SesliDinleyiciCercevesi from "../../components/panel/SesliDinleyiciCercevesi";
import HazirlikListesi from "../../components/panel/HazirlikListesi";
import ProfileSwitcher from "../../components/panel/ProfileSwitcher";
import { ReklamSayaci } from "../../components/control/ReklamSayaci";
import PanelTimer from "../../components/panel/PanelTimer";
import CloseRequestModal from "../../components/panel/CloseRequestModal";
import DashboardUstSerit, { useDashboardBolumu } from "../../components/panel/DashboardUstSerit";
import { runObsAction, type ActionRow } from "../../lib/obsActions";
import { resonanceLinkAllowed } from "../../lib/embedMessages";
// Kontrol Merkezi yalnız o sekme açılınca yüklenir (ana paketi büyütmesin)
const MusicPanel = lazy(() => import("../../components/panel/MusicPanel"));
const BotEkrani = lazy(() => import("../../components/panel/BotEkrani"));
const KurulumSihirbazi = lazy(() => import("../../components/panel/KurulumSihirbazi"));
const AppSettingsPage = lazy(() => import("../../components/panel/AppSettingsPage"));
const CihazEslestirme = lazy(() => import("../../components/panel/CihazEslestirme"));
const YayinBilgisiDock = lazy(() => import("../../components/control/YayinBilgisiDock").then((m) => ({ default: m.YayinBilgisiDock })));
const SoundBoardPanel = lazy(() => import("../../components/panel/SoundBoardPanel"));
const AxBotHost = lazy(() => import("../../components/panel/AxBotHost"));
const ProfileDashboard = lazy(() => import("../../components/panel/ProfileDashboard"));
const ConnectionsHub = lazy(() => import("../../components/panel/ConnectionsHub"));
const ObsControlHub = lazy(() => import("../../components/studio/ObsControlHub"));
const HotkeysPage = lazy(() => import("../../components/panel/HotkeysPage"));
const CanliEkrani = lazy(() => import("../../components/control/CanliEkrani"));
const ObsStudioPanel = lazy(() => import("../../components/panel/ObsStudioPanel"));
import { HataSiniri } from "../../components/ui/HataSiniri";
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
  loadPanelLayout,
  savePanelLayout,
  type NavId,
  type PanelLayout,
} from "../../lib/panelLayout";
import {
  loadSoundboard,
  type SoundPad,
} from "../../lib/soundboard";
import {
  isObsConnected,
} from "../../lib/obs";
import { useObs } from "../../lib/obs/ObsContext";
import { type SceneRole } from "../../lib/sceneSuggest";
import { clearNotice, pushNotice, useNotices } from "../../lib/notices";
import { yayinSagligiIzle } from "../../lib/yayinSagligi";
import { getStreamHealth } from "../../lib/obs";
import UpdateModal from "@/components/axthrowa/UpdateModal";
import KarsilamaEkrani from "@/components/axthrowa/LisansEkrani";
import { useAxthrowaStore, useAxthrowaStoreKoprusu } from "../../store/useAxthrowaStore";
import {
  creditsSessionCounts,
} from "../../lib/creditsSession"; import { usePanelGezinme } from "./usePanelGezinme"; import { usePanelDuzeni } from "./usePanelDuzeni"; import { usePanelKisayollari } from "./usePanelKisayollari"; import { usePanelYayin } from "./usePanelYayin"; import { usePanelDosyalar } from "./usePanelDosyalar"; import { usePanelObs } from "./usePanelObs"; import { usePanelMedya } from "./usePanelMedya"; import { usePanelKayit } from "./usePanelKayit"; import { usePanelIzleme } from "./usePanelIzleme";

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
export const PART_KEYS = Object.keys(PART_LABELS_TR);

/** Müzik paylaşımında kopyalanan alanlar ve hedef ekranlar */
export const MUSIC_KEYS = ["bgAudioPath", "audioLoop", "musicSound", "musicVolume", "musicShared"];
export const MUSIC_SHARE_SCREENS: ScreenId[] = ["starting", "ending", "brb"];

/** OBS bağlantısı + sahne/ses kısayolları tüm sekmelerde aynı olsun */
export const OBS_SHARE_SCREENS: ScreenId[] = ["starting", "ending", "brb", "chat"];

/** Sayı alanlarını güvenli aralığa sıkıştırır — boş/NaN girişte varsayılana döner. */

export const ROL_AD: Record<SceneRole, string> = { starting: "Giriş", ending: "Çıkış", brb: "Mola", game: "Oyun" };

const SahneAyarlari = lazy(() => import("../../components/panel/SahneAyarlari"));
const MiniKip = lazy(() => import("../../components/control/MiniKip").then((m) => ({ default: m.MiniKip })));

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
  // Canlı ekranının kipi: "Yayın sonrası → Rapor" bu kipi ister, menü de seçimini buna göre gösterir
  const [canliKip, setCanliKip] = useState<Kip | null>(null);
  const [kipIstegi, setKipIstegi] = useState<{ kip: Kip | null; n: number } | null>(null);
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
  // İlk kurulum bitene kadar Hazırlık'ın başında "Kurulum" satırı; temiz veride sihirbaz kendiliğinden açılır (U1)
  const [kurulumGoster, setKurulumGoster] = useState(false);
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
  const yayinBilgisiTab = activeNav === "yayinBilgisi";
  const cihazlarTab = activeNav === "cihazlar";
  const settingsTab = activeNav === "settings";
  const sayfaDali = activeNav === "kurulum" ? "kurulum" : profileTab ? "profile" : controlTab ? "control" : yayinTab ? "yayin" : musicTab ? "music" : botTab ? "bot" : chatTab ? "chat" : soundsTab ? "sounds" : hotkeysTab ? "hotkeys" : yayinBilgisiTab ? "yayinBilgisi" : cihazlarTab ? "cihazlar" : settingsTab ? "settings" : "sahne";

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
      .then((s) => {
        setSfxStopHk(String(s.sfxStopHotkey || ""));
        if (kurulumGerekli(s)) {
          setKurulumGoster(true);
          setActiveNav("kurulum");
        }
      })
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
  const { mini, miniyeGec, scheduleOverlayRefresh, showToast } = usePanelIzleme({ obsCtxConnected, overlayRefreshTimers, server, setCreditCounts, setObsConnected, settingsRef });
  const { mirrorMusic, persistNow, reload, update } = usePanelKayit({ hotkeyCaptureRef, obsSharedRef, saveTimer, screen, setActiveNav, setSettings, settings, settingsRef, showToast, tt });
  const { hiddenParts, indirme, indirmeMetni, indirmeSuruyor, obsUrl, refreshBackgrounds, refreshLogos, refreshMusic, refreshParticles, refreshVideos, restoreAllParts, restorePart } = usePanelMedya({ screen, server, setBgFiles, setLogoFiles, setMusicFiles, setParticleFiles, setVideoFiles, settings, showToast, update });
  const { refreshObsLists } = usePanelObs({ liveOn, mirrorMusic, obsConnect, persistNow, refreshBackgrounds, refreshLogos, refreshMusic, refreshParticles, refreshVideos, reload, scenesCountRef, scheduleOverlayRefresh, screen, setInputs, setObsConnected, setScenes, setServer, setTransitions, settingsRef, showToast, update });
  const { fetchKickChatroom, goScene, pickBackground, pickLocalVideo, pickLogo } = usePanelDosyalar({ endingStopDoneRef, forceNavRef, obsConnect, obsConnected, refreshBackgrounds, refreshLogos, refreshVideos, setActiveNav, setObsConnected, setScreen, settingsRef, showToast, startingSwitchDoneRef, streamWatchArmedRef, update });
  const { handlePreviewCountdownEnd, runMasterStream } = usePanelYayin({ endingStopDoneRef, forceNavRef, liveOn, masterBusy, obsConnect, scheduleOverlayRefresh, screen, setActiveNav, setCreditCounts, setKipIstegi, setLayout, setLiveOn, setMasterBusy, setObsConnected, setScreen, settingsRef, showToast, startingSwitchDoneRef, streamWatchArmedRef });
  const { clearChatNow, globalHotkeys, hotkeyError, hotkeyFailures, runActionHotkey } = usePanelKisayollari({ clearChatHk, goScene, hotkeyCapture, hotkeyCaptureRef, settings, settingsRef, sfxPads, sfxStopHk, showToast, tt });

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
  const { secOrder, sectionHidden, visibleTabs } = usePanelDuzeni({ activeNav, forceNavRef, kurulumGoster, layout, screen, setActiveNav, setScreen });

  const sayfaMeta = DEFAULT_TABS.find((tab) => tab.id === activeNav);
  const botGrubu = botTab ? menuGrubuBul("bot", botSekme) : null;
  const sahneSekmesi = activeNav === "starting" || activeNav === "ending" || activeNav === "brb";
  const sayfaAdi =
    botGrubu === "etkilesim"
      ? tt("nav.grup.etkilesim")
      : botGrubu === "sahne"
        ? tt("nav.overlaylar")
        : botGrubu === "hazirlik"
          ? tt("nav.baglantilar")
          : sahneSekmesi
            ? tt("nav.ekranlar")
            : activeNav === "kurulum"
              ? tt("nav.kurulum")
              : activeNav === "control" && canliKip === "sonrasi"
              ? tt("nav.grup.sonrasi")
              : (sayfaMeta?.labelKey && tt(sayfaMeta.labelKey as MsgKey)) || sayfaMeta?.label || String(activeNav);
  const { sayfaAc, sayfaAdiBul } = usePanelGezinme({ activeNav, botSekme, canliKip, endingStopDoneRef, forceNavRef, prefs, setActiveNav, setBotSekme, setKipIstegi, setScreen, startingSwitchDoneRef, streamWatchArmedRef });

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

  if (mini) {
    return (
      <Suspense fallback={null}>
        <MiniKip onCik={() => miniyeGec(false)} onToast={showToast} />
      </Suspense>
    );
  }

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
        kip={activeNav === "control" ? canliKip : null}
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
            // Ekranlar: Giriş, Mola, Çıkış iç sekme (eskiden üç ayrı menü satırıydı)
            <div role="tablist" aria-label={tt("nav.ekranlar")} className="flex shrink-0 gap-0.5 rounded-ui-2 bg-black/20 p-0.5">
              {EKRANLAR.filter((e) => visibleTabs.includes(e.id)).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={activeNav === e.id}
                  onClick={() => sayfaAc({ nav: e.id })}
                  className={`h-7 rounded-ui-1 px-3 text-xs font-semibold transition-colors ${activeNav === e.id ? "bg-white/10 text-white" : "text-panel-muted hover:text-white"}`}
                >
                  {tt(e.adAnahtari)}
                </button>
              ))}
            </div>
          ) : null}
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
          <ReklamSayaci />
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
                (liveOn ? "bg-[var(--dt-live)] text-white" : "bg-[var(--dt-ok)] text-ui-bg")
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
      <HataSiniri ad={String(sayfaAdi || "Sayfa")}>
      <Suspense fallback={<div className="flex-1 p-6 text-sm text-panel-muted">Yükleniyor…</div>}>
      {activeNav === "kurulum" ? (
        <Suspense fallback={<div className="flex-1 p-6 text-sm text-panel-muted">Yükleniyor…</div>}>
          <KurulumSihirbazi
            onToast={showToast}
            onBitti={() => {
              setKurulumGoster(false);
              setActiveNav("control");
            }}
          />
        </Suspense>
      ) : profileTab ? (
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
          <DashboardUstSerit bolum={dashBolum} onBolum={setDashBolum} />
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
            <HazirlikListesi
              onToast={showToast}
              onCanli={() => sayfaAc({ nav: "control" })}
              onGit={(h) => {
                if (h === "obs") setDashBolum("baglantilar");
                else if (h === "platformlar") sayfaAc({ nav: "bot", botSayfa: "platforms" });
                else if (h === "bot") sayfaAc({ nav: "bot" });
                else if (h === "sahneler") sayfaAc({ nav: "starting" });
                else sayfaAc({ nav: "bot", botSayfa: "overlays" });
              }}
            />
          )}
          {/* Sekme değişse de bağlı kalır: sadakat sayacı, metrikler ve oturum kapatma sürer */}
          <ProfileDashboard
            onToast={showToast}
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
            kipIstegi={kipIstegi}
            onKip={setCanliKip}
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
      ) : yayinBilgisiTab ? (
        // A2b: başlık, kategori, etiketler ve şablonlar; Canlı ekranındaki bölmenin aynısı
        <div className="custom-scrollbar mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto p-4">
          <YayinBilgisiDock onToast={showToast} />
        </div>
      ) : cihazlarTab ? (
        // Y6: eşleşmiş telefonlar, izinler, iptal ve yerel ağ erişimi
        <div className="custom-scrollbar mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto p-4">
          <CihazEslestirme onToast={showToast} />
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
      </HataSiniri>
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


