import { useState } from "react";
import { Eye, Play, Plus, Trash2 } from "lucide-react";
import HotkeyInput from "../panel/HotkeyInput";
import HotkeyStatusDot, { type HotkeyFailure } from "./HotkeyStatusDot";
import { SOURCE_MODES, actionBindingId, listSceneItems, type SourceMode } from "../../lib/obsActions";
import type { HotkeyRow } from "../../lib/obsHotkeyCatalog";

/**
 * Kaynak görünürlüğü kısayolları — sahnedeki bir kaynağı (kamera, görsel, yazı…)
 * tek tuşla göster / gizle / tersle.
 *
 * Kaynak adını elle yazmak yerine sahneyi seçip OBS'ten kaynak listesini
 * yüklüyor, tıklayarak ekliyorsun.
 */

type Props = {
  rows: HotkeyRow[];
  scenes: string[];
  obsConnected: boolean;
  registered: Set<string>;
  failures: HotkeyFailure[];
  onListeningChange: (listening: boolean) => void;
  onChange: (rows: HotkeyRow[]) => void;
  onRun: (row: HotkeyRow) => void;
};

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SourceVisibilityHotkeys({
  rows,
  scenes,
  obsConnected,
  registered,
  failures,
  onListeningChange,
  onChange,
  onRun,
}: Props) {
  const [scene, setScene] = useState("");
  const [items, setItems] = useState<string[] | null>(null);
  const [loadedScene, setLoadedScene] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await listSceneItems(scene);
      setItems(r.items);
      setLoadedScene(r.scene);
    } catch (e) {
      setItems(null);
      setError(obsConnected ? String((e as Error)?.message || e) : "Önce OBS'e bağlan (Dashboard → OBS WebSocket).");
    } finally {
      setBusy(false);
    }
  };

  const add = (source: string) => {
    if (rows.some((r) => r.source === source && (r.scene || "") === loadedScene)) return;
    onChange([...rows, { id: newId(), kind: "srcToggle", scene: loadedScene, source, mode: "toggle", hotkey: "" }]);
  };

  const patch = (id: string, part: Partial<HotkeyRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...part } : r)));

  return (
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Eye className="h-4 w-4 text-panel-accent" /> Kaynak görünürlüğü
        </h3>
        <p className="mt-0.5 text-[11px] leading-snug text-panel-muted">
          Sahnedeki bir kaynağı (kamera, görsel, yazı…) tek tuşla göster, gizle ya da tersle. Bir sahne
          seçip kaynakları yükle, eklemek istediğine tıkla.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg bg-white/[0.03] p-2.5">
        <label className="min-w-[10rem] flex-1 text-[11px] text-panel-muted">
          Sahne
          <input
            className="yya-input mt-0.5 h-8 w-full text-xs"
            list="src-vis-scenes"
            value={scene}
            placeholder="Boş = şu an yayındaki sahne"
            onChange={(e) => setScene(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          className="yya-btn-ghost h-8 px-3 text-xs disabled:opacity-50"
          onClick={() => void load()}
        >
          {busy ? "Yükleniyor…" : "Kaynakları yükle"}
        </button>
        <datalist id="src-vis-scenes">
          {scenes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {error && <p className="rounded-md bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">{error}</p>}

      {items && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-panel-muted">
            «{loadedScene}» sahnesindeki kaynaklar{items.length ? "" : " — kaynak yok"}:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((it) => {
              const added = rows.some((r) => r.source === it && (r.scene || "") === loadedScene);
              return (
                <button
                  key={it}
                  type="button"
                  disabled={added}
                  onClick={() => add(it)}
                  className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white transition hover:bg-panel-accent/20 disabled:opacity-40"
                  title={added ? "Zaten ekli" : "Kısayol ekle"}
                >
                  {!added && <Plus className="h-3 w-3" />}
                  {it}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg bg-white/[0.03] px-3 py-3 text-center text-[11px] text-panel-muted">
          Henüz kaynak kısayolu yok. Yukarıdan bir sahnenin kaynaklarını yükleyip birine tıkla.
        </p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const bid = actionBindingId(r.id);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
                <HotkeyStatusDot
                  bindingId={bid}
                  hotkey={r.hotkey || ""}
                  registered={registered}
                  failures={failures}
                />
                <div className="min-w-[8rem] flex-1">
                  <div className="truncate text-xs font-medium text-white">{r.source}</div>
                  <div className="truncate text-[10px] text-panel-muted">
                    {r.scene ? `Sahne: ${r.scene}` : "Şu an yayındaki sahne"}
                  </div>
                </div>
                <select
                  className="yya-input h-8 w-[9.5rem] text-xs"
                  value={(r.mode as SourceMode) || "toggle"}
                  aria-label="İşlem"
                  onChange={(e) => patch(r.id, { mode: e.target.value })}
                >
                  {SOURCE_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <HotkeyInput
                  className="w-28 rounded border border-panel-border bg-black/40 px-1.5 py-1 text-center text-xs"
                  value={r.hotkey || ""}
                  onListeningChange={onListeningChange}
                  onChange={(v) => patch(r.id, { hotkey: v })}
                />
                <button
                  type="button"
                  title="Şimdi dene"
                  className="rounded bg-panel-accent/80 px-2 py-1 text-[#08131c]"
                  onClick={() => onRun(r)}
                >
                  <Play className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  title="Sil"
                  className="rounded bg-red-900/40 px-2 py-1 text-red-200"
                  onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
