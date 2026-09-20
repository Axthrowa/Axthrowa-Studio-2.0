/**
 * Dinamik widget form — Genel / Stil / Animasyon / Veri (kompakt Elgato tarzı).
 * Ham JSON yok.
 */

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Minus, Plus, Trash2 } from "lucide-react";
import {
  groupFieldsBySection,
  inferFieldsFromConfig,
  type FieldSection,
  type FieldSpec,
} from "../../lib/widgets/catalog";
import { cn } from "../../lib/cn";
import DateField from "../ui/date-field";
import { Switch } from "../ui/switch";

function selectOptionLabel(fieldKey: string, opt: string): string {
  const maps: Record<string, Record<string, string>> = {
    metric: {
      followers: "Takipçi",
      subs: "Abone",
      tips: "Bağış",
      kick: "KICK",
    },
    goalType: {
      followers: "Takipçi",
      subs: "Abone",
      tips: "Bağış",
      kick: "KICK",
    },
    layout: {
      bar: "Bar",
      circle: "Daire",
      minimal: "Minimal",
      list: "Liste",
      combined: "Birleşik",
      alert: "Alert",
    },
  };
  return maps[fieldKey]?.[opt] || opt;
}

type Props = {
  kind?: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
};

const DEBOUNCE_MS = 160;

const TAB_ORDER: FieldSection[] = ["general", "style", "physics", "data", "sfx", "transform"];
const TAB_LABELS: Partial<Record<FieldSection, string>> = {
  general: "Genel",
  style: "Görsel",
  physics: "Animasyon",
  data: "Veri",
  sfx: "Ses",
  transform: "Pozisyon",
};

function Row({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2",
        !last && "border-b border-white/5"
      )}
    >
      <div className="min-w-0 flex-1 pr-2">
        <p className="text-[13px] text-white/90">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-white/50">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Stack({
  label,
  hint,
  children,
  last,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5 px-3 py-2", !last && "border-b border-white/5")}>
      <div>
        <p className="yya-label normal-case tracking-normal">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-white/50">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ColorField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (v: string) => {
    setLocal(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(v), DEBOUNCE_MS);
  };

  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(local) ? local : "#22d3ee";
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        disabled={disabled}
        className="h-7 w-8 cursor-pointer rounded-md border border-white/10 bg-transparent"
        value={hex}
        onChange={(e) => commit(e.target.value)}
      />
      <input
        disabled={disabled}
        className="h-7 w-[5.5rem] rounded-md border border-white/[0.08] bg-black/40 px-2 font-mono text-[11px] text-white/80 outline-none focus:border-emerald-500/40"
        value={local}
        onChange={(e) => commit(e.target.value)}
      />
    </div>
  );
}

