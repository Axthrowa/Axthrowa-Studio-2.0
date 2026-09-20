/**
 * Widget canlı kontrol paneli — Anket, Çekiliş, Müzik, Webhook, TTS.
 * API/state aynı; UI Night Signal Deep + InfoAlert.
 */

import { useEffect, useState } from "react";
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
import {
  Copy,
  Disc3,
  Gift,
  GripVertical,
  Pause,
  Play,
  Plus,
  SkipForward,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { API_BASE } from "../../lib/api";
import {
  runtimeApi,
  type PollRuntime,
  type RaffleRuntime,
  type SongItem,
  type SongsRuntime,
} from "../../lib/widgets/runtimeApi";
import { Btn } from "../panel/botTabs/ui";
import InfoAlert from "../ui/InfoAlert";
import { RuntimePanelShell } from "../ui/SettingsGroup";

type Props = {
  kind: string;
  config: Record<string, unknown>;
  onToast: (m: string) => void;
  onConfigPatch?: (key: string, value: unknown) => void;
};

export default function WidgetRuntimePanel({
  kind,
  config,
  onToast,
  onConfigPatch,
}: Props) {
  const k = kind.toLowerCase();

  if (k === "poll" || k === "polls") {
    return <PollControls onToast={onToast} defaultCmd={String(config.command || "!oy")} />;
  }
  if (k === "raffles" || k === "giveaway") {
    return (
      <RaffleControls
        onToast={onToast}
        defaultCmd={String(config.joinCommand || "!katil")}
      />
    );
  }
  if (k === "songrequest" || k === "now-playing") {
    return <SongControls onToast={onToast} />;
  }
  if (k === "goal" || k === "goals") {
    return <GoalWebhookInfo onToast={onToast} />;
  }
  if (k === "tts" || k === "cloudtts") {
    return <TtsInfoCard />;
  }
  if (k === "credits" || k === "moviecredits") {
    return (
      <CreditsEntriesEditor
        entries={
          Array.isArray(config.custom_entries)
            ? (config.custom_entries as Array<{ role?: string; name?: string }>)
            : []
        }
        onChange={(entries) => onConfigPatch?.("custom_entries", entries)}
      />
    );
  }
  return null;
}

function PollControls({
  onToast,
  defaultCmd,
}: {
  onToast: (m: string) => void;
  defaultCmd: string;
}) {
  const [question, setQuestion] = useState("Bugün ne oynayalım?");
  const [options, setOptions] = useState(["Evet", "Hayır", "Valorant", "Just Chatting"]);
  const [command, setCommand] = useState(defaultCmd || "!oy");
  const [live, setLive] = useState<PollRuntime | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void runtimeApi.getPoll().then(setLive).catch(() => undefined);
    const t = window.setInterval(() => {
      void runtimeApi.getPoll().then(setLive).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(t);
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const p = await runtimeApi.startPoll({ question, options, command });
      setLive(p);
      onToast("Anket başladı — OBS barları canlı");
    } catch (e) {
      onToast(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      setLive(await runtimeApi.stopPoll());
      onToast("Anket durduruldu");
    } catch (e) {
      onToast(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  const total = live
    ? Object.values(live.votes || {}).reduce((a, b) => a + Number(b), 0)
    : 0;

  return (
    <RuntimePanelShell
      eyebrow="Canlı anket"
      title="Yeni anket başlat"
      icon={<Sparkles className="h-4 w-4" />}
      accentClass="text-panel-accent border-panel-accent/30"
    >
      <label className="block text-xs text-panel-muted">
        <span className="mb-1.5 block font-medium">Soru</span>
        <input
          className="yya-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </label>
      <label className="block text-xs text-panel-muted">
        <span className="mb-1.5 block font-medium">Oy komutu</span>
        <input
          className="yya-input font-mono"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
      </label>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-panel-muted">Seçenekler</p>
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <span className="grid h-9 min-w-[3.5rem] shrink-0 place-items-center rounded-lg bg-panel-soft px-1.5 font-mono text-[10px] font-bold text-panel-accent">
              {command} {i + 1}
            </span>
            <input
              className="yya-input flex-1 text-xs"
              value={o}
              onChange={(e) => {
                const next = [...options];
                next[i] = e.target.value;
                setOptions(next);
              }}
            />
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/25 text-red-200"
              onClick={() => setOptions(options.filter((_, j) => j !== i))}
              aria-label="Sil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-panel-accent/40 py-2.5 text-[12px] font-semibold text-panel-accent"
          onClick={() => setOptions([...options, `Cevap ${options.length + 1}`])}
        >
          <Plus className="h-3.5 w-3.5" />
          Seçenek ekle
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn tone="accent" disabled={busy} onClick={() => void start()}>
          Anketi başlat
        </Btn>
        <Btn tone="ghost" disabled={busy} onClick={() => void stop()}>
          Durdur
        </Btn>
      </div>
      {live?.active && (
        <div className="rounded-xl border border-panel-accent/20 bg-black/35 p-3 text-xs text-white/80">
          <p className="font-semibold text-panel-accent">Canlı · {live.question}</p>
          <p className="mt-1 text-white/50">
            {command} 1…{live.options?.length || 0} · toplam oy {total}
          </p>
          <ul className="mt-3 space-y-2">
            {(live.options || []).map((lab, i) => {
              const n = Number(live.votes?.[String(i + 1)] ?? live.votes?.[i + 1] ?? 0);
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <li key={i}>
                  <div className="mb-1 flex justify-between gap-2 text-[11px]">
                    <span>
                      {i + 1}. {lab}
                    </span>
                    <span className="font-mono text-panel-accent">
                      {n} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-panel-accent to-[#7eeaea] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </RuntimePanelShell>
  );
}

function RaffleControls({
  onToast,
  defaultCmd,
}: {
  onToast: (m: string) => void;
  defaultCmd: string;
}) {
  const [cmd, setCmd] = useState(defaultCmd || "!katil");
  const [durationSec, setDurationSec] = useState(120);
  const [live, setLive] = useState<RaffleRuntime | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    void runtimeApi.getRaffle().then(setLive).catch(() => undefined);

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 1500);
    return () => window.clearInterval(t);
  }, []);

  return (
    <RuntimePanelShell
      eyebrow="Çekiliş"
      title="Katılımcılar & çekiliş"
      icon={<Gift className="h-4 w-4" />}
      accentClass="text-amber-300 border-amber-400/30"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-panel-muted">
          <span className="mb-1.5 block font-medium">Katılım komutu</span>
          <input
            className="yya-input font-mono"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
          />
        </label>
        <label className="block text-xs text-panel-muted">
          <span className="mb-1.5 block font-medium">Süre (sn)</span>
          <input
            type="number"
            className="yya-input"
            value={durationSec}
            min={10}
            onChange={(e) => setDurationSec(Number(e.target.value) || 120)}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn
          tone="accent"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setLive(
                await runtimeApi.startRaffle({
                  joinCommand: cmd,
                  durationSec,
                })
              );
              onToast("Çekiliş açıldı — chat’ten katılım bekleniyor");
            } catch (e) {
              onToast(String((e as Error).message || e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Çekilişi başlat
        </Btn>
        <Btn
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await runtimeApi.drawRaffle();
              setLive(r);
              onToast(r.winner ? `Kazanan: ${r.winner}` : "Katılımcı yok");
            } catch (e) {
              onToast(String((e as Error).message || e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Kazananı çek
        </Btn>
        <Btn
          tone="ghost"
          disabled={busy}
          onClick={() => void runtimeApi.stopRaffle().then(setLive)}
        >
          Kapat
        </Btn>
      </div>
      <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
          <Trophy className="h-3.5 w-3.5" />
          Çekilişe Katılanlar ({live?.entrants?.length || 0})
        </p>
        {live?.winner && (
          <p className="mt-2 font-display text-lg font-bold text-[#ff8a5b]">
            {live.winner}
          </p>
        )}
        <ul className="mt-2 space-y-1 text-[12px] text-white/70">
          {(live?.entrants || []).length === 0 ? (
            <li className="text-white/50">Henüz yok — {cmd}</li>
          ) : (
            (live?.entrants || []).map((u) => (
              <li
                key={u}
                className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1"
              >
                {u}
              </li>
            ))
          )}
        </ul>
      </div>
    </RuntimePanelShell>
  );
}

function EqualizerBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {[0.35, 0.7, 0.45, 0.9, 0.55].map((base, i) => (
        <span
          key={i}
          className="w-1 origin-bottom rounded-sm bg-panel-accent"
          style={{
            height: `${Math.round(base * 100)}%`,
            animation: active
              ? `yya-eq-bounce 0.65s ease-in-out ${i * 0.09}s infinite alternate`
              : "none",
            opacity: active ? 1 : 0.35,
          }}
        />
      ))}
      <style>{`
        @keyframes yya-eq-bounce {
          0% { transform: scaleY(0.35); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

function SortableSongRow({
  song,
  index,
}: {
  song: SongItem;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: song.id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex items-center gap-2 truncate rounded-xl border border-white/5 bg-black/30 px-2 py-2 ${
        isDragging ? "z-10 border-panel-accent/40 opacity-90 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-white/50 active:cursor-grabbing"
        aria-label="Sürükle"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="mr-1 font-mono text-panel-accent">{index + 1}.</span>
      <span className="min-w-0 flex-1 truncate">
        {song.title} · {song.by}
      </span>
    </li>
  );
}

function SongControls({ onToast }: { onToast: (m: string) => void }) {
  const [live, setLive] = useState<SongsRuntime | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const refresh = () => void runtimeApi.getSongs().then(setLive).catch(() => undefined);
  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 2000);
    return () => window.clearInterval(t);
  }, []);

  const cur = live?.current;
  const vid = cur?.videoId || (cur as { video_id?: string })?.video_id;
  const queue = live?.queue || [];
  const playing = Boolean(live?.playing && cur);

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = queue.findIndex((t) => t.id === active.id);
    const newIndex = queue.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(queue, oldIndex, newIndex);
    setLive((prev) => (prev ? { ...prev, queue: next } : prev));
    try {
      setLive(await runtimeApi.reorderSongs(next.map((t) => t.id)));
    } catch (e) {
      onToast(String((e as Error).message || e));
      refresh();
    }
  };

  return (
    <RuntimePanelShell
      eyebrow="Song request"
      title="Müzik sırası"
      icon={<Disc3 className="h-4 w-4" />}
      accentClass="text-panel-accent border-panel-accent/30"
    >
      <InfoAlert tone="info" title="Nasıl çalışır?">
        Chat’ten <code className="text-panel-accent">!sr youtube-link</code> ile sıraya eklenir.
        Ses OBS’e gitmesi için panel açık kalmalı. Kuyruğu sürükleyerek sıralayın.
      </InfoAlert>

      {vid && live?.playing !== false && (
        <iframe
          title="sr-panel-player"
          className="h-36 w-full rounded-xl border border-white/10 shadow-lg"
          src={`https://www.youtube.com/embed/${vid}?autoplay=1&controls=1`}
          allow="autoplay; encrypted-media"
        />
      )}

      <div className="relative overflow-hidden rounded-xl border border-panel-accent/25 bg-gradient-to-r from-panel-accent/15 via-black/50 to-black/40 p-3">
        <div className="flex items-center gap-3">
          <EqualizerBars active={playing} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-panel-accent/80">
              Now Playing
            </p>
            <p className="mt-0.5 truncate font-semibold text-white">
              {cur?.title || "— boş —"}
            </p>
            {cur?.by ? (
              <p className="text-[11px] text-white/50">isteyen · {cur.by}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Btn
          tone="accent"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setLive(await runtimeApi.playSong());
            } finally {
              setBusy(false);
            }
          }}
        >
          <Play className="h-3.5 w-3.5" /> Oynat
        </Btn>
        <Btn
          tone="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setLive(await runtimeApi.pauseSong());
            } finally {
              setBusy(false);
            }
          }}
        >
          <Pause className="h-3.5 w-3.5" /> Duraklat
        </Btn>
        <Btn
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setLive(await runtimeApi.skipSong());
              onToast("Sonraki şarkı");
            } finally {
              setBusy(false);
            }
          }}
        >
          <SkipForward className="h-3.5 w-3.5" /> Geç
        </Btn>
        <Btn tone="ghost" disabled={busy} onClick={() => void runtimeApi.clearSongs().then(setLive)}>
          Sırayı temizle
        </Btn>
      </div>

      <div className="flex gap-2">
        <input
          className="yya-input flex-1 text-xs"
          placeholder="YouTube link veya isim"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <Btn
          disabled={busy || !manual.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              setLive(await runtimeApi.addSong({ text: manual.trim(), by: "panel" }));
              setManual("");
              onToast("Sıraya eklendi");
            } catch (e) {
              onToast(String((e as Error).message || e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Ekle
        </Btn>
      </div>

      <div className="max-h-52 space-y-1.5 overflow-y-auto text-[12px] text-white/70">
        <p className="sticky top-0 z-[1] mb-1 bg-[color:var(--panel-bg-deep)] pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-panel-accent">
          Canlı kuyruk · {queue.length}
        </p>
        {queue.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-white/50">
            Chat’ten !sr ile doldurulur
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
            <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {queue.map((t, i) => (
                  <SortableSongRow key={t.id} song={t} index={i} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </RuntimePanelShell>
  );
}

function GoalWebhookInfo({ onToast }: { onToast: (m: string) => void }) {
  const url = runtimeApi.donationsWebhookUrl();
  return (
    <InfoAlert
      tone="webhook"
      title="Bağış webhook’unuz"
      action={
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-panel-accent/30 bg-panel-soft px-2 py-1 text-[10px] font-semibold text-panel-accent"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => onToast("Webhook URL kopyalandı"));
          }}
        >
          <Copy className="h-3 w-3" /> Kopyala
        </button>
      }
    >
      <p className="mb-2">
        ByNoGame ve benzeri platformlardan gelen bağışları hedefe yazmak için bu URL’yi webhook
        olarak kaydedin:
      </p>
      <code className="mb-2 block break-all rounded-xl border border-panel-border/80 bg-black/45 px-3 py-2 font-mono text-[11px] text-[#7dd3d3]">
        {url}
      </code>
      <p className="text-[11px] text-panel-muted">
        Örnek gövde:{" "}
        <code className="text-white/70">{`{"{"}"amount":50,"user":"Ali","message":"sağol"{"}"}`}</code>
        {" · "}
        Yerel API: <code className="text-white/60">{API_BASE}</code>
      </p>
    </InfoAlert>
  );
}

function TtsInfoCard() {
  return (
    <InfoAlert tone="tts" title="Cloud / Standart TTS">
      <p className="mb-2">
        Bağış, abone veya chat mesajlarını sesli okur. OBS Browser Source olarak eklendiğinde yayın
        sesine karışır.
      </p>
      <ul className="list-inside list-disc space-y-1 text-white/70">
        <li>
          Komut: <code className="text-panel-accent">!tts mesajın</code>
        </li>
        <li>Otomatik: bağış / abone olaylarında (aşağıdaki anahtarlarla aç/kapa)</li>
        <li>
          Motor: <em>standard</em> = tarayıcı SpeechSynthesis · <em>cloud</em> = bulut ses
        </li>
      </ul>
      <p className="mt-2 text-[11px] text-panel-muted">
        İpucu: Overlay’de ses için OBS’te “Tarayıcı kaynağını izle” açık olmalı.
      </p>
    </InfoAlert>
  );
}

function CreditsEntriesEditor({
  entries,
  onChange,
}: {
  entries: Array<{ role?: string; name?: string }>;
  onChange: (e: Array<{ role: string; name: string }>) => void;
}) {
  const list = entries.length > 0 ? entries : [{ role: "Özel Sponsor", name: "" }];
  return (
    <RuntimePanelShell
      eyebrow="Credits"
      title="Özel teşekkürler"
      accentClass="text-panel-accent border-panel-accent/25"
    >
      {list.map((row, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <input
            className="yya-input min-w-[7rem] flex-1 text-xs"
            placeholder="Rol (Örn: Sponsor)"
            value={row.role || ""}
            onChange={(e) => {
              const next = list.map((x, j) =>
                j === i ? { role: e.target.value, name: x.name || "" } : x
              );
              onChange(next.map((x) => ({ role: x.role || "", name: x.name || "" })));
            }}
          />
          <input
            className="yya-input min-w-[7rem] flex-1 text-xs"
            placeholder="İsim"
            value={row.name || ""}
            onChange={(e) => {
              const next = list.map((x, j) =>
                j === i ? { role: x.role || "", name: e.target.value } : x
              );
              onChange(next.map((x) => ({ role: x.role || "", name: x.name || "" })));
            }}
          />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/25 text-red-200"
            onClick={() =>
              onChange(
                list
                  .filter((_, j) => j !== i)
                  .map((x) => ({ role: x.role || "", name: x.name || "" }))
              )
            }
            aria-label="Sil"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-panel-accent/40 py-2.5 text-[12px] font-semibold text-panel-accent"
        onClick={() =>
          onChange([
            ...list.map((x) => ({ role: x.role || "", name: x.name || "" })),
            { role: "Teşekkür", name: "" },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Satır ekle
      </button>
    </RuntimePanelShell>
  );
}
