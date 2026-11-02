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
  Play,
  Square,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Info,
  GripVertical,
  EyeOff,
  Columns2,
  Pause,
  Volume2,
  VolumeX,
  SkipForward,
  RotateCcw,
  Link2,
  Undo2,
  Mic,
  MicOff,
} from "lucide-react";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { streamaxtBase } from "../../lib/streamaxt";
import { obsControl, type ObsConnectionStatus, type ObsInputInfo, type ObsSceneSnapshot } from "../../lib/obsControl";
import { isAudioInput, meterPercent, meterZone } from "../../lib/obsAudio";
import { actionsApi, CATEGORY_LABEL, obsApi, quickActions, type ActionInfo, type ObsCanvas, type ObsInputLevel } from "../../lib/api/actions";
import { ActivityFeedPanel, UniversalChatPanel } from "./UniversalChat";
import { DeckPanel } from "./DeckPanel";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import {
  applyPreset,
  cycleSpan,
  defaultLayout,
  formatBytes,
  isActive,
  movePanel,
  overallLive,
  PANELS,
  parseLayout,
  PRESETS,
  STATE_LABEL,
  STATE_TONE,
  toggleVisible,
  type ControlLayout,
  type PanelId,
} from "../../lib/controlCenter";
import {
  multistreamApi,
  type AuditRow,
  type Destination,
  type EncoderInfo,
  type Finding,
  type MultistreamStatus,
  type Platform,
} from "../../lib/api/multistream";

type Props = { onToast: (msg: string) => void };

const LAYOUT_KEY = "yya.controlCenter.layout";
const NOTES_KEY = "yya.controlCenter.notes";

function loadLayout(): ControlLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? parseLayout(JSON.parse(raw)) : defaultLayout();
  } catch {
    return defaultLayout();
  }
}

const TONE_CLASS = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  bad: "bg-red-500/15 text-red-300 border-red-500/30",
  idle: "bg-white/[0.05] text-white/60 border-white/10",
} as const;

// ─── Canlı durum ─────────────────────────────────────────────────────────

function useMultistream(onToast: (m: string) => void) {
  const [status, setStatus] = useState<MultistreamStatus | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setStatus(await multistreamApi.status());
      setError("");
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;
    const connect = () => {
      ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data));
          if (m?.type === "multistream" && m.data) {
            // Yayın anlık görüntüsü ön ayar / OBS yönlendirme / alıcı anahtarı taşımaz; onları koru
            setStatus((prev) => (prev ? { ...prev, ...m.data } : { ...m.data, presets: [], obsRedirected: false }));
          }
        } catch {
          /* başka mesaj türleri */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      ws?.close();
    };
  }, [refresh]);

  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        const r = await fn();
        if (r && typeof r === "object" && "destinations" in (r as object)) {
          setStatus((prev) => ({ ...(prev || ({} as MultistreamStatus)), ...(r as unknown as MultistreamStatus) }));
        }
        return r;
      } catch (e) {
        onToast(`${label}: ${String((e as Error).message || e).slice(0, 200)}`);
        return null;
      }
    },
    [onToast]
  );

  return { status, error, refresh, run };
}

// ─── Çift tıklamalı onay (kazara tetiklenmesin, §87) ──────────────────────

