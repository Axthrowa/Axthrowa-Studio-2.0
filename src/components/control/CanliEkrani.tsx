/**
 * Canlı ekranı: yayın sırasında gerekenler kaydırmadan tek ekranda. Görüntü, sahneler, ses, hızlı işlemler,
 * sohbet ve olaylar. Çoklu yayın, denetim günlüğü gibi seyrek işler "Gelişmiş masa"da (ControlCenter) kalır.
 *
 * Sık güncellenen parçalar (süre, önizleme, ses ölçeri) kendi bileşenlerinde: her güncellemede ekranın tamamı
 * yeniden çizilmesin.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { nesneMenusu } from "../axthrowa/SagTikMenusu";
import { sahneMenusu } from "./sahneMenusu";
import { Activity, Eye, EyeOff, Gauge, Pin, Plug, Radio, Settings2, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import { PlatformLogo } from "../chat/ChatFeed";
import type { Platform } from "../../lib/chatHub";
import { actionsApi } from "../../lib/api/actions";
import { getStreamHealth, isObsConnected, onObsConnection, type StreamHealth } from "../../lib/obs";
import { isAudioInput, onizlemeBeklemesi, onizlemeGenisligi } from "../../lib/obsAudio";
import { obsControl, type ObsInputInfo, type ObsSceneSnapshot } from "../../lib/obsControl";
import { axbotBase } from "../../lib/axbot";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { bitHiziKbps, ESIK } from "../../lib/yayinSagligi";
import SohbetTemizleDiyalogu from "../panel/SohbetTemizleDiyalogu";
import ControlCenter, { KontrolListesi } from "./ControlCenter";
import UyariKuyrugu from "./UyariKuyrugu";
import { ETIKET, TUS, TUS_TABAN } from "./donanim";
import SesKaristirici from "./SesKaristirici";
import HizliIslemler from "./HizliIslemler";
import YayinDuzeni from "./YayinDuzeni";
import { KIPLER, otomatikKip, type Kip } from "../../lib/canliYerlesim";
import { botSekmesi, ekPanelBul } from "../../lib/canliEkPaneller";
import { YayinBilgisiDock } from "./YayinBilgisiDock";
import { YayinRaporu } from "./YayinRaporu";
import { YayinKarsilastirma } from "./YayinKarsilastirma";
import { ActivityFeedPanel } from "./UniversalChat";
import { BasiliTutDugme } from "../ui/BasiliTut";
import { BaskinYardimcisi } from "./BaskinYardimcisi";
import { twitchBaskinYapabilir } from "../../lib/platformAuth/twitchWrite";
import { panelAyir, paneliGeriAl, useAyrikPaneller, type AyrikId } from "../../lib/ayrikPanel";

/** U9: başlıktaki "Ayır" düğmesi */
function AyirDugmesi({ id }: { id: AyrikId }) {
  return (
    <button
      type="button"
      title="Ayrı pencerede aç"
      className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-[var(--dt-surface-3)] hover:text-white"
      onClick={() => void panelAyir(id)}
    >
      Ayır
    </button>
  );
}

/** Panel ayrı penceredeyken yerinde kalan kutu */
function AyrikYer({ id }: { id: AyrikId }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-sm text-panel-muted">
      Ayrı pencerede açık
      <button type="button" className={`${TUS} px-2 py-1 text-xs`} onClick={() => void paneliGeriAl(id)}>
        Panele geri al
      </button>
    </div>
  );
}

type Props = {
  onToast: (m: string) => void;
  canli: boolean;
  mesgul: boolean;
  onYayin: () => void;
  /** Botta bir sayfa aç (çekiliş, anket) */
  onBot: (sayfa: string) => void;
  /** OBS WebSocket bağlantı ekranına git */
  onObsBagla: () => void;
  /** Uygulamanın kendi sayfaları (Müzik, Ses Paneli…): panele eklenince aynı bileşen çizilir */
  yerelPanel: (id: string) => ReactNode;
  /** Menüden istenen kip ("Yayın sonrası → Rapor"); `null` kendiliğinden kip. `n` her istekte değişir. */
  kipIstegi?: { kip: Kip | null; n: number } | null;
  /** Geçerli kip: menü seçimini buna göre gösterir */
  onKip?: (k: Kip) => void;
};

