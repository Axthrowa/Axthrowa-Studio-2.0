/** Extras — Chat alerts, Clip, Rankings, Nightbot (Botrix parity). */

import { useState } from "react";
import { AlertTriangle, Upload } from "lucide-react";
import { botaxtApi } from "../../../lib/api/botaxt";
import { cn } from "../../../lib/cn";
import {
  FeatureRow,
  GlowToggle,
  Modal,
  button,
  enabled,
  input,
  label,
  parseObject,
  type Obj,
} from "./shared";

function normalizeTpl(s: string) {
  return s.replace(/\$\(([^)]+)\)/g, "{$1}");
}

type AlertEvent = {
  enabled?: boolean;
  message?: string;
  min_amount?: number;
  min_viewers?: number;
};

const ALERT_DEFAULTS: Record<string, AlertEvent> = {
  follow: {
    enabled: false,
    message: "@{name} takip için teşekkürler!",
  },
  kicks: {
    enabled: true,
    message: "@{name} {amount} KICKs için teşekkür ederim.",
    min_amount: 0,
  },
  subscription: {
    enabled: true,
    message: "@{name} {months} aydır abone olduğunuz için teşekkür ederim!",
  },
  resubscription: {
    enabled: true,
    message: "@{name}, {months} aylık aboneliğini yenilediğin için teşekkürler!",
  },
  gift: {
    enabled: true,
    message: "Hediye için teşekkürler @{name}!",
  },
  host: {
    enabled: true,
    message: "@{name} {viewers} izleyici ile beni raidlediğiniz için teşekkür ederim!",
    min_viewers: 0,
  },
  welcome: {
    enabled: false,
    message: "Hoş geldin @{name}!",
  },
};

const CLIP_RANKS = [
  { v: 0, label: "Herkes" },
  { v: 500, label: "VIP" },
  { v: 100, label: "Abone" },
  { v: 1000, label: "Moderatör" },
  { v: 2000, label: "Sahip" },
  { v: -1, label: "Kimse (komutu kapat)" },
];

