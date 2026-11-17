/**
 * Kontrol Merkezi — yayını YÖNETEN çalışma alanı (Broadcast yayını üretir; bu ekran yönetir).
 *
 * Çoklu yayın hedefleri, GO LIVE, OBS yönlendirme, yayın öncesi kontrol listesi, ekip çapında uyarı kuyruğu,
 * denetim günlüğü ve operatör notları. Tüm eylemler sunucunun Control Plane'inden geçer (izin + denetim).
 * Paneller sürükle-bırak ile sıralanır, gizlenir, genişletilir; hazır profiller var.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Radio,
  GripVertical,
  EyeOff,
  Columns2,
  Mic,
  MicOff,
} from "lucide-react";
import { obsControl, type ObsConnectionStatus, type ObsInputInfo, type ObsSceneSnapshot } from "../../lib/obsControl";
import { isAudioInput, meterPercent, meterZone } from "../../lib/obsAudio";
import { actionsApi, CATEGORY_LABEL, obsApi, quickActions, type ActionInfo, type ObsCanvas, type ObsInputLevel } from "../../lib/api/actions";
import { ActivityFeedPanel, UniversalChatPanel } from "./UniversalChat";
import { DeckPanel } from "./DeckPanel";
import UyariKuyrugu from "./UyariKuyrugu";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { nesneMenusu } from "../axthrowa/SagTikMenusu";
import { sahneMenusu } from "./sahneMenusu";
import {
  applyPreset,
  cycleSpan,
  defaultLayout,
  movePanel,
  PANELS,
  parseLayout,
  PRESETS,
  toggleVisible,
  type ControlLayout,
  type PanelId,
} from "../../lib/controlCenter";
import { TONE_CLASS, useMultistream, ConfirmButton, SessionPanel, DestinationsPanel, VodMuzikUyarisi, PreflightPanel, AuditPanel } from "./CokluYayinPanelleri";

type Props = { onToast: (msg: string) => void };

const LAYOUT_KEY = "studio.controlCenter.layout";
const NOTES_KEY = "studio.controlCenter.notes";

function loadLayout(): ControlLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? parseLayout(JSON.parse(raw)) : defaultLayout();
  } catch {
    return defaultLayout();
  }
}

/** Canlı ekranının "Yayın öncesi" çalışma alanı için */
export function KontrolListesi({ onToast }: { onToast: (m: string) => void }) {
  return (
    <>
      <VodMuzikUyarisi onToast={onToast} />
      <PreflightPanel ms={useMultistream(onToast)} />
    </>
  );
}

/**
 * OBS sahne ve ses hızlı denetimi (Ground Control tarzı tek dokunuş). Sahne geçişi ve susturma yayını
 * başlatmaz/bitirmez; bu yüzden onay istemez. OBS'e bağlantı Bağlantılar sekmesinden yapılır.
 */
