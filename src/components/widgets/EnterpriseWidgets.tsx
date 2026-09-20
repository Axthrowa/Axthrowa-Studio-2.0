/** Viewers / Labels / Activity / Shoutout / Wheel / Poll / Raffles / Hype / Song / TTS / Credits */

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { runtimeApi } from "../../lib/widgets/runtimeApi";
import { useRuntimeBus } from "../../lib/widgets/useRuntimeBus";
import { useSubathonEvents } from "../../lib/widgets/useSubathonEvents";
import { useWidgetSync, type WidgetSyncEvent } from "../../lib/widgets/useWidgetSync";
import {
  emitWidgetBus,
  playWidgetSfx,
  resolveSfx,
  volFromConfig,
  subscribeWidgetBus,
} from "../../lib/widgets/widgetBus";

type Cfg = { config: Record<string, unknown> };

export function ViewersWidget({ config }: Cfg) {
  const isPreview = Boolean(config._previewMode);
  const [n, setN] = useState(() => (isPreview ? 1284 : 0));
  const fontSize = Number(config.fontSize) || 42;
  const color = String(config.color || "#F1F5F9");
  const suffix = String(config.suffix ?? " izleyici");
  const prefix = String(config.prefix || "");
  const mode = String(config.mode || "sum");
  const { subscribe } = useWidgetSync();
  useEffect(() => {
    if (isPreview) {
      setN(mode === "kick" ? 842 : mode === "twitch" ? 442 : 1284);
      return;
    }
    return subscribe((ev) => {
      if (ev.kind === "raid") {
        const amt = Number(ev.amount) || 10;
        setN((x) => x + amt);
      }
    });
  }, [subscribe, isPreview, mode]);
  return (
    <div className="flex yya-widget-root items-center justify-center bg-transparent">
      <p className="font-bold tabular-nums text-white" style={{ fontSize, color }}>
        {prefix}
        {n.toLocaleString("tr-TR")}
        {suffix}
      </p>
    </div>
  );
}

