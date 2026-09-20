import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { botaxtApi } from "../../../lib/api/botaxt";
import { cn } from "../../../lib/cn";
import { CommandsPanel } from "./CommandsPanel";
import { ExtrasPanel } from "./ExtrasPanel";
import {
  FeatureRow,
  GlowToggle,
  Modal,
  button,
  enabled,
  input,
  label,
  parseList,
  parseObject,
  type Obj,
} from "./shared";

export type BotrixTab = "moderation" | "commands" | "timers" | "extras";
export { GlowToggle, button as botrixButton, input as botrixInput, label as botrixLabel };

type Timer = {
  id: string;
  name?: string;
  message: string;
  enabled?: number | boolean;
  interval_sec: number;
  min_chat_lines: number;
  platforms_json?: string;
};

const MODS = [
  { key: "caps", title: "Caps koruması", desc: "Sohbette CAPS spam mesajlarını kısıtla", field: "caps_enabled" },
  { key: "links", title: "Link koruması", desc: "Link içeren mesajları engeller", field: "links_enabled" },
  { key: "emotes", title: "Emote koruması", desc: "Aşırı emote içeren mesajları engeller", field: "" },
  { key: "symbols", title: "Sembol koruması", desc: "Aşırı sembol içeren mesajları engeller", field: "symbols_enabled" },
  { key: "badwords", title: "Kötü söz koruması", desc: "Belirli kelimeleri yasakla", field: "" },
] as const;
const ACTIONS = [
  ["timeout", "Sustur"],
  ["message", "Mesaj gönder"],
  ["timeout_message", "Sustur ve mesaj gönder"],
  ["delete", "Mesajı sil"],
  ["delete_message", "Sil ve mesaj gönder"],
] as const;
const TIMEOUTS = [30, 60, 120, 300, 900, 1800, 3600, 7200, 18000, 43200, 86400];

