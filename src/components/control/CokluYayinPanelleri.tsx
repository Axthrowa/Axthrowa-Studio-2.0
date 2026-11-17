/** Kontrol Merkezi: çoklu yayın oturumu, hedefler, ön kontrol ve denetim panelleri (TEK-4). */
import { useCallback, useEffect, useState } from "react";
import { Play, Square, Plus, Pencil, RefreshCw, AlertTriangle, ShieldAlert, Info, Link2, Undo2 } from "lucide-react";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { isObsConnected } from "../../lib/obs";
import { vodMuzikDenetle, vodMuzikDuzelt } from "../../lib/vodMuzik";
import { formatBytes, isActive, overallLive, STATE_LABEL, STATE_TONE } from "../../lib/controlCenter";
import { multistreamApi, type AuditRow, type Destination, type EncoderInfo, type Finding, type MultistreamStatus, type Platform } from "../../lib/api/multistream";

export const TONE_CLASS = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  bad: "bg-red-500/15 text-red-300 border-red-500/30",
  idle: "bg-white/[0.05] text-white/60 border-white/10",
} as const;

// ─── Canlı durum ─────────────────────────────────────────────────────────

export function useMultistream(onToast: (m: string) => void) {
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

export function ConfirmButton({
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

export function SessionPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
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
          className={`rounded-full border px-2.5 py-1 text-ui-2 font-bold ${
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
          className="studio-btn-primary inline-flex items-center gap-1.5"
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
          className="studio-btn-ghost inline-flex items-center gap-1.5"
          disabled={!!busy || !s?.ffmpeg}
          title="OBS'in yayın servisini yerel alıcıya çevirir; özgün ayar Kimlik Yöneticisine yedeklenir"
          onClick={() => void go("obs", () => ms.run("OBS yönlendirme", multistreamApi.obsConnect))}
        >
          <Link2 className="h-3.5 w-3.5" /> OBS'i yönlendiriciye bağla
        </button>
        {s?.obsRedirected && (
          <button
            type="button"
            className="studio-btn-ghost inline-flex items-center gap-1.5"
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
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-ui-2 font-semibold text-red-200 disabled:opacity-40"
          onConfirm={() => void go("end", () => ms.run("Oturumu kapatma", multistreamApi.endAll))}
        />
      </div>
      {s?.ingest && (
        <p className="text-ui-2 text-panel-muted">
          Elle kurulum için OBS → Ayarlar → Yayın → Özel: sunucu <code className="text-white/70">{s.ingest.server}</code>
          {" "}(anahtar "OBS'i yönlendiriciye bağla" ile otomatik yazılır).
        </p>
      )}
      {!!s?.log?.length && (
        <div className="max-h-24 overflow-y-auto rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-ui-2 text-white/50">
          {[...s.log].reverse().slice(0, 12).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export type Draft = { id?: string; name: string; platform: Platform; server: string; enabled: boolean; key: string };

export function DestinationsPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
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
                  <div className="text-ui-2 text-panel-muted">
                    {d.platformLabel} · {d.hasKey ? "anahtar kayıtlı" : "anahtar YOK"}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-ui-2 font-bold ${TONE_CLASS[tone]}`}>
                  {STATE_LABEL[d.state]}
                  {d.state === "reconnecting" && d.retryInSecs != null ? ` · ${d.retryInSecs} sn` : ""}
                </span>
              </div>
              {p && isActive(d.state) && (
                <div className="mt-1.5 grid grid-cols-3 gap-1 text-ui-2 text-white/60">
                  <span>{p.bitrateKbps != null ? `${Math.round(p.bitrateKbps)} kbps` : "—"}</span>
                  <span>{p.fps ? `${p.fps.toFixed(0)} fps` : "—"}</span>
                  <span>{p.speed != null ? `hız ${p.speed.toFixed(2)}x` : "—"}</span>
                </div>
              )}
              {d.droppedTotal > 0 && <div className="mt-1 text-ui-2 text-amber-300">Düşürülen paket: {d.droppedTotal}</div>}
              {d.lastError && (d.state === "failed" || d.state === "reconnecting" || d.state === "warning") && (
                <div className="mt-1 line-clamp-2 text-ui-2 text-red-300/90">{d.lastError}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {isActive(d.state) ? (
                  <button
                    type="button"
                    className="studio-btn-ghost inline-flex items-center gap-1 !px-2 !py-1 text-ui-2"
                    onClick={() => void ms.run(`${d.name} durdurma`, () => multistreamApi.stop(d.id))}
                  >
                    <Square className="h-3 w-3" /> Durdur
                  </button>
                ) : (
                  <button
                    type="button"
                    className="studio-btn-ghost inline-flex items-center gap-1 !px-2 !py-1 text-ui-2"
                    disabled={!d.enabled || !d.hasKey || !s?.session}
                    title={!s?.session ? "Önce çoklu yayını başlatın" : !d.hasKey ? "Yayın anahtarı yok" : undefined}
                    onClick={() => void ms.run(`${d.name} başlatma`, () => multistreamApi.start(d.id))}
                  >
                    <Play className="h-3 w-3" /> Başlat
                  </button>
                )}
                <button
                  type="button"
                  className="studio-btn-ghost inline-flex items-center gap-1 !px-2 !py-1 text-ui-2"
                  onClick={() => openEdit(d)}
                >
                  <Pencil className="h-3 w-3" /> Düzenle
                </button>
                <ConfirmButton
                  label="Sil"
                  confirmLabel="Silinsin mi?"
                  className="rounded-lg px-2 py-1 text-ui-2 text-red-300 hover:bg-red-500/10"
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
            <label className="studio-label">
              Ad
              <input
                className="studio-input mt-1 w-full"
                value={draft.name}
                maxLength={60}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ör. Twitch ana kanal"
              />
            </label>
            <label className="studio-label">
              Platform
              <select
                className="studio-input mt-1 w-full"
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
          <label className="studio-label block">
            Sunucu adresi (anahtarsız)
            <input
              className="studio-input mt-1 w-full font-mono"
              value={draft.server}
              onChange={(e) => setDraft({ ...draft, server: e.target.value })}
              placeholder={draft.platform === "kick" ? "Kick panelindeki sunucu: rtmps://…/app" : "rtmps://…"}
            />
          </label>
          <label className="studio-label block">
            Yayın anahtarı {draft.id ? "(boş bırakılırsa mevcut anahtar korunur)" : ""}
            <input
              type="password"
              autoComplete="off"
              className="studio-input mt-1 w-full font-mono"
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="Windows Kimlik Yöneticisinde saklanır"
            />
          </label>
          <label className="flex items-center gap-2 text-ui-2 text-white/70">
            <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            GO LIVE ile başlasın
          </label>
          <div className="flex gap-2">
            <button type="button" className="studio-btn-primary" onClick={() => void save()}>
              Kaydet
            </button>
            <button type="button" className="studio-btn-ghost" onClick={() => setDraft(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="studio-btn-ghost inline-flex items-center gap-1.5" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Hedef ekle
        </button>
      )}
    </div>
  );
}

/** Y14: müzik Twitch VOD izine de gidiyorsa uyarı ve tek tıkla düzeltme */
export function VodMuzikUyarisi({ onToast }: { onToast: (m: string) => void }) {
  const [sonuc, setSonuc] = useState<{ iz: number | null; sorunlu: string[] } | null>(null);
  const denetle = useCallback(() => {
    if (!isObsConnected()) return;
    vodMuzikDenetle()
      .then(setSonuc)
      .catch(() => setSonuc(null));
  }, []);
  useEffect(denetle, [denetle]);
  if (!sonuc?.sorunlu.length || sonuc.iz === null) return null;
  const iz = sonuc.iz;
  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1 text-white/90">
        Müzik Twitch VOD izine ({iz}. iz) de gidiyor: {sonuc.sorunlu.join(", ")}. Telifli müzik VOD'u sessize aldırabilir.
      </span>
      <button
        type="button"
        className="studio-btn-ghost shrink-0 !px-2 !py-0.5"
        onClick={() =>
          void vodMuzikDuzelt(iz, sonuc.sorunlu)
            .then(() => onToast("Müzik VOD izinden çıkarıldı; canlı yayında çalmaya devam eder"))
            .catch((e) => onToast(`Düzeltilemedi: ${String((e as Error).message || e).slice(0, 120)}`))
            .finally(denetle)
        }
      >
        Düzelt
      </button>
    </div>
  );
}

export function PreflightPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
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
      <div className="flex items-center justify-between gap-2 text-ui-2 text-white/60">
        <span>
          OBS: {e?.codec ? e.codec.toUpperCase() : "?"} · {e?.bitrateKbps ?? "?"} kbps · {e?.rateControl ?? "?"} · anahtar kare{" "}
          {e?.keyintSec ?? "?"} sn · {e?.width && e?.height ? `${e.width}×${e.height}` : "?"}
          {e?.fps ? ` @${Math.round(e.fps)}` : ""}
        </span>
        <button type="button" className="studio-btn-ghost !px-2 !py-1" disabled={loading} onClick={() => void load()} title="Yenile">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <label className="flex items-center gap-2 text-ui-2 text-white/70">
        Ölçtüğüm yükleme hızı
        <input
          className="studio-input w-20 !py-0.5 text-xs"
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
              <span className="block text-ui-2 text-panel-muted">
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

export const ACTION_LABEL: Record<string, string> = {
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

export function AuditPanel({ ms }: { ms: ReturnType<typeof useMultistream> }) {
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
    <div className="max-h-64 space-y-1 overflow-y-auto text-ui-2">
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
