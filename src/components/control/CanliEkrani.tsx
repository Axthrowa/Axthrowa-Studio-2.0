/**
 * Canlı ekranı: yayın sırasında gerekenler kaydırmadan tek ekranda. Görüntü, sahneler, ses, hızlı işlemler,
 * sohbet ve olaylar. Çoklu yayın, denetim günlüğü gibi seyrek işler "Gelişmiş masa"da (ControlCenter) kalır.
 *
 * Sık güncellenen parçalar (süre, önizleme, ses ölçeri) kendi bileşenlerinde: her güncellemede ekranın tamamı
 * yeniden çizilmesin.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { actionsApi } from "../../lib/api/actions";
import { getStreamHealth, isObsConnected, onObsConnection, type StreamHealth } from "../../lib/obs";
import { isAudioInput, onizlemeBeklemesi } from "../../lib/obsAudio";
import { obsControl, type ObsInputInfo, type ObsSceneSnapshot } from "../../lib/obsControl";
import { streamaxtBase } from "../../lib/streamaxt";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import SohbetTemizleDiyalogu from "../panel/SohbetTemizleDiyalogu";
import ControlCenter from "./ControlCenter";
import SesKaristirici from "./SesKaristirici";
import { ActivityFeedPanel, UniversalChatPanel } from "./UniversalChat";

type Props = {
  onToast: (m: string) => void;
  canli: boolean;
  mesgul: boolean;
  onYayin: () => void;
  /** Botta bir sayfa aç (çekiliş, anket) */
  onBot: (sayfa: string) => void;
};

type BotDurumu = {
  canli?: { izleyici?: number };
  platforms?: Record<string, { connected?: boolean; yazabilir?: boolean }>;
};

const ONIZLEME_GENISLIK = 854;

