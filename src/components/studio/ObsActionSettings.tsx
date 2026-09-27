import { useEffect, useState } from "react";
import { Play, Plus, Trash2, Zap } from "lucide-react";
import HotkeyInput from "../panel/HotkeyInput";
import { actionsApi, CATEGORY_LABEL, missingActionParam, type ActionInfo } from "../../lib/api/actions";
import { multistreamApi } from "../../lib/api/multistream";
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

const field = "yya-input mt-1 h-9 w-full text-xs md:text-sm font-medium text-white";

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
  return <span className={"size-2.5 shrink-0 rounded-full " + color} title={title} />;
}

type Hedef = { id: string; name: string };

/** "Panel eylemi" satırı: kayıt defterinden eylem seçimi ve o eylemin istediği alanlar. */
function PanelEylemiAlanlari({
  row,
  katalog,
  hedefler,
  onPatch,
}: {
  row: ActionRow;
  katalog: ActionInfo[] | null;
  hedefler: Hedef[];
  onPatch: (p: Partial<ActionRow>) => void;
}) {
  if (katalog === null) return <p className="text-xs text-white/70">Eylem listesi alınıyor…</p>;
  const spec = katalog.find((a) => a.id === row.name);
  const gruplar = new Map<string, ActionInfo[]>();
  for (const a of katalog) gruplar.set(a.category, [...(gruplar.get(a.category) || []), a]);
  const eksik = spec ? missingActionParam(spec, row) : null;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-wider text-white/80">
        Eylem
        <select className={field} value={row.name || ""} onChange={(e) => onPatch({ name: e.target.value, confirmed: false })}>
          <option value="">Eylem seç…</option>
          {[...gruplar.entries()].map(([kat, liste]) => (
            <optgroup key={kat} label={CATEGORY_LABEL[kat] || kat}>
              {liste.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                  {a.confirm ? " — onay ister" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {spec && spec.params.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {spec.params.map((p) => {
            switch (p.kind) {
              case "scene":
              case "optionalScene":
                return (
                  <label key={p.name} className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Sahne
                    <input
                      className={field}
                      list="obs-act-scenes"
                      value={row.scene || ""}
                      placeholder={p.kind === "optionalScene" ? "Boş = şu an yayındaki" : "OBS sahnesi"}
                      onChange={(e) => onPatch({ scene: e.target.value })}
                    />
                  </label>
                );
              case "engineScene":
                return (
                  <label key={p.name} className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Motor sahnesi
                    <input className={field} value={row.scene || ""} placeholder="Yayın sekmesindeki sahne adı" onChange={(e) => onPatch({ scene: e.target.value })} />
                  </label>
                );
              case "input":
                return (
                  <label key={p.name} className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Ses girişi
                    <input className={field} list="obs-act-inputs" value={row.input || ""} onChange={(e) => onPatch({ input: e.target.value })} />
                  </label>
                );
              case "source":
              case "engineSource":
                return (
                  <label key={p.name} className="text-xs font-bold uppercase tracking-wider text-white/80">
                    {p.kind === "engineSource" ? "Motor kaynağı" : "Kaynak adı"}
                    <input
                      className={field}
                      value={row.source || ""}
                      placeholder={p.kind === "engineSource" ? "Yayın sekmesindeki adı" : "örn. Kamera"}
                      onChange={(e) => onPatch({ source: e.target.value })}
                    />
                  </label>
                );
              case "destination":
                return (
                  <label key={p.name} className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Hedef
                    <select className={field} value={row.target || ""} onChange={(e) => onPatch({ target: e.target.value })}>
                      <option value="">Hedef seç…</option>
                      {hedefler.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              case "db":
                return (
                  <label key={p.name} className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Fark (dB, −30…+30)
                    <input
                      className={field}
                      type="number"
                      min={-30}
                      max={30}
                      step={1}
                      value={row.delta ?? -3}
                      onChange={(e) => onPatch({ delta: Number(e.target.value) || 0 })}
                    />
                  </label>
                );
            }
          })}
        </div>
      )}
      {spec?.confirm && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100">
          <input type="checkbox" className="mt-0.5" checked={!!row.confirmed} onChange={(e) => onPatch({ confirmed: e.target.checked })} />
          <span>
            Bu kısayol onay sormadan çalışsın. «{spec.label}» yayını başlatır ya da keser; işaretlemezsen kısayol kaydedilmez.
          </span>
        </label>
      )}
      {row.hotkey && eksik && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">Kısayol kaydedilmedi: {eksik} boş.</p>
      )}
      {spec && !spec.available && spec.reason && <p className="text-xs text-white/70">Şu an kullanılamıyor: {spec.reason}.</p>}
    </div>
  );
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

  // Panel eylemleri kataloğu yalnız böyle bir satır varken alınır
  const eylemVar = rows.some((r) => r.kind === "action");
  const [katalog, setKatalog] = useState<ActionInfo[] | null>(null);
  const [hedefler, setHedefler] = useState<Hedef[]>([]);
  useEffect(() => {
    if (!eylemVar || katalog !== null) return;
    actionsApi
      .list()
      .then(setKatalog)
      .catch(() => setKatalog([]));
    multistreamApi
      .status()
      .then((s) => setHedefler(s.destinations.map((d) => ({ id: d.id, name: d.name }))))
      .catch(() => setHedefler([]));
  }, [eylemVar, katalog]);

  return (
    <section className="w-full min-w-0 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass">
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Zap className="h-4.5 w-4.5 text-panel-accent" /> OBS eylemleri
        </h3>
        <button
          type="button"
          className="yya-btn-ghost inline-flex h-8 items-center gap-1 px-3 text-xs font-bold"
          onClick={() => onChange([...rows, { id: newId(), kind: (ACTION_KINDS.find((k) => !hideKinds.includes(k.id))?.id || "volume") as ActionKind, hotkey: "" }])}
        >
          <Plus className="h-3.5 w-3.5" /> Eylem
        </button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-white/75">
        Kaynak aç/kapa, kayıt, ses seviyesi, filtre ve sahne gezme. Bir kısayola bağlayıp yayın
        sırasında tek tuşla kullan.
      </p>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs font-medium text-white/70">
          Henüz eylem yok. “Eylem” ile ekle.
        </p>
      )}

      <div className="space-y-2.5">
        {rows.map((row, idx) => {
          const bid = actionBindingId(row.id);
          const eksik = missingField(row);
          const hint = ACTION_KINDS.find((k) => k.id === row.kind)?.hint;
          const fail = failures.find((f) => f.id === bid);

          return (
            <div key={row.id} className="space-y-2 rounded-xl border border-white/[0.08] bg-black/30 p-2.5">
              <div className="flex items-center gap-2">
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
                  className="shrink-0 rounded-lg bg-panel-accent/85 px-3 py-2 text-xs font-bold text-[#08131c] hover:bg-panel-accent disabled:opacity-40"
                  onClick={() => onRun(row)}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Sil"
                  className="shrink-0 rounded-lg bg-red-900/50 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-900/70"
                  onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* --- türe göre alanlar --- */}
              {row.kind === "srcToggle" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Sahne
                    <input
                      className={field}
                      list="obs-act-scenes"
                      value={row.scene || ""}
                      placeholder="Boş = şu an yayındaki"
                      onChange={(e) => patch(idx, { scene: e.target.value })}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/80">
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
                <div className="grid grid-cols-[1fr_6rem] gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Ses girişi
                    <input
                      className={field}
                      list="obs-act-inputs"
                      value={row.input || ""}
                      placeholder="örn. Müzik"
                      onChange={(e) => patch(idx, { input: e.target.value })}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/80">
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
                <label className="block text-xs font-bold uppercase tracking-wider text-white/80">
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
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-white/80">
                    Kaynak
                    <input
                      className={field}
                      value={row.source || ""}
                      placeholder="örn. Kamera"
                      onChange={(e) => patch(idx, { source: e.target.value })}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/80">
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

              {row.kind === "action" && (
                <PanelEylemiAlanlari row={row} katalog={katalog} hedefler={hedefler} onPatch={(p) => patch(idx, p)} />
              )}

              {row.kind === "obsHotkey" && (
                <label className="block text-xs font-bold uppercase tracking-wider text-white/80">
                  OBS kısayol adı
                  <input
                    className={field}
                    value={row.name || ""}
                    placeholder="örn. OBSBasic.StartReplayBuffer"
                    onChange={(e) => patch(idx, { name: e.target.value })}
                  />
                </label>
              )}

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white/80">Kısayol</span>
                <HotkeyInput
                  className="min-w-0 flex-1 rounded-lg border border-panel-border bg-black/50 px-2.5 py-1.5 text-center font-mono text-xs md:text-sm font-medium text-white"
                  value={row.hotkey || ""}
                  onListeningChange={onListeningChange}
                  onChange={(v) => patch(idx, { hotkey: v })}
                />
              </div>

              {fail && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200">
                  Bu kısayol çalışmıyor: {fail.reason}.{fail.reason.includes("tuş") ? " Farklı bir tuş seç." : ""}
                </p>
              )}
              {row.hotkey && eksik && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">
                  Kısayol kaydedilmedi: {eksik} boş.
                </p>
              )}
              {hint && <p className="text-xs leading-relaxed text-white/70">{hint}</p>}
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
