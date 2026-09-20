/** Commands + Default Commands — Botrix parity. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { botaxtApi } from "../../../lib/api/botaxt";
import { fetchSettings } from "../../../lib/api";
import { cn } from "../../../lib/cn";
import {
  extractDiscordInvite,
  sanitizeCommandResponse,
  normalizeSocialUrl,
} from "../../../lib/smartBot/commandTemplate";
import {
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

type Command = {
  id: string;
  name: string;
  response: string;
  enabled?: number | boolean;
  min_level?: number;
  cooldown_sec?: number;
  user_cooldown_sec?: number;
  aliases_json?: string;
  platforms_json?: string;
  extras_json?: string;
  cost_points?: number;
  live_only?: number | boolean;
};

const RANKS = [
  { v: 0, label: "Herkes" },
  { v: 100, label: "Ücretli abone / YT Member" },
  { v: 500, label: "VIP" },
  { v: 1000, label: "Moderatör" },
  { v: 2000, label: "Sahip" },
] as const;

const ACCESS = [
  { v: "anytime", label: "Her zaman" },
  { v: "live", label: "Yalnızca canlıyken" },
  { v: "offline", label: "Yalnızca çevrimdışıyken" },
] as const;

const COOLDOWNS = [0, 3, 5, 8, 10, 15, 30, 60, 120, 300];

export type DefaultDef = {
  name: string;
  aliases: string[];
  response: string;
  rank: number;
  info?: string;
};

export const DEFAULT_COMMANDS: DefaultDef[] = [
  {
    name: "addcom",
    aliases: [],
    response: "Kullanım: !addcom !isim yanıt metni",
    rank: 1000,
    info: "Sohbetten yeni komut ekler (mod)",
  },
  {
    name: "commands",
    aliases: ["komutlar"],
    response: "Açık komutların listesini yazar",
    rank: 0,
  },
  {
    name: "delcom",
    aliases: [],
    response: "Kullanım: !delcom !isim",
    rank: 1000,
    info: "Sohbetten komut siler (mod)",
  },
  {
    name: "editcom",
    aliases: [],
    response: "Kullanım: !editcom !isim yeni yanıt",
    rank: 1000,
    info: "Sohbetten komut düzenler (mod)",
  },
  {
    name: "followage",
    aliases: [],
    response: "@{username} bu kanalı {time} süredir takip ediyor!",
    rank: 0,
  },
  {
    name: "level",
    aliases: [],
    response:
      "@{username} henüz bir seviyeye ulaşmadı.\n@{username} adlı kullanıcının seviyesi {level}.",
    rank: 0,
  },
  {
    name: "points",
    aliases: [],
    response:
      "@{username} Bunu yapmak için yeterli puanınız bulunmamaktadır.\n@{username} adlı kullanıcının {points} puanı var.",
    rank: 0,
  },
  {
    name: "pointsadd",
    aliases: ["points add"],
    response: "Puan eklendi.",
    rank: 2000,
  },
  {
    name: "so",
    aliases: ["promo"],
    response: "{name} adlı kullanıcının kanalını takip edin -> {url}",
    rank: 1000,
  },
  {
    name: "shop",
    aliases: [],
    response: "{username} şu adresten kanal mağazasını görebilirsiniz: {url}",
    rank: 0,
  },
  {
    name: "top",
    aliases: [],
    response:
      "En çok destek veren kullanıcıların listesine {url} adresinden ulaşabilirsiniz.",
    rank: 0,
  },
  {
    name: "uptime",
    aliases: [],
    response: "Bu yayın {time} önce başladı.",
    rank: 0,
  },
  {
    name: "watchtime",
    aliases: [],
    response: "@{username} bu kanalı izleyerek {time} geçirdi.",
    rank: 0,
  },
  {
    name: "xp",
    aliases: [],
    response:
      "@{username} henüz bir seviyeye ulaşmadı.\n@{username} seviye atlamak için {xp}/{nextlvl} XP'ye sahiptir.",
    rank: 0,
  },
  { name: "discord", aliases: [], response: "Discord: {url}", rank: 0 },
  { name: "sosyal", aliases: [], response: "Sosyal: {url}", rank: 0 },
  { name: "title", aliases: [], response: "Yayın başlığı: {title}", rank: 0 },
  { name: "game", aliases: [], response: "Kategori: {game}", rank: 0 },
  { name: "lurk", aliases: [], response: "{username} lurk modunda.", rank: 0 },
  { name: "ping", aliases: [], response: "Pong! {time}", rank: 0 },
];

const BUILTIN_ALWAYS = new Set([
  "addcom",
  "editcom",
  "delcom",
  "commands",
  "followage",
  "sosyal",
  "lurk",
  "ping",
]);

function rankLabel(v: number) {
  return RANKS.find((r) => r.v === v)?.label || String(v);
}

function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
            className={cn(
              "rounded-lg border px-3.5 py-2.5 text-sm font-extrabold tracking-normal text-white/85 antialiased transition",
              value === o.v
                ? "border-teal-400/50 bg-teal-400/15 text-teal-200"
                : "border-white/10 text-white/55 hover:text-white/85"
            )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const EMPTY: Command = {
  id: "",
  name: "",
  response: "",
  enabled: true,
  min_level: 0,
  cooldown_sec: 3,
  user_cooldown_sec: 3,
  cost_points: 0,
  live_only: false,
};

export function CommandsPanel({ toast }: { toast: (m: string) => void }) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [sub, setSub] = useState<"mine" | "defaults">("mine");
  const [edit, setEdit] = useState<Command | null>(null);
  const [form, setForm] = useState<Obj>({});
  const [defaultEdit, setDefaultEdit] = useState<DefaultDef | null>(null);
  const [defForm, setDefForm] = useState<Obj>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [discordInvite, setDiscordInvite] = useState("");

  const load = useCallback(() => {
    void botaxtApi
      .commands()
      .then((r) => setCommands((r.commands || []) as Command[]))
      .catch((e) => toast(e.message));
  }, [toast]);
  useEffect(load, [load]);

  useEffect(() => {
    void fetchSettings("starting")
      .then((d) => {
        const disc = (d as { socials?: { discord?: string | { handle?: string } } })?.socials
          ?.discord;
        const raw =
          typeof disc === "string" ? disc.trim() : String(disc?.handle || "").trim();
        if (raw) setDiscordInvite(normalizeSocialUrl("discord", raw));
      })
      .catch(() => {
        /* Giriş sosyal opsiyonel */
      });
  }, []);

  const openMine = (command?: Command) => {
    const c = command || { ...EMPTY, id: crypto.randomUUID() };
    const ex = parseObject(c.extras_json);
    const access =
      String(ex.access || "") ||
      (enabled(c.live_only) ? "live" : "anytime");
    setEdit(c);
    setForm({
      name: c.name,
      response: c.response,
      url: String(
        ex.url ||
          (String(c.name || "").replace(/^!/, "").toLowerCase() === "discord"
            ? discordInvite
            : "") ||
          ""
      ),
      min_level: Number(c.min_level) || 0,
      activation: String(ex.activation || "command"),
      editor_mode: String(ex.editor_mode || "normal"),
      access,
      aliases: parseList(c.aliases_json).join(", "),
      platforms: parseList(c.platforms_json).length
        ? parseList(c.platforms_json)
        : ["kick", "twitch", "youtube", "discord"],
      cooldown_sec:
        Number(c.user_cooldown_sec) > 0
          ? Number(c.user_cooldown_sec)
          : Number(c.cooldown_sec) || 3,
      cooldown_mode: Number(c.user_cooldown_sec) > 0 ? "user" : "global",
      cost_points: Number(c.cost_points) || 0,
    });
  };

  const saveMine = async () => {
    if (!edit) return;
    const name = String(form.name || "")
      .replace(/^!/, "")
      .trim();
    const response = sanitizeCommandResponse(name, String(form.response || ""));
    if (!name || !response.trim()) {
      toast("Komut adı ve mesaj zorunlu");
      return;
    }
    setBusy(true);
    try {
      const cooldown = Number(form.cooldown_sec) || 0;
      const access = String(form.access || "anytime");
      const url = normalizeSocialUrl(
        name,
        String(form.url || "").trim() ||
          extractDiscordInvite(String(form.response || "")) ||
          (name.toLowerCase() === "discord" ? discordInvite : "")
      );
      const body = {
        id: edit.id,
        name,
        response,
        enabled: true,
        min_level: Number(form.min_level) || 0,
        cooldown_sec: form.cooldown_mode === "global" ? cooldown : 0,
        user_cooldown_sec: form.cooldown_mode === "user" ? cooldown : 0,
        aliases: String(form.aliases || "")
          .split(",")
          .map((x) => x.trim().replace(/^!/, ""))
          .filter(Boolean),
        platforms_json: JSON.stringify(form.platforms || []),
        cost_points: Number(form.cost_points) || 0,
        live_only: access === "live",
        extras_json: JSON.stringify({
          ...parseObject(edit.extras_json),
          activation: form.activation,
          editor_mode: form.editor_mode,
          access,
          url,
        }),
      };
      if (commands.some((c) => c.id === edit.id)) await botaxtApi.updateCommand(body);
      else await botaxtApi.createCommand(body);
      setEdit(null);
      toast("Komut kaydedildi");
      load();
    } catch (e) {
      toast((e as Error).message || "Komut kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await botaxtApi.deleteCommand(id);
      toast("Komut silindi");
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const findCmd = (def: DefaultDef) =>
    commands.find(
      (c) =>
        c.name.toLowerCase() === def.name.toLowerCase() ||
        def.aliases.some((a) => a.toLowerCase() === c.name.toLowerCase())
    );

  const toggleDefault = async (def: DefaultDef, value: boolean) => {
    setBusy(true);
    try {
      const found = findCmd(def);
      if (value && !found) {
        const extras: Record<string, string> = {};
        if (def.name === "discord" && discordInvite) extras.url = discordInvite;
        await botaxtApi.createCommand({
          id: crypto.randomUUID(),
          name: def.name,
          response: sanitizeCommandResponse(def.name, def.response),
          enabled: true,
          min_level: def.rank,
          cooldown_sec: 5,
          user_cooldown_sec: 0,
          aliases: def.aliases,
          platforms_json: JSON.stringify(["kick"]),
          extras_json: JSON.stringify(extras),
        });
      } else if (found && value) {
        await botaxtApi.updateCommand({
          id: found.id,
          name: found.name,
          response: found.response,
          enabled: true,
          min_level: found.min_level,
          cooldown_sec: found.cooldown_sec,
          user_cooldown_sec: found.user_cooldown_sec,
          aliases: parseList(found.aliases_json),
          platforms_json: found.platforms_json,
          cost_points: found.cost_points,
        });
      } else if (found) {
        if (BUILTIN_ALWAYS.has(def.name)) {
          await botaxtApi.updateCommand({
            id: found.id,
            name: found.name,
            response: found.response,
            enabled: false,
            min_level: found.min_level,
            cooldown_sec: found.cooldown_sec,
            user_cooldown_sec: found.user_cooldown_sec,
            aliases: parseList(found.aliases_json),
            platforms_json: found.platforms_json,
            cost_points: found.cost_points,
          });
        } else {
          await botaxtApi.deleteCommand(found.id);
        }
      } else if (!value && BUILTIN_ALWAYS.has(def.name)) {
        await botaxtApi.createCommand({
          id: crypto.randomUUID(),
          name: def.name,
          response: sanitizeCommandResponse(def.name, def.response),
          enabled: false,
          min_level: def.rank,
          cooldown_sec: 5,
          aliases: def.aliases,
          platforms_json: JSON.stringify(["kick"]),
        });
      }
      toast(`!${def.name} ${value ? "açıldı" : "kapatıldı"}`);
      load();
    } catch (e) {
      toast((e as Error).message || "Komut güncellenemedi");
    } finally {
      setBusy(false);
    }
  };

  const openDefaultSettings = (def: DefaultDef) => {
    const found = findCmd(def);
    const ex = found ? parseObject(found.extras_json) : {};
    setDefaultEdit(def);
    setDefForm({
      name: found?.name || def.name,
      aliases: found
        ? parseList(found.aliases_json).join(", ")
        : def.aliases.join(", "),
      info: sanitizeCommandResponse(def.name, found?.response || def.info || def.response),
      url: String(ex.url || (def.name === "discord" ? discordInvite : "") || ""),
      enabled: found ? enabled(found.enabled) : false,
      min_level: found ? Number(found.min_level) || def.rank : def.rank,
    });
  };

  const saveDefaultSettings = async () => {
    if (!defaultEdit) return;
    setBusy(true);
    try {
      const found = findCmd(defaultEdit);
      const name = String(defForm.name || defaultEdit.name)
        .replace(/^!/, "")
        .trim();
      const url = normalizeSocialUrl(
        name,
        String(defForm.url || "").trim() ||
          extractDiscordInvite(String(defForm.info || "")) ||
          (name.toLowerCase() === "discord" ? discordInvite : "")
      );
      const body = {
        id: found?.id || crypto.randomUUID(),
        name,
        response: sanitizeCommandResponse(name, String(defForm.info || defaultEdit.response)),
        enabled: Boolean(defForm.enabled),
        min_level: Number(defForm.min_level) || 0,
        cooldown_sec: 5,
        user_cooldown_sec: 0,
        aliases: String(defForm.aliases || "")
          .split(",")
          .map((x) => x.trim().replace(/^!/, ""))
          .filter(Boolean),
        platforms_json: JSON.stringify(["kick"]),
        extras_json: JSON.stringify({
          ...(found ? parseObject(found.extras_json) : {}),
          url,
        }),
      };
      if (found) await botaxtApi.updateCommand(body);
      else if (defForm.enabled) await botaxtApi.createCommand(body);
      setDefaultEdit(null);
      toast("Varsayılan komut ayarları kaydedildi");
      load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetDefaultSettings = () => {
    if (!defaultEdit) return;
    setDefForm({
      name: defaultEdit.name,
      aliases: defaultEdit.aliases.join(", "),
      info: defaultEdit.info || defaultEdit.response,
      url: defaultEdit.name === "discord" ? discordInvite : "",
      enabled: Boolean(defForm.enabled),
      min_level: defaultEdit.rank,
    });
  };

  const platforms = (form.platforms || []) as string[];
  const filteredDefaults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return DEFAULT_COMMANDS;
    return DEFAULT_COMMANDS.filter(
      (d) =>
        d.name.includes(q) ||
        d.response.toLowerCase().includes(q) ||
        d.aliases.some((a) => a.includes(q))
    );
  }, [search]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
        <div className="flex gap-6">
          {(
            [
              ["mine", "Komutlarım"],
              ["defaults", "Varsayılan komutlar"],
            ] as const
          ).map(([id, text]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={cn(
                "border-b-2 px-1 pb-3 text-sm font-semibold transition",
                sub === id
                  ? "border-teal-400 text-teal-300"
                  : "border-transparent text-white/50 hover:text-white/75"
              )}
            >
              {text}
            </button>
          ))}
        </div>
        {sub === "mine" ? (
          <button
            type="button"
            onClick={() => openMine()}
            className={cn(
              button,
              "mb-2 min-h-11 bg-teal-400 px-5 text-sm font-extrabold tracking-normal text-[#042f2e] hover:bg-teal-300"
            )}
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Komut ekle</span>
          </button>
        ) : null}
      </div>

      {sub === "mine" ? (
        <div className="space-y-3">
          {commands.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-[#101417] p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold text-teal-400">!{c.name}</p>
                <p className="mt-1 truncate text-sm text-white/50">{c.response}</p>
                <p className="mt-1 text-[11px] text-white/50">
                  Rank: {rankLabel(Number(c.min_level) || 0)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openMine(c)}
                  className={cn(button, "border border-white/15 bg-white/[0.06] font-extrabold text-white/90 hover:border-teal-400/40 hover:text-teal-200")}
                >
                  <Pencil className="h-3.5 w-3.5" /> Düzenle
                </button>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  className={cn(button, "border border-red-500/20 text-red-300/75 hover:bg-red-500/10")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {!commands.length ? (
            <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-sm text-white/50">
              Henüz komut eklenmedi.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <input
              className={cn(input, "pl-10")}
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-white/[0.08]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0a0d10] text-[10px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-3 py-2.5">Komut</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Mesaj</th>
                  <th className="px-3 py-2.5">Rank</th>
                  <th className="px-3 py-2.5">Açık</th>
                  <th className="px-3 py-2.5">Ayarlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredDefaults.map((def) => {
                  const found = findCmd(def);
                  const on = BUILTIN_ALWAYS.has(def.name)
                    ? !found || enabled(found.enabled)
                    : !!found && enabled(found.enabled);
                  const rank = found ? Number(found.min_level) || def.rank : def.rank;
                  return (
                    <tr key={def.name} className="border-t border-white/[0.06] bg-[#101417]">
                      <td className="px-3 py-3 font-mono font-semibold text-teal-400">
                        !{def.name}
                        {def.aliases.length ? (
                          <span className="ml-1 text-[10px] text-white/50">
                            , {def.aliases.map((a) => `!${a}`).join(", ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="hidden max-w-[280px] truncate px-3 py-3 text-white/50 md:table-cell">
                        {(found?.response || def.response).split("\n")[0]}
                      </td>
                      <td className="px-3 py-3 text-xs text-white/55">{rankLabel(rank)}</td>
                      <td className="px-3 py-3">
                        <GlowToggle
                          checked={on}
                          disabled={busy}
                          onChange={(v) => void toggleDefault(def, v)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => openDefaultSettings(def)}
                          className="rounded-lg border border-white/10 p-2 text-white/55 hover:text-teal-300"
                          title="Ayarlar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit ? (
        <Modal
          title={commands.some((c) => c.id === edit.id) ? "Komutu düzenle" : "Komut ekle"}
          onClose={() => setEdit(null)}
          onConfirm={() => void saveMine()}
          busy={busy}
        >
          <div className="rounded-lg border border-teal-400/20 bg-teal-400/[0.07] px-4 py-3 text-xs text-teal-200/80">
            Değişkenler: {"{user}"}, {"{username}"}, {"{channel}"}, {"{query}"}, {"{count}"},{" "}
            {"{points}"}, {"{level}"}, {"{url}"}, {"{time}"}, {"{name}"}, {"{xp}"}, {"{nextlvl}"},{" "}
            {"{amount}"}, {"{months}"}, {"{viewers}"}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={label}>Komut</span>
              <div className="flex">
                <span className="grid place-items-center rounded-l-lg border border-r-0 border-white/10 bg-white/5 px-3 text-teal-400">
                  !
                </span>
                <input
                  className={cn(input, "rounded-l-none")}
                  value={String(form.name || "")}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </label>
            <label>
              <span className={label}>Erişim</span>
              <select
                className={input}
                value={String(form.access || "anytime")}
                onChange={(e) => setForm({ ...form, access: e.target.value })}
              >
                {ACCESS.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <span className={label}>Aktivasyon</span>
            <ToggleGroup
              value={String(form.activation || "command")}
              options={[
                { v: "command", label: "Yalnızca komut" },
                { v: "keyword", label: "Sohbet anahtar kelimesi" },
              ]}
              onChange={(v) => setForm({ ...form, activation: v })}
            />
          </div>
          <label>
            <span className={label}>Mesaj</span>
            <textarea
              rows={5}
              className={input}
              value={String(form.response || "")}
              onChange={(e) => setForm({ ...form, response: e.target.value })}
              placeholder="Discord: {url}"
            />
          </label>
          {String(form.name || "").replace(/^!/, "").toLowerCase() === "discord" ||
          String(form.response || "").includes("{url}") ? (
            <label>
              <span className={label}>Link ({"{url}"})</span>
              <input
                className={input}
                value={String(form.url || "")}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://discord.gg/sunucun"
              />
              <p className="mt-1 text-[11px] text-white/50">
                !discord yazılınca sohbete bu adres gider. Komut adını yanıt olarak yazma.
              </p>
            </label>
          ) : null}
          <div>
            <span className={label}>Editör modu</span>
            <ToggleGroup
              value={String(form.editor_mode || "normal")}
              options={[
                { v: "normal", label: "Normal" },
                { v: "experimental", label: "Deneysel" },
              ]}
              onChange={(v) => setForm({ ...form, editor_mode: v })}
            />
          </div>
          <div>
            <span className={label}>Platform</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["kick", "twitch", "youtube", "discord"].map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() =>
                    setForm({
                      ...form,
                      platforms: platforms.includes(p)
                        ? platforms.filter((x) => x !== p)
                        : [...platforms, p],
                    })
                  }
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize tracking-normal",
                    platforms.includes(p)
                      ? "border-teal-400/50 bg-teal-400/10 text-teal-300"
                      : "border-white/10 text-white/50"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={label}>Cooldown</span>
              <select
                className={input}
                value={Number(form.cooldown_sec) || 0}
                onChange={(e) => setForm({ ...form, cooldown_sec: Number(e.target.value) })}
              >
                {COOLDOWNS.map((v) => (
                  <option key={v} value={v}>
                    {v} sn
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className={label}>Cooldown modu</span>
              <ToggleGroup
                value={String(form.cooldown_mode || "user")}
                options={[
                  { v: "global", label: "Global" },
                  { v: "user", label: "Kullanıcı başına" },
                ]}
                onChange={(v) => setForm({ ...form, cooldown_mode: v })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className={label}>Alias</span>
              <input
                className={input}
                value={String(form.aliases || "")}
                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                placeholder="örn. hello, hi"
              />
            </label>
            <label>
              <span className={label}>Fiyat (puan)</span>
              <input
                type="number"
                min={0}
                className={input}
                value={Number(form.cost_points) || 0}
                onChange={(e) => setForm({ ...form, cost_points: Number(e.target.value) })}
              />
            </label>
            <label>
              <span className={label}>Rank</span>
              <select
                className={input}
                value={Number(form.min_level) || 0}
                onChange={(e) => setForm({ ...form, min_level: Number(e.target.value) })}
              >
                {RANKS.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-white/50">Daha yüksek roller de komutu kullanabilir.</p>
        </Modal>
      ) : null}

      {defaultEdit ? (
        <Modal
          title="Komutu düzenle"
          onClose={() => setDefaultEdit(null)}
          onConfirm={() => void saveDefaultSettings()}
          busy={busy}
          footerExtra={
            <button
              type="button"
              onClick={resetDefaultSettings}
              className={cn(button, "mr-auto border border-amber-400/35 text-amber-300")}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Sıfırla
            </button>
          }
        >
          <p className="-mt-2 text-sm text-white/50">
            Botun sohbette göndereceği yanıt. Komut adını (!discord) buraya yazma.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={label}>Komut</span>
              <input
                className={input}
                value={String(defForm.name || "")}
                onChange={(e) => setDefForm({ ...defForm, name: e.target.value })}
              />
            </label>
            <label>
              <span className={label}>Alias</span>
              <input
                className={input}
                value={String(defForm.aliases || "")}
                onChange={(e) => setDefForm({ ...defForm, aliases: e.target.value })}
              />
            </label>
          </div>
          <label>
            <span className={label}>Yanıt mesajı</span>
            <textarea
              rows={5}
              className={input}
              value={String(defForm.info || "")}
              onChange={(e) => setDefForm({ ...defForm, info: e.target.value })}
              placeholder="Discord: {url}"
            />
          </label>
          {String(defaultEdit?.name || "").toLowerCase() === "discord" ||
          String(defForm.info || "").includes("{url}") ? (
            <label>
              <span className={label}>Discord davet linki ({"{url}"})</span>
              <input
                className={input}
                value={String(defForm.url || "")}
                onChange={(e) => setDefForm({ ...defForm, url: e.target.value })}
                placeholder="https://discord.gg/sunucun"
              />
            </label>
          ) : null}
          <div className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3">
            <span className="text-sm text-white/70">Açık</span>
            <GlowToggle
              checked={Boolean(defForm.enabled)}
              onChange={(v) => setDefForm({ ...defForm, enabled: v })}
            />
          </div>
          <label>
            <span className={label}>Rank</span>
            <select
              className={input}
              value={Number(defForm.min_level) || 0}
              onChange={(e) => setDefForm({ ...defForm, min_level: Number(e.target.value) })}
            >
              {RANKS.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-white/50">
              Daha yüksek roller de komutu kullanabilir.
            </p>
          </label>
        </Modal>
      ) : null}
    </>
  );
}