function Durum({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-panel-muted">
      <span aria-hidden className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      {children}
      <span className="sr-only">{ok ? " bağlı" : " bağlı değil"}</span>
    </span>
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
  return <span className="font-medium tabular-nums text-panel-muted">{`${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`}</span>;
}

/**
 * OBS'in yayındaki sahnesi: bir kare gelince sıradakini ister, en çok ~15 kare/sn. Video akışı değildir; OBS ek bir
 * çıkış olmadan yalnız kare verir. Kare önce çözülür, sonra tuvale çizilir: geçişte titremez.
 */
function ObsOnizleme({ sahne }: { sahne: string }) {
  const tuval = useRef<HTMLCanvasElement>(null);
  const [kareVar, setKareVar] = useState(false);
  useEffect(() => {
    if (!sahne) {
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
          im.src = await obsControl.screenshot(sahne, ONIZLEME_GENISLIK);
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
  }, [sahne]);
  return (
    <div className="relative aspect-video max-h-[52vh] w-full overflow-hidden rounded-xl bg-black">
      <canvas ref={tuval} role="img" aria-label={`${sahne} sahnesinin önizlemesi`} className="h-full w-full object-contain" />
      {!kareVar ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-panel-muted">
          {sahne ? "Önizleme yükleniyor…" : "OBS bağlanınca önizleme burada görünür"}
        </div>
      ) : null}
      {sahne ? <span className="absolute left-3 top-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white">{sahne}</span> : null}
    </div>
  );
}

export default function CanliEkrani({ onToast, canli, mesgul, onYayin, onBot }: Props) {
  const [gelismis, setGelismis] = useState(false);
  const [sekme, setSekme] = useState<"sohbet" | "olaylar">("sohbet");
  const [temizleAcik, setTemizleAcik] = useState(false);
  const [bot, setBot] = useState<BotDurumu | null>(null);
  const [obsBagli, setObsBagli] = useState(false);
  const [snap, setSnap] = useState<ObsSceneSnapshot | null>(null);
  const [girisler, setGirisler] = useState<ObsInputInfo[]>([]);
  const [saglik, setSaglik] = useState<StreamHealth | null>(null);
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
      setSnap(sc);
      setGirisler(inp.filter((i) => isAudioInput(i.kind, i.name)));
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
        const base = await streamaxtBase();
        const [d, p] = await Promise.all([
          fetch(`${base}/api/status`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`${base}/api/pinned`, { cache: "no-store" }).then((r) => r.json()),
        ]);
        setBot(d);
        setSabit(p?.message ? p : null);
      } catch {
        setBot(null);
      }
    };
    void botYukle();
    const botId = setVisibleInterval(() => void botYukle(), 5000);
    const saglikYukle = () => {
      if (!isObsConnected()) return setSaglik(null);
      void getStreamHealth().then(setSaglik).catch(() => setSaglik(null));
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
      const r = await fetch(`${await streamaxtBase()}/api/games/trigger`, {
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
    await fetch(`${await streamaxtBase()}/api/pinned`, { method: "DELETE" }).catch(() => {});
  };

  if (gelismis) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-4 pt-3">
          <button type="button" className="yya-btn-ghost h-9 px-3 text-xs font-semibold" onClick={() => setGelismis(false)}>
            ← Canlı ekranına dön
          </button>
        </div>
        <ControlCenter onToast={onToast} />
      </div>
    );
  }

  const kick = bot?.platforms?.kick;
  const baslangic = saglik?.active ? Date.now() - saglik.durationMs : 0;
  const saglikMetni = saglik?.reconnecting ? "OBS yeniden bağlanıyor" : saglik && saglik.dropPct >= 2 ? `Kare düşüşü %${saglik.dropPct.toFixed(1)}` : "Yayın sağlığı iyi";
  const saglikIyi = !!saglik && !saglik.reconnecting && saglik.dropPct < 2;
  const hizliSinif = "yya-btn-ghost h-11 w-full px-2 text-sm font-medium";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 px-4 py-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-white">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${canli ? "bg-red-400" : "bg-white/30"}`} />
          {canli ? "Canlı" : "Yayın kapalı"}
          {canli && saglik?.active ? <SureSayaci key={Math.round(baslangic / 10000)} baslangic={baslangic} /> : null}
        </span>
        {bot?.canli?.izleyici ? (
          <span className="text-panel-muted">
            <b className="font-semibold tabular-nums text-white">{bot.canli.izleyici}</b> izleyici
          </span>
        ) : null}
        <Durum ok={obsBagli}>OBS</Durum>
        <Durum ok={!!kick?.connected}>Bot</Durum>
        {canli && saglik?.active ? <Durum ok={saglikIyi}>{saglikMetni}</Durum> : null}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="yya-btn-ghost h-9 px-3 text-xs font-semibold" onClick={() => setGelismis(true)}>
            Gelişmiş masa
          </button>
          <button type="button" disabled={mesgul} className={`h-9 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${canli ? "border border-red-400 text-red-200" : "bg-panel-accent text-black"}`} onClick={onYayin}>
            {mesgul ? "…" : canli ? "Yayını bitir" : "Yayını başlat"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:overflow-hidden">
        <section aria-label="Yayın" className="custom-scrollbar flex min-w-0 flex-col gap-4 lg:overflow-y-auto">
          <ObsOnizleme sahne={snap?.currentScene || ""} />

          <div>
            <h2 className="mb-2 text-xs font-semibold text-panel-muted">Sahne</h2>
            {!obsBagli ? (
              <p className="text-sm text-panel-muted">OBS bağlı değil. Hazırlık › Bağlantılar'dan bağlanabilirsin.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {(snap?.scenes || []).map((ad) => {
                  const aktif = ad === snap?.currentScene;
                  return (
                    <button
                      key={ad}
                      type="button"
                      disabled={mesgulSahne}
                      aria-pressed={aktif}
                      onClick={() => !aktif && void sahneSec(ad)}
                      title={ad}
                      className={`h-12 truncate rounded-lg border px-3 text-sm font-semibold transition-colors ${aktif ? "border-panel-accent bg-panel-accent text-black" : "border-white/15 bg-panel-card text-white hover:border-white/30"}`}
                    >
                      {ad}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <div className="min-w-0">
              <h2 className="mb-2 text-xs font-semibold text-panel-muted">Ses karıştırıcısı</h2>
              {obsBagli ? <SesKaristirici girisler={girisler} onSustur={(g) => void sustur(g)} onToast={onToast} /> : <p className="text-sm text-panel-muted">OBS bağlanınca görünür.</p>}
            </div>
            <div className="min-w-0">
              <h2 className="mb-2 text-xs font-semibold text-panel-muted">Hızlı işlem</h2>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={hizliSinif} onClick={() => onBot("giveaways")}>Çekiliş başlat</button>
                <button type="button" className={hizliSinif} onClick={() => onBot("polls")}>Anket aç</button>
                <button type="button" className={hizliSinif} onClick={() => void soruSor()}>Soru sor</button>
                <button type="button" className={hizliSinif} onClick={() => setTemizleAcik(true)}>Sohbeti temizle</button>
              </div>
            </div>
          </div>
        </section>

        <aside aria-label="Sohbet ve olaylar" className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl bg-panel-card lg:min-h-0">
          <div role="tablist" className="flex shrink-0 gap-1 p-2">
            {(["sohbet", "olaylar"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={sekme === s}
                onClick={() => setSekme(s)}
                className={`h-9 flex-1 rounded-md text-sm font-semibold ${sekme === s ? "bg-white/10 text-white" : "text-panel-muted hover:text-white"}`}
              >
                {s === "sohbet" ? "Sohbet" : "Olaylar"}
              </button>
            ))}
          </div>
          {sabit && sekme === "sohbet" ? (
            <div className="mx-2 flex shrink-0 items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-[13px]">
              <Pin className="h-3.5 w-3.5 shrink-0 text-panel-accent" />
              <span className="min-w-0 flex-1 truncate text-white">{sabit.message}</span>
              <button type="button" className="shrink-0 text-xs text-panel-muted hover:text-white" onClick={() => void sabitiKaldir()}>Kaldır</button>
            </div>
          ) : null}
          {/* İkisi de bağlı kalır: sekme değişince liste ve filtreler kaybolmasın */}
          <div className={`custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2 ${sekme === "sohbet" ? "" : "hidden"}`}><UniversalChatPanel onToast={onToast} /></div>
          <div className={`custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2 ${sekme === "olaylar" ? "" : "hidden"}`}><ActivityFeedPanel onToast={onToast} /></div>
        </aside>
      </div>

      <SohbetTemizleDiyalogu open={temizleAcik} onClose={() => setTemizleAcik(false)} onDone={onToast} />
    </div>
  );
}
