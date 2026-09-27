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
    <section className="space-y-4 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass">
      <div className="border-b border-white/[0.06] pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Eye className="h-4.5 w-4.5 text-panel-accent" /> Kaynak görünürlüğü
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-white/75">
          Sahnedeki bir kaynağı (kamera, görsel, yazı…) tek tuşla göster, gizle ya da tersle. Bir sahne
          seçip kaynakları yükle, eklemek istediğine tıkla.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 rounded-xl bg-white/[0.03] p-3">
        <label className="min-w-[10rem] flex-1 text-xs font-bold uppercase tracking-wider text-white/80">
          Sahne
          <input
            className="yya-input mt-1 h-9 w-full text-xs md:text-sm font-medium text-white"
            list="src-vis-scenes"
            value={scene}
            placeholder="Boş = şu an yayındaki sahne"
            onChange={(e) => setScene(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          className="yya-btn-ghost h-9 px-3.5 text-xs md:text-sm font-bold disabled:opacity-50"
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

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">{error}</p>}

      {items && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/80">
            «{loadedScene}» sahnesindeki kaynaklar{items.length ? "" : " — kaynak yok"}:
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map((it) => {
              const added = rows.some((r) => r.source === it && (r.scene || "") === loadedScene);
              return (
                <button
                  key={it}
                  type="button"
                  disabled={added}
                  onClick={() => add(it)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-panel-accent/25 disabled:opacity-40"
                  title={added ? "Zaten ekli" : "Kısayol ekle"}
                >
                  {!added && <Plus className="h-3.5 w-3.5" />}
                  {it}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl bg-white/[0.03] px-4 py-4 text-center text-xs font-medium text-white/70">
          Henüz kaynak kısayolu yok. Yukarıdan bir sahnenin kaynaklarını yükleyip birine tıkla.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const bid = actionBindingId(r.id);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
                <HotkeyStatusDot
                  bindingId={bid}
                  hotkey={r.hotkey || ""}
                  registered={registered}
                  failures={failures}
                />
                <div className="min-w-[8rem] flex-1">
                  <div className="truncate text-xs md:text-sm font-bold text-white">{r.source}</div>
                  <div className="truncate text-xs text-white/75 font-medium">
                    {r.scene ? `Sahne: ${r.scene}` : "Şu an yayındaki sahne"}
                  </div>
                </div>
                <select
                  className="yya-input h-9 w-[10rem] text-xs md:text-sm font-medium text-white"
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
                  className="w-32 rounded-lg border border-panel-border bg-black/50 px-2 py-1.5 text-center font-mono text-xs md:text-sm font-medium text-white"
                  value={r.hotkey || ""}
                  onListeningChange={onListeningChange}
                  onChange={(v) => patch(r.id, { hotkey: v })}
                />
                <button
                  type="button"
                  title="Şimdi dene"
                  className="rounded-lg bg-panel-accent/85 p-2 text-[#08131c] hover:bg-panel-accent"
                  onClick={() => onRun(r)}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Sil"
                  className="rounded-lg bg-red-900/50 p-2 text-red-200 hover:bg-red-900/70"
                  onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
