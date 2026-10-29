/**
 * Uygulama ayarları — AxthrowA
 */

import { useEffect, useMemo, useState } from "react";
import { Guncelleme, YedekPaneli } from "./GuncellemeYedek";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  Download,
  FolderOpen,
  Info,
  Languages,
  Monitor,
  Palette,
  Play,
  Upload
} from "lucide-react";
import { useI18n } from "../../i18n";
import type { MsgKey } from "../../i18n/messages";
import type { AppPrefs, AppTheme } from "../../lib/appPrefs";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { Switch } from "../axthrowa/switch";
import { LisansFormu } from "../axthrowa/LisansEkrani";
import { HataRaporuAnahtari } from "../axthrowa/HataRaporuAnahtari";
import { SETTINGS_SECTIONS, visibleOrdered, type PanelLayout } from "../../lib/panelLayout";
import { useStudioTheme, type StudioSkin } from "../../lib/theme/ThemeContext";
import { cn } from "../../lib/cn";
import { streamaxtBase } from "../../lib/streamaxt";

type Tab = "general" | "help" | "about";

type Props = {
  prefs: AppPrefs;
  onPrefs: (p: AppPrefs) => void;
  version?: string;
  layout?: PanelLayout;
};

const HELP_BLOCKS: {
  title: MsgKey;
  body: MsgKey;
  img?: string;
  imgAlt?: string;
}[] = [
  { title: "help.howto", body: "help.howto.body" },
  {
    title: "help.browser",
    body: "help.browser.body",
    img: "/help/help-obs-browser.png",
    imgAlt: "OBS Browser Source",
  },
  { title: "help.ws", body: "help.ws.body" },
  {
    title: "help.chat",
    body: "help.chat.body",
    img: "/help/help-chat-connect.png",
    imgAlt: "Chat",
  },
  {
    title: "help.sfx",
    body: "help.sfx.body",
    img: "/help/help-soundboard.png",
    imgAlt: "Soundboard",
  },
  { title: "help.hotkeys", body: "help.hotkeys.body" },
  { title: "help.music", body: "help.music.body" },
  { title: "help.tips", body: "help.tips.body" },
];

const THEME_OPTS: { id: AppTheme; labelKey: MsgKey }[] = [
  { id: "dark", labelKey: "settings.theme.dark" },
  { id: "light", labelKey: "settings.theme.light" },
  { id: "system", labelKey: "settings.theme.system" },
];