function SlimSlider({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldSpec;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const step = field.step ?? 1;
  const safe = Number.isFinite(value) ? value : min;
  const [local, setLocal] = useState(safe);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setLocal(safe), [safe]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const live = (v: number) => {
    setLocal(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(v), DEBOUNCE_MS);
  };
  const flush = (v: number) => {
    window.clearTimeout(timer.current);
    setLocal(v);
    onChange(v);
  };

  return (
    <div className="flex w-[9.5rem] items-center gap-2 sm:w-[11rem]">
      <input
        type="range"
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={local}
        className="ns-range h-1 flex-1 accent-emerald-500"
        onChange={(e) => live(Number(e.target.value))}
        onMouseUp={(e) => flush(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => flush(Number((e.target as HTMLInputElement).value))}
      />
      <span className="w-8 text-right font-mono text-[11px] tabular-nums text-white/55">
        {local}
      </span>
    </div>
  );
}

function SlimInput({
  value,
  onChange,
  disabled,
  type = "text",
  min,
  max,
  step,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commit = (v: string) => {
    setLocal(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(v), DEBOUNCE_MS);
  };
  return (
    <input
      className={cn(
        "h-8 rounded-md border border-white/[0.08] bg-black/40 px-2 text-xs text-white/90 outline-none focus:border-emerald-500/40",
        type === "number" ? "w-[5.5rem]" : "w-[9rem] sm:w-[11rem]",
        className
      )}
      disabled={disabled}
      type={type}
      min={min}
      max={max}
      step={step}
      value={local}
      onChange={(e) => commit(e.target.value)}
      onBlur={(e) => {
        window.clearTimeout(timer.current);
        onChange(e.target.value);
      }}
    />
  );
}

function StringListField({
  label,
  value,
  onChange,
  disabled,
  placeholder = "Seçenek",
  showVoteCmds,
  votePrefix = "!oy",
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showVoteCmds?: boolean;
  votePrefix?: string;
}) {
  const list = value.length > 0 ? value : [""];
  return (
    <Stack
      label={label}
      hint={showVoteCmds ? `Oylar: ${votePrefix} 1, ${votePrefix} 2…` : undefined}
      last
    >
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {list.map((item, i) => (
            <motion.div
              key={`opt-${i}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.16 }}
              className="flex items-center gap-1.5 overflow-hidden"
            >
              <span className="grid h-6 min-w-[1.75rem] place-items-center rounded-md bg-emerald-500/10 px-1 text-[10px] font-semibold text-emerald-400">
                {showVoteCmds ? i + 1 : i + 1}
              </span>
              <input
                className="h-8 flex-1 rounded-md border border-white/[0.08] bg-black/40 px-2 text-xs outline-none focus:border-emerald-500/40"
                disabled={disabled}
                value={item}
                placeholder={`${placeholder} ${i + 1}`}
                onChange={(e) => {
                  const next = [...list];
                  next[i] = e.target.value;
                  onChange(next);
                }}
              />
              <button
                type="button"
                disabled={disabled || list.length <= 1}
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/50 hover:border-red-400/40 hover:text-red-300 disabled:opacity-30"
                aria-label="Sil"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange([...list.filter(Boolean), `${placeholder} ${list.length + 1}`])
          }
          className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-white/10 text-[11px] font-medium text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80"
        >
          <Plus className="h-3 w-3" />
          Ekle
        </button>
      </div>
    </Stack>
  );
}

function ObjectListField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Array<Record<string, unknown>>;
  onChange: (v: Array<Record<string, unknown>>) => void;
  disabled?: boolean;
}) {
  const list =
    value.length > 0
      ? value
      : [
          { label: "VIP", color: "#22d3ee" },
          { label: "100 Puan", color: "#ff8a5b" },
        ];
  const ids = list.map((_, i) => `slice-${i}`);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(list, oldIndex, newIndex));
  };

  return (
    <Stack label={label} hint="Sürükle · dilim adı + renk" last>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {list.map((row, i) => (
              <SortableSliceRow
                key={ids[i]}
                id={ids[i]}
                row={row}
                disabled={disabled}
                canDelete={list.length > 1}
                onPatch={(patch) => {
                  const next = list.map((x, j) => (j === i ? { ...x, ...patch } : x));
                  onChange(next);
                }}
                onDelete={() => onChange(list.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...list,
            {
              label: `Dilim ${list.length + 1}`,
              color: ["#22d3ee", "#ff8a5b", "#f59e0b", "#38bdf8", "#fb7185"][
                list.length % 5
              ],
            },
          ])
        }
        className="mt-1.5 inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-dashed border-panel-accent/30 text-[11px] font-semibold text-panel-accent hover:bg-panel-soft"
      >
        <Plus className="h-3 w-3" />
        Dilim ekle
      </button>
    </Stack>
  );
}

function SortableSliceRow({
  id,
  row,
  disabled,
  canDelete,
  onPatch,
  onDelete,
}: {
  id: string;
  row: Record<string, unknown>;
  disabled?: boolean;
  canDelete: boolean;
  onPatch: (p: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });
  const lab = String(row.label ?? row.name ?? "");
  const hasColor = "color" in row || (!("value" in row) && !("source" in row));
  const hasValue = "value" in row || "source" in row;
  const col = String(row.color ?? "#64748b");
  const hex = /^#/.test(col) ? col : "#64748b";
  const val = String(row.value ?? "");
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-white/10 bg-black/25 px-1.5 py-1",
        isDragging && "z-10 border-panel-accent/40 opacity-90 shadow-lg"
      )}
    >
      <button
        type="button"
        className="inline-flex h-7 w-6 cursor-grab items-center justify-center text-white/50 active:cursor-grabbing"
        aria-label="Sürükle"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {hasColor ? (
        <input
          type="color"
          disabled={disabled}
          className="h-7 w-8 cursor-pointer rounded-md border border-white/10 bg-transparent"
          value={hex}
          onChange={(e) => onPatch({ color: e.target.value })}
        />
      ) : null}
      <input
        className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-[12px] outline-none focus:border-panel-accent/50"
        disabled={disabled}
        value={lab}
        placeholder="Ad"
        onChange={(e) => onPatch({ label: e.target.value })}
      />
      {hasValue ? (
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-[12px] outline-none focus:border-panel-accent/50"
          disabled={disabled}
          value={val}
          placeholder="Değer"
          onChange={(e) => onPatch({ value: e.target.value })}
        />
      ) : null}
      <button
        type="button"
        disabled={disabled || !canDelete}
        onClick={onDelete}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/50 hover:text-red-300 disabled:opacity-30"
        aria-label="Sil"
      >
        <Minus className="h-3 w-3" />
      </button>
    </div>
  );
}

function renderField(
  field: FieldSpec,
  raw: unknown,
  onChange: (key: string, value: unknown) => void,
  disabled: boolean | undefined,
  isLast: boolean,
  config: Record<string, unknown>
): ReactNode {
  if (field.type === "css") return null;

  if (field.type === "date") {
    return (
      <Row key={field.key} label={field.label} hint={field.description} last={isLast}>
        <DateField
          disabled={disabled}
          value={raw == null ? "" : String(raw)}
          onChange={(v) => onChange(field.key, v)}
        />
      </Row>
    );
  }

  if (field.type === "stringList") {
    const arr = Array.isArray(raw) ? (raw as string[]).map(String) : [];
    return (
      <StringListField
        key={field.key}
        label={field.label}
        value={arr}
        disabled={disabled}
        showVoteCmds={field.key === "options"}
        votePrefix={String(config.command || config.voteCommand || "!oy")}
        onChange={(v) => onChange(field.key, v)}
      />
    );
  }

  if (field.type === "objectList") {
    const arr = Array.isArray(raw)
      ? (raw as Array<Record<string, unknown>>)
      : [];
    return (
      <ObjectListField
        key={field.key}
        label={field.label}
        value={arr}
        disabled={disabled}
        onChange={(v) => onChange(field.key, v)}
      />
    );
  }

  if (field.type === "bool") {
    return (
      <Row key={field.key} label={field.label} hint={field.description} last={isLast}>
        <Switch
          checked={Boolean(raw)}
          disabled={disabled}
          onCheckedChange={(v) => onChange(field.key, v)}
        />
      </Row>
    );
  }

  if (field.type === "color") {
    return (
      <Row key={field.key} label={field.label} last={isLast}>
        <ColorField
          value={typeof raw === "string" ? raw : "#22d3ee"}
          onChange={(v) => onChange(field.key, v)}
          disabled={disabled}
        />
      </Row>
    );
  }

  if (field.type === "slider") {
    return (
      <Row key={field.key} label={field.label} last={isLast}>
        <SlimSlider
          field={field}
          value={typeof raw === "number" ? raw : Number(raw) || 0}
          onChange={(v) => onChange(field.key, v)}
          disabled={disabled}
        />
      </Row>
    );
  }

  if (field.type === "select") {
    const options =
      field.options?.length
        ? field.options
        : ["—"];
    const val = raw == null ? options[0] : String(raw);
    return (
      <Row key={field.key} label={field.label} last={isLast}>
        <select
          disabled={disabled}
          className="h-7 rounded-md border border-white/10 bg-black/30 px-2 text-[12px] text-white/85 outline-none focus:border-cyan-400/50"
          value={val}
          onChange={(e) => onChange(field.key, e.target.value)}
        >
          {!options.includes(val) ? (
            <option key={val} value={val}>
              {selectOptionLabel(field.key, val)}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {selectOptionLabel(field.key, opt)}
            </option>
          ))}
        </select>
      </Row>
    );
  }

  if (field.type === "number") {
    return (
      <Row key={field.key} label={field.label} last={isLast}>
        <SlimInput
          type="number"
          disabled={disabled}
          min={field.min}
          max={field.max}
          step={field.step}
          value={raw == null || (typeof raw === "number" && !Number.isFinite(raw)) ? "" : String(raw)}
          onChange={(v) => {
            if (v.trim() === "") {
              onChange(field.key, field.min ?? 0);
              return;
            }
            const n = Number(v);
            onChange(field.key, Number.isFinite(n) ? n : field.min ?? 0);
          }}
        />
      </Row>
    );
  }

  return (
    <Row key={field.key} label={field.label} hint={field.description} last={isLast}>
      <SlimInput
        disabled={disabled}
        value={raw == null ? "" : String(raw)}
        onChange={(v) => onChange(field.key, v)}
      />
    </Row>
  );
}

export default function DynamicWidgetForm({ kind, config, onChange, disabled }: Props) {
  const fields = useMemo(
    () => inferFieldsFromConfig(config, kind).filter((f) => f.type !== "css"),
    [config, kind]
  );
  const groups = useMemo(() => groupFieldsBySection(fields), [fields]);
  const primaryGroups = useMemo(() => {
    const ordered = TAB_ORDER.map((section) =>
      groups.find((g) => g.section === section)
    ).filter(Boolean) as { section: FieldSection; label: string; fields: FieldSpec[] }[];
    const extras = groups.filter(
      (g) =>
        !TAB_ORDER.includes(g.section) &&
        g.section !== "advanced" &&
        g.fields.some((f) => f.type !== "css")
    );
    return [...ordered, ...extras];
  }, [groups]);

  const [tab, setTab] = useState<string>("general");

  useEffect(() => {
    setTab("general");
  }, [kind]);

  useEffect(() => {
    const ids = primaryGroups.map((g) => g.section);
    if (ids.length && !ids.includes(tab as FieldSection)) {
      setTab(ids[0]);
    }
  }, [primaryGroups, tab]);

  if (fields.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 px-3 py-8 text-center text-[12px] text-white/50">
        Bu widget için düzenlenebilir alan yok.
      </p>
    );
  }

  const active =
    primaryGroups.find((g) => g.section === tab)?.section ||
    primaryGroups[0]?.section ||
    "general";
  const activeGroup = primaryGroups.find((g) => g.section === active) || primaryGroups[0];

  const sizeKeys = new Set(["fontSize", "width", "height", "scale"]);
  const sizeFields = (["fontSize", "width", "height", "scale"] as const)
    .map((key) => fields.find((f) => f.key === key))
    .filter(Boolean) as FieldSpec[];
  const tabFields = (activeGroup?.fields || []).filter((f) => !sizeKeys.has(f.key));

  return (
    <div className="relative z-30 space-y-3" data-ui="botaxt-form-tabs">
      {sizeFields.length > 0 ? (
        <div className="yya-settings-panel overflow-hidden">
          <p className="yya-label border-b border-white/5 px-3 py-1.5">Boyut &amp; yazı</p>
          {sizeFields.map((f, i) =>
            renderField(
              f,
              config[f.key] ??
                (f.key === "fontSize"
                  ? 18
                  : f.key === "width"
                    ? 480
                    : f.key === "height"
                      ? 320
                      : 1),
              onChange,
              disabled,
              i === sizeFields.length - 1,
              config
            )
          )}
        </div>
      ) : null}

      <div
        role="tablist"
        className="flex w-full flex-wrap gap-0.5 rounded-lg border border-white/[0.05] bg-black/30 p-0.5"
      >
        {primaryGroups.map((g) => {
          const on = g.section === active;
          return (
            <button
              key={g.section}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(g.section)}
              className={cn(
                "relative z-30 flex-1 cursor-pointer rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors duration-150",
                on
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
              )}
            >
              {TAB_LABELS[g.section] || g.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        className="relative z-30 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
      >
        {tabFields.map((f, i, arr) =>
          renderField(
            f,
            config[f.key],
            onChange,
            disabled,
            i === arr.length - 1,
            config
          )
        )}
      </div>
    </div>
  );
}