export function ExtrasPanel({
  extras,
  saveExtras,
  toast,
}: {
  extras: Obj;
  saveExtras: (next: Obj) => Promise<void>;
  toast: (m: string) => void;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<Obj>({});
  const [events, setEvents] = useState<Record<string, AlertEvent>>({});
  const [importText, setImportText] = useState("");
  const [resetPoints, setResetPoints] = useState(false);
  const [resetLevels, setResetLevels] = useState(false);
  const [busy, setBusy] = useState(false);
  const chatbot = parseObject(extras.chatbot_extras);
  const runtime = parseObject(extras.runtime_commands);

  const saveFeature = async (key: string, value: Obj) => {
    setBusy(true);
    try {
      await saveExtras({
        ...extras,
        chatbot_extras: { ...chatbot, [key]: value },
      });
      if (key === "watchtime_points") {
        await botaxtApi.putLoyaltySettings({
          tick_enabled: value.enabled !== false,
        });
      }
      toast("Ekstra ayar kaydedildi");
      setEdit(null);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRuntime = async (key: string, value: boolean) => {
    setBusy(true);
    try {
      await saveExtras({
        ...extras,
        runtime_commands: { ...runtime, [key]: value },
      });
      toast(`!${key} ${value ? "açıldı" : "kapatıldı"}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openChatAlerts = () => {
    const cfg = parseObject(chatbot.chat_alerts);
    const stored = parseObject(cfg.events);
    const next: Record<string, AlertEvent> = {};
    for (const [k, def] of Object.entries(ALERT_DEFAULTS)) {
      const cur = parseObject(stored[k]) as AlertEvent;
      next[k] = {
        enabled: cur.enabled ?? def.enabled,
        message: normalizeTpl(String(cur.message || def.message || "")),
        min_amount: Number(cur.min_amount ?? def.min_amount ?? 0),
        min_viewers: Number(cur.min_viewers ?? def.min_viewers ?? 0),
      };
    }
    setEvents(next);
    setDraft({ enabled: cfg.enabled !== false });
    setEdit("chat_alerts");
  };

  const saveChatAlerts = async () => {
    await saveFeature("chat_alerts", {
      enabled: draft.enabled !== false,
      events,
    });
  };

  const openClip = () => {
    const cfg = parseObject(chatbot.clip_command);
    setDraft({
      enabled: cfg.enabled !== false,
      min_rank: Number(cfg.min_rank ?? 0),
    });
    setEdit("clip_command");
  };

  const saveClip = async () => {
    const min = Number(draft.min_rank);
    await saveFeature("clip_command", {
      enabled: min === -1 ? false : draft.enabled !== false,
      min_rank: min,
    });
  };

  const runReset = async () => {
    if (!resetPoints && !resetLevels) {
      toast("En az bir seçenek işaretleyin");
      return;
    }
    setBusy(true);
    try {
      await botaxtApi.resetLoyalty({
        points: resetPoints,
        levels: resetLevels,
      });
      toast("Sıralama sıfırlandı");
      setEdit(null);
      setResetPoints(false);
      setResetLevels(false);
    } catch (e) {
      toast((e as Error).message || "Sıfırlama başarısız");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const data = JSON.parse(importText) as Obj;
      const commands = Array.isArray(data.commands)
        ? (data.commands as Obj[])
        : Array.isArray(data)
          ? (data as Obj[])
          : [];
      const timers = Array.isArray(data.timers) ? (data.timers as Obj[]) : [];
      let count = 0;
      for (const c of commands) {
        const name = String(c.command || c.name || "").replace(/^!/, "");
        const response = String(c.message || c.response || "");
        if (!name || !response) continue;
        await botaxtApi.createCommand({
          id: crypto.randomUUID(),
          name,
          response,
          enabled: true,
          min_level: 0,
          cooldown_sec: Number(c.cooldown || 5),
          aliases: [],
          platforms_json: JSON.stringify(["kick"]),
        });
        count++;
      }
      for (const t of timers) {
        const message = String(t.message || t.response || "");
        if (!message) continue;
        await botaxtApi.upsertTimer({
          id: crypto.randomUUID(),
          name: String(t.name || "Nightbot"),
          message,
          enabled: true,
          interval_sec: Number(
            t.interval_sec || Number(t.interval || 5) * 60
          ),
          min_chat_lines: Number(t.min_chat_lines || t.chat_lines || 0),
          platforms_json: JSON.stringify(["kick"]),
        });
        count++;
      }
      toast(`${count} öğe içe aktarıldı`);
      setEdit(null);
      setImportText("");
    } catch (e) {
      toast(
        e instanceof SyntaxError
          ? "Geçerli Nightbot JSON'u girin"
          : (e as Error).message
      );
    } finally {
      setBusy(false);
    }
  };

  const patchEvent = (key: string, patch: Partial<AlertEvent>) => {
    setEvents((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const alertCards: {
    key: string;
    title: string;
    premium?: boolean;
    minKey?: "min_amount" | "min_viewers";
    minLabel?: string;
  }[] = [
    { key: "follow", title: "Takip" },
    { key: "kicks", title: "KICKs", minKey: "min_amount", minLabel: "Minimum tutar" },
    { key: "subscription", title: "Abonelik" },
    { key: "resubscription", title: "Yenileme" },
    { key: "gift", title: "Hediye abone" },
    { key: "host", title: "Host / Raid", minKey: "min_viewers", minLabel: "Minimum izleyici" },
    { key: "welcome", title: "Hoş geldin", premium: true },
  ];

  return (
    <>
      <div className="space-y-3">
        <FeatureRow
          title="Sohbet uyarıları"
          desc="Takip, abone, raid gibi etkileşimlerde sohbete mesaj gönderir."
          checked={enabled(parseObject(chatbot.chat_alerts).enabled) || parseObject(chatbot.chat_alerts).enabled === undefined}
          busy={busy}
          onToggle={(v) =>
            void saveFeature("chat_alerts", {
              ...parseObject(chatbot.chat_alerts),
              enabled: v,
            })
          }
          onConfigure={openChatAlerts}
        />
        <FeatureRow
          title="Clip komutu"
          desc="Sohbetten !clip yazınca yayıncıya klip isteği düşer (Kick klip API’si yok; mesaj gönderilir)."
          checked={
            enabled(parseObject(chatbot.clip_command).enabled) ||
            parseObject(chatbot.clip_command).enabled === undefined
          }
          busy={busy}
          onToggle={(v) =>
            void saveFeature("clip_command", {
              ...parseObject(chatbot.clip_command),
              enabled: v,
            })
          }
          onConfigure={openClip}
        />
        <FeatureRow
          title="Seviye sistemi"
          desc="Sohbet etkileşimiyle izleyicilere seviye verir."
          checked={enabled(parseObject(chatbot.level_system).enabled)}
          busy={busy}
          onToggle={(v) => void saveFeature("level_system", { enabled: v })}
        />
        <FeatureRow
          title="İzleme süresi ve puan"
          desc="Yayını izleyenlere otomatik puan kazandırır."
          checked={enabled(parseObject(chatbot.watchtime_points).enabled)}
          busy={busy}
          onToggle={(v) => void saveFeature("watchtime_points", { enabled: v })}
        />
        <FeatureRow
          title="Sıralamalar"
          desc="Puan, seviye veya her ikisini sıfırlayın."
          checked={false}
          hideToggle
          onToggle={() => undefined}
          onConfigure={() => {
            setResetPoints(false);
            setResetLevels(false);
            setEdit("rankings");
          }}
          configureLabel="Sıfırla"
        />
        <FeatureRow
          title="Nightbot'tan içe aktar"
          desc="Komut, timer ve moderasyon ayarlarını içe aktarın."
          checked={false}
          hideToggle
          onToggle={() => undefined}
          onConfigure={() => setEdit("import")}
          configureLabel="İçe aktar"
        />
      </div>

      <h3 className="mb-3 mt-7 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
        Widget komutları
      </h3>
      <div className="space-y-3">
        {(
          [
            ["oy", "!oy", "Aktif ankete oy gönderir"],
            ["sr", "!sr", "Şarkı isteğini kuyruğa ekler"],
            ["katil", "!katil", "Çekilişe katılım sağlar"],
          ] as const
        ).map(([key, title, desc]) => (
          <FeatureRow
            key={key}
            title={title}
            desc={desc}
            checked={runtime[key] !== false}
            busy={busy}
            onToggle={(v) => void toggleRuntime(key, v)}
          />
        ))}
      </div>

      {edit === "chat_alerts" ? (
        <Modal
          title="Metin uyarıları"
          onClose={() => setEdit(null)}
          onConfirm={() => void saveChatAlerts()}
          busy={busy}
        >
          <div className="space-y-3">
            {alertCards.map((card) => {
              const ev = events[card.key] || {};
              return (
                <div
                  key={card.key}
                  className="rounded-xl border border-white/[0.08] bg-[#0b0f12] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-teal-400">{card.title}</span>
                      {card.premium ? (
                        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                          Premium
                        </span>
                      ) : null}
                    </div>
                    <GlowToggle
                      checked={!!ev.enabled}
                      onChange={(v) => patchEvent(card.key, { enabled: v })}
                    />
                  </div>
                  {ev.enabled ? (
                    <div className="space-y-3">
                      <textarea
                        rows={2}
                        className={input}
                        value={ev.message || ""}
                        onChange={(e) =>
                          patchEvent(card.key, { message: e.target.value })
                        }
                        placeholder="Mesaj..."
                      />
                      {card.minKey ? (
                        <label>
                          <span className={label}>{card.minLabel}</span>
                          <input
                            type="number"
                            min={0}
                            className={input}
                            value={Number(ev[card.minKey] || 0)}
                            onChange={(e) =>
                              patchEvent(card.key, {
                                [card.minKey!]: Number(e.target.value) || 0,
                              })
                            }
                          />
                          <p className="mt-1 text-[11px] text-white/50">
                            Uyarı yalnızca değer bu minimuma ulaşırsa gönderilir.
                          </p>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {edit === "clip_command" ? (
        <Modal
          title="Clip komutu"
          onClose={() => setEdit(null)}
          onConfirm={() => void saveClip()}
          busy={busy}
        >
          <p className="text-sm text-white/55">
            Komutu kullanmak için minimum rol:
          </p>
          <select
            className={input}
            value={Number(draft.min_rank ?? 0)}
            onChange={(e) => setDraft({ ...draft, min_rank: Number(e.target.value) })}
          >
            {CLIP_RANKS.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>
        </Modal>
      ) : null}

      {edit === "rankings" ? (
        <Modal
          title="Sıralamaları sıfırla"
          onClose={() => setEdit(null)}
          onConfirm={() => void runReset()}
          busy={busy}
          confirm="Sıfırla"
        >
          <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
            <input
              type="checkbox"
              className="mt-1 accent-teal-400"
              checked={resetPoints}
              onChange={(e) => setResetPoints(e.target.checked)}
            />
            <div>
              <p className="font-semibold text-white">Puanlar</p>
              <p className="mt-1 text-xs text-white/50">
                *Tüm izleyicilerin puanlarını kalıcı silmek için işaretleyin.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
            <input
              type="checkbox"
              className="mt-1 accent-teal-400"
              checked={resetLevels}
              onChange={(e) => setResetLevels(e.target.checked)}
            />
            <div>
              <p className="font-semibold text-white">Seviyeler</p>
              <p className="mt-1 text-xs text-white/50">
                *Tüm izleyicilerin seviyesini 0 yapmak için işaretleyin.
              </p>
            </div>
          </label>
          <p className="text-xs text-amber-200/80">
            *Bu işlem veritabanından siler ve geri alınamaz.
          </p>
        </Modal>
      ) : null}

      {edit === "import" ? (
        <Modal
          title="Nightbot'tan içe aktar"
          onClose={() => setEdit(null)}
          onConfirm={() => void runImport()}
          busy={busy}
          confirm="İçe aktar"
        >
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs text-amber-100/70">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            Nightbot dışa aktarma JSON&apos;unu yapıştırın. Desteklenmeyen alanlar
            atlanır.
          </div>
          <label>
            <span className={label}>JSON</span>
            <textarea
              rows={12}
              className={cn(input, "font-mono text-xs")}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'{"commands":[{"name":"hello","message":"Merhaba!"}]}'}
            />
          </label>
          <label
            className={cn(
              button,
              "w-fit cursor-pointer border border-white/10 text-white/60 hover:border-teal-400/30 hover:text-teal-300"
            )}
          >
            <Upload className="h-4 w-4" />
            JSON dosyası seç
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void file.text().then(setImportText);
              }}
            />
          </label>
        </Modal>
      ) : null}
    </>
  );
}
