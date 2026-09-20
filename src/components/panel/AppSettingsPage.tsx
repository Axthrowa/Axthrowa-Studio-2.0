/**
 * Uygulama ayarları — AxthrowA
 */

import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useI18n } from "../../i18n";
import type { MsgKey } from "../../i18n/messages";
import type { AppPrefs, AppTheme } from "../../lib/appPrefs";
import { API_BASE } from "../../lib/api";
import { SETTINGS_SECTIONS, visibleOrdered, type PanelLayout } from "../../lib/panelLayout";
import { useStudioTheme, type StudioSkin } from "../../lib/theme/ThemeContext";
import { cn } from "../../lib/cn";

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
    <div className="mx-auto max-w-2xl space-y-4 overflow-visible p-4 pb-16">
      <div className="flex gap-2 border-b border-panel-border pb-2">
        {visibleTabs.map((id) => {
          const meta = SETTINGS_SECTIONS.find((s) => s.id === id);
          return (
            <button
              key={id}
              type="button"
              className={
                "rounded-md px-3 py-1.5 text-sm " +
                (activeTab === id ? "bg-panel-accent text-white" : "bg-white/5 hover:bg-white/10")
              }
              onClick={() => setTab(id)}
            >
              {meta ? t(meta.labelKey as MsgKey) : id}
            </button>
          );
        })}
      </div>

      {activeTab === "general" && (
        <div className="space-y-5 rounded-lg border border-panel-border bg-black/20 p-4">
          <div className="space-y-2">
            <p className="text-sm text-panel-muted">{t("settings.theme")}</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTS.map((opt) => {
                const on = prefs.theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set({ theme: opt.id })}
                    className={cn(
                      "rounded-lg border px-2 py-2.5 text-sm font-medium transition",
                      on
                        ? "border-panel-accent bg-panel-accent/20 text-white"
                        : "border-panel-border bg-black/30 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-panel-muted">Görünüm stili</p>
            <div className="space-y-1.5">
              {skins.map((s) => {
                const on = skin === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSkin(s.id as StudioSkin)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                      on
                        ? "border-panel-accent/60 bg-panel-accent/15"
                        : "border-panel-border bg-black/25 hover:bg-white/[0.06]"
                    )}
                  >
                    <span
                      className="size-9 shrink-0 rounded-lg border border-white/10"
                      style={{
                        background: `linear-gradient(145deg, ${s.swatch[0]} 40%, ${s.swatch[1]})`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-white">
                        {s.label}
                      </span>
                      <span className="block text-[11px] text-white/50">{s.hint}</span>
                    </span>
                    {on ? (
                      <span className="text-[11px] font-semibold text-panel-accent">Aktif</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-panel-muted">{t("settings.language")}</p>
            <div className="grid grid-cols-2 gap-2">
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
                      "rounded-lg border px-2 py-2.5 text-sm font-medium transition",
                      on
                        ? "border-panel-accent bg-panel-accent/20 text-white"
                        : "border-panel-border bg-black/30 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.openObsOnLaunch}
              onChange={(e) => set({ openObsOnLaunch: e.target.checked })}
            />
            {t("settings.openObs")}
          </label>

          <div className="space-y-1 text-sm">
            <span className="text-panel-muted">{t("settings.obsPath")}</span>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-2 py-1.5 text-xs"
                value={prefs.obsExePath || ""}
                placeholder="C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe"
                onChange={(e) => set({ obsExePath: e.target.value || null })}
              />
              <button
                type="button"
                className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs"
                onClick={() => void browseObs()}
              >
                {t("settings.obsBrowse")}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            onClick={() => void launchObs()}
          >
            {t("settings.obsLaunchNow")}
          </button>
          {msg && <p className="text-xs text-panel-muted">{msg}</p>}

          <hr className="border-panel-border/60" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("backup.title")}</h3>
            <p className="text-[11px] text-panel-muted">{t("backup.hint")}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-panel-accent px-3 py-2 text-sm font-medium text-black"
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
                {t("backup.export")}
              </button>
              <label className="cursor-pointer rounded-md bg-white/10 px-3 py-2 text-sm hover:bg-white/15">
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
        </div>
      )}

      {activeTab === "help" && (
        <div className="space-y-3 text-sm">
          {HELP_BLOCKS.map((block) => (
            <section
              key={block.title}
              className="overflow-hidden rounded-lg border border-panel-border bg-black/20"
            >
              {block.img && (
                <img
                  src={block.img}
                  alt={block.imgAlt || ""}
                  className="max-h-48 w-full object-cover object-center"
                  loading="lazy"
                />
              )}
              <div className="p-3">
                <h3 className="mb-1 font-semibold">{t(block.title)}</h3>
                <p className="text-panel-muted leading-relaxed">{t(block.body)}</p>
              </div>
            </section>
          ))}
        </div>
      )}

      {activeTab === "about" && (
        <div className="space-y-2 rounded-lg border border-panel-border bg-black/20 p-4 text-sm">
          <h2 className="text-lg font-semibold">{t("brand.title")}</h2>
          <p className="text-base font-medium text-panel-accent">{t("about.credit")}</p>
          <p className="text-panel-muted">
            {t("about.version")}: {version}
          </p>
          <p className="text-panel-muted">
            {t("about.port")}: {API_BASE}
          </p>
        </div>
      )}
    </div>
  );
}