function ScenesPanel({ onToast }: { onToast: (m: string) => void }) {
  const [status, setStatus] = useState<ObsConnectionStatus | null>(null);
  const [snap, setSnap] = useState<ObsSceneSnapshot | null>(null);
  const [inputs, setInputs] = useState<ObsInputInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tuvaller, setTuvaller] = useState<ObsCanvas[] | null>(null);
  const [seviye, setSeviye] = useState<Record<string, ObsInputLevel>>({});

  const load = useCallback(async () => {
    try {
      const st = await obsControl.status();
      setStatus(st);
      if (!st.connected) {
        setSnap(null);
        setInputs([]);
        return;
      }
      const [sc, inp] = await Promise.all([obsControl.scenes(), obsControl.inputs()]);
      setSnap(sc);
      setInputs(inp.filter((i) => isAudioInput(i.kind, i.name)));
      // Tuvaller panel sunucusundan (obs-websocket 5.7); eski OBS'te sessizce gizlenir
      setTuvaller(await obsApi.canvases().catch(() => null));
    } catch (e) {
      setStatus((s) => ({ ...(s || { connecting: false, host: "127.0.0.1", port: 4455 }), connected: false, lastError: String((e as Error).message || e) }));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setVisibleInterval(() => void load(), 8000);
    return () => clearVisibleInterval(id);
  }, [load]);

  // Ses ölçerleri: WebSocket akışı (R7), en çok 4/sn çizilir. OBS aboneliği akış kapanınca düşer.
  const bagli = !!status?.connected && inputs.length > 0;
  useEffect(() => {
    if (!bagli) return;
    let son = 0;
    return obsApi.olcerAkisi((r) => {
      const simdi = performance.now();
      if (r && simdi - son < 250) return;
      son = simdi;
      setSeviye(r && r.ageMs >= 0 && r.ageMs < 2000 ? Object.fromEntries(r.inputs.map((l) => [l.name, l])) : {});
    });
  }, [bagli]);

  const sahne = async (ad: string) => {
    setBusy(ad);
    try {
      // Eylem kayıt defterinden: izin + denetim günlüğü (eskiden doğrudan OBS'e gidiyordu, günlüğe düşmüyordu)
      await actionsApi.run("scene.switch", { scene: ad });
      setSnap((s) => (s ? { ...s, currentScene: ad } : s));
    } catch (e) {
      onToast(`Sahne değiştirilemedi: ${String((e as Error).message || e).slice(0, 160)}`);
    } finally {
      setBusy(null);
      void load();
    }
  };

  const sustur = async (girdi: ObsInputInfo) => {
    const hedef = !girdi.muted;
    setInputs((l) => l.map((i) => (i.name === girdi.name ? { ...i, muted: hedef } : i)));
    try {
      await actionsApi.run(hedef ? "audio.mute" : "audio.unmute", { input: girdi.name });
    } catch (e) {
      setInputs((l) => l.map((i) => (i.name === girdi.name ? { ...i, muted: !hedef } : i)));
      onToast(`${girdi.name}: ${String((e as Error).message || e).slice(0, 160)}`);
    }
  };

  if (!status?.connected) {
    return (
      <p className="text-xs text-panel-muted">
        OBS bağlı değil{status?.lastError ? ` (${status.lastError.slice(0, 100)})` : ""} — Bağlantılar sekmesinden bağlanın.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white/80">Sahneler</span>
        {snap?.streaming && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_CLASS.bad}`}>OBS YAYINDA</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {(snap?.scenes || []).map((ad) => {
          const aktif = ad === snap?.currentScene;
          return (
            <button
              key={ad}
              type="button"
              disabled={busy !== null}
              aria-pressed={aktif}
              onClick={() => !aktif && void sahne(ad)}
              onContextMenu={nesneMenusu(() => sahneMenusu(ad, aktif, () => void sahne(ad), onToast))}
              className={`truncate rounded-lg border px-2 py-2 text-left font-semibold transition ${
                aktif ? "border-red-500/60 bg-red-500/20 text-white" : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/30"
              }`}
              title={aktif ? "Yayındaki sahne" : `${ad} sahnesine geç`}
            >
              {aktif && <span className="mr-1 text-[10px] font-black text-red-300">CANLI</span>}
              {ad}
            </button>
          );
        })}
        {(snap?.scenes || []).length === 0 && <p className="col-span-full text-panel-muted">Sahne yok.</p>}
      </div>
      {tuvaller && tuvaller.length > 1 && (
        <div className="space-y-1">
          <div className="font-bold text-white/80">Tuvaller</div>
          {tuvaller.map((t) => (
            <div key={t.uuid} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
              <span className="min-w-0 truncate text-white/85">
                {t.name} <span className="text-panel-muted">{t.width}×{t.height}@{Math.round(t.fps)}</span>
              </span>
              <span className="shrink-0 text-[10px] text-panel-muted" title={t.sceneSwitchSupported ? "" : "obs-websocket ikincil tuvalde sahne geçişine izin vermiyor"}>
                {t.main ? "ana tuval — yukarıdan yönetilir" : `${t.provider || "eklenti"} yönetir`}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="font-bold text-white/80">Ses girişleri</div>
      <div className="space-y-1">
        {inputs.length === 0 && <p className="text-panel-muted">Ses girişi bulunamadı.</p>}
        {inputs.map((g) => (
          <button
            key={g.name}
            type="button"
            onClick={() => void sustur(g)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 py-1.5 ${
              g.muted ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
            }`}
            title={g.muted ? "Sesi aç" : "Sustur"}
          >
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-white/85">{g.name}</span>
              <SesOlceri seviye={seviye[g.name]} susturulmus={g.muted} />
            </span>
            {g.muted ? <MicOff className="h-3.5 w-3.5 shrink-0 text-red-300" /> : <Mic className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
          </button>
        ))}
      </div>
    </div>
  );
}

