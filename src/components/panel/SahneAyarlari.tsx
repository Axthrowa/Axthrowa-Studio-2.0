import { lazy, type Dispatch, type SetStateAction } from "react";
import type { OverlaySettings, ScreenId } from "../../lib/api";
import type { MsgKey } from "../../i18n/messages";
import type { NavId } from "../../lib/panelLayout";
import { ANIM_OPTIONS, EFFECT_OPTIONS } from "../../lib/textStyles";
import { API_BASE, importLibraryFile } from "../../lib/api";
import CopyUrl from "@/components/axthrowa/CopyUrl";
import { DEFAULT_END_MARGIN } from "../../lib/youtube";
import { DEFAULT_SOCIALS, SOCIAL_META } from "../../lib/socials";
import EdgePanel from "./EdgePanel";
import HotkeyInput from "./HotkeyInput";
import LazyMount from "./LazyMount";
import LivePreview from "./LivePreview";
import PanelTimer from "./PanelTimer";
import { Pin, PinOff } from "lucide-react";
import SettingsSection, { ayarBolumuAc } from "./SettingsSection";
import TextStyleEditor from "./TextStyleEditor";
import { Toast } from "@/components/axthrowa/Toast";
import VideoTrimBar from "./VideoTrimBar";
import { clearCreditsSession, creditsSessionCounts } from "../../lib/creditsSession";
import { clearNotice, type useNotices } from "../../lib/notices";
import { open } from "@tauri-apps/plugin-dialog";
import { type useVideoDownload } from "../../lib/useVideoDownload";

/** Önizlemede tıklanan parça → ayar bölümü ve varsa alanı */
const PARCA_AYARI: Record<string, { bolum: string; alan?: string }> = {
  logo: { bolum: "logo" },
  eyebrow: { bolum: "metin", alan: "eyebrow" },
  title: { bolum: "metin", alan: "title" },
  sub: { bolum: "metin", alan: "sub" },
  ticker: { bolum: "metin", alan: "ticker" },
  countdown: { bolum: "geriSayim" },
  socials: { bolum: "sosyal" },
  credits: { bolum: "jenerik" },
  nowPlaying: { bolum: "resonance" },
  lyrics: { bolum: "resonance" },
};

