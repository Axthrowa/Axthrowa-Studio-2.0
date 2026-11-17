/**
 * Ayarlar (UI-6): solda bölüm listesi, sağda tek bölüm. Her bölüm 1366×768'de kaydırmasız sığar.
 * Komut paleti (Ctrl+K) ayarı bulunca bölüm sekmesini açar (ayarDizini.json'daki `t`).
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Guncelleme, YedekPaneli } from "./GuncellemeYedek";
import { PaketPaylasimi } from "./PaketPaylasimi";
import { BaglantiKorumasiKarti } from "./BaglantiKorumasiKarti";
import { YayinTakvimiKarti } from "./YayinTakvimiKarti";
import { CanliAltyaziKarti } from "./CanliAltyaziKarti";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Download, FolderOpen, Info, Play, Upload } from "lucide-react";
import { useI18n } from "../../i18n";
import type { MsgKey } from "../../i18n/messages";
import type { AppPrefs, AppTheme, Hareket, Kose, MenuYazi, Yogunluk } from "../../lib/appPrefs";
import { API_BASE, fetchSettings, patchSettings, okJson } from "../../lib/api";
import { Switch } from "../axthrowa/switch";
import { LisansFormu } from "../axthrowa/LisansEkrani";
import PrivacySettings from "../axthrowa/PrivacySettings";
import DiscordKarti from "../axthrowa/DiscordKarti";
import YardimSayfasi from "./YardimSayfasi";
import { SETTINGS_SECTIONS, visibleOrdered, type PanelLayout, type SettingsSectionId } from "../../lib/panelLayout";
import { useStudioTheme, type StudioSkin } from "../../lib/theme/ThemeContext";
import { cn } from "../../lib/cn";
import { Button, SegmentedControl, TabPanel, Tabs } from "../ui";
import { axbotBase } from "../../lib/axbot";

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
const MENU_YAZI_OPTS: { id: MenuYazi; labelKey: MsgKey }[] = [
  { id: "kucuk", labelKey: "settings.menuYazi.kucuk" },
  { id: "normal", labelKey: "settings.menuYazi.normal" },
  { id: "buyuk", labelKey: "settings.menuYazi.buyuk" },
  { id: "cokBuyuk", labelKey: "settings.menuYazi.cokBuyuk" },
];
const HAREKET_OPTS: { id: Hareket; labelKey: MsgKey }[] = [
  { id: "acik", labelKey: "settings.motion.acik" },
  { id: "azaltilmis", labelKey: "settings.motion.azaltilmis" },
  { id: "kapali", labelKey: "settings.motion.kapali" },
  { id: "sistem", labelKey: "settings.motion.sistem" },
];

/** Bölüm içindeki başlıklı blok; başlık h3 (komut paleti ayar adını buradan bulur) */
function Blok({ baslik, aciklama, children, className }: { baslik: string; aciklama?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2", className)}>
      <div>
        <h3 className="text-ui-3 font-semibold text-ui-fg">{baslik}</h3>
        {aciklama ? <p className="mt-0.5 text-ui-2 text-ui-fg2">{aciklama}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Etiketli seçenek grubu (tek seçim): ortak bölümlü denetim */
function SecimGrubu<T extends string>({ baslik, secenekler, deger, onSec, t }: {
  baslik: string;
  secenekler: { id: T; labelKey: MsgKey }[];
  deger: T;
  onSec: (id: T) => void;
  t: (k: MsgKey) => string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-ui-2 font-semibold text-ui-fg2">{baslik}</p>
      <SegmentedControl label={baslik} options={secenekler.map((o) => ({ id: o.id, label: t(o.labelKey) }))} value={deger} onValueChange={onSec} />
    </div>
  );
}

/** 15 görünüm stili: her kart stilin zemini, yüzeyi ve vurgusuyla küçük bir önizleme */
function StilIzgarasi() {
  const { skin, setSkin, skins } = useStudioTheme();
  return (
    <div className="grid grid-cols-3 gap-1.5 xl:grid-cols-5">
      {skins.map((s) => {
        const on = skin === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            title={s.hint}
            onClick={() => setSkin(s.id as StudioSkin)}
            className={cn(
              "overflow-hidden rounded-ui-2 border text-left transition-colors duration-ui",
              on ? "border-ui-accent ring-1 ring-ui-accent" : "border-ui-line hover:border-ui-line2"
            )}
          >
            {/* Önizleme: zemin, bir menü çubuğu, bir kart ve vurgu renginde düğme */}
            <span aria-hidden className="flex h-12 gap-1 p-1.5" style={{ background: s.swatch[0] }}>
              <span className="w-2.5 rounded-sm opacity-60" style={{ background: s.swatch[1] }} />
              <span className="flex flex-1 flex-col justify-between rounded-sm border border-white/10 bg-white/[0.06] p-1">
                <span className="h-1 w-3/4 rounded-full bg-white/40" />
                <span className="h-2 w-6 self-end rounded-sm" style={{ background: s.swatch[1] }} />
              </span>
            </span>
            <span className="flex items-center gap-1 bg-ui-s2 px-1.5 py-1">
              <span className="min-w-0 flex-1 truncate text-ui-2 font-semibold text-ui-fg">{s.label}</span>
              {on ? <span className="text-ui-2 font-bold text-ui-accent">Aktif</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function AppSettingsPage({ prefs, onPrefs, version = "1.0.0", layout }: Props) {
  const { t, locale, setLocale } = useI18n();
  const { skin } = useStudioTheme();
  const [tab, setTab] = useState<SettingsSectionId>("gorunum");
  const [msg, setMsg] = useState("");
  // Rust okur (pencere simge durumuna inince): bu yüzden tarayıcı tercihinde değil, panel ayarında
  const [tepsiyeKucult, setTepsiyeKucult] = useState(false);
  useEffect(() => {
    if (isTauri()) void fetchSettings("panel").then((s) => setTepsiyeKucult(s.tepsiyeKucult === true)).catch(() => {});
  }, []);

  const set = (patch: Partial<AppPrefs>) => onPrefs({ ...prefs, ...patch });

  const visibleTabs = useMemo(() => {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    const kayitli = layout?.sections.settings;
    // UI-6 öncesi kayıtlı sıra (general/help/about) yeni bölümleri sona iterdi: o durumda varsayılan sıra
    const oh = kayitli?.order.includes("gorunum") ? kayitli : { order: ids, hidden: kayitli?.hidden ?? [] };
    return visibleOrdered(oh, ids) as SettingsSectionId[];
  }, [layout]);

  const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0] || "gorunum";

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
      const file = await open({ multiple: false, filters: [{ name: "OBS", extensions: ["exe"] }] });
      if (typeof file === "string" && file) set({ obsExePath: file });
    } catch {
      /* */
    }
  };

  const yedekAl = async () => {
    try {
      const { buildBackup, downloadBackupJson } = await import("../../lib/panelBackup");
      downloadBackupJson(await buildBackup());
      setMsg(t("backup.ok"));
    } catch {
      setMsg(t("backup.fail"));
    }
  };

  const yedekYukle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const { applyBackup } = await import("../../lib/panelBackup");
      await applyBackup(data);
      setMsg(t("backup.restored"));
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      setMsg(t("backup.fail"));
    }
  };

  const ileti = msg ? <p className="text-ui-2 font-semibold text-ui-accent">{msg}</p> : null;

  const bolumler: Record<SettingsSectionId, ReactNode> = {
    gorunum: (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Blok baslik="Görünüm stili" aciklama={skin === "gun-isigi" ? t("settings.skinLightHint") : undefined}>
          <StilIzgarasi />
        </Blok>
        <div className="space-y-4">
          <Blok baslik={t("settings.theme")}>
            <SegmentedControl
              label={t("settings.theme")}
              options={THEME_OPTS.map((o) => ({ id: o.id, label: t(o.labelKey) }))}
              value={prefs.theme}
              onValueChange={(theme) => set({ theme })}
            />
          </Blok>
          <Blok baslik={t("settings.language")}>
            <SegmentedControl
              label={t("settings.language")}
              options={[
                { id: "tr" as const, label: t("settings.lang.tr" as MsgKey) },
                { id: "en" as const, label: t("settings.lang.en" as MsgKey) },
              ]}
              value={locale === "en" ? "en" : "tr"}
              onValueChange={(id) => {
                setLocale(id);
                set({ locale: id });
              }}
            />
          </Blok>
          <Blok baslik={t("settings.ui")} aciklama={t("settings.motionHint")}>
            <SecimGrubu baslik={t("settings.density")} secenekler={YOGUNLUK_OPTS} deger={prefs.yogunluk} onSec={(yogunluk) => set({ yogunluk })} t={t} />
            <SecimGrubu baslik={t("settings.corners")} secenekler={KOSE_OPTS} deger={prefs.kose} onSec={(kose) => set({ kose })} t={t} />
            <SecimGrubu baslik={t("settings.menuYazi")} secenekler={MENU_YAZI_OPTS} deger={prefs.menuYazi} onSec={(menuYazi) => set({ menuYazi })} t={t} />
            <SecimGrubu baslik={t("settings.motion")} secenekler={HAREKET_OPTS} deger={prefs.hareket} onSec={(hareket) => set({ hareket })} t={t} />
          </Blok>
        </div>
      </div>
    ),
    obs: (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 text-ui-3 font-semibold text-ui-fg">
            <input
              type="checkbox"
              checked={prefs.openObsOnLaunch}
              onChange={(e) => set({ openObsOnLaunch: e.target.checked })}
              className="size-4 rounded border-ui-line2 text-ui-accent"
            />
            <span>{t("settings.openObs")}</span>
          </label>
          <Blok baslik={t("settings.obsPath")}>
            <div className="flex gap-2">
              <input
                className="dt-input min-w-0 flex-1"
                value={prefs.obsExePath || ""}
                placeholder="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
                aria-label={t("settings.obsPath")}
                onChange={(e) => set({ obsExePath: e.target.value || null })}
              />
              <Button variant="secondary" onClick={() => void browseObs()}>
                <FolderOpen aria-hidden />
                {t("settings.obsBrowse")}
              </Button>
            </div>
          </Blok>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => void launchObs()}>
              <Play aria-hidden />
              {t("settings.obsLaunchNow")}
            </Button>
            {ileti}
          </div>
        </div>
        <BaglantiKorumasiKarti />
      </div>
    ),
    yedek: (
      <div className="grid gap-5 lg:grid-cols-2">
        <Blok baslik={t("backup.title")} aciklama={t("backup.hint")}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void yedekAl()}>
              <Download aria-hidden />
              {t("backup.export")}
            </Button>
            <label className="axt-dugme axt-dugme-ikincil cursor-pointer">
              <Upload className="size-3.5" />
              {t("backup.import")}
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void yedekYukle(f);
                }}
              />
            </label>
            {ileti}
          </div>
        </Blok>
        <YedekPaneli />
      </div>
    ),
    guncelleme: (
      <div className="grid gap-5 lg:grid-cols-2">
        <Guncelleme />
        {isTauri() ? (
          <Blok baslik="Premium lisans" aciklama="Anahtar bu bilgisayarda Windows Kimlik Bilgisi Yöneticisi'nde saklanır; doğrulama çevrimdışıdır.">
            <LisansFormu />
            <DiscordKarti />
          </Blok>
        ) : null}
      </div>
    ),
    paylasim: (
      <div className="grid gap-5 lg:grid-cols-2">
        <PaketPaylasimi />
        <YayinTakvimiKarti />
      </div>
    ),
    altyazi: <CanliAltyaziKarti />,
    gizlilik: <PrivacySettings />,
    gelismis: (
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          {isTauri() ? (
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className="text-ui-3 font-semibold text-ui-fg">{t("settings.trayOnMinimize")}</p>
                <p className="mt-0.5 text-ui-2 text-ui-fg2">{t("settings.trayOnMinimizeHint")}</p>
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
          <Blok baslik="Yerel sunucu" aciklama="Overlay ve bot bağlantılarının kullandığı adres.">
            <p className="font-mono text-ui-2 text-ui-fg">{API_BASE}</p>
          </Blok>
        </div>
        <DestekPaketi />
      </div>
    ),
    help: <YardimSayfasi />,
    about: <Hakkinda version={version} />,
  };

  return (
    <div className="mx-auto flex max-w-6xl gap-4 p-4 pb-16">
      <Tabs
        label={t("nav.grup.ayarlar")}
        idPrefix="ayar"
        orientation="vertical"
        className="w-44 shrink-0 self-start rounded-ui-2 border border-ui-line py-1"
        value={activeTab}
        onValueChange={(id) => setTab(id)}
        items={visibleTabs.map((id) => {
          const meta = SETTINGS_SECTIONS.find((s) => s.id === id);
          return { id, label: meta ? t(meta.labelKey as MsgKey) : id };
        })}
      />
      <TabPanel key={activeTab} idPrefix="ayar" id={activeTab} className="studio-sayfa-gir min-w-0 flex-1 rounded-ui-2 border border-ui-line bg-ui-s1 p-4">
        {bolumler[activeTab]}
      </TabPanel>
    </div>
  );
}

function Hakkinda({ version }: { version: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4 text-ui-3">
      <div className="flex items-center gap-3.5">
        <span className="flex size-12 items-center justify-center rounded-ui-2 border border-ui-accent/30 bg-ui-accent/15 text-ui-accent">
          <Info className="size-6" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ui-fg">{t("brand.title")}</h2>
          <p className="font-bold text-ui-accent">{t("about.credit")}</p>
          <SurumSatiri />
        </div>
      </div>

      <p className="leading-relaxed text-ui-fg2">
        AxthrowA Studio, yayın ekranlarını, OBS kontrolünü, çoklu sohbeti, müziği ve sohbet botunu tek uygulamada toplayan
        yayıncı stüdyosudur. Her şey bu bilgisayarda çalışır; hesap açman ya da sunucu kiralaman gerekmez.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Stüdyo", "Giriş, Çıkış ve Mola ekranları, OBS kontrolü, kısayollar ve ses paneli"],
          ["AxBoT", "Sohbet komutları, uyarılar, Tek URL widget'ları, çekiliş, anket ve oyunlar"],
          ["Resonance", "Spotify ve YouTube Music için şimdi çalıyor kartı ve şarkı sözleri"],
        ].map(([ad, aciklama]) => (
          <div key={ad} className="rounded-ui-2 border border-ui-line bg-ui-s2 p-3">
            <p className="font-bold text-ui-accent">{ad}</p>
            <p className="mt-1 leading-relaxed text-ui-fg2">{aciklama}</p>
          </div>
        ))}
      </div>

      <p className="text-ui-fg2">
        {t("about.version")}: <span className="font-mono font-bold text-ui-fg">{version}</span>
      </p>

      <div className="space-y-1.5 rounded-ui-2 border border-ui-line bg-ui-s2 p-4">
        <p className="font-bold text-ui-fg">Verilerin</p>
        <p className="leading-relaxed text-ui-fg2">
          Ayarların, medyan ve bağlantı bilgilerin yalnız bu bilgisayarda saklanır. Hata raporları sen açmadıkça gönderilmez.
          Sorun bildirirken Gelişmiş bölümündeki Destek paketini ekleyebilirsin; sırlar dosyaya yazılmadan ayıklanır.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-ui-2">
        <a href="/LICENSE.txt" target="_blank" rel="noreferrer" className="font-bold text-ui-accent underline underline-offset-2">
          Lisans
        </a>
        <a href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer" className="font-bold text-ui-accent underline underline-offset-2">
          Üçüncü taraf bildirimleri
        </a>
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
    <Blok
      baslik="Destek paketi"
      aciklama="Sorun bildirirken ekleyebileceğin tek bir JSON dosyası: sürüm, OBS ve motor durumu, çoklu yayın hedefleri, ön kontrol, ayarlar ve son günlük satırları. Yayın anahtarları, parolalar, token alanları, rtmp yolları ve kullanıcı klasörü dosyaya yazılmadan önce ayıklanır. Dosya hiçbir yere gönderilmez."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          loading={yuk}
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
          Destek paketi oluştur
        </Button>
        {durum && (
          <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(durum.yol)}>
            Yolu kopyala
          </Button>
        )}
      </div>
      {durum && (
        <p className="break-all text-ui-2 text-ui-fg2">
          {durum.yol} · {(durum.boyut / 1024).toFixed(0)} KB · {durum.gizlenen} değer ayıklandı
        </p>
      )}
      {hata && <p className="text-ui-2 text-ui-danger">{hata}</p>}
    </Blok>
  );
}

/** AxthrowA Studio ve gömülü AxBoT sürümü (bot kapalıysa yalnız Studio) */
function SurumSatiri() {
  const [bot, setBot] = useState<string | null>(null);
  useEffect(() => {
    axbotBase()
      .then((b) => fetch(`${b}/health`))
      .then(okJson)
      .then((d) => setBot(typeof d?.surum === "string" ? d.surum : null))
      .catch(() => {});
  }, []);
  return (
    <p className="mt-1 text-ui-2 text-ui-fg2">
      Sürüm <b className="text-ui-fg">v{__STUDIO_SURUM__}</b>
      {bot && (
        <>
          {" "}· AxBoT <b className="text-ui-fg">v{bot}</b>
        </>
      )}
    </p>
  );
}
