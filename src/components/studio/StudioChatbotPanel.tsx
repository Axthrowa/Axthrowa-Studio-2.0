/** Studio Chatbot — SQLite bot_commands + timers CRUD. */

import { useCallback, useEffect, useState } from "react";
import { botaxtApi } from "../../lib/api/botaxt";
import { Btn, Check, Field, Header, SubNav } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

type Cmd = {
  id: string;
  name: string;
  aliases_json?: string;
  response: string;
  enabled: number | boolean;
  cooldown_sec: number;
  user_cooldown_sec: number;
  min_level: number;
  cost_points?: number;
  count_uses?: number;
};

type Timer = {
  id: string;
  name: string;
  message: string;
  enabled: number | boolean;
  interval_sec: number;
  min_chat_lines: number;
};

const LEVELS = [
  { v: 0, label: "Herkes" },
  { v: 100, label: "Abone" },
  { v: 500, label: "VIP" },
  { v: 1000, label: "Mod" },
];

function on(v: number | boolean | undefined) {
  return v === true || v === 1;
}

function parseAliases(raw?: string): string {
  try {
    const a = JSON.parse(raw || "[]");
    return Array.isArray(a) ? a.join(", ") : "";
  } catch {
    return "";
  }
}

export default function StudioChatbotPanel({ onToast }: Props) {
  const [sub, setSub] = useState<"commands" | "timers" | "settings">("commands");
  const [cmds, setCmds] = useState<Cmd[]>([]);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [prefix, setPrefix] = useState("!");
  const [botName, setBotName] = useState("BotAxT");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Cmd | null>(null);
  const [aliasStr, setAliasStr] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, t, s] = await Promise.all([
        botaxtApi.commands(),
        botaxtApi.timers().catch(() => ({ timers: [] })),
        botaxtApi.botSettings().catch(() => ({} as Record<string, unknown>)),
      ]);
      setCmds((c.commands || []) as Cmd[]);
      setTimers((t.timers || []) as Timer[]);
      const settings = s as Record<string, unknown>;
      if (settings.prefix) setPrefix(String(settings.prefix));
      if (settings.bot_name) setBotName(String(settings.bot_name));
      if (settings.enabled != null) setEnabled(on(settings.enabled as number | boolean));
    } catch (e) {
      onToast(String((e as Error).message || "Komutlar yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCmd = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const aliases = aliasStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const body = {
        id: edit.id,
        name: edit.name.replace(/^!/, "").trim() || "cmd",
        aliases,
        response: edit.response,
        enabled: on(edit.enabled),
        cooldown_sec: Number(edit.cooldown_sec) || 5,
        user_cooldown_sec: Number(edit.user_cooldown_sec) || 0,
        min_level: Number(edit.min_level) || 0,
        cost_points: Number(edit.cost_points) || 0,
      };
      const exists = cmds.some((c) => c.id === edit.id);
      if (exists) await botaxtApi.updateCommand(body);
      else await botaxtApi.createCommand(body);
      setEdit(null);
      onToast("Komut kaydedildi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  const removeCmd = async (id: string) => {
    setBusy(true);
    try {
      await botaxtApi.deleteCommand(id);
      onToast("Komut silindi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Silinemedi"));
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    try {
      await botaxtApi.putBotSettings({
        enabled,
        bot_name: botName,
        prefix,
      });
      onToast("Bot ayarları kaydedildi");
    } catch (e) {
      onToast(String((e as Error).message || "Ayar kaydı başarısız"));
    } finally {
      setBusy(false);
    }
  };

  const addTimer = async () => {
    setBusy(true);
    try {
      await botaxtApi.upsertTimer({
        name: "Hatırlatma",
        message: "Takip + !sosyal",
        enabled: true,
        interval_sec: 480,
        min_chat_lines: 12,
      });
      onToast("Timer eklendi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Timer eklenemedi"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Header
        title="Chatbot"
        sub="SQLite komutları · Rust dinleyici !prefix ile eşleştirir"
      />
      <SubNav
        value={sub}
        onChange={setSub}
        items={
          [
            { id: "commands", label: "Komutlar" },
            { id: "timers", label: "Timerlar" },
            { id: "settings", label: "Ayarlar" },
          ] as const
        }
      />

      {sub === "settings" && (
        <div className="yya-card space-y-3">
          <Check label="Bot açık" checked={enabled} onChange={setEnabled} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bot adı" value={botName} onChange={setBotName} />
            <Field label="Prefix" value={prefix} onChange={setPrefix} />
          </div>
          <Btn disabled={busy} onClick={() => void saveSettings()}>
            Kaydet
          </Btn>
        </div>
      )}

      {sub === "commands" && (
        <>
          <div className="flex flex-wrap gap-2">
            <Btn
              disabled={busy}
              onClick={() => {
                setEdit({
                  id: crypto.randomUUID(),
                  name: "yeni",
                  response: "Merhaba {user}!",
                  enabled: true,
                  cooldown_sec: 5,
                  user_cooldown_sec: 8,
                  min_level: 0,
                  cost_points: 0,
                });
                setAliasStr("");
              }}
            >
              + Komut
            </Btn>
            <Btn tone="ghost" disabled={busy} onClick={() => void load()}>
              Yenile
            </Btn>
          </div>

          <div className="overflow-hidden rounded-2xl border border-panel-border/80">
            <table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--panel-bg-deep)]/80 text-[11px] uppercase tracking-wider text-panel-muted">
                <tr>
                  <th className="px-3 py-2">Komut</th>
                  <th className="px-3 py-2">Yetki</th>
                  <th className="px-3 py-2">CD</th>
                  <th className="px-3 py-2">Kullanım</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cmds.map((c) => (
                  <tr key={c.id} className="border-t border-panel-border/50">
                    <td className="px-3 py-2">
                      <span className="font-medium text-panel-accent">
                        {prefix}
                        {c.name}
                      </span>
                      <div className="truncate text-[11px] text-panel-muted">{c.response}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-panel-muted">
                      {LEVELS.find((l) => l.v === c.min_level)?.label || c.min_level}
                    </td>
                    <td className="px-3 py-2 text-xs text-panel-muted">
                      {c.cooldown_sec}s / {c.user_cooldown_sec}s
                    </td>
                    <td className="px-3 py-2 text-xs text-panel-muted">{c.count_uses || 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Btn
                          tone="ghost"
                          onClick={() => {
                            setEdit(c);
                            setAliasStr(parseAliases(c.aliases_json));
                          }}
                        >
                          Düzenle
                        </Btn>
                        <Btn tone="danger" onClick={() => void removeCmd(c.id)}>
                          Sil
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
                {!cmds.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-xs text-panel-muted">
                      Henüz komut yok
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {edit ? (
            <div className="yya-card space-y-3">
              <h3 className="font-display text-base font-semibold text-white">Komut düzenle</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Ad (prefix olmadan)"
                  value={edit.name}
                  onChange={(v) => setEdit({ ...edit, name: v })}
                />
                <Field label="Alias (virgülle)" value={aliasStr} onChange={setAliasStr} />
              </div>
              <label className="block text-xs text-panel-muted">
                Yanıt
                <textarea
                  className="yya-input mt-1 min-h-[72px]"
                  value={edit.response}
                  onChange={(e) => setEdit({ ...edit, response: e.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  label="Global CD (sn)"
                  type="number"
                  value={String(edit.cooldown_sec)}
                  onChange={(v) => setEdit({ ...edit, cooldown_sec: Number(v) || 0 })}
                />
                <Field
                  label="Kullanıcı CD (sn)"
                  type="number"
                  value={String(edit.user_cooldown_sec)}
                  onChange={(v) => setEdit({ ...edit, user_cooldown_sec: Number(v) || 0 })}
                />
                <label className="block text-xs text-panel-muted">
                  Yetki
                  <select
                    className="yya-input mt-1"
                    value={edit.min_level}
                    onChange={(e) =>
                      setEdit({ ...edit, min_level: Number(e.target.value) || 0 })
                    }
                  >
                    {LEVELS.map((l) => (
                      <option key={l.v} value={l.v}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Check
                label="Aktif"
                checked={on(edit.enabled)}
                onChange={(v) => setEdit({ ...edit, enabled: v })}
              />
              <div className="flex gap-2">
                <Btn disabled={busy} onClick={() => void saveCmd()}>
                  Kaydet
                </Btn>
                <Btn tone="ghost" onClick={() => setEdit(null)}>
                  İptal
                </Btn>
              </div>
            </div>
          ) : null}
        </>
      )}

      {sub === "timers" && (
        <div className="space-y-3">
          <Btn disabled={busy} onClick={() => void addTimer()}>
            + Timer
          </Btn>
          {timers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-panel-border/70 bg-panel-elevated/40 px-3 py-2"
            >
              <div>
                <p className="text-sm text-white">{t.name}</p>
                <p className="text-[11px] text-panel-muted">
                  {t.interval_sec}s · {t.message}
                </p>
              </div>
              <Btn
                tone="danger"
                onClick={() =>
                  void botaxtApi.deleteTimer(t.id).then(() => load())
                }
              >
                Sil
              </Btn>
            </div>
          ))}
          {!timers.length ? (
            <p className="text-center text-xs text-panel-muted">Timer yok</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
