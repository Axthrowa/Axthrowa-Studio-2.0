import { Play, Plus, Trash2, Zap } from "lucide-react";
import HotkeyInput from "../panel/HotkeyInput";
import {
  ACTION_KINDS,
  actionBindingId,
  missingField,
  normalizeRecordMode,
  type ActionKind,
  type ActionRow,
  type RecordMode,
} from "../../lib/obsActions";

/**
 * OBS eylem kısayolları — sahne değiştirmenin ötesi: kaynak aç/kapa, kayıt,
 * ses seviyesi, filtre, sahne gezme ve OBS'in kendi kısayolları.
 *
 * Satırlar `obs.actionHotkeys[]` içinde durur; kaydı ve çakışma denetimi
 * `lib/hotkeyPlan.ts` yapar, tuşu Rust (`hotkeys.rs`) çalıştırır.
 */

type Failure = { id: string; spec: string; reason: string };

type Props = {
  rows: ActionRow[];
  scenes: string[];
  inputs: { name: string }[];
  /** Kaydedilen binding kimlikleri (`act:<satır>`) */
  registered: Set<string>;
  failures: Failure[];
  onListeningChange: (listening: boolean) => void;
  onChange: (rows: ActionRow[]) => void;
  /** Satırı şimdi çalıştır (kısayola basmadan dene) */
  onRun: (row: ActionRow) => void;
  /** Kendi bölümü olan türler (kaynak görünürlüğü, OBS kısayolu) bu listede seçilmez. */
  hideKinds?: ActionKind[];
};

const field = "yya-input mt-0.5 h-8 w-full text-xs";

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Aynı üç durumlu nokta: yeşil kayıtlı · kırmızı kaydedilemedi · sarı bekliyor. */
function Dot({
  id,
  hotkey,
  eksik,
  registered,
  failures,
}: {
  id: string;
  hotkey: string;
  eksik: string | null;
  registered: Set<string>;
  failures: Failure[];
}) {
  const fail = failures.find((f) => f.id === id);
  const ok = !!hotkey && registered.has(id);
  const color = fail ? "bg-red-400" : ok ? "bg-emerald-400" : "bg-amber-400";
  const title = !hotkey
    ? "Kısayol atanmadı"
    : eksik
      ? `Eksik alan: ${eksik} — bu satır kaydedilmez`
      : fail
        ? `Kaydedilemedi: ${fail.reason}`
        : ok
          ? "Küresel kayıt tutuyor — uygulama tepsideyken de çalışır"
          : "Yalnızca panel odaktayken çalışır";
  return <span className={"size-2 shrink-0 rounded-full " + color} title={title} />;
}