function Field({
  alan,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  alan?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div data-alan={alan}>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/85">{label}</label>
      <input
        aria-label={label}
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
        aria-label={label}
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

const TemplatePicker = lazy(() => import("../../components/panel/TemplatePicker"));

const VideoScrubber = lazy(() => import("../../components/panel/VideoScrubber"));

function clampInt(raw: string, min: number, max: number, fallback: number) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export type SahneAyarlariProps = {
  PART_LABELS: Record<string, string>;
  bgFiles: string[];
  clearChatHk: string;
  clearChatNow: () => Promise<void>;
  creditCounts: { donors: number; subscribers: number; followers: number; };
  fetchKickChatroom: () => Promise<void>;
  handlePreviewCountdownEnd: (live: OverlaySettings) => Promise<void>;
  hiddenParts: string[];
  indirme: ReturnType<typeof useVideoDownload>;
  indirmeMetni: string;
  indirmeSuruyor: boolean;
  inputs: { name: string; kind: string; }[];
  logoFiles: string[];
  musicFiles: string[];
  notices: ReturnType<typeof useNotices>;
  obsConnected: boolean;
  obsUrl: string;
  openExternal: (url: string) => Promise<void>;
  panelsPinned: boolean;
  particleFiles: string[];
  particleKeys: string[];
  pickBackground: () => Promise<void>;
  pickLocalVideo: () => Promise<void>;
  pickLogo: () => Promise<void>;
  previewOn: boolean;
  refreshBackgrounds: () => void;
  refreshLogos: () => void;
  refreshMusic: () => void;
  refreshParticles: () => void;
  refreshVideos: () => void;
  resonanceOverlayUrl: string;
  restoreAllParts: () => void;
  restorePart: (key: string) => void;
  scenes: string[];
  screen: ScreenId;
  secOrder: (id: string, side?: boolean) => { order: number; };
  sectionHidden: (id: string) => boolean;
  setActiveNav: Dispatch<SetStateAction<NavId | ScreenId>>;
  setClearChatHk: Dispatch<SetStateAction<string>>;
  setCreditCounts: Dispatch<SetStateAction<{ donors: number; subscribers: number; followers: number; }>>;
  setHotkeyCapture: Dispatch<SetStateAction<boolean>>;
  setPanelsPinned: Dispatch<SetStateAction<boolean>>;
  setParticleFiles: Dispatch<SetStateAction<string[]>>;
  setPreviewOn: Dispatch<SetStateAction<boolean>>;
  settings: OverlaySettings;
  showToast: (m: string) => void;
  transitions: string[];
  tt: (key: MsgKey) => string;
  update: (patch: OverlaySettings) => void;
  videoFiles: string[];
};

/** Giriş/Çıkış/Mola/Chat ekranlarının ayar ve önizleme görünümü. */
export default function SahneAyarlari({
  PART_LABELS,
  bgFiles,
  clearChatHk,
  clearChatNow,
  creditCounts,
  fetchKickChatroom,
  handlePreviewCountdownEnd,
  hiddenParts,
  indirme,
  indirmeMetni,
  indirmeSuruyor,
  inputs,
  logoFiles,
  musicFiles,
  notices,
  obsConnected,
  obsUrl,
  openExternal,
  panelsPinned,
  particleFiles,
  particleKeys,
  pickBackground,
  pickLocalVideo,
  pickLogo,
  previewOn,
  refreshBackgrounds,
  refreshLogos,
  refreshMusic,
  refreshParticles,
  refreshVideos,
  resonanceOverlayUrl,
  restoreAllParts,
  restorePart,
  scenes,
  screen,
  secOrder,
  sectionHidden,
  setActiveNav,
  setClearChatHk,
  setCreditCounts,
  setHotkeyCapture,
  setPanelsPinned,
  setParticleFiles,
  setPreviewOn,
  settings,
  showToast,
  transitions,
  tt,
  update,
  videoFiles,
}: SahneAyarlariProps) {
  return (
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
          <Field alan="eyebrow" label={tt("field.eyebrow")} value={settings.eyebrow || ""} onChange={(v) => update({ eyebrow: v })} />
          <Field alan="title" label={tt("field.title")} value={settings.title || ""} onChange={(v) => update({ title: v })} />
          <Field alan="sub" label={tt("field.sub")} value={settings.sub || ""} onChange={(v) => update({ sub: v })} />
          <Field label={tt("field.badge")} value={settings.liveText || ""} onChange={(v) => update({ liveText: v })} />
          <Field alan="ticker" label={tt("field.ticker")} value={settings.ticker || ""} onChange={(v) => update({ ticker: v })} />
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
              aria-label={tt("field.bg")}
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
              <input aria-label="Seviye"
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
              Windows ses karıştırıcısında &quot;AxBoT&quot; adıyla görünür
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
                <select aria-label="YouTube kalite"
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
                <input aria-label="Kart bilgisi okunamazsa sondan atlanacak süre (sn)"
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
              <input aria-label="Seviye"
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
                <input aria-label="Seviye"
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
            <input aria-label="Zoom"
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
            <input aria-label="Kaydır X"
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
            <input aria-label="Kaydır Y"
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
            <select aria-label="Logo efekt"
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
            <select aria-label="Logo animasyon"
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
                aria-label="Logo vurgu rengi"
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
          {(["logo", "eyebrow", "title", "sub", "countdown", "socials", "ticker", "credits", "visualizer", "nowPlaying", "lyrics"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="w-20 text-panel-muted">{PART_LABELS[k] || k}</span>
              <input
                aria-label={PART_LABELS[k] || k}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.lyricsEnabled === true && settings.visible?.lyrics !== false}
              onChange={(e) =>
                update({
                  lyricsEnabled: e.target.checked,
                  visible: { ...(settings.visible || {}), lyrics: true },
                })
              }
            />
            Şarkı sözleri widget’ı
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
            <input aria-label="Yoğunluk"
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
                    <input aria-label="Boyut"
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
                    <input aria-label="Vurgu"
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
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.2 text-[10px] font-mono text-panel-muted">
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
            onPartSelect={(k) => {
              const a = PARCA_AYARI[k];
              if (a && !ayarBolumuAc(a.bolum, a.alan)) showToast(`${PART_LABELS[k] || k} ayarları gizli; Düzen'den gösterebilirsin.`);
            }}
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.lyricsEnabled === true && settings.visible?.lyrics !== false}
          onChange={(e) =>
            update({
              lyricsEnabled: e.target.checked,
              visible: { ...(settings.visible || {}), lyrics: true },
            })
          }
        />
        Bu ekranda şarkı sözlerini göster
      </label>
      <p className="text-[11px] text-panel-muted">
        Söz boyutu, rengi ve zamanlaması Müzik sayfasında (Resonance) ayarlanır.
      </p>
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
                    aria-label={SOCIAL_META[key as keyof typeof SOCIAL_META]?.label || key}
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
  );
}