export function LabelsWidget({ config }: Cfg) {
  const items = Array.isArray(config.items)
    ? (config.items as Array<{ label?: string; value?: string }>)
    : [];
  const marquee = Boolean(config.marquee);
  const fontSize = Number(config.fontSize) || 20;
  const color = String(config.color || "#E2E8F0");
  const labelColor = String(config.labelColor || "#94A3B8");
  const sep = String(config.separator || "  ·  ");
  const text = items
    .map((i) => `${i.label || ""}: ${i.value || "—"}`)
    .join(sep);
  return (
    <div className="flex yya-widget-root items-end bg-transparent p-4">
      <div
        className={`w-full overflow-hidden whitespace-nowrap ${marquee ? "animate-pulse" : ""}`}
        style={{ fontSize, color }}
      >
        {items.length === 0 ? (
          <span style={{ color: labelColor }}>Etiketler bekleniyor…</span>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

export function ActivityWidget({ config }: Cfg) {
  const isPreview = Boolean(config._previewMode);
  const [rows, setRows] = useState<WidgetSyncEvent[]>(() =>
    isPreview
      ? ([
          { id: "p1", kind: "sub", user: "AxthrowA", amount: 1, t: Date.now() },
          { id: "p2", kind: "follow", user: "NeonFox", t: Date.now() - 1000 },
          { id: "p3", kind: "tip", user: "KickKing", amount: 50, t: Date.now() - 2000 },
          { id: "p4", kind: "bits", user: "BitFan", amount: 100, t: Date.now() - 3000 },
        ] as WidgetSyncEvent[])
      : []
  );
  const max = Number(config.maxItems) || 12;
  const push = (ev: WidgetSyncEvent) => {
    const show =
      (ev.kind === "follow" && config.showFollow !== false) ||
      (ev.kind === "sub" && config.showSub !== false) ||
      (ev.kind === "raid" && config.showRaid !== false) ||
      ((ev.kind === "tip" || ev.kind === "donation") && config.showTip !== false) ||
      (ev.kind === "bits" && config.showCheer !== false && config.showBits !== false);
    if (!show) return;
    setRows((p) => {
      if (p.some((x) => x.id === ev.id)) return p;
      return [ev, ...p].slice(0, max);
    });
  };
  const { subscribe } = useWidgetSync({
    kinds: ["follow", "sub", "tip", "raid", "bits", "donation"],
  });
  useEffect(() => {
    if (isPreview) return;
    return subscribe((ev) => push(ev));
  }, [subscribe, max, config, isPreview]);
  useSubathonEvents((ev) => {
    if (isPreview) return;
    push({
      id: `act-${ev.kind}-${Date.now()}-${ev.user || ""}`,
      kind: ev.kind === "donation" ? "tip" : ev.kind,
      user: ev.user,
      amount: ev.amount ?? undefined,
      message: ev.message,
      t: Date.now(),
      raw: ev.raw,
    });
  }, !isPreview);
  return (
    <div className="flex yya-widget-root items-end justify-end bg-transparent p-4">
      <ul className="w-80 space-y-1.5 text-sm text-white">
        {rows.length === 0 ? (
          <li className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-[12px] text-white/50">
            Aktivite bekleniyor…
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-1.5 backdrop-blur"
            >
              <span className="uppercase text-[10px] text-[#3ecfcf]">{r.kind}</span>{" "}
              <span className="font-semibold">{r.user}</span>
              {r.amount != null && <span className="text-white/70"> · {r.amount}</span>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function ShoutoutWidget({ config }: Cfg) {
  const [card, setCard] = useState<{ user: string; msg: string } | null>(null);
  const cmd = String(config.command || "!so").toLowerCase();
  const durationMs = Number(config.durationMs) || 8000;
  const { subscribe } = useWidgetSync({ kinds: ["chat"] });
  useEffect(() => {
    return subscribe((ev) => {
      const t = (ev.text || "").trim();
      if (!t.toLowerCase().startsWith(cmd)) return;
      const user = t.slice(cmd.length).trim().replace(/^@/, "") || ev.user || "";
      setCard({ user, msg: String(config.showLastGame ? "Son oyun · bilinmiyor" : "") });
      window.setTimeout(() => setCard(null), durationMs);
    });
  }, [subscribe, cmd, durationMs, config.showLastGame]);
  if (!card) return <div className="yya-widget-root bg-transparent" />;
  return (
    <div className="flex yya-widget-root items-center justify-center bg-transparent">
      <div className="rounded-2xl border border-[#3ecfcf]/40 bg-zinc-950/70 px-8 py-6 text-center text-white shadow-[0_0_40px_rgba(62,207,207,.25)] backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#3ecfcf]">Shoutout</p>
        <p className="mt-1 font-display text-3xl font-bold">@{card.user}</p>
        {card.msg && <p className="mt-2 text-sm text-white/70">{card.msg}</p>}
      </div>
    </div>
  );
}

export function WheelWidget({ config }: Cfg) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const rawSlices = Array.isArray(config.slices)
    ? (config.slices as Array<{ label?: string; color?: string; weight?: number }>)
    : Array.isArray(config.segments)
      ? (config.segments as Array<{ label?: string; color?: string; weight?: number }>)
      : [];
  const segs =
    rawSlices.length > 0
      ? rawSlices
      : [
          { label: "Tekrar", color: "#334155" },
          { label: "100 Puan", color: "#ff8a5b" },
          { label: "SFX", color: "#F59E0B" },
          { label: "Jackpot", color: "#3ecfcf" },
        ];
  const cmd = String(config.command || "!cark").toLowerCase();
  const dur = Number(config.spinDurationMs) || 5500;
  const showResultMs = Number(config.showResultMs) || 4000;
  const opacity = Number(config.opacity ?? 1);
  const { subscribe } = useWidgetSync({ kinds: ["chat"] });

  useEffect(() => {
    return subscribe((ev) => {
      if (!(ev.text || "").toLowerCase().startsWith(cmd) || spinning) return;
      setSpinning(true);
      setResult(null);
      const idx = Math.floor(Math.random() * segs.length);
      const slice = 360 / segs.length;
      const target = 360 * 5 + (360 - idx * slice - slice / 2);
      setRotation((r) => r + target);
      window.setTimeout(() => {
        setResult(segs[idx]?.label || "Ödül");
        setSpinning(false);
        window.setTimeout(() => setResult(null), showResultMs);
      }, dur);
    });
  }, [subscribe, cmd, dur, segs, spinning, showResultMs]);

  const grad = segs
    .map((s, i) => {
      const a0 = (i / segs.length) * 360;
      const a1 = ((i + 1) / segs.length) * 360;
      return `${s.color || "#64748b"} ${a0}deg ${a1}deg`;
    })
    .join(", ");

  return (
    <div className="flex yya-widget-root flex-col items-center justify-center gap-5 bg-transparent" style={{ opacity }}>
      <div className="relative">
        <div
          className="pointer-events-none absolute -inset-6 rounded-full opacity-70 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(62,207,207,.35) 0%, rgba(255,138,91,.12) 45%, transparent 70%)",
          }}
        />
        <div
          className="relative h-64 w-64 rounded-full border-[3px] border-white/25 shadow-[0_0_50px_rgba(62,207,207,.28),inset_0_0_24px_rgba(0,0,0,.35)]"
          style={{
            background: `conic-gradient(${grad})`,
            transform: `rotate(${rotation}deg)`,
            transitionProperty: "transform",
            transitionTimingFunction: spinning
              ? "cubic-bezier(0.12, 0.75, 0.08, 1)"
              : "linear",
            transitionDuration: spinning ? `${dur}ms` : "0ms",
            willChange: "transform",
          }}
        >
          <div className="absolute inset-[28%] rounded-full border border-white/20 bg-[#080b10]/85 shadow-inner backdrop-blur-sm" />
          <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pure-white shadow-[0_0_12px_rgba(62,207,207,.8)]" />
        </div>
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]">
          <div className="border-x-[10px] border-b-[16px] border-x-transparent border-b-[#3ecfcf]" />
        </div>
      </div>
      <p className="font-display text-2xl font-bold tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.55)]">
        {result || (spinning ? "Dönüyor…" : `Komut: ${cmd}`)}
      </p>
    </div>
  );
}

export function PollWidget({ config }: Cfg) {
  const { poll: busPoll, subscribe } = useRuntimeBus();
  const [poll, setPoll] = useState(busPoll);
  const fallbackQ = String(config.question || "Anket");
  const fallbackOpts = Array.isArray(config.options)
    ? (config.options as string[]).filter(Boolean)
    : ["Evet", "Hayır"];
  const showPercent = config.showPercent !== false;
  const opacity = Number(config.opacity ?? 1);
  const barFrom = String(config.colorFrom || "#3ecfcf");
  const barTo = String(config.colorTo || "#ff8a5b");

  useEffect(() => {
    void runtimeApi.getPoll().then(setPoll).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (busPoll) setPoll(busPoll);
  }, [busPoll]);
  useEffect(() => {
    return subscribe((m) => {
      if (m.type === "poll-state" && m.data) setPoll(m.data as typeof poll);
    });
  }, [subscribe]);

  const active = poll?.active;
  const question = active ? poll!.question : fallbackQ;
  const opts = active && poll!.options?.length ? poll!.options : fallbackOpts;
  const votes = poll?.votes || {};
  const total =
    Object.values(votes).reduce((a, b) => a + Number(b), 0) || (active ? 0 : 1);
  const cmd = String(poll?.command || config.command || "!oy");
  const showCmds = config.showVoteCommands !== false;

  useEffect(() => {
    return subscribeWidgetBus((ev) => {
      if (ev.action === "poll.ended") {
        playWidgetSfx(
          resolveSfx(config, "sfxOnEnd", "preset:chime"),
          volFromConfig(config, 0.65)
        );
      }
    });
  }, [config]);

  return (
    <div
      className="flex yya-widget-root items-center justify-center bg-transparent p-6"
      style={{ opacity }}
    >
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-[#3ecfcf]/25 bg-[#080b10]/75 p-5 text-white shadow-[0_0_40px_rgba(62,207,207,.14)] backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#3ecfcf]">
          {active ? "Canlı Anket" : "Anket"}
        </p>
        <h2 className="font-display text-xl font-bold">{question}</h2>
        {showCmds && (
          <div className="flex flex-wrap gap-1.5">
            {opts.map((_, i) => (
              <code
                key={i}
                className="rounded-md border border-panel-accent/25 bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-[#7dd3d3]"
              >
                {cmd} {i + 1}
              </code>
            ))}
          </div>
        )}
        {opts.map((label, i) => {
          const n = Number(votes[String(i + 1)] ?? votes[i + 1] ?? 0);
          const pct = total > 0 ? (n / total) * 100 : 0;
          return (
            <div key={`${label}-${i}`}>
              <div className="mb-1 flex justify-between text-sm">
                <span>
                  <span className="mr-1.5 font-mono text-[11px] text-[#3ecfcf]">
                    {cmd} {i + 1}
                  </span>
                  {label}
                </span>
                <span>
                  {n}
                  {showPercent ? ` · ${Math.round(pct)}%` : ""}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  layout
                  className="h-full rounded-full"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 140, damping: 20, mass: 0.6 }}
                  style={{
                    background: `linear-gradient(90deg, ${barFrom}, ${barTo})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RafflesWidget({ config }: Cfg) {
  const { raffle: busRaffle, lastWinner, subscribe } = useRuntimeBus();
  const [raffle, setRaffle] = useState(busRaffle);
  const [winner, setWinner] = useState<string | null>(null);
  const cmd = String(config.joinCommand || "!katil");

  useEffect(() => {
    void runtimeApi.getRaffle().then(setRaffle).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (busRaffle) setRaffle(busRaffle);
  }, [busRaffle]);
  useEffect(() => {
    if (lastWinner) {
      setWinner(lastWinner);
      void confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#3ecfcf", "#ff8a5b", "#f59e0b", "#ffffff"],
      });
    }
  }, [lastWinner]);
  useEffect(() => {
    return subscribe((m) => {
      if (m.type === "raffle-state" && m.data) setRaffle(m.data as typeof raffle);
      if (m.type === "raffle-winner" && m.winner) {
        setWinner(String(m.winner));
        void confetti({ particleCount: 180, spread: 90, origin: { y: 0.5 } });
      }
    });
  }, [subscribe]);

  const entrants = raffle?.entrants || [];
  const shownWinner = winner || raffle?.winner || null;

  return (
    <div className="flex yya-widget-root items-center justify-center bg-transparent p-6">
      <motion.div
        className="max-w-sm rounded-2xl border border-[#f59e0b]/35 bg-zinc-950/70 p-6 text-center text-white shadow-[0_0_50px_rgba(245,158,11,.2)] backdrop-blur"
        animate={shownWinner ? { scale: [1, 1.06, 1] } : {}}
        transition={{ duration: 0.5 }}
      >
        <p className="text-[11px] uppercase tracking-widest text-[#f59e0b]">Çekiliş</p>
        {shownWinner ? (
          <p className="mt-3 font-display text-3xl font-bold text-[#ff8a5b]">🎉 {shownWinner}</p>
        ) : (
          <p className="mt-2 text-sm text-white/70">{entrants.length} katılımcı</p>
        )}
        <p className="mt-2 text-[11px] text-white/50">Katıl: {raffle?.joinCommand || cmd}</p>
        <p className="mt-3 max-h-40 overflow-hidden text-[11px] text-white/50">
          {entrants.join(" · ") || "Katılımcılar bekleniyor…"}
        </p>
      </motion.div>
    </div>
  );
}

export function HypeTrainWidget({ config }: Cfg) {
  const [points, setPoints] = useState(0);
  const levels = Array.isArray(config.levels)
    ? (config.levels as number[])
    : [50, 120, 250, 500];
  const perSub = Number(config.pointsPerSub) || 10;
  const perTip = Number(config.pointsPerTip) || 5;
  const theme = String(config.theme || "neon").toLowerCase();
  const bgUrl = String(config.custom_bg_url || "");
  const lastLevel = useRef(0);
  const { subscribe } = useWidgetSync({ kinds: ["sub", "tip", "bits", "donation"] });
  useEffect(() => {
    return subscribe((ev) => {
      setPoints((p) => p + (ev.kind === "sub" ? perSub : perTip));
    });
  }, [subscribe, perSub, perTip]);
  const next = levels.find((l) => l > points) || levels[levels.length - 1];
  const prev = [...levels].reverse().find((l) => l <= points) || 0;
  const pct = Math.min(1, (points - prev) / Math.max(1, next - prev));
  const level = levels.filter((l) => points >= l).length;

  useEffect(() => {
    if (level > lastLevel.current) {
      lastLevel.current = level;
      playWidgetSfx(
        resolveSfx(config, "sfxOnLevel", "preset:levelup"),
        volFromConfig(config, 0.65)
      );
      void emitWidgetBus("hypetrain", "hypetrain.level", { level, points });
      if (config.burstEmoteWallOnLevel !== false) {
        void emitWidgetBus("hypetrain", "emotewall.burst", { level });
      }
    }
  }, [level, points, config]);

  const shell =
    theme === "minimal"
      ? "border-white/15 bg-black/40"
      : theme === "cyberpunk"
        ? "border-fuchsia-400/50 bg-[#120818]/80 shadow-[0_0_40px_rgba(232,121,249,.25)]"
        : "border-fuchsia-400/30 bg-zinc-950/55 shadow-[0_0_30px_rgba(232,121,249,.15)]";
  return (
    <div
      className="flex yya-widget-root items-start justify-center bg-transparent p-6"
      style={
        bgUrl
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.55)), url(${bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className={`w-full max-w-md rounded-2xl border p-4 text-white backdrop-blur ${shell}`}>
        <p className="text-[11px] uppercase tracking-widest text-fuchsia-300">
          Hype Train · Lv {level} · {theme}
        </p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-[#ff8a5b]"
            animate={{ width: `${pct * 100}%` }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
        </div>
        <p className="mt-2 text-sm text-white/70">
          {points} / {next} puan
        </p>
      </div>
    </div>
  );
}

export function TtsWidget({ config }: Cfg) {
  const { subscribe } = useWidgetSync({ kinds: ["tip", "sub", "donation", "chat"] });
  useEffect(() => {
    return subscribe((ev) => {
      if (!("speechSynthesis" in window)) return;
      const readTips = config.readTips !== false;
      const readSubs = config.readSubs !== false;
      const readChat = Boolean(config.readChat);
      if (ev.kind === "tip" && !readTips) return;
      if (ev.kind === "sub" && !readSubs) return;
      if (ev.kind === "chat" && !readChat) return;
      if (ev.kind === "chat" && !readChat) return;
      const u = new SpeechSynthesisUtterance(
        `${ev.user || ""} ${ev.message || ev.text || ""}`.trim()
      );
      u.lang = String(config.lang || "tr-TR");
      u.volume = Number(config.volume ?? 0.85);
      window.speechSynthesis.speak(u);
    });
  }, [subscribe, config]);
  return <div className="yya-widget-root bg-transparent" aria-hidden />;
}

export function SongRequestWidget({ config }: Cfg) {
  const { songs: busSongs } = useRuntimeBus();
  const [songs, setSongs] = useState(busSongs);
  const cmd = String(config.requestCommand || config.command || "!sr");
  const showVideo = Boolean(config.show_video);
  const opacity = Number(config.opacity ?? 1);

  useEffect(() => {
    void runtimeApi.getSongs().then(setSongs).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (busSongs) setSongs(busSongs);
  }, [busSongs]);

  const current = songs?.current;
  const queue = songs?.queue || [];
  const vid =
    current?.videoId ||
    (current as { video_id?: string } | null | undefined)?.video_id ||
    undefined;
  const playing = songs?.playing !== false;

  return (
    <div
      className="relative flex yya-widget-root items-end justify-start bg-transparent p-4"
      style={{ opacity }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#3ecfcf]/28 bg-[#080b10]/72 shadow-[0_12px_40px_rgba(0,0,0,.45)] backdrop-blur-md">
        <div className="h-1 w-full bg-gradient-to-r from-[#3ecfcf] via-[#7dd3d3] to-[#ff8a5b]" />
        <div className="px-4 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3ecfcf]">
            Song Request {playing ? "· ▶" : "· ⏸"}
          </p>
          {current ? (
            <>
              <p className="mt-1.5 truncate text-sm font-semibold">{current.title}</p>
              <p className="text-[11px] text-white/50">isteyen · {current.by}</p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-white/55">Sıra boş — {cmd} …</p>
          )}
          {Boolean(config.showQueue) && queue.length > 0 && (
            <ul className="mt-2 max-h-24 space-y-0.5 overflow-hidden text-[11px] text-white/50">
              {queue.slice(0, 5).map((t) => (
                <li key={t.id}>
                  {t.title} · {t.by}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {vid && playing && (
        <iframe
          title="sr-player"
          className={
            showVideo
              ? "absolute bottom-4 right-4 h-40 w-64 rounded-xl border border-white/20 shadow-lg"
              : "pointer-events-none absolute h-px w-px opacity-0"
          }
          src={`https://www.youtube.com/embed/${vid}?autoplay=1&controls=0`}
          allow="autoplay"
        />
      )}
    </div>
  );
}

export function CreditsWidget({ config }: Cfg) {
  const title = String(config.title || "Teşekkürler");
  const closing = String(
    config.footer_message || config.closingMessage || "İzlediğiniz için teşekkürler!"
  );
  const scrollSpeed = Number(config.scroll_speed);
  const speed =
    Number.isFinite(scrollSpeed) && scrollSpeed > 0
      ? Math.max(12, 110 - scrollSpeed * 10)
      : Number(config.speedSec) || 40;
  const opacity = Number(config.opacity ?? 1);
  const custom = Array.isArray(config.custom_entries)
    ? (config.custom_entries as Array<{ role?: string; name?: string }>)
    : [];
  const [names, setNames] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const { subscribe } = useWidgetSync({
    kinds: ["follow", "sub", "tip", "raid", "donation"],
  });
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.user) setNames((n) => [...n, ev.user!].slice(-200));
    });
  }, [subscribe]);
  useEffect(() => {
    return subscribeWidgetBus((ev) => {
      if (ev.action === "credits.play" || ev.action === "goal.complete") {
        if (config.autoPlayOnGoalComplete === false && ev.action === "goal.complete") return;
        setPlaying(true);
        playWidgetSfx(
          resolveSfx(config, "sfxUrl", "preset:success"),
          volFromConfig(config, 0.65)
        );
      }
    });
  }, [config]);
  if (!playing) {
    return <div className="yya-widget-root bg-transparent" />;
  }
  return (
    <div
      className="relative yya-widget-root overflow-hidden bg-transparent text-white"
      style={{ opacity }}
    >
      <style>{`
        @keyframes credits-scroll {
          0% { transform: translateY(100vh); }
          100% { transform: translateY(-100%); }
        }
      `}</style>
      <div
        className="absolute inset-x-0 text-center"
        style={{ animation: `credits-scroll ${speed}s linear infinite` }}
      >
        <h1 className="font-display text-4xl font-bold">{title}</h1>
        {custom.length > 0 && (
          <ul className="mt-8 space-y-3 text-lg">
            {custom
              .filter((e) => e.name)
              .map((e, i) => (
                <li key={`c-${i}`}>
                  <span className="text-white/50">{e.role || "Teşekkür"}</span>
                  <br />
                  <span className="font-semibold">{e.name}</span>
                </li>
              ))}
          </ul>
        )}
        <ul className="mt-8 space-y-2 text-lg">
          {names.length === 0 ? (
            <li className="text-white/50">İsimler olaylardan toplanır…</li>
          ) : (
            names.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)
          )}
        </ul>
        <p className="mt-16 font-display text-2xl text-white/80">{closing}</p>
      </div>
    </div>
  );
}
