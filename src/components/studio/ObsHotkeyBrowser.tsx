import { useMemo, useState } from "react";
import { Play, Search, Trash2 } from "lucide-react";
import HotkeyInput from "../panel/HotkeyInput";
import HotkeyStatusDot, { type HotkeyFailure } from "./HotkeyStatusDot";
import { actionBindingId, listObsHotkeys } from "../../lib/obsActions";
import {
  GROUP_LABEL,
  buildHotkeyCatalog,
  friendlyHotkeyName,
  hotkeyGroup,
  isGeneralName,
  type CatalogEntry,
  type HotkeyGroup,
  type HotkeyRow,
} from "../../lib/obsHotkeyCatalog";

/**
 * Diğer OBS kısayolları — OBS'in "Ayarlar → Kısayollar" listesinin tamamı.
 *
 * OBS'e bağlanıp gerçek kısayol listesini okur (sürüm/eklenti farkı olmasın),
 * seçtiğin kısayola bir tuş bağlar. Ses kaynağı sessize alma, bas-konuş,
 * tarayıcı kaynağı yenileme, belirli bir sahneyi seçme gibi bir kaynağa ait
 * kısayollar için hangi kaynak olduğunu da seçersin.
 */

type Props = {
  rows: HotkeyRow[];
  inputs: { name: string }[];
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
    ? `hk:${crypto.randomUUID()}`
    : `hk:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function ObsHotkeyBrowser({
  rows,
  inputs,
  scenes,
  obsConnected,
  registered,
  failures,
  onListeningChange,
  onChange,
  onRun,
}: Props) {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [context, setContext] = useState("");
  const [hotkey, setHotkey] = useState("");

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setCatalog(buildHotkeyCatalog(await listObsHotkeys()));
    } catch (e) {
      setCatalog(null);
      setError(obsConnected ? String((e as Error)?.message || e) : "Önce OBS'e bağlan (Dashboard → OBS WebSocket).");
    } finally {
      setBusy(false);
    }
  };

  const shown = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    return catalog
      // Sık kullanılanlar yukarıdaki "Yayın ve kayıt" bölümünde; burada tekrar etme.
      .filter((c) => !isGeneralName(c.name))
      .filter((c) => !q || c.label.toLocaleLowerCase("tr").includes(q) || c.name.toLocaleLowerCase("tr").includes(q));
  }, [catalog, query]);

  const selected = catalog?.find((c) => c.name === name) || null;
  const group: HotkeyGroup | null = selected ? selected.group : name ? hotkeyGroup(name) : null;
  const contextOptions = group === "scene" ? scenes : inputs.map((i) => i.name);
  const canAdd = !!name && !!hotkey.trim() && (!selected?.needsContext || !!context.trim());

  const add = () => {
    if (!canAdd) return;
    const ctx = selected?.needsContext ? context.trim() : "";
    onChange([
      ...rows,
      {
        id: newId(),
        kind: "obsHotkey",
        name,
        source: ctx,
        label: `${friendlyHotkeyName(name)}${ctx ? ` · ${ctx}` : ""}`,
        hotkey: hotkey.trim(),
      },
    ]);
    setHotkey("");
    setContext("");
  };

  const patch = (id: string, part: Partial<HotkeyRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...part } : r)));

  const grouped = useMemo(() => {
    const m = new Map<HotkeyGroup, CatalogEntry[]>();
    for (const c of shown) m.set(c.group, [...(m.get(c.group) || []), c]);
    return [...m.entries()];
  }, [shown]);

  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass">
      <div className="border-b border-white/[0.06] pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Search className="h-4.5 w-4.5 text-panel-accent" /> Diğer OBS kısayolları
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-white/75">
          OBS'in Ayarlar → Kısayollar listesindeki her komut: ses kaynağını sessize alma, bas-konuş, tarayıcı
          kaynağını yenileme, stüdyo modu, belirli bir sahneyi seçme…
        </p>
      </div>

      <div className="space-y-3 rounded-xl bg-white/[0.03] p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            className="studio-btn-ghost h-9 px-3.5 text-xs md:text-sm font-bold disabled:opacity-50"
            onClick={() => void load()}
          >
            {busy ? "Okunuyor…" : catalog ? "Listeyi yenile" : "OBS'ten kısayolları yükle"}
          </button>
          {catalog && (
            <input
              className="studio-input h-9 min-w-[10rem] flex-1 text-xs md:text-sm font-medium text-white"
              placeholder="Ara (ör. sessize, tarayıcı, sahne)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">{error}</p>}

        {catalog && (
          <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto_auto]">
            <label className="text-xs font-bold uppercase tracking-wider text-white/80">
              Kısayol
              <select
                className="studio-input mt-1 h-9 w-full text-xs md:text-sm font-medium text-white"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setContext("");
                }}
              >
                <option value="">Seç…</option>
                {grouped.map(([g, list]) => (
                  <optgroup key={g} label={GROUP_LABEL[g]}>
                    {list.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.label}
                        {c.count > 1 ? ` (${c.count} kaynak)` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-white/80">
              {group === "scene" ? "Sahne" : "Kaynak"}
              <input
                className="studio-input mt-1 h-9 w-full text-xs md:text-sm font-medium text-white disabled:opacity-40"
                list="obs-hk-context"
                value={context}
                disabled={!selected?.needsContext}
                placeholder={selected?.needsContext ? "Hangisi?" : "Gerekmez"}
                onChange={(e) => setContext(e.target.value)}
              />
              <datalist id="obs-hk-context">
                {contextOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="text-xs font-bold uppercase tracking-wider text-white/80">
              Tuş
              <div className="mt-1">
                <HotkeyInput
                  className="h-9 w-32 rounded-lg border border-panel-border bg-black/50 px-2 text-center font-mono text-xs md:text-sm font-medium text-white"
                  value={hotkey}
                  onListeningChange={onListeningChange}
                  onChange={setHotkey}
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                disabled={!canAdd}
                className="h-9 rounded-lg bg-panel-accent px-4 text-xs md:text-sm font-bold text-[#08131c] hover:bg-panel-accent/90 disabled:opacity-40"
                onClick={add}
              >
                Ekle
              </button>
            </div>
          </div>
        )}
        {catalog && selected?.needsContext && (
          <p className="text-[10px] text-panel-muted">
            Bu kısayol OBS'te {selected.count} yerde tanımlı; hangi {group === "scene" ? "sahne" : "kaynak"} için
            olduğunu yaz.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
              <HotkeyStatusDot
                bindingId={actionBindingId(r.id)}
                hotkey={r.hotkey || ""}
                registered={registered}
                failures={failures}
              />
              <div className="min-w-[8rem] flex-1">
                <div className="truncate text-xs font-medium text-white">
                  {friendlyHotkeyName(String(r.name))}
                  {r.source ? ` · ${r.source}` : ""}
                </div>
                <div className="truncate font-mono text-[10px] text-panel-muted">{r.name}</div>
              </div>
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
          ))}
        </div>
      )}
    </section>
  );
}