function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${className || ""} ${armed ? "ring-2 ring-red-400" : ""}`}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

// ─── Paneller ────────────────────────────────────────────────────────────

function SessionPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
  const s = ms.status;
  const states = (s?.destinations || []).map((d) => d.state);
  const genel = overallLive(states);
  const [busy, setBusy] = useState("");
  const go = async (k: string, f: () => Promise<unknown>) => {
    setBusy(k);
    await f();
    setBusy("");
  };
  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            genel === "live" ? TONE_CLASS.ok : genel === "partial" ? TONE_CLASS.warn : TONE_CLASS.idle
          }`}
        >
          {genel === "live" ? "CANLI" : genel === "partial" ? "KISMEN CANLI" : "YAYIN DIŞI"}
        </span>
        {s?.session ? (
          <span className="text-white/70">
            Alıcı {s.session.ingest === "receiving" ? "OBS'ten görüntü alıyor" : "OBS'in bağlanmasını bekliyor"} ·{" "}
            {formatBytes(s.session.bytesIn)} · {Math.floor(s.session.uptimeSecs / 60)} dk
          </span>
        ) : (
          <span className="text-white/50">Çoklu yayın oturumu kapalı</span>
        )}
      </div>
      {!s?.ffmpeg && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-red-200">
          FFmpeg bulunamadı — çoklu yayın için gerekli (PATH'e ekleyin; YouTube arka planı indirmesi de kullanır).
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="yya-btn-primary inline-flex items-center gap-1.5"
          disabled={!!busy || !s?.ffmpeg}
          onClick={() =>
            void go("go", async () => {
              const r = await ms.run("GO LIVE", multistreamApi.goLive);
              if (r && r.blocked.length) {
                /* engellenen hedefler kartlarda ve kontrol listesinde görünür */
              }
            })
          }
        >
          <Play className="h-3.5 w-3.5" /> Çoklu yayını başlat
        </button>
        <button
          type="button"
          className="yya-btn-ghost inline-flex items-center gap-1.5"
          disabled={!!busy || !s?.ffmpeg}
          title="OBS'in yayın servisini yerel alıcıya çevirir; özgün ayar Kimlik Yöneticisine yedeklenir"
          onClick={() => void go("obs", () => ms.run("OBS yönlendirme", multistreamApi.obsConnect))}
        >
          <Link2 className="h-3.5 w-3.5" /> OBS'i yönlendiriciye bağla
        </button>
        {s?.obsRedirected && (
          <button
            type="button"
            className="yya-btn-ghost inline-flex items-center gap-1.5"
            disabled={!!busy}
            onClick={() => void go("restore", () => ms.run("OBS geri yükleme", multistreamApi.obsRestore))}
          >
            <Undo2 className="h-3.5 w-3.5" /> OBS ayarını geri yükle
          </button>
        )}
        <ConfirmButton
          label="Hepsini bitir"
          confirmLabel="Emin misin? Tekrar tıkla"
          disabled={!!busy || !s?.session}
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-200 disabled:opacity-40"
          onConfirm={() => void go("end", () => ms.run("Oturumu kapatma", multistreamApi.endAll))}
        />
      </div>
      {s?.ingest && (
        <p className="text-[11px] text-panel-muted">
          Elle kurulum için OBS → Ayarlar → Yayın → Özel: sunucu <code className="text-white/70">{s.ingest.server}</code>
          {" "}(anahtar "OBS'i yönlendiriciye bağla" ile otomatik yazılır).
        </p>
      )}
      {!!s?.log?.length && (
        <div className="max-h-24 overflow-y-auto rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-[10px] text-white/50">
          {[...s.log].reverse().slice(0, 12).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

type Draft = { id?: string; name: string; platform: Platform; server: string; enabled: boolean; key: string };

function DestinationsPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
  const s = ms.status;
  const [draft, setDraft] = useState<Draft | null>(null);
  const presets = s?.presets || [];

  const openNew = () =>
    setDraft({ name: "", platform: "twitch", server: presets.find((p) => p.platform === "twitch")?.server || "", enabled: true, key: "" });
  const openEdit = (d: Destination) =>
    setDraft({ id: d.id, name: d.name, platform: d.platform, server: d.server, enabled: d.enabled, key: "" });

  const save = async () => {
    if (!draft) return;
    const r = await ms.run("Kaydetme", () =>
      multistreamApi.upsert({
        id: draft.id,
        name: draft.name,
        platform: draft.platform,
        server: draft.server,
        enabled: draft.enabled,
        key: draft.key || undefined,
      })
    );
    if (r) setDraft(null);
  };

  return (
    <div className="space-y-2.5 text-xs">
      {(s?.destinations || []).length === 0 && !draft && (
        <p className="text-white/50">Henüz hedef yok. Twitch, Kick, YouTube ya da özel RTMP(S) ekleyin.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {(s?.destinations || []).map((d) => {
          const tone = STATE_TONE[d.state];
          const p = d.progress;
          return (
            <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{d.name}</div>
                  <div className="text-[10px] text-panel-muted">
                    {d.platformLabel} · {d.hasKey ? "anahtar kayıtlı" : "anahtar YOK"}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_CLASS[tone]}`}>
                  {STATE_LABEL[d.state]}
                  {d.state === "reconnecting" && d.retryInSecs != null ? ` · ${d.retryInSecs} sn` : ""}
                </span>
              </div>
              {p && isActive(d.state) && (
                <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-white/60">
                  <span>{p.bitrateKbps != null ? `${Math.round(p.bitrateKbps)} kbps` : "—"}</span>
                  <span>{p.fps ? `${p.fps.toFixed(0)} fps` : "—"}</span>
                  <span>{p.speed != null ? `hız ${p.speed.toFixed(2)}x` : "—"}</span>
                </div>
              )}
              {d.droppedTotal > 0 && <div className="mt-1 text-[10px] text-amber-300">Düşürülen paket: {d.droppedTotal}</div>}
              {d.lastError && (d.state === "failed" || d.state === "reconnecting" || d.state === "warning") && (
                <div className="mt-1 line-clamp-2 text-[10px] text-red-300/90">{d.lastError}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isActive(d.state) ? (
                  <button
                    type="button"
                    className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1 text-[11px]"
                    onClick={() => void ms.run(`${d.name} durdurma`, () => multistreamApi.stop(d.id))}
                  >
                    <Square className="h-3 w-3" /> Durdur
                  </button>
                ) : (
                  <button
                    type="button"
                    className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1 text-[11px]"
                    disabled={!d.enabled || !d.hasKey || !s?.session}
                    title={!s?.session ? "Önce çoklu yayını başlatın" : !d.hasKey ? "Yayın anahtarı yok" : undefined}
                    onClick={() => void ms.run(`${d.name} başlatma`, () => multistreamApi.start(d.id))}
                  >
                    <Play className="h-3 w-3" /> Başlat
                  </button>
                )}
                <button
                  type="button"
                  className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1 text-[11px]"
                  onClick={() => openEdit(d)}
                >
                  <Pencil className="h-3 w-3" /> Düzenle
                </button>
                <ConfirmButton
                  label="Sil"
                  confirmLabel="Silinsin mi?"
                  className="rounded-lg px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
                  onConfirm={() => void ms.run("Silme", () => multistreamApi.remove(d.id))}
                />
              </div>
            </div>
          );
        })}
      </div>

      {draft ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="yya-label">
              Ad
              <input
                className="yya-input mt-1 w-full"
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ör. Twitch ana kanal"
              />
            </label>
            <label className="yya-label">
              Platform
              <select
                className="yya-input mt-1 w-full"
                value={draft.platform}
                onChange={(e) => {
                  const platform = e.target.value as Platform;
                  const pre = presets.find((p) => p.platform === platform)?.server || "";
                  setDraft({ ...draft, platform, server: draft.id ? draft.server : pre });
                }}
              >
                {presets.map((p) => (
                  <option key={p.platform} value={p.platform}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="yya-label block">
            Sunucu adresi (anahtarsız)
            <input
              className="yya-input mt-1 w-full font-mono"
              value={draft.server}
              onChange={(e) => setDraft({ ...draft, server: e.target.value })}
              placeholder={draft.platform === "kick" ? "Kick panelindeki sunucu: rtmps://…/app" : "rtmps://…"}
            />
          </label>
          <label className="yya-label block">
            Yayın anahtarı {draft.id ? "(boş bırakılırsa mevcut anahtar korunur)" : ""}
            <input
              type="password"
              autoComplete="off"
              className="yya-input mt-1 w-full font-mono"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="Windows Kimlik Yöneticisinde saklanır"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-white/70">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            GO LIVE ile başlasın
          </label>
          <div className="flex gap-2">
            <button type="button" className="yya-btn-primary" onClick={() => void save()}>
              Kaydet
            </button>
            <button type="button" className="yya-btn-ghost" onClick={() => setDraft(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="yya-btn-ghost inline-flex items-center gap-1.5" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Hedef ekle
        </button>
      )}
    </div>
  );
}

function PreflightPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
  const [data, setData] = useState<{ findings: Finding[]; encoder: EncoderInfo } | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await ms.run("Kontrol listesi", multistreamApi.preflight);
    if (r) setData(r);
    setLoading(false);
  }, [ms]);
  const destKey = (ms.status?.destinations || []).map((d) => `${d.id}:${d.enabled}:${d.platform}`).join("|");
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey]);

  // Kullanıcının ölçtüğü yükleme hızı (Mbps): bant gereksinimi bununla karşılaştırılır; girilmezse yalnız gereksinim gösterilir
  const [upload, setUpload] = useState("");
  useEffect(() => {
    fetchSettings("panel")
      .then((s) => {
        const v = Number(s.multistreamUploadMbps);
        if (Number.isFinite(v) && v > 0) setUpload(String(v));
      })
      .catch(() => {});
  }, []);
  const saveUpload = async () => {
    const v = Number(upload.replace(",", "."));
    const deger = upload.trim() === "" ? null : Number.isFinite(v) && v > 0 && v < 100000 ? v : undefined;
    if (deger === undefined) return;
    await patchSettings("panel", { multistreamUploadMbps: deger }).catch(() => {});
    void load();
  };
  const e = data?.encoder;
  const icon = (l: Finding["level"]) =>
    l === "block" ? <ShieldAlert className="h-3.5 w-3.5 text-red-300" /> : l === "warn" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> : <Info className="h-3.5 w-3.5 text-sky-300" />;
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
        <span>
          OBS: {e?.codec ? e.codec.toUpperCase() : "?"} · {e?.bitrateKbps ?? "?"} kbps · {e?.rateControl ?? "?"} · anahtar kare{" "}
          {e?.keyintSec ?? "?"} sn · {e?.width && e?.height ? `${e.width}×${e.height}` : "?"}
          {e?.fps ? ` @${Math.round(e.fps)}` : ""}
        </span>
        <button type="button" className="yya-btn-ghost !px-2 !py-1" disabled={loading} onClick={() => void load()} title="Yenile">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-white/70">
        Ölçtüğüm yükleme hızı
        <input
          className="yya-input w-20 !py-0.5 text-xs"
          inputMode="decimal"
          placeholder="Mbps"
          value={upload}
          onChange={(ev) => setUpload(ev.target.value)}
          onBlur={() => void saveUpload()}
          onKeyDown={(ev) => ev.key === "Enter" && void saveUpload()}
        />
        Mbps
      </label>
      {data && data.findings.length === 0 && <p className="text-emerald-300">Sorun bulunmadı.</p>}
      <ul className="space-y-1.5">
        {(data?.findings || []).map((f, i) => (
          <li key={`${f.id}-${f.destination}-${i}`} className="flex gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
            <span className="mt-0.5 shrink-0">{icon(f.level)}</span>
            <span className="min-w-0">
              <span className="text-white/90">{f.message}</span>
              <span className="block text-[10px] text-panel-muted">
                {f.source}
                {f.source === "hesap" || f.source === "uygulama" ? "" : ` · doğrulama ${f.verified}`}
                {f.destination ? ` · hedef ${ms.status?.destinations.find((d) => d.id === f.destination)?.name || f.destination}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type AlertState = { paused: boolean; muted: boolean; version: number; updatedBy: string; lastAction: string | null; updatedAt: number };
type RecentAlert = { id: string; eventType: string; title: string; message: string; at: number; isTest: boolean };

function AlertQueuePanel({ onToast }: { onToast: (m: string) => void }) {
  const [state, setState] = useState<AlertState | null>(null);
  const [recent, setRecent] = useState<RecentAlert[]>([]);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${await streamaxtBase()}/api/alerts/control`, { cache: "no-store" });
      const d = await r.json();
      setState(d.state);
      setRecent(d.recent || []);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load();
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: number | undefined;
    const connect = async () => {
      const kok = await streamaxtBase();
      if (closed) return;
      ws = new WebSocket(`${kok.replace(/^http/, "ws")}/ws?type=dashboard`);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data));
          if (m?.type === "alert_control" && m.state) setState(m.state);
          if (m?.type === "alert_control" || m?.type === "alert") window.setTimeout(() => void load(), 250);
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(() => void connect(), 4000);
      };
    };
    void connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      ws?.close();
    };
  }, [load]);

  const act = async (action: string, alertId?: string) => {
    try {
      const r = await fetch(`${await streamaxtBase()}/api/alerts/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: state?.version, alertId, actor: "Kontrol Merkezi" }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.state) setState(d.state);
      if (d?.recent) setRecent(d.recent);
      if (r.status === 409) onToast(`${d.error || "Başka biri az önce değiştirdi"} — güncel durum yüklendi`);
      else if (!r.ok) onToast(d.error || "Uyarı denetimi uygulanamadı");
    } catch {
      onToast("StreamAxT'e ulaşılamadı (Bot sekmesinden başlatın)");
    }
  };

  if (offline) return <p className="text-xs text-white/50">StreamAxT çalışmıyor — uyarı kuyruğu denetimi için Bot sekmesinden başlatın.</p>;

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1" disabled={!state} onClick={() => void act(state?.paused ? "resume" : "pause")}>
          {state?.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />} {state?.paused ? "Sürdür" : "Duraklat"}
        </button>
        <button type="button" className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1" disabled={!state} onClick={() => void act(state?.muted ? "unmute" : "mute")}>
          {state?.muted ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />} {state?.muted ? "Sesi aç" : "Sessize al"}
        </button>
        <button type="button" className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1" disabled={!state} onClick={() => void act("skip")}>
          <SkipForward className="h-3 w-3" /> Atla
        </button>
        <button type="button" className="yya-btn-ghost inline-flex items-center gap-1 !px-2 !py-1" disabled={!state} onClick={() => void act("clear")}>
          <Trash2 className="h-3 w-3" /> Bekleyenleri temizle
        </button>
        {state?.paused && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_CLASS.warn}`}>DURAKLATILDI</span>}
        {state?.muted && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_CLASS.bad}`}>SESSİZ</span>}
      </div>
      {state?.lastAction && (
        <p className="text-[10px] text-panel-muted">
          Son: {state.updatedBy} · {state.lastAction} · {new Date(state.updatedAt).toLocaleTimeString("tr-TR")}
        </p>
      )}
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {recent.length === 0 && <p className="text-panel-muted">Bu oturumda uyarı yok.</p>}
        {recent.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
            <span className="min-w-0 truncate text-white/80">
              {u.title || u.eventType} <span className="text-panel-muted">{u.message}</span>
              {u.isTest && <span className="ml-1 text-[10px] text-cyan-300">TEST</span>}
            </span>
            <button type="button" className="shrink-0 rounded p-1 hover:bg-white/10" title="Yeniden oynat" onClick={() => void act("replay", u.id)}>
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
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

  // Ses ölçerleri: panel görünürken 2/sn. OBS aboneliği istek kesilince kapanır.
  const bagli = !!status?.connected && inputs.length > 0;
  useEffect(() => {
    if (!bagli) return;
    let iptal = false;
    const id = setVisibleInterval(() => {
      obsApi
        .meters()
        .then((r) => {
          if (!iptal) setSeviye(r.ageMs >= 0 && r.ageMs < 2000 ? Object.fromEntries(r.inputs.map((l) => [l.name, l])) : {});
        })
        .catch(() => !iptal && setSeviye({}));
    }, 500);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
    };
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
              className={`truncate rounded-lg border px-2 py-2 text-left font-semibold transition ${
                aktif ? "border-red-500/60 bg-red-500/20 text-white" : "border-white/10 bg-white/[0.03] text-white/80 hover:border-white/30"
              }`}
              title={aktif ? "Yayındaki sahne" : `${ad} sahnesine geç`}
            >
              {aktif && <span className="mr-1 text-[9px] font-black text-red-300">CANLI</span>}
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
function SesOlceri({ seviye, susturulmus }: { seviye?: ObsInputLevel; susturulmus: boolean }) {
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

  const gruplar = list.reduce<Record<string, ActionInfo[]>>((m, a) => ((m[a.category] ||= []).push(a), m), {});
  return (
    <div className="space-y-2 text-xs">
      {Object.entries(gruplar).map(([kategori, eylemler]) => (
        <div key={kategori}>
          <div className="mb-1 font-bold text-white/80">{CATEGORY_LABEL[kategori] || kategori}</div>
          <div className="flex flex-wrap gap-1.5">
            {eylemler.map((a) => {
              const sinif = `yya-btn-ghost !px-2 !py-1 ${a.available ? "" : "opacity-50"}`;
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

const ACTION_LABEL: Record<string, string> = {
  MULTISTREAM_DEST_ADD: "hedef ekledi",
  MULTISTREAM_DEST_UPDATE: "hedefi güncelledi",
  MULTISTREAM_DEST_DELETE: "hedefi sildi",
  MULTISTREAM_DEST_START: "hedefi başlattı",
  MULTISTREAM_DEST_STOP: "hedefi durdurdu",
  MULTISTREAM_SESSION_START: "oturumu açtı",
  MULTISTREAM_SESSION_STOP: "tüm hedefleri bitirdi",
  MULTISTREAM_GO_LIVE: "çoklu yayını başlattı",
  MULTISTREAM_OBS_CONNECT: "OBS'i yönlendiriciye bağladı",
  MULTISTREAM_OBS_RESTORE: "OBS ayarını geri yükledi",
};

function AuditPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const load = useCallback(async () => {
    const r = await ms.run("Denetim günlüğü", () => multistreamApi.audit(60));
    if (r) setRows(r.items);
  }, [ms]);
  const logKey = ms.status?.log?.length ?? 0;
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logKey]);
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto text-[11px]">
      {rows.length === 0 && <p className="text-panel-muted">Kayıt yok.</p>}
      {rows.map((r) => (
        <div key={r.id} className="flex justify-between gap-2 rounded bg-white/[0.03] px-2 py-1">
          <span className="text-white/80">
            <b className="text-white">{r.actor}</b>{" "}
            {ACTION_LABEL[r.action] || (r.action.startsWith("ACTION:") ? `eylem: ${r.action.slice(7)}` : r.action)}
          </span>
          <span className="shrink-0 text-panel-muted">{new Date(r.ts).toLocaleString("tr-TR")}</span>
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
      className="yya-input h-32 w-full resize-y text-xs"
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
        return <AlertQueuePanel onToast={onToast} />;
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
          className="yya-input !py-1 text-xs"
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
        <button type="button" className={`yya-btn-ghost !py-1 text-xs ${editing ? "ring-1 ring-panel-accent" : ""}`} onClick={() => setEditing((x) => !x)}>
          Düzeni düzenle
        </button>
      </div>

      {editing && hidden.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
          <span className="text-white/50">Gizli paneller:</span>
          {hidden.map((p) => (
            <button key={p.id} type="button" className="yya-btn-ghost !px-2 !py-0.5" onClick={() => setLayout(toggleVisible(layout, p.id))}>
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
              <span className="truncate text-[10px] text-panel-muted">{meta[p.id].hint}</span>
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