const AxBotHost = lazy(() => import("../panel/AxBotHost"));

type BotDurumu = {
  canli?: { izleyici?: number; platformlar?: { platform: string; canli?: boolean; izleyici?: number }[] };
  platforms?: Record<string, { connected?: boolean; yazabilir?: boolean }>;
};


function Olcum({ etiket, ikon: Ikon, uyari, children }: { etiket: React.ReactNode; ikon?: LucideIcon; uyari?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-panel-border bg-panel-card px-2 py-1.5">
      <div className={`${ETIKET} flex items-center gap-1.5`}>
        {Ikon ? <Ikon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${uyari ? "text-red-400" : "text-white/55"}`} /> : null}
        {etiket}
      </div>
      <div className={`truncate font-mono text-base tabular-nums ${uyari ? "text-red-400" : "text-white"}`}>{children}</div>
    </div>
  );
}

const LOGOLU: ReadonlySet<string> = new Set<Platform>(["kick", "twitch", "youtube"]);

/** İzleyici: yayında olan her platform kendi logosu ve sayısıyla (çoklu yayında hepsi); bilinmiyorsa toplam */
function Izleyiciler({ bot }: { bot: BotDurumu | null }) {
  const canlilar = (bot?.canli?.platformlar || []).filter((p) => p.canli && LOGOLU.has(p.platform));
  if (!canlilar.length) return <>{bot?.canli?.izleyici ?? "—"}</>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {canlilar.map((p) => (
        <span key={p.platform} className="inline-flex shrink-0 items-center">
          <PlatformLogo platform={p.platform as Platform} />
          {p.izleyici ?? 0}
        </span>
      ))}
    </span>
  );
}

function Durum({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85">
      <span aria-hidden className="dt-nokta" data-durum={ok ? "hazir" : undefined} />
      {children}
      <span className="sr-only">{ok ? " bağlı" : " bağlı değil"}</span>
    </span>
  );
}

/** Uygulama sayfaları bu genişliğe göre tasarlandı; daha dar panelde sayfa bu genişlikte çizilip orantılı küçültülür */
const SAYFA_TABAN_PX = 760;
/** Bundan küçük yazı okunmaz: daha dar kutuda sayfa yatay kaydırılır */
const EN_AZ_ORAN = 0.7;

/**
 * Panele eklenen uygulama sayfası (Giriş ekranı, OBS Stüdyo…) dar kutuda sütunları birbirine girmesin: sayfa
 * taban genişlikte çizilir, CSS `zoom` ile kutuya sığdırılır. Botun sayfaları iframe'de kendi genişliğine uyar, buna gerek duymaz.
 */
function Sigdir({ children }: { children: ReactNode }) {
  const kap = useRef<HTMLDivElement>(null);
  const [olcu, setOlcu] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = kap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setOlcu({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const oran = olcu && olcu.w > 0 && olcu.w < SAYFA_TABAN_PX ? Math.max(EN_AZ_ORAN, olcu.w / SAYFA_TABAN_PX) : 1;
  return (
    <div ref={kap} className="custom-scrollbar h-full min-h-0 w-full overflow-x-auto overflow-y-hidden">
      <div
        className="custom-scrollbar overflow-auto"
        style={oran < 1 && olcu ? { zoom: oran, width: SAYFA_TABAN_PX, height: olcu.h / oran } : { width: "100%", height: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}

/** Saniyede bir güncellenen yayın süresi */
function SureSayaci({ baslangic }: { baslangic: number }) {
  const [simdi, setSimdi] = useState(() => Date.now());
  useEffect(() => {
    const id = setVisibleInterval(() => setSimdi(Date.now()), 1000);
    return () => clearVisibleInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((simdi - baslangic) / 1000));
  const iki = (n: number) => String(n).padStart(2, "0");
  return <span>{`${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`}</span>;
}

/**
 * OBS'in yayındaki sahnesi: bir kare gelince sıradakini ister, en çok ~15 kare/sn. Video akışı değildir; OBS ek bir
 * çıkış olmadan yalnız kare verir. Kare önce çözülür, sonra tuvale çizilir: geçişte titremez.
 */
/** Yoklama aynı veriyi getirdiyse eski nesne kalsın: ekran boşuna yeniden çizilmez */
function ayniysaKoru<T>(yeni: T) {
  return <E,>(eski: E): E | T => (JSON.stringify(eski) === JSON.stringify(yeni) ? eski : yeni);
}

const ONIZLEME_KAPALI_KEY = "studio.canli.onizlemeKapali";
const GENIS_SOHBET_KEY = "studio.canli.genisSohbet";

function kayitliOnizlemeAcik(): boolean {
  try {
    return localStorage.getItem(ONIZLEME_KAPALI_KEY) !== "1";
  } catch {
    return true;
  }
}

function ObsBos({ metin, onBagla }: { metin: string; onBagla: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-panel-muted">{metin}</p>
      <button type="button" className={`${TUS_TABAN} h-8 px-3 text-xs font-bold`} onClick={onBagla}>
        OBS&apos;e bağlan
      </button>
    </div>
  );
}

function ObsOnizleme({ sahne, bagli, onBagla, onProgramaDon }: { sahne: string; bagli: boolean; onBagla: () => void; onProgramaDon?: () => void }) {
  const tuval = useRef<HTMLCanvasElement>(null);
  const [kareVar, setKareVar] = useState(false);
  const [acik, setAcik] = useState(kayitliOnizlemeAcik);
  const degistir = () => {
    const yeni = !acik;
    setAcik(yeni);
    try {
      localStorage.setItem(ONIZLEME_KAPALI_KEY, yeni ? "0" : "1");
    } catch {
      /* tercih saklanamadı: bu oturumda yine geçerli */
    }
  };
  useEffect(() => {
    // Kapalıyken OBS'ten hiç kare istenmez
    if (!sahne || !acik) {
      setKareVar(false);
      return;
    }
    let iptal = false;
    const bekle = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    void (async () => {
      while (!iptal) {
        if (document.hidden) {
          await bekle(500);
          continue;
        }
        const t0 = performance.now();
        try {
          const im = new Image();
          im.src = await obsControl.screenshot(sahne, onizlemeGenisligi(tuval.current?.clientWidth ?? 0, window.devicePixelRatio));
          await im.decode();
          const c = tuval.current;
          if (c && !iptal) {
            if (c.width !== im.naturalWidth || c.height !== im.naturalHeight) {
              c.width = im.naturalWidth;
              c.height = im.naturalHeight;
            }
            c.getContext("2d")?.drawImage(im, 0, 0);
            setKareVar(true);
          }
        } catch {
          /* sahne değişiyor ya da OBS yanıt vermedi: son kare kalır */
        }
        await bekle(onizlemeBeklemesi(performance.now() - t0));
      }
    })();
    return () => {
      iptal = true;
    };
  }, [sahne, acik]);
  if (!acik) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-panel-card px-3 py-2 text-sm text-panel-muted">
        <EyeOff className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Önizleme kapalı{sahne ? ` · ${sahne}` : ""}</span>
        <button type="button" onClick={degistir} className={`${TUS} shrink-0 px-2.5 py-1 text-xs font-medium`}>
          Önizlemeyi aç
        </button>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-black">
      <canvas ref={tuval} role="img" aria-label={`${sahne} sahnesinin önizlemesi`} className="h-full w-full object-contain" />
      {!bagli ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
          <ObsBos metin="Önizleme için OBS bağlı değil." onBagla={onBagla} />
        </div>
      ) : !kareVar ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-panel-muted">
          {sahne ? "Önizleme yükleniyor…" : "OBS bağlanınca önizleme burada görünür"}
        </div>
      ) : null}
      {sahne ? (
        <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-medium text-white ${onProgramaDon ? "bg-amber-600/90" : "bg-black/70"}`}>
          {onProgramaDon ? `Önizleme: ${sahne} (yayında değil)` : sahne}
        </span>
      ) : null}
      {onProgramaDon ? (
        <button type="button" onClick={onProgramaDon} className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white hover:bg-[var(--dt-surface-3)]">
          Yayındaki sahneye dön
        </button>
      ) : null}
      <button
        type="button"
        onClick={degistir}
        title="Önizlemeyi kapat: OBS'ten kare istenmez, daha az kaynak harcanır"
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white transition-all hover:bg-[var(--dt-surface-3)] active:scale-[0.98] motion-reduce:active:scale-100"
      >
        <Eye className="h-3.5 w-3.5" />
        Önizlemeyi kapat
      </button>
    </div>
  );
}