export default function ObsActionSettings({
  rows,
  scenes,
  inputs,
  registered,
  failures,
  onListeningChange,
  onChange,
  onRun,
  hideKinds = [],
}: Props) {
  const patch = (idx: number, part: Partial<ActionRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...part } : r)));

  return (
    <section className="w-full min-w-0 rounded-xl border border-white/[0.07] bg-[#101216] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
          <Zap className="h-4 w-4 text-panel-accent" /> OBS eylemleri
        </h3>
        <button
          type="button"
          className="yya-btn-ghost inline-flex h-7 items-center gap-1 px-2 text-[10px]"
          onClick={() => onChange([...rows, { id: newId(), kind: (ACTION_KINDS.find((k) => !hideKinds.includes(k.id))?.id || "volume") as ActionKind, hotkey: "" }])}
        >
          <Plus className="h-3 w-3" /> Eylem
        </button>
      </div>
      <p className="mb-2 text-[10px] text-panel-muted">
        Kaynak aç/kapa, kayıt, ses seviyesi, filtre ve sahne gezme. Bir kısayola bağlayıp yayın
        sırasında tek tuşla kullan.
      </p>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-panel-muted">
          Henüz eylem yok. “Eylem” ile ekle.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const bid = actionBindingId(row.id);
          const eksik = missingField(row);
          const hint = ACTION_KINDS.find((k) => k.id === row.kind)?.hint;
          const fail = failures.find((f) => f.id === bid);

          return (
            <div key={row.id} className="space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2">
              <div className="flex items-center gap-1.5">
                <select
                  className={field}
                  value={row.kind}
                  aria-label="Eylem türü"
                  onChange={(e) => patch(idx, { kind: e.target.value as ActionKind })}
                >
                  {ACTION_KINDS.filter((k) => !hideKinds.includes(k.id) || k.id === row.kind).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <Dot
                  id={bid}
                  hotkey={row.hotkey || ""}
                  eksik={eksik}
                  registered={registered}
                  failures={failures}
                />
                <button
                  type="button"
                  title="Şimdi dene"
                  disabled={!!eksik}
                  className="shrink-0 rounded bg-panel-accent/80 px-2 py-1 text-[11px] font-medium text-[#08131c] disabled:opacity-40"
                  onClick={() => onRun(row)}
                >
                  <Play className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Sil"
                  className="shrink-0 rounded bg-red-900/50 px-2 py-1 text-red-200"
                  onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              {/* --- türe göre alanlar --- */}
              {row.kind === "srcToggle" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="text-[11px] text-panel-muted">
                    Sahne
                    <input
                      className={field}
                      list="obs-act-scenes"
                      value={row.scene || ""}
                      placeholder="Boş = şu an yayındaki"
                      onChange={(e) => patch(idx, { scene: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] text-panel-muted">
                    Kaynak adı
                    <input
                      className={field}
                      value={row.source || ""}
                      placeholder="örn. Kamera"
                      onChange={(e) => patch(idx, { source: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {row.kind === "volume" && (
                <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
                  <label className="text-[11px] text-panel-muted">
                    Ses girişi
                    <input
                      className={field}
                      list="obs-act-inputs"
                      value={row.input || ""}
                      placeholder="örn. Müzik"
                      onChange={(e) => patch(idx, { input: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] text-panel-muted">
                    Fark (dB)
                    <input
                      className={field}
                      type="number"
                      step={1}
                      value={row.delta ?? -3}
                      onChange={(e) => patch(idx, { delta: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
              )}

              {row.kind === "record" && (
                <label className="block text-[11px] text-panel-muted">
                  Ne yapsın?
                  <select
                    className={field}
                    value={normalizeRecordMode(row.mode)}
                    onChange={(e) => patch(idx, { mode: e.target.value as RecordMode })}
                  >
                    <option value="toggle">Başlat / durdur (tersle)</option>
                    <option value="start">Yalnız başlat</option>
                    <option value="stop">Yalnız durdur</option>
                    <option value="pause">Duraklat / sürdür</option>
                  </select>
                </label>
              )}

              {row.kind === "filter" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="text-[11px] text-panel-muted">
                    Kaynak
                    <input
                      className={field}
                      value={row.source || ""}
                      placeholder="örn. Kamera"
                      onChange={(e) => patch(idx, { source: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] text-panel-muted">
                    Filtre adı
                    <input
                      className={field}
                      value={row.filter || ""}
                      placeholder="örn. Bulanıklık"
                      onChange={(e) => patch(idx, { filter: e.target.value })}
                    />
                  </label>
                </div>
              )}

              {row.kind === "obsHotkey" && (
                <label className="block text-[11px] text-panel-muted">
                  OBS kısayol adı
                  <input
                    className={field}
                    value={row.name || ""}
                    placeholder="örn. OBSBasic.StartReplayBuffer"
                    onChange={(e) => patch(idx, { name: e.target.value })}
                  />
                </label>
              )}

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-panel-muted">Kısayol</span>
                <HotkeyInput
                  className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-1.5 py-1 text-center text-xs"
                  value={row.hotkey || ""}
                  onListeningChange={onListeningChange}
                  onChange={(v) => patch(idx, { hotkey: v })}
                />
              </div>

              {fail && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                  Bu kısayol çalışmıyor: {fail.reason}. Farklı bir tuş seç.
                </p>
              )}
              {row.hotkey && eksik && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
                  Kısayol kaydedilmedi: {eksik} boş.
                </p>
              )}
              {hint && <p className="text-[10px] leading-snug text-panel-muted">{hint}</p>}
            </div>
          );
        })}
      </div>

      <datalist id="obs-act-scenes">
        {scenes.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="obs-act-inputs">
        {inputs.map((i) => (
          <option key={i.name} value={i.name} />
        ))}
      </datalist>
    </section>
  );
}
