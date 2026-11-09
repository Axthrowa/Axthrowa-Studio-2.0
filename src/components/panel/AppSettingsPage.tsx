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
  SlidersHorizontal,
  Upload
} from "lucide-react";
import { useI18n } from "../../i18n";
import type { MsgKey } from "../../i18n/messages";
import type { AppPrefs, AppTheme, Hareket, Kose, Yogunluk } from "../../lib/appPrefs";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { Switch } from "../axthrowa/switch";
import { LisansFormu } from "../axthrowa/LisansEkrani";
import PrivacySettings from "../axthrowa/PrivacySettings";
import DiscordKarti from "../axthrowa/DiscordKarti";
import YardimSayfasi from "./YardimSayfasi";
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

const THEME_OPTS: { id: AppTheme; labelKey: MsgKey }[] = [
  { id: "dark", labelKey: "settings.theme.dark" },
  { id: "light", labelKey: "settings.theme.light" },
  { id: "system", labelKey: "settings.theme.system" },
];

const YOGUNLUK_OPTS: { id: Yogunluk; labelKey: MsgKey }[] = [
  { id: "rahat", labelKey: "settings.density.rahat" },
  { id: "siki", labelKey: "settings.density.siki" },
];
const KOSE_OPTS: { id: Kose; labelKey: MsgKey }[] = [
  { id: "yuvarlak", labelKey: "settings.corners.yuvarlak" },
  { id: "az", labelKey: "settings.corners.az" },
  { id: "keskin", labelKey: "settings.corners.keskin" },
];
const HAREKET_OPTS: { id: Hareket; labelKey: MsgKey }[] = [
  { id: "acik", labelKey: "settings.motion.acik" },
  { id: "azaltilmis", labelKey: "settings.motion.azaltilmis" },
  { id: "kapali", labelKey: "settings.motion.kapali" },
  { id: "sistem", labelKey: "settings.motion.sistem" },
];

const secimDugmesi = (on: boolean) =>
  cn(
    "rounded-xl border px-3.5 py-3 text-xs md:text-sm font-bold transition-all active:scale-95",
    on
      ? "border-panel-accent/60 bg-panel-accent/15 text-panel-accent shadow-glow-sm"
      : "border-white/[0.08] bg-black/30 text-white/75 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
  );

/** Etiketli düğme grubu (tek seçim) */
function SecimGrubu<T extends string>({ baslik, secenekler, deger, onSec, t }: {
  baslik: string;
  secenekler: { id: T; labelKey: MsgKey }[];
  deger: T;
  onSec: (id: T) => void;
  t: (k: MsgKey) => string;
}) {
  return (
    <div role="group" aria-label={baslik} className="space-y-1.5">
      <p className="text-xs font-semibold text-white/80">{baslik}</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${secenekler.length}, minmax(0, 1fr))` }}>
        {secenekler.map((o) => (
          <button key={o.id} type="button" aria-pressed={deger === o.id} onClick={() => onSec(o.id)} className={secimDugmesi(deger === o.id)}>
            {t(o.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div className="mx-auto max-w-6xl space-y-4 overflow-visible p-4 pb-16">
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

      <div key={activeTab} className="yya-sayfa-gir">
      {activeTab === "general" && (
        // Geniş ekranda iki sütun: ayar blokları bölünmez, ayırıcı çizgiler sütunda gereksiz
        <div className="columns-1 gap-8 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid [&>hr]:hidden xl:[&>hr]:hidden">
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
                    aria-pressed={on}
                    onClick={() => set({ theme: opt.id })}
                    className={secimDugmesi(on)}
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
            {skin === "gun-isigi" ? <p className="text-xs text-white/75">{t("settings.skinLightHint")}</p> : null}
            <div className="yya-liste-gir grid gap-2 sm:grid-cols-2">
              {skins.map((s) => {
                const on = skin === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSkin(s.id as StudioSkin)}
                    className={cn(
                      "yya-kalk flex w-full items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition-all duration-150 active:scale-[0.99]",
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

          {/* Arayüz: yoğunluk, köşeler, animasyonlar */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs md:text-sm font-bold uppercase tracking-wider text-white/85">
              <SlidersHorizontal className="size-4 text-panel-accent" />
              <span>{t("settings.ui")}</span>
            </div>
            <SecimGrubu baslik={t("settings.density")} secenekler={YOGUNLUK_OPTS} deger={prefs.yogunluk} onSec={(yogunluk) => set({ yogunluk })} t={t} />
            <SecimGrubu baslik={t("settings.corners")} secenekler={KOSE_OPTS} deger={prefs.kose} onSec={(kose) => set({ kose })} t={t} />
            <SecimGrubu baslik={t("settings.motion")} secenekler={HAREKET_OPTS} deger={prefs.hareket} onSec={(hareket) => set({ hareket })} t={t} />
            <p className="text-xs text-white/75">{t("settings.motionHint")}</p>
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

          <PrivacySettings />

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
                placeholder="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
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
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-700 px-4 py-2.5 text-xs md:text-sm font-bold text-white shadow-glow-sm transition-all hover:bg-emerald-500 active:scale-95"
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
                <DiscordKarti />
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

      {activeTab === "help" && <YardimSayfasi />}

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

          <p className="leading-relaxed text-white/85">
            AxthrowA Studio, yayın ekranlarını, OBS kontrolünü, çoklu sohbeti, müziği ve sohbet botunu tek uygulamada toplayan
            yayıncı stüdyosudur. Her şey bu bilgisayarda çalışır; hesap açman ya da sunucu kiralaman gerekmez.
          </p>

          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Stüdyo", "Giriş, Çıkış ve Mola ekranları, OBS kontrolü, kısayollar ve ses paneli"],
              ["AxBoT", "Sohbet komutları, uyarılar, Tek URL widget'ları, çekiliş, anket ve oyunlar"],
              ["Resonance", "Spotify ve YouTube Music için şimdi çalıyor kartı ve şarkı sözleri"],
            ].map(([ad, aciklama]) => (
              <div key={ad} className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
                <p className="font-bold text-panel-accent">{ad}</p>
                <p className="mt-1 leading-relaxed text-white/75">{aciklama}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="text-xs md:text-sm text-white/80 font-medium">
              {t("about.version")}: <span className="font-mono font-bold text-white">{version}</span>
            </p>
            <p className="text-xs md:text-sm text-white/80 font-medium">
              {t("about.port")}: <span className="font-mono font-bold text-white">{API_BASE}</span>
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/30 p-4">
            <p className="font-bold text-white">Verilerin</p>
            <p className="leading-relaxed text-white/75">
              Ayarların, medyan ve bağlantı bilgilerin yalnız bu bilgisayarda saklanır. Hata raporları sen açmadıkça gönderilmez.
              Sorun bildirirken Genel sekmesindeki Destek paketini ekleyebilirsin; sırlar dosyaya yazılmadan ayıklanır.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <a href="/LICENSE.txt" target="_blank" rel="noreferrer" className="font-bold text-panel-accent underline underline-offset-2">
              Lisans
            </a>
            <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer" className="font-bold text-panel-accent underline underline-offset-2">
              Üçüncü taraf bildirimleri
            </a>
          </div>
        </div>
      )}
      </div>
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

/** AxthrowA Studio ve gömülü AxBoT sürümü (bot kapalıysa yalnız YYA) */
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
          {" "}· AxBoT <b className="text-white">v{bot}</b>
        </>
      )}
    </p>
  );
}