const OLCER_RENK = { ok: "bg-emerald-400", hot: "bg-amber-400", clip: "bg-red-500" } as const;

/** Tek giriş ölçeri: dolu çubuk ortalama büyüklük, ince çizgi tepe değeri. Veri yoksa gösterilmez. */
export function SesOlceri({ seviye, susturulmus }: { seviye?: ObsInputLevel; susturulmus: boolean }) {
  if (!seviye) return null;
  const tepe = meterPercent(seviye.peakDb);
  const ort = meterPercent(seviye.magnitudeDb);
  return (
    <span
      className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10"
      role="meter"
      aria-label={`${seviye.name} ses seviyesi`}
      aria-valuemin={-60}
      aria-valuemax={0}
      aria-valuenow={Math.max(-60, Math.round(seviye.peakDb))}
      title={`tepe ${seviye.peakDb.toFixed(1)} dBFS`}
    >
      <span
        className={`absolute inset-y-0 left-0 ${susturulmus ? "bg-white/30" : OLCER_RENK[meterZone(seviye.magnitudeDb)]}`}
        style={{ width: `${ort}%` }}
      />
      {tepe > 0 && <span className="absolute inset-y-0 w-0.5 bg-white/80" style={{ left: `calc(${tepe}% - 2px)` }} />}
    </span>
  );
}

/**
 * Hızlı eylemler (Ground Control / Stream Deck tarzı): parametresiz eylemler kayıt defterinden gelir; kullanılamayan
 * eylem gerekçesiyle devre dışı görünür, yayın/kayıt kesen eylemler çift onay ister. Hepsi denetim günlüğüne düşer.
 */