function Moderation({
  extras,
  saveExtras,
  toast,
}: {
  extras: Obj;
  saveExtras: (next: Obj) => Promise<void>;
  toast: (m: string) => void;
}) {
  const [filters, setFilters] = useState<Obj>({});
  const [editKey, setEditKey] = useState<(typeof MODS)[number]["key"] | null>(null);
  const [draft, setDraft] = useState<Obj>({});
  const [busy, setBusy] = useState(false);
  const moderation = parseObject(extras.moderation);

  useEffect(() => {
    void botaxtApi
      .filters()
      .then((r) => setFilters((r as Obj) || {}))
      .catch(() => undefined);
  }, []);

  const isOn = (m: (typeof MODS)[number]) => {
    if (m.key === "emotes") return enabled(parseObject(moderation.emotes).enabled);
    if (m.key === "badwords") return enabled(parseObject(moderation.badwords).enabled);
    if (m.field) return enabled(filters[m.field]) || enabled(moderation[m.field]);
    return false;
  };

  const open = (key: (typeof MODS)[number]["key"]) => {
    setEditKey(key);
    const cfg = parseObject(moderation[key]);
    setDraft({
      action: cfg.action || "timeout",
      timeout_sec: Number(cfg.timeout_sec || 60),
      custom_message: Boolean(cfg.custom_message),
      message: String(cfg.message || ""),
      allowed_domains: Array.isArray(cfg.allowed_domains)
        ? (cfg.allowed_domains as string[]).join(", ")
        : String(cfg.allowed_domains || ""),
      caps_min_len: Number(cfg.caps_min_len || 8),
      caps_ratio: Number(cfg.caps_ratio || 70),
      max_emotes: Number(cfg.max_emotes || 10),
      symbols_max: Number(cfg.symbols_max || 15),
      words: Array.isArray(filters.blacklist)
        ? (filters.blacklist as string[]).join("\n")
        : String(cfg.words || ""),
      bypass_og: Boolean(cfg.bypass_og),
      bypass_vip: Boolean(cfg.bypass_vip),
      bypass_subscriber: Boolean(cfg.bypass_subscriber),
      enabled: cfg.enabled !== false,
    });
  };

  const toggle = async (m: (typeof MODS)[number], value: boolean) => {
    setBusy(true);
    try {
      const nextExtras = {
        ...extras,
        moderation: {
          ...moderation,
          [m.key]: { ...parseObject(moderation[m.key]), enabled: value },
          ...(m.field ? { [m.field]: value } : {}),
        },
      };
      const nextFilters = { ...filters };
      if (m.field) nextFilters[m.field] = value;
      await Promise.all([saveExtras(nextExtras), botaxtApi.putFilters(nextFilters)]);
      setFilters(nextFilters);
      toast(`${m.title} ${value ? "açıldı" : "kapatıldı"}`);
    } catch (e) {
      toast((e as Error).message || "Ayar kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editKey) return;
    setBusy(true);
    try {
      const words = String(draft.words || "")
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      const nextExtras = {
        ...extras,
        moderation: {
          ...moderation,
          [editKey]: {
            enabled: draft.enabled !== false,
            action: draft.action,
            timeout_sec: Number(draft.timeout_sec),
            custom_message: Boolean(draft.custom_message),
            message: String(draft.message || ""),
            allowed_domains: String(draft.allowed_domains || "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 5),
            caps_min_len: Number(draft.caps_min_len),
            caps_ratio: Number(draft.caps_ratio),
            max_emotes: Number(draft.max_emotes),
            symbols_max: Number(draft.symbols_max),
            words,
            bypass_og: Boolean(draft.bypass_og),
            bypass_vip: Boolean(draft.bypass_vip),
            bypass_subscriber: Boolean(draft.bypass_subscriber),
          },
        },
      };
      const nextFilters = { ...filters };
      if (editKey === "badwords") nextFilters.blacklist = words;
      await Promise.all([saveExtras(nextExtras), botaxtApi.putFilters(nextFilters)]);
      setFilters(nextFilters);
      setEditKey(null);
      toast("Moderasyon ayarları kaydedildi");
    } catch (e) {
      toast((e as Error).message || "Ayar kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const mod = MODS.find((m) => m.key === editKey);
  return (
    <>
      <div className="space-y-3">
        {MODS.map((m) => (
          <FeatureRow
            key={m.key}
            title={m.title}
            desc={m.desc}
            checked={isOn(m)}
            busy={busy}
            onToggle={(v) => void toggle(m, v)}
            onConfigure={() => open(m.key)}
          />
        ))}
      </div>
      {editKey && mod ? (
        <Modal
          title={`Gelişmiş moderasyon - ${mod.title}`}
          onClose={() => setEditKey(null)}
          onConfirm={() => void save()}
          busy={busy}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={label}>İhlal eylemi</span>
              <select
                className={input}
                value={String(draft.action)}
                onChange={(e) => setDraft({ ...draft, action: e.target.value })}
              >
                {ACTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Susturma süresi</span>
              <select
                className={input}
                value={Number(draft.timeout_sec)}
                onChange={(e) => setDraft({ ...draft, timeout_sec: Number(e.target.value) })}
              >
                {TIMEOUTS.map((v) => (
                  <option key={v} value={v}>
                    {v < 60 ? `${v} saniye` : `${v / 60} dakika`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={Boolean(draft.custom_message)}
              onChange={(e) => setDraft({ ...draft, custom_message: e.target.checked })}
              className="accent-teal-400"
            />{" "}
            Özel mesaj kullan
          </label>
          {draft.custom_message ? (
            <label>
              <span className={label}>Özel mesaj</span>
              <input
                className={input}
                value={String(draft.message)}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                placeholder="{user}, bu mesaj yasak."
              />
            </label>
          ) : null}
          {editKey === "links" ? (
            <label>
              <span className={label}>İzin verilen alan adları (en fazla 5)</span>
              <input
                className={input}
                value={String(draft.allowed_domains)}
                onChange={(e) => setDraft({ ...draft, allowed_domains: e.target.value })}
                placeholder="youtube.com, discord.gg"
              />
            </label>
          ) : null}
          {editKey === "caps" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={label}>Minimum mesaj uzunluğu</span>
                <input
                  type="number"
                  className={input}
                  value={Number(draft.caps_min_len)}
                  onChange={(e) => setDraft({ ...draft, caps_min_len: Number(e.target.value) })}
                />
              </label>
              <label>
                <span className={label}>CAPS oranı (%)</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className={input}
                  value={Number(draft.caps_ratio)}
                  onChange={(e) => setDraft({ ...draft, caps_ratio: Number(e.target.value) })}
                />
              </label>
            </div>
          ) : null}
          {editKey === "emotes" ? (
            <label>
              <span className={label}>Maksimum emote</span>
              <input
                type="number"
                min={1}
                className={input}
                value={Number(draft.max_emotes)}
                onChange={(e) => setDraft({ ...draft, max_emotes: Number(e.target.value) })}
              />
            </label>
          ) : null}
          {editKey === "symbols" ? (
            <label>
              <span className={label}>Maksimum sembol</span>
              <input
                type="number"
                min={1}
                className={input}
                value={Number(draft.symbols_max)}
                onChange={(e) => setDraft({ ...draft, symbols_max: Number(e.target.value) })}
              />
            </label>
          ) : null}
          {editKey === "badwords" ? (
            <label>
              <span className={label}>Yasaklı kelimeler (virgül veya yeni satır)</span>
              <textarea
                rows={6}
                className={input}
                value={String(draft.words)}
                onChange={(e) => setDraft({ ...draft, words: e.target.value })}
              />
            </label>
          ) : null}
          <div>
            <span className={label}>Muaf roller</span>
            <div className="flex flex-wrap gap-5 text-sm text-white/65">
              {(
                [
                  ["bypass_og", "OG"],
                  ["bypass_vip", "VIP"],
                  ["bypass_subscriber", "Subscriber"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(draft[k])}
                    onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })}
                    className="accent-teal-400"
                  />
                  {l}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-teal-300/70">Moderatörler her zaman muaf tutulur.</p>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

const EMPTY_TIMER: Timer = {
  id: "",
  name: "Timer",
  message: "",
  enabled: true,
  interval_sec: 300,
  min_chat_lines: 0,
  platforms_json: '["kick"]',
};

function Timers({ toast }: { toast: (m: string) => void }) {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [edit, setEdit] = useState<Timer | null>(null);
  const [platforms, setPlatforms] = useState<string[]>(["kick"]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      void botaxtApi
        .timers()
        .then((r) => setTimers((r.timers || []) as Timer[]))
        .catch((e) => toast(e.message)),
    [toast]
  );
  useEffect(load, [load]);
  const open = (t?: Timer) => {
    const next = t || { ...EMPTY_TIMER, id: crypto.randomUUID() };
    setEdit(next);
    setPlatforms(
      parseList(next.platforms_json).length ? parseList(next.platforms_json) : ["kick"]
    );
  };
  const save = async () => {
    if (!edit?.message.trim()) return toast("Timer mesajı zorunlu");
    setBusy(true);
    try {
      await botaxtApi.upsertTimer({
        ...edit,
        name: edit.name || "Timer",
        enabled: true,
        interval_sec: Number(edit.interval_sec),
        min_chat_lines: Number(edit.min_chat_lines),
        platforms_json: JSON.stringify(platforms),
      });
      setEdit(null);
      toast("Timer kaydedildi");
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    setBusy(true);
    try {
      await botaxtApi.deleteTimer(id);
      toast("Timer silindi");
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => open()} className={cn(button, "min-h-11 bg-teal-400 px-5 text-sm font-extrabold tracking-normal text-[#042f2e] hover:bg-teal-300")}>
          <Plus className="h-5 w-5 shrink-0" />
          <span className="whitespace-nowrap">Timer ekle</span>
        </button>
      </div>
      <div className="space-y-3">
        {timers.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#101417] p-4 sm:flex-row sm:items-center"
          >
            <Clock3 className="h-5 w-5 text-teal-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{t.message}</p>
              <p className="mt-1 text-xs text-white/50">
                {Math.round(t.interval_sec / 60)} dk · En az {t.min_chat_lines} satır
              </p>
            </div>
            <button
              type="button"
              onClick={() => open(t)}
              className={cn(button, "border border-white/10 text-white/60")}
            >
              <Pencil className="h-3.5 w-3.5" /> Düzenle
            </button>
            <button
              type="button"
              onClick={() => void remove(t.id)}
              className={cn(button, "border border-red-500/20 text-red-300")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      {!timers.length ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-white/50">
          Henüz timer eklenmedi.
        </div>
      ) : null}
      {edit ? (
        <Modal title="Timer düzenle" onClose={() => setEdit(null)} onConfirm={() => void save()} busy={busy}>
          <label>
            <span className={label}>Mesaj</span>
            <textarea
              rows={5}
              className={input}
              value={edit.message}
              onChange={(e) => setEdit({ ...edit, message: e.target.value })}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={label}>Aralık</span>
              <select
                className={input}
                value={edit.interval_sec}
                onChange={(e) => setEdit({ ...edit, interval_sec: Number(e.target.value) })}
              >
                {[5, 10, 15, 20, 30, 45, 60].map((v) => (
                  <option key={v} value={v * 60}>
                    {v} dakika
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={label}>Sohbet satırı</span>
              <input
                type="number"
                min={0}
                className={input}
                value={edit.min_chat_lines}
                onChange={(e) => setEdit({ ...edit, min_chat_lines: Number(e.target.value) })}
              />
            </label>
          </div>
          <div>
            <span className={label}>Platformlar</span>
            <div className="flex flex-wrap gap-3">
              {["kick", "twitch", "youtube", "discord"].map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm capitalize text-white/65">
                  <input
                    type="checkbox"
                    className="accent-teal-400"
                    checked={platforms.includes(p)}
                    onChange={(e) =>
                      setPlatforms(
                        e.target.checked
                          ? [...platforms, p]
                          : platforms.filter((x) => x !== p)
                      )
                    }
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export default function BotrixTabs({
  tab,
  extras,
  onSaveExtras,
  onToast,
}: {
  tab: BotrixTab;
  extras: Obj;
  onSaveExtras: (next: Obj) => Promise<void>;
  onToast: (message: string) => void;
}) {
  const view = useMemo(() => {
    if (tab === "moderation")
      return <Moderation extras={extras} saveExtras={onSaveExtras} toast={onToast} />;
    if (tab === "commands") return <CommandsPanel toast={onToast} />;
    if (tab === "timers") return <Timers toast={onToast} />;
    return <ExtrasPanel extras={extras} saveExtras={onSaveExtras} toast={onToast} />;
  }, [extras, onSaveExtras, onToast, tab]);
  return <div>{view}</div>;
}