export default function CanliEkrani({ onToast, canli, mesgul, onYayin, onBot, onObsBagla, yerelPanel, kipIstegi, onKip }: Props) {
  const [gelismis, setGelismis] = useState(false);
  const [baskinAcik, setBaskinAcik] = useState(false);
  const [duzenle, setDuzenle] = useState(false);
  // Kip: yayın açılınca "Canlı", kapanınca "Yayın öncesi" kendiliğinden seçilir; elle seçilen o değişime dek korunur
  const [kipSecim, setKipSecim] = useState<Kip | null>(null);
  useEffect(() => setKipSecim(null), [canli]);
  const kip = kipSecim ?? otomatikKip(canli);
  useEffect(() => {
    if (kipIstegi) setKipSecim(kipIstegi.kip);
  }, [kipIstegi]);
  useEffect(() => onKip?.(kip), [kip, onKip]);
  const [genisSohbet, setGenisSohbet] = useState(() => {
    try {
      return localStorage.getItem(GENIS_SOHBET_KEY) === "1";
    } catch {
      return false;
    }
  });
  const genisSohbetSec = (genis: boolean) => {
    setGenisSohbet(genis);
    try {
      localStorage.setItem(GENIS_SOHBET_KEY, genis ? "1" : "0");
    } catch {
      /* saklanamadı: bu oturumda yine geçerli */
    }
  };
  const [sekme, setSekme] = useState<"sohbet" | "olaylar">("sohbet");
  const ayrik = useAyrikPaneller((s) => s.ayrik);
  const [temizleAcik, setTemizleAcik] = useState(false);
  const [hizliDuzen, setHizliDuzen] = useState(false);
  const [bot, setBot] = useState<BotDurumu | null>(null);
  const [obsBagli, setObsBagli] = useState(false);
  const [snap, setSnap] = useState<ObsSceneSnapshot | null>(null);
  // Sağ tık "Önizle": yayına geçmeden başka bir sahnenin karesi önizleme panelinde
  const [onizlenen, setOnizlenen] = useState<string | null>(null);
  useEffect(() => {
    if (onizlenen && (onizlenen === snap?.currentScene || !snap?.scenes?.includes(onizlenen))) setOnizlenen(null);
  }, [onizlenen, snap?.currentScene, snap?.scenes]);
  const [girisler, setGirisler] = useState<ObsInputInfo[]>([]);
  const [saglik, setSaglik] = useState<StreamHealth | null>(null);
  const [kbps, setKbps] = useState<number | null>(null);
  const oncekiSaglik = useRef<StreamHealth | null>(null);
  const [sabit, setSabit] = useState<{ message: string; displayName?: string; display_name?: string } | null>(null);
  const [mesgulSahne, setMesgulSahne] = useState(false);

  const obsYukle = useCallback(async () => {
    try {
      const st = await obsControl.status();
      setObsBagli(st.connected);
      if (!st.connected) {
        setSnap(null);
        setGirisler([]);
        return;
      }
      const [sc, inp] = await Promise.all([obsControl.scenes(), obsControl.inputs()]);
      setSnap(ayniysaKoru(sc));
      setGirisler(ayniysaKoru(inp.filter((i) => isAudioInput(i.kind, i.name))));
    } catch {
      setObsBagli(false);
    }
  }, []);

  useEffect(() => {
    if (gelismis) return;
    void obsYukle();
    const obsId = setVisibleInterval(() => void obsYukle(), 8000);
    // OBS bağlanınca sahneler beklemeden gelsin
    const obsBirak = onObsConnection(() => void obsYukle());
    const botYukle = async () => {
      try {
        const base = await axbotBase();
        const [d, p] = await Promise.all([
          fetch(`${base}/api/status`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${base}/api/pinned`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setBot(ayniysaKoru(d));
        setSabit(ayniysaKoru(p?.message ? p : null));
      } catch {
        setBot(null);
      }
    };
    void botYukle();
    const botId = setVisibleInterval(() => void botYukle(), 5000);
    const saglikYukle = () => {
      if (!isObsConnected()) {
        oncekiSaglik.current = null;
        setKbps(null);
        return setSaglik(null);
      }
      void getStreamHealth()
        .then((h) => {
          setSaglik(h);
          const o = oncekiSaglik.current;
          // Önbellekten aynı örnek döndüyse son değer ekranda kalır
          if (o && o.durationMs === h.durationMs && h.active) return;
          setKbps(bitHiziKbps(o, h));
          oncekiSaglik.current = h;
        })
        .catch(() => setSaglik(null));
    };
    saglikYukle();
    const saglikId = setVisibleInterval(saglikYukle, 5000);
    return () => {
      clearVisibleInterval(obsId);
      obsBirak();
      clearVisibleInterval(botId);
      clearVisibleInterval(saglikId);
    };
  }, [gelismis, obsYukle]);

  const sahneSec = async (ad: string) => {
    setMesgulSahne(true);
    try {
      await actionsApi.run("scene.switch", { scene: ad });
      setSnap((s) => (s ? { ...s, currentScene: ad } : s));
    } catch (e) {
      onToast(`Sahne değiştirilemedi: ${String((e as Error).message || e).slice(0, 160)}`);
    } finally {
      setMesgulSahne(false);
    }
  };

  const sustur = async (g: ObsInputInfo) => {
    const hedef = !g.muted;
    setGirisler((l) => l.map((i) => (i.name === g.name ? { ...i, muted: hedef } : i)));
    try {
      await actionsApi.run(hedef ? "audio.mute" : "audio.unmute", { input: g.name });
    } catch (e) {
      setGirisler((l) => l.map((i) => (i.name === g.name ? { ...i, muted: !hedef } : i)));
      onToast(`${g.name}: ${String((e as Error).message || e).slice(0, 160)}`);
    }
  };

  const soruSor = async () => {
    try {
      const r = await fetch(`${await axbotBase()}/api/games/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: "trivia" }),
      });
      onToast(((await r.json()) as { message?: string }).message || "Soru gönderildi");
    } catch {
      onToast("Bot kapalı — soru gönderilemedi");
    }
  };

  const sabitiKaldir = async () => {
    setSabit(null);
    await fetch(`${await axbotBase()}/api/pinned`, { method: "DELETE" }).catch(() => {});
  };

  if (gelismis) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-4 pt-3">
          <button type="button" className="studio-btn-ghost h-9 px-3 text-xs font-semibold" onClick={() => setGelismis(false)}>
            ← Canlı ekranına dön
          </button>
        </div>
        <ControlCenter onToast={onToast} />
      </div>
    );
  }

  const kick = bot?.platforms?.kick;
  const baslangic = saglik?.active ? Date.now() - saglik.durationMs : 0;
  const yayinda = canli && !!saglik?.active;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-panel-bg font-sans text-white">
      <div className="grid shrink-0 grid-cols-2 gap-2 p-2 pb-0 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <Olcum
          ikon={Radio}
          uyari={saglik?.reconnecting}
          etiket={
            <>
              <span aria-hidden className="dt-lamba" data-canli={canli} />
              {saglik?.reconnecting ? "Yeniden bağlanıyor" : canli ? "Canlı" : "Yayın"}
            </>
          }
        >
          {yayinda ? <SureSayaci key={Math.round(baslangic / 10000)} baslangic={baslangic} /> : canli ? "—" : "KAPALI"}
        </Olcum>
        <Olcum etiket="İzleyici" ikon={Users}><Izleyiciler bot={bot} /></Olcum>
        <Olcum etiket="FPS" ikon={Gauge}>{saglik?.fps != null ? saglik.fps.toFixed(0) : "—"}</Olcum>
        <Olcum etiket="Bit hızı · kbps" ikon={Activity}>{yayinda && kbps !== null ? kbps : "—"}</Olcum>
        <Olcum etiket="Kare kaybı" ikon={TriangleAlert} uyari={yayinda && saglik.dropPct >= ESIK.kareDususu}>
          {yayinda ? `%${saglik.dropPct.toFixed(1)}` : "—"}
        </Olcum>
        <div className="min-w-0 rounded-md border border-panel-border bg-panel-card px-2 py-1.5">
          <div className={`${ETIKET} flex items-center gap-1.5`}><Plug aria-hidden className="h-3.5 w-3.5 shrink-0 text-white/55" />Bağlantı</div>
          <div className="flex h-6 items-center gap-3">
            <Durum ok={obsBagli}>OBS</Durum>
            <Durum ok={!!kick?.connected}>Bot</Durum>
          </div>
        </div>
        <div className="col-span-full flex items-stretch gap-2 xl:col-auto">
          <button type="button" aria-pressed={duzenle} className={`${TUS} min-h-10 flex-1 px-3 text-xs font-semibold xl:flex-none ${duzenle ? "border-white/30 bg-[var(--dt-surface-3)]" : ""}`} onClick={() => setDuzenle((d) => !d)}>
            Düzenle
          </button>
          <button type="button" className={`${TUS} min-h-10 flex-1 px-3 text-xs font-semibold xl:flex-none`} onClick={() => setGelismis(true)}>
            Gelişmiş masa
          </button>
          {canli && twitchBaskinYapabilir() && (
            <button type="button" className={`${TUS} min-h-10 flex-1 px-3 text-xs font-semibold xl:flex-none`} onClick={() => setBaskinAcik(true)} title="Yayını bitirmeden önce takip ettiğin canlı bir kanala baskın yap">
              Baskın
            </button>
          )}
          <BaskinYardimcisi acik={baskinAcik} kapat={() => setBaskinAcik(false)} />
          <BasiliTutDugme
            basiliTut={canli}
            disabled={mesgul}
            className={`${TUS_TABAN} min-h-10 flex-1 px-4 text-xs font-bold disabled:opacity-60 xl:flex-none ${canli ? "border-red-500 bg-panel-elevated text-red-400 hover:bg-[var(--dt-surface-3)]" : "border-panel-accent bg-panel-accent text-[var(--panel-cta-ink)] hover:bg-panel-accent/85"}`}
            onOnay={onYayin}
          >
            {mesgul ? "…" : canli ? "Yayını bitir" : "Yayını başlat"}
          </BasiliTutDugme>
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 lg:overflow-hidden ${genisSohbet ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,45%)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"}`}>
        <section aria-label="Yayın" className="custom-scrollbar min-w-0 lg:overflow-y-auto">
          <div role="tablist" aria-label="Yayın kipi" className="mb-2 flex gap-1">
            {KIPLER.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kip === k.id}
                className={`${TUS_TABAN} h-8 flex-1 text-xs font-bold ${kip === k.id ? "border-white/20 bg-[var(--dt-surface-3)] text-white" : "border-panel-border text-white/55 hover:bg-[var(--dt-surface-3)]"}`}
                onClick={() => {
                  setDuzenle(false);
                  setKipSecim(k.id);
                }}
              >
                {k.ad}
              </button>
            ))}
          </div>
          <YayinDuzeni
            key={kip}
            kip={kip}
            duzenle={duzenle}
            onBitti={() => setDuzenle(false)}
            onGenisSohbet={genisSohbetSec}
            ekPanel={(id) => {
              const k = ekPanelBul(id);
              if (!k) return null;
              const sekmesi = botSekmesi(id);
              return {
                baslik: k.ad,
                icerik: (
                  <Suspense fallback={<p className="p-3 text-sm text-panel-muted">Yükleniyor…</p>}>
                    {sekmesi ? (
                      <div className="flex h-full min-h-0 flex-col">
                        <AxBotHost onToast={onToast} tab={sekmesi} embed onOpenMusic={() => onBot(sekmesi)} />
                      </div>
                    ) : (
                      <Sigdir>{yerelPanel(id)}</Sigdir>
                    )}
                  </Suspense>
                ),
              };
            }}
            paneller={{
              bilgi: { baslik: "Yayın bilgisi", gosterBaslik: false, icerik: <YayinBilgisiDock onToast={onToast} /> },
              kontrol: { baslik: "Yayın öncesi kontrol", gosterBaslik: true, icerik: <KontrolListesi onToast={onToast} /> },
              uyarilar: {
                baslik: "Uyarı kuyruğu",
                gosterBaslik: true,
                baslikEki: ayrik.includes("uyarilar") ? undefined : <AyirDugmesi id="uyarilar" />,
                icerik: ayrik.includes("uyarilar") ? <AyrikYer id="uyarilar" /> : <UyariKuyrugu onToast={onToast} />,
              },
              rapor: { baslik: "Yayın raporu", gosterBaslik: true, icerik: <YayinRaporu /> },
              karsilastirma: { baslik: "Yayınlar arası karşılaştırma", gosterBaslik: true, icerik: <YayinKarsilastirma /> },
              onizleme: {
                baslik: "Önizleme",
                gosterBaslik: false,
                icerik: <ObsOnizleme sahne={onizlenen || snap?.currentScene || ""} bagli={obsBagli} onBagla={onObsBagla} onProgramaDon={onizlenen ? () => setOnizlenen(null) : undefined} />,
              },
              sahne: {
                baslik: "Sahne",
                gosterBaslik: true,
                icerik: !obsBagli ? (
              <ObsBos metin="Sahne listesi için OBS bağlı değil." onBagla={onObsBagla} />
            ) : !snap?.scenes?.length ? (
              <p className="text-sm text-panel-muted">OBS bağlı ama sahne yok. OBS&apos;te bir sahne ekleyin; liste kendiliğinden yenilenir.</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
                {(snap?.scenes || []).map((ad) => {
                  const aktif = ad === snap?.currentScene;
                  return (
                    <button
                      key={ad}
                      type="button"
                      disabled={mesgulSahne}
                      aria-pressed={aktif}
                      onClick={() => !aktif && void sahneSec(ad)}
                      onContextMenu={nesneMenusu(() => sahneMenusu(ad, aktif, () => void sahneSec(ad), onToast, () => setOnizlenen(ad)))}
                      title={ad}
                      className={`${TUS_TABAN} h-12 truncate px-3 text-xs font-bold ${aktif ? "border-panel-accent bg-panel-accent text-[var(--panel-cta-ink)]" : "border-panel-border bg-panel-elevated text-white hover:bg-[var(--dt-surface-3)]"}`}
                    >
                      {ad}
                    </button>
                  );
                })}
              </div>
            ),
              },
              ses: {
                baslik: "Ses karıştırıcısı",
                gosterBaslik: true,
                baslikEki: ayrik.includes("mikser") ? undefined : <AyirDugmesi id="mikser" />,
                icerik: ayrik.includes("mikser") ? <AyrikYer id="mikser" /> : obsBagli ? <SesKaristirici girisler={girisler} onSustur={(g) => void sustur(g)} onToast={onToast} /> : <ObsBos metin="Ses karıştırıcısı için OBS bağlı değil." onBagla={onObsBagla} />,
              },
              hizli: {
                baslik: "Hızlı işlem",
                gosterBaslik: true,
                baslikEki: (
                  <button
                    type="button"
                    aria-pressed={hizliDuzen}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-[var(--dt-surface-3)] hover:text-white"
                    onClick={() => setHizliDuzen((d) => !d)}
                  >
                    <Settings2 aria-hidden className="h-3.5 w-3.5" />
                    {hizliDuzen ? "Bitti" : "Özelleştir"}
                  </button>
                ),
                icerik: (
              <HizliIslemler onToast={onToast} onSoru={() => void soruSor()} onTemizle={() => setTemizleAcik(true)} duzen={hizliDuzen} />
                ),
              },
            }}
          />
        </section>

        <aside aria-label="Sohbet ve olaylar" className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-md border border-panel-border bg-panel-card lg:min-h-0">
          <div role="tablist" className="flex shrink-0 gap-2 p-2">
            {(["sohbet", "olaylar"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={sekme === s}
                onClick={() => setSekme(s)}
                className={`${TUS_TABAN} h-9 flex-1 text-xs font-bold ${sekme === s ? "border-white/20 bg-[var(--dt-surface-3)] text-white" : "border-panel-border text-white/55 hover:bg-[var(--dt-surface-3)]"}`}
              >
                {s === "sohbet" ? "Sohbet" : "Olaylar"}
              </button>
            ))}
            {!ayrik.includes(sekme === "sohbet" ? "sohbet" : "etkinlik") && <AyirDugmesi id={sekme === "sohbet" ? "sohbet" : "etkinlik"} />}
          </div>
          {sabit && sekme === "sohbet" ? (
            <div className="mx-2 flex shrink-0 items-center gap-2 rounded-md border border-panel-border px-3 py-2 text-[13px]">
              <Pin className="h-3.5 w-3.5 shrink-0 text-panel-accent" />
              <span className="min-w-0 flex-1 truncate text-white">{sabit.message}</span>
              <button type="button" className={`${TUS} shrink-0 px-2 py-1 text-xs`} onClick={() => void sabitiKaldir()}>Kaldır</button>
            </div>
          ) : null}
          {/* İkisi de bağlı kalır: sekme değişince liste ve filtreler kaybolmasın */}
          <div className={`flex min-h-0 flex-1 flex-col ${sekme === "sohbet" ? "" : "hidden"}`}>
            {ayrik.includes("sohbet") ? (
              <AyrikYer id="sohbet" />
            ) : (
              <Suspense fallback={<p className="p-3 text-sm text-panel-muted">Yükleniyor…</p>}>
                <AxBotHost onToast={onToast} tab="multichat" embed onOpenMusic={() => onBot("multichat")} />
              </Suspense>
            )}
          </div>
          <div className={`custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2 ${sekme === "olaylar" ? "" : "hidden"}`}>
            {ayrik.includes("etkinlik") ? <AyrikYer id="etkinlik" /> : <ActivityFeedPanel onToast={onToast} />}
          </div>
        </aside>
      </div>

      <SohbetTemizleDiyalogu open={temizleAcik} onClose={() => setTemizleAcik(false)} onDone={onToast} />
    </div>
  );
}