function QuickActionsPanel({ onToast }: { onToast: (m: string) => void }) {
  const [list, setList] = useState<ActionInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [hata, setHata] = useState("");

  const load = useCallback(async () => {
    try {
      setList(quickActions(await actionsApi.list()));
      setHata("");
    } catch (e) {
      setHata(String((e as Error).message || e).slice(0, 160));
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setVisibleInterval(() => void load(), 5000);
    return () => clearVisibleInterval(id);
  }, [load]);

  const calistir = async (a: ActionInfo) => {
    setBusy(a.id);
    try {
      await actionsApi.run(a.id, {}, a.confirm);
      onToast(`${a.label}: tamam`);
    } catch (e) {
      onToast(`${a.label}: ${String((e as Error).message || e).slice(0, 160)}`);
    } finally {
      setBusy(null);
      void load();
    }
  };

  if (hata) return <p className="text-xs text-red-300">Eylemler alınamadı: {hata}</p>;
  if (!list) return <p className="text-xs text-panel-muted">Yükleniyor…</p>;

  // Yalnız şu an kullanılabilenler: onlarca soluk düğme yayın sırasında aranılanı bulmayı zorlaştırıyordu
  const gruplar = list.filter((a) => a.available).reduce<Record<string, ActionInfo[]>>((m, a) => ((m[a.category] ||= []).push(a), m), {});
  if (!Object.keys(gruplar).length) return <p className="text-xs text-panel-muted">OBS bağlanınca eylemler burada görünür.</p>;
  return (
    <div className="space-y-2 text-xs">
      {Object.entries(gruplar).map(([kategori, eylemler]) => (
        <div key={kategori}>
          <div className="mb-1 font-bold text-white/80">{CATEGORY_LABEL[kategori] || kategori}</div>
          <div className="flex flex-wrap gap-1.5">
            {eylemler.map((a) => {
              const sinif = `studio-btn-ghost !px-2 !py-1 ${a.available ? "" : "opacity-50"}`;
              const baslik = a.available ? (a.confirm ? "Çift onay ister" : a.label) : a.reason || "Kullanılamıyor";
              return a.confirm ? (
                <span key={a.id} title={baslik}>
                  <ConfirmButton
                    label={a.label}
                    confirmLabel="Emin misin? Tekrar tıkla"
                    disabled={!a.available || busy !== null}
                    className={sinif}
                    onConfirm={() => void calistir(a)}
                  />
                </span>
              ) : (
                <button key={a.id} type="button" title={baslik} disabled={!a.available || busy !== null} className={sinif} onClick={() => void calistir(a)}>
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotesPanel() {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(NOTES_KEY) || "";
    } catch {
      return "";
    }
  });
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(NOTES_KEY, text);
      } catch {
        /* */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [text]);
  return (
    <textarea
      className="studio-input h-32 w-full resize-y text-xs"
      value={text}
      maxLength={4000}
      onChange={(e) => setText(e.target.value)}
      placeholder="Sponsor okuması 21:30, raid hedefi…"
    />
  );
}

// ─── Çalışma alanı ───────────────────────────────────────────────────────

export default function ControlCenter({ onToast }: Props) {
  const ms = useMultistream(onToast);
  const [layout, setLayout] = useState<ControlLayout>(loadLayout);
  const [editing, setEditing] = useState(false);
  const dragId = useRef<PanelId | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      /* tarayıcı depolaması kapalıysa düzen yalnız bu oturumda kalır */
    }
  }, [layout]);

  const meta = useMemo(() => Object.fromEntries(PANELS.map((p) => [p.id, p])), []);
  const render = (id: PanelId) => {
    switch (id) {
      case "session":
        return <SessionPanel ms={ms} />;
      case "destinations":
        return <DestinationsPanel ms={ms} />;
      case "scenes":
        return <ScenesPanel onToast={onToast} />;
      case "quickActions":
        return <QuickActionsPanel onToast={onToast} />;
      case "deck":
        return <DeckPanel onToast={onToast} />;
      case "chat":
        return <UniversalChatPanel onToast={onToast} />;
      case "activity":
        return <ActivityFeedPanel onToast={onToast} />;
      case "preflight":
        return <PreflightPanel ms={ms} />;
      case "alertQueue":
        return <UyariKuyrugu onToast={onToast} />;
      case "audit":
        return <AuditPanel ms={ms} />;
      case "notes":
        return <NotesPanel />;
    }
  };

  const visible = layout.panels.filter((p) => p.visible);
  const hidden = layout.panels.filter((p) => !p.visible);
  const spanClass = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3" } as const;

  return (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Radio className="h-4 w-4 text-panel-accent" />
        <h2 className="text-sm font-bold text-white">Kontrol Merkezi</h2>
        {ms.error && <span className="text-[11px] text-red-300">{ms.error.slice(0, 120)}</span>}
        <span className="ml-auto" />
        <select
          className="studio-input !py-1 text-xs"
          value={PRESETS[layout.preset] ? layout.preset : "custom"}
          onChange={(e) => e.target.value !== "custom" && setLayout(applyPreset(e.target.value))}
          title="Hazır düzen"
        >
          {Object.entries(PRESETS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
          <option value="custom">Özel</option>
        </select>
        <button type="button" className={`studio-btn-ghost !py-1 text-xs ${editing ? "ring-1 ring-panel-accent" : ""}`} onClick={() => setEditing((x) => !x)}>
          Düzeni düzenle
        </button>
      </div>

      {editing && hidden.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="text-white/50">Gizli paneller:</span>
          {hidden.map((p) => (
            <button key={p.id} type="button" className="studio-btn-ghost !px-2 !py-0.5" onClick={() => setLayout(toggleVisible(layout, p.id))}>
              + {meta[p.id].title}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {visible.map((p) => (
          <section
            key={p.id}
            className={`rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 ${spanClass[p.span]}`}
            draggable={editing}
            onDragStart={() => (dragId.current = p.id)}
            onDragOver={(e) => editing && e.preventDefault()}
            onDrop={() => {
              if (dragId.current) setLayout(movePanel(layout, dragId.current, p.id));
              dragId.current = null;
            }}
          >
            <header className="mb-2 flex items-center gap-1.5">
              {editing && <GripVertical className="h-3.5 w-3.5 cursor-grab text-panel-muted" />}
              <h3 className="text-xs font-bold text-white">{meta[p.id].title}</h3>
              {/* Açıklama yalnız düzenlerken: yayın sırasında başlık yeter */}
              {editing && <span className="truncate text-[10px] text-panel-muted">{meta[p.id].hint}</span>}
              {editing && (
                <span className="ml-auto flex gap-1">
                  <button type="button" className="rounded p-1 hover:bg-white/10" title="Genişlik" onClick={() => setLayout(cycleSpan(layout, p.id))}>
                    <Columns2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="rounded p-1 hover:bg-white/10" title="Gizle" onClick={() => setLayout(toggleVisible(layout, p.id))}>
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </header>
            {render(p.id)}
          </section>
        ))}
      </div>
    </div>
  );
}