export default function AppSettingsPage({
  prefs,
  onPrefs,
  version = "1.0.0",
  layout,
}: Props) {
  const { t, locale, setLocale } = useI18n();
  const { skin, setSkin, skins } = useStudioTheme();
  const [tab, setTab] = useState<Tab>("general");
  const [msg, setMsg] = useState("");
  // Rust okur (pencere simge durumuna inince): bu yüzden tarayıcı tercihinde değil, panel ayarında
  const [tepsiyeKucult, setTepsiyeKucult] = useState(false);
  useEffect(() => {
    if (isTauri()) void fetchSettings("panel").then((s) => setTepsiyeKucult(s.tepsiyeKucult === true)).catch(() => {});
  }, []);

  const set = (patch: Partial<AppPrefs>) => onPrefs({ ...prefs, ...patch });

  const visibleTabs = useMemo(() => {
    const oh = layout?.sections.settings || {
      order: SETTINGS_SECTIONS.map((s) => s.id),
      hidden: [],
    };
    return visibleOrdered(
      oh,
      SETTINGS_SECTIONS.map((s) => s.id)
    ) as Tab[];
  }, [layout]);

  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0] || "general";

  const launchObs = async () => {
    try {
      if (!isTauri()) {
        setMsg(t("settings.obsLaunchFail"));
        return;
      }
      const res = await invoke<string>("launch_obs", { path: prefs.obsExePath || null });
      setMsg(res === "already" ? t("settings.obsAlready") : t("settings.obsLaunchOk"));
    } catch {
      setMsg(t("settings.obsLaunchFail"));
    }
  };

  const browseObs = async () => {
    try {
      const file = await open({
        multiple: false,
        filters: [{ name: "OBS", extensions: ["exe"] }],
      });
      if (typeof file === "string" && file) set({ obsExePath: file });
    } catch {
      /* */
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 overflow-visible p-4 pb-20 md:p-6">
      {/* Segmented Tab Bar */}
      <div className="flex gap-1.5 rounded-2xl border border-white/[0.07] bg-black/40 p-1.5 shadow-inner">
        {visibleTabs.map((id) => {
          const meta = SETTINGS_SECTIONS.find((s) => s.id === id);
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              className={cn(
                "flex-1 rounded-xl px-4 py-2.5 text-xs md:text-sm font-bold tracking-wide transition-all duration-150",
                isActive
                  ? "border border-panel-accent/40 bg-panel-accent/90 text-[#08131c] shadow-glow-sm"
                  : "text-white/70 hover:bg-white/[0.05] hover:text-white"
              )}
              onClick={() => setTab(id)}
            >
              {meta ? t(meta.labelKey as MsgKey) : id}
            </button>
          );
        })}
      </div>

      {activeTab === "general" && (
        <div className="space-y-6 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-6 shadow-glass">
          {/* Theme Option */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-wider text-white/85">
              <Palette className="size-4 text-panel-accent" />
              <span>{t("settings.theme")}</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {THEME_OPTS.map((opt) => {
                const on = prefs.theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set({ theme: opt.id })}
                    className={cn(
                      "rounded-xl border px-3.5 py-3 text-xs md:text-sm font-bold transition-all active:scale-95",
                      on
                        ? "border-panel-accent/60 bg-panel-accent/15 text-panel-accent shadow-glow-sm"
                        : "border-white/[0.08] bg-black/30 text-white/75 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin Selection */}
          <div className="space-y-2.5">
            <p className="text-xs md:text-sm font-bold uppercase tracking-wider text-white/85">Görünüm stili</p>
            <div className="space-y-2.5">
              {skins.map((s) => {
                const on = skin === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSkin(s.id as StudioSkin)}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-150 active:scale-[0.99]",
                      on
                        ? "border-panel-accent/60 bg-panel-accent/[0.12] shadow-glow-sm"
                        : "border-white/[0.07] bg-black/30 hover:border-white/[0.12] hover:bg-black/50"
                    )}
                  >
                    <span
                      className="size-10 shrink-0 rounded-xl border border-white/20 shadow-sm"
                      style={{
                        background: `linear-gradient(145deg, ${s.swatch[0]} 40%, ${s.swatch[1]})`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">
                        {s.label}
                      </span>
                      <span className="block text-xs font-medium text-white/75">{s.hint}</span>
                    </span>
                    {on ? (
                      <span className="rounded-lg border border-panel-accent/30 bg-panel-accent/20 px-2.5 py-1 text-xs font-bold text-panel-accent">
                        Aktif
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-wider text-white/85">
              <Languages className="size-4 text-panel-accent" />
              <span>{t("settings.language")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: "tr" as const, labelKey: "settings.lang.tr" as MsgKey },
                  { id: "en" as const, labelKey: "settings.lang.en" as MsgKey },
                ] as const
              ).map((opt) => {
                const on = locale === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLocale(opt.id);
                      set({ locale: opt.id });
                    }}
                    className={cn(
                      "rounded-xl border px-3.5 py-3 text-xs md:text-sm font-bold transition-all active:scale-95",
                      on
                        ? "border-panel-accent/60 bg-panel-accent/15 text-panel-accent shadow-glow-sm"
                        : "border-white/[0.08] bg-black/30 text-white/75 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* OBS Auto-launch switch */}
          <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-white">
              <input
                type="checkbox"
                checked={prefs.openObsOnLaunch}
                onChange={(e) => set({ openObsOnLaunch: e.target.checked })}
                className="size-4.5 rounded border-white/20 text-panel-accent focus:ring-panel-accent/40"
              />
              <span>{t("settings.openObs")}</span>
            </label>
          </div>

          {isTauri() ? (
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-bold text-white/85">{t("settings.trayOnMinimize")}</p>
                <p className="mt-1 text-xs text-white/60">{t("settings.trayOnMinimizeHint")}</p>
              </div>
              <Switch
                checked={tepsiyeKucult}
                aria-label={t("settings.trayOnMinimize")}
                onCheckedChange={(v) => {
                  setTepsiyeKucult(v);
                  void patchSettings("panel", { tepsiyeKucult: v }).catch(() => setTepsiyeKucult(!v));
                }}
              />
            </div>
          ) : null}

          <HataRaporuAnahtari />

          {/* OBS Path */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-wider text-white/85">
              <Monitor className="size-4 text-panel-accent" />
              <span>{t("settings.obsPath")}</span>
            </div>
            <div className="flex gap-2.5">
              <input
                className="min-w-0 flex-1 rounded-xl border border-white/[0.09] bg-black/40 px-3.5 py-2.5 text-xs md:text-sm font-medium text-white placeholder:text-panel-muted outline-none focus:border-panel-accent/60"
                value={prefs.obsExePath || ""}
                placeholder="C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe"
                onChange={(e) => set({ obsExePath: e.target.value || null })}
              />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-xs md:text-sm font-bold text-white hover:bg-white/[0.1] transition-all active:scale-95"
                onClick={() => void browseObs()}
              >
                <FolderOpen className="size-4" />
                {t("settings.obsBrowse")}
              </button>
            </div>
          </div>

          {/* Launch OBS Action */}
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/90 px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-glow-sm transition-all hover:bg-emerald-500 active:scale-95"
              onClick={() => void launchObs()}
            >
              <Play className="size-4 fill-current" />
              {t("settings.obsLaunchNow")}
            </button>
            {msg && <p className="text-xs md:text-sm font-semibold text-panel-accent">{msg}</p>}
          </div>

          <hr className="border-white/[0.08]" />

          {/* Backup & Restore */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {t("backup.title")}
              </h3>
              <p className="mt-1 text-xs font-medium text-white/75">{t("backup.hint")}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-panel-accent/40 bg-panel-accent/90 px-4 py-2.5 text-xs md:text-sm font-bold text-[#08131c] shadow-glow-sm transition-all hover:bg-panel-accent active:scale-95"
                onClick={async () => {
                  try {
                    const { buildBackup, downloadBackupJson } = await import("../../lib/panelBackup");
                    const b = await buildBackup();
                    downloadBackupJson(b);
                    setMsg(t("backup.ok"));
                  } catch {
                    setMsg(t("backup.fail"));
                  }
                }}
              >
                <Download className="size-4" />
                {t("backup.export")}
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-xs md:text-sm font-bold text-white hover:bg-white/[0.1] transition-all active:scale-95">
                <Upload className="size-4" />
                {t("backup.import")}
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      const { applyBackup } = await import("../../lib/panelBackup");
                      await applyBackup(data);
                      setMsg(t("backup.restored"));
                      window.setTimeout(() => window.location.reload(), 600);
                    } catch {
                      setMsg(t("backup.fail"));
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {isTauri() ? (
            <>
              <hr className="border-white/[0.08]" />
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">Premium lisans</h3>
                  <p className="mt-1 text-xs font-medium text-white/75">
                    Anahtar bu bilgisayarda Windows Kimlik Bilgisi Yöneticisi'nde saklanır; doğrulama çevrimdışıdır.
                  </p>
                </div>
                <LisansFormu />
              </div>
            </>
          ) : null}
          <hr className="border-white/[0.08]" />
          <Guncelleme />
          <hr className="border-white/[0.08]" />
          <YedekPaneli />
          <hr className="border-white/[0.08]" />
          <DestekPaketi />
        </div>
      )}

      {activeTab === "help" && (
        <div className="space-y-4 text-xs md:text-sm">
          {HELP_BLOCKS.map((block) => (
            <section
              key={block.title}
              className="overflow-hidden rounded-2xl border border-white/[0.07] bg-panel-card/60 shadow-glass"
            >
              {block.img && (
                <img
                  src={block.img}
                  alt={block.imgAlt || ""}
                  className="max-h-52 w-full object-cover object-center border-b border-white/[0.06]"
                  loading="lazy"
                />
              )}
              <div className="p-5 space-y-2">
                <h3 className="font-display text-base font-bold text-white">{t(block.title)}</h3>
                <p className="text-xs md:text-sm text-white/80 leading-relaxed">{t(block.body)}</p>
              </div>
            </section>
          ))}
        </div>
      )}

      {activeTab === "about" && (
        <div className="space-y-4 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-6 text-xs md:text-sm shadow-glass">
          <div className="flex items-center gap-3.5">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-panel-accent/30 bg-panel-accent/15 text-panel-accent shadow-glow-sm">
              <Info className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">{t("brand.title")}</h2>
              <p className="text-base font-bold text-panel-accent">{t("about.credit")}</p>
              <SurumSatiri />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="text-xs md:text-sm text-white/80 font-medium">
              {t("about.version")}: <span className="font-mono font-bold text-white">{version}</span>
            </p>
            <p className="text-xs md:text-sm text-white/80 font-medium">
              {t("about.port")}: <span className="font-mono font-bold text-white">{API_BASE}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Destek paketi (§93): sırları ayıklanmış tanılama dosyası. Dosya yalnız bu bilgisayara yazılır; paylaşmak kullanıcının kararı. */
function DestekPaketi() {
  const [durum, setDurum] = useState<{ yol: string; boyut: number; gizlenen: number } | null>(null);
  const [hata, setHata] = useState("");
  const [yuk, setYuk] = useState(false);
  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-white">Destek paketi</h3>
        <p className="mt-1 text-xs font-medium text-white/75">
          Sorun bildirirken ekleyebileceğin tek bir JSON dosyası: sürüm, OBS ve motor durumu, çoklu yayın hedefleri, ön kontrol,
          ayarlar ve son günlük satırları. Yayın anahtarları, parolalar, token alanları, rtmp yolları ve kullanıcı klasörü
          dosyaya yazılmadan önce ayıklanır. Dosya hiçbir yere gönderilmez.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="dt-btn"
          disabled={yuk}
          onClick={async () => {
            setYuk(true);
            setHata("");
            try {
              const { supportApi } = await import("../../lib/api/actions");
              const r = await supportApi.create();
              setDurum({ yol: r.yol, boyut: r.boyut, gizlenen: r.gizlenen });
            } catch (e) {
              setHata(String((e as Error).message || e).slice(0, 200));
            } finally {
              setYuk(false);
            }
          }}
        >
          {yuk ? "Hazırlanıyor…" : "Destek paketi oluştur"}
        </button>
        {durum && (
          <button type="button" className="dt-btn" onClick={() => void navigator.clipboard?.writeText(durum.yol)}>
            Yolu kopyala
          </button>
        )}
      </div>
      {durum && (
        <p className="break-all text-xs text-white/80">
          {durum.yol} · {(durum.boyut / 1024).toFixed(0)} KB · {durum.gizlenen} değer ayıklandı
        </p>
      )}
      {hata && <p className="text-xs text-red-300">{hata}</p>}
    </div>
  );
}

/** Yayın Yönetim Aracı ve gömülü StreamAxT sürümü (bot kapalıysa yalnız YYA) */
function SurumSatiri() {
  const [bot, setBot] = useState<string | null>(null);
  useEffect(() => {
    streamaxtBase()
      .then((b) => fetch(`${b}/health`))
      .then((r) => r.json())
      .then((d) => setBot(typeof d?.surum === "string" ? d.surum : null))
      .catch(() => {});
  }, []);
  return (
    <p className="mt-1 text-xs text-panel-muted">
      Sürüm <b className="text-white">v{__YYA_SURUM__}</b>
      {bot && (
        <>
          {" "}· StreamAxT <b className="text-white">v{bot}</b>
        </>
      )}
    </p>
  );
}
