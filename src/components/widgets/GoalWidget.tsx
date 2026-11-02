/** Dinamik Hedef Barı — bar / circle / minimal + bağış webhook + tamamlanma zinciri. */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRuntimeBus } from "../../lib/widgets/useRuntimeBus";
import {
  emitWidgetBus,
  playWidgetSfx,
  resolveSfx,
  subscribeWidgetBus,
  volFromConfig,
} from "../../lib/widgets/widgetBus";
import AnimatedCounter from "./AnimatedCounter";

type Props = { config: Record<string, unknown> };

const GOAL_TYPE_LABELS: Record<string, string> = {
  followers: "Takipçi Hedefi",
  subs: "Abonelik Hedefi",
  tips: "Bağış Hedefi",
  kick: "KICK Hedefi",
  donation: "Bağış Hedefi",
  custom: "Hedef",
};

const MONEY_METRICS = new Set(["tips", "donation", "tip", "donate"]);

/** Çubuk görünüşü. Boş tema, hedefin türüne göre seçilir. */
const GOAL_THEMES = ["renk", "duz", "ince", "dilim", "gece", "kick"] as const;
type GoalTheme = (typeof GOAL_THEMES)[number];

function goalTheme(config: Record<string, unknown>, metric: string): GoalTheme {
  const raw = String(config.theme || "").toLowerCase();
  if ((GOAL_THEMES as readonly string[]).includes(raw)) return raw as GoalTheme;
  const m = metric.toLowerCase();
  if (["subs", "sub", "abonelik"].includes(m)) return "gece";
  if (["tips", "tip", "donation", "donate"].includes(m)) return "dilim";
  if (["kicks", "kick"].includes(m)) return "ince";
  if (["followers", "follower", "follow", "takip"].includes(m)) return "kick";
  return "renk";
}

function GoalGlyph({ metric }: { metric: string }) {
  const m = metric.toLowerCase();
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (["subs", "sub"].includes(m)) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path {...common} d="M7 1.6 8.5 5l3.6.3-2.8 2.3.9 3.5L7 9.3 3.8 11.1l.9-3.5L1.9 5.3 5.5 5z" />
      </svg>
    );
  }
  if (isMoneyMetric(m)) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle {...common} cx="7" cy="7" r="5" />
        <path {...common} d="M7 3.6v6.8M5.2 5.2h2.6a1.3 1.3 0 0 1 0 2.6H5.6" />
      </svg>
    );
  }
  if (["kicks", "kick"].includes(m)) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path {...common} d="M8.2 1.4 3.2 7.6h3.2L5.4 12.6 11 5.8H7.6z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <circle {...common} cx="7" cy="4.2" r="2" />
      <path {...common} d="M3.2 12.2c.4-2.4 1.8-3.6 3.8-3.6s3.4 1.2 3.8 3.6" />
    </svg>
  );
}

function isMoneyMetric(metric: string): boolean {
  return MONEY_METRICS.has(metric.toLowerCase());
}

function formatGoalNumber(
  n: number,
  metric: string,
  opts: { prefix?: string; suffix?: string; decimals?: number }
): string {
  const decimals =
    opts.decimals != null
      ? opts.decimals
      : isMoneyMetric(metric)
        ? 0
        : Number.isInteger(n)
          ? 0
          : 1;
  const formatted = new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(n);
  const prefix =
    opts.prefix ??
    (isMoneyMetric(metric) ? "₺" : "");
  const suffix = opts.suffix ?? "";
  return `${prefix}${formatted}${suffix}`;
}

function previewCurrent(config: Record<string, unknown>): number {
  const cur = Number(config.current);
  const target = Math.max(1, Number(config.target) || 100);
  const start = Math.max(0, Number(config.startValue ?? config.start ?? 0));
  if (Number.isFinite(cur) && cur > start) return cur;
  return start + Math.max(1, Math.round((target - start) * 0.55));
}

function GoalTrack({
  theme,
  pct,
  barH,
  from,
  to,
  gradient,
  glow,
  milestones,
  bumpFlash,
  metric,
}: {
  theme: GoalTheme;
  pct: number;
  barH: number;
  from: string;
  to: string;
  gradient: string;
  glow: string;
  milestones: number[];
  bumpFlash: number;
  metric: string;
}) {
  const tip = Math.max(pct * 100, pct > 0 ? 4 : 0);
  const width = `${tip}%`;
  const fill =
    theme === "kick"
      ? "#53fc18"
      : theme === "duz" || theme === "ince"
        ? from
        : theme === "gece"
          ? "#e7e5e4"
          : gradient;
  const track =
    theme === "gece" ? "#292524" : theme === "kick" ? "#142016" : "rgba(255,255,255,0.12)";
  const radius = theme === "ince" || theme === "dilim" ? 2 : 999;
  const segments = 24;
  const filled = Math.round(pct * segments);
  const yay = { type: "spring" as const, stiffness: 95, damping: 20 };

  return (
    <div className="relative" style={{ height: Math.max(barH, 22) }}>
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden"
        style={{
          height: barH,
          borderRadius: radius,
          background: track,
          boxShadow: theme === "renk" ? "inset 0 0 0 1px rgba(255,255,255,0.15)" : undefined,
        }}
      >
        {theme === "dilim" ? (
          <div className="flex h-full gap-0.5">
            {Array.from({ length: segments }, (_, i) => (
              <span
                key={i}
                className="h-full flex-1"
                style={{ background: i < filled ? from : "transparent" }}
              />
            ))}
          </div>
        ) : (
          <>
            {milestones.map((m) => (
              <span
                key={m}
                className="pointer-events-none absolute top-0 z-[1] h-full w-px bg-white/25"
                style={{ left: `${m * 100}%` }}
              />
            ))}
            <motion.div
              className="h-full"
              animate={{ width }}
              transition={yay}
              style={{ background: fill, boxShadow: glow, borderRadius: radius }}
            />
          </>
        )}
        <AnimatePresence>
          {theme === "renk" && bumpFlash > 0 ? (
            <motion.span
              key={bumpFlash}
              className="pointer-events-none absolute inset-0"
              style={{ background: `linear-gradient(90deg, transparent, ${from}55, transparent)` }}
              initial={{ opacity: 0, x: "-30%" }}
              animate={{ opacity: [0, 0.85, 0], x: "60%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55 }}
            />
          ) : null}
        </AnimatePresence>
      </div>
      <motion.span
        className="absolute top-1/2 z-10 grid h-5 w-5 place-items-center"
        animate={{ left: `${tip}%` }}
        transition={yay}
        style={{
          x: "-50%",
          y: "-50%",
          color: theme === "gece" ? "#e7e5e4" : theme === "kick" ? "#53fc18" : from,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,.85))",
        }}
      >
        <GoalGlyph metric={metric} />
      </motion.span>
    </div>
  );
}

export default function GoalWidget({ config }: Props) {
  const isPreview = Boolean(config._previewMode);
  const gradId = useId().replace(/:/g, "");
  const { subscribe } = useRuntimeBus();
  const startValue = Math.max(0, Number(config.startValue ?? config.start ?? 0));
  const target = Math.max(1, Number(config.target) || 100);

  const [current, setCurrent] = useState(() => {
    if (isPreview) return previewCurrent(config);
    const c = Number(config.current);
    return Number.isFinite(c) ? c : startValue;
  });
  const [bumpFlash, setBumpFlash] = useState(0);
  const firedComplete = useRef(false);
  const lastSeenConfig = useRef<number | null>(null);

  useEffect(() => {
    if (isPreview) {
      setCurrent(previewCurrent(config));
      return;
    }
    const c = Number(config.current);
    if (!Number.isFinite(c)) return;
    // Config sync = kaynak doğruluk; optimistic bump üzerine yaz
    if (lastSeenConfig.current !== c) {
      lastSeenConfig.current = c;
      setCurrent(c);
    }
  }, [config.current, isPreview]);

  useEffect(() => {
    return subscribe((m) => {
      if (m.type !== "goal-update") return;
      // Mutlak current (sunucu bump sonrası) — çift sayımı önler
      if ((m as { current?: unknown }).current != null) {
        const abs = Number((m as { current?: unknown }).current);
        if (Number.isFinite(abs)) {
          const metricNow = String(config.metric || config.goalType || "followers").toLowerCase();
          const msgMetric = String((m as { metric?: unknown }).metric || "").toLowerCase();
          const tipLike = ["tips", "tip", "donation", "donate", "bağış", "bagis"].includes(
            metricNow
          );
          const same =
            msgMetric !== "" &&
            (msgMetric === metricNow ||
              (msgMetric === "followers" &&
                ["followers", "follower", "follow", "takip", "takipci", "takipçi"].includes(metricNow)));
          // Donasyon webhook absolute current yalnızca bağış hedeflerine.
          // Takip olayı metric: followers ile gelir; yalnız takipçi barına yazılır.
          const hasTarget = (m as { target?: unknown }).target != null;
          if (same || (!msgMetric && (tipLike || hasTarget))) {
            lastSeenConfig.current = abs;
            setCurrent(abs);
            setBumpFlash((n) => n + 1);
          }
          return;
        }
      }
      // amount-only: yalnızca bağış metrikli bar (webhook)
      if (typeof m.amount === "number" && Number.isFinite(m.amount) && m.amount !== 0) {
        const metricNow = String(config.metric || config.goalType || "followers").toLowerCase();
        if (!["tips", "tip", "donation", "donate", "bağış", "bagis"].includes(metricNow)) {
          return;
        }
        setCurrent((c) => {
          const next = c + Number(m.amount);
          lastSeenConfig.current = next;
          return next;
        });
        setBumpFlash((n) => n + 1);
      }
    });
  }, [subscribe, config.metric, config.goalType]);

  useEffect(() => {
    return subscribeWidgetBus((ev) => {
      if (ev.action === "goal.complete") {
        firedComplete.current = true;
      }
    });
  }, []);

  const layout = String(config.layout || "bar").toLowerCase();
  const range = Math.max(1, target - startValue);
  const pct = Math.min(1, Math.max(0, (current - startValue) / range));
  const isComplete = pct >= 1;
  const from = String(config.colorFrom || config.color || "#3ECFCF");
  const to = String(config.colorTo || "#FF8A5B");
  const metric = String(config.metric || config.goalType || "followers");
  const theme = goalTheme(config, metric);
  const title =
    String(config.title || "").trim() ||
    GOAL_TYPE_LABELS[metric] ||
    GOAL_TYPE_LABELS.custom;
  const thickness = Number(config.thickness) || 16;
  const showPercent = config.showPercent !== false;
  const showValue = config.showValue !== false;
  const showMilestones = Boolean(config.showMilestones ?? layout === "bar");
  const showBackground = config.showBackground !== false;
  const fontSize = Number(config.fontSize) || 22;
  const fontFamily = String(config.fontFamily || "Outfit, sans-serif");
  const opacity = Number(config.opacity ?? 1);
  const glow = Math.max(0, Number(config.glowIntensity ?? 1));
  const prefix = String(config.valuePrefix ?? config.currencyPrefix ?? "");
  const suffix = String(config.valueSuffix ?? "");
  const decimals =
    config.decimals != null && Number.isFinite(Number(config.decimals))
      ? Number(config.decimals)
      : undefined;
  const gradient = `linear-gradient(90deg, ${from}, ${to})`;
  const vol = volFromConfig(config, 0.72);
  const slotH = Number(config.height) || 0;
  const compact = isPreview || (slotH > 0 && slotH < 140) || thickness <= 12;

  const fmt = (n: number) =>
    formatGoalNumber(n, metric, { prefix: prefix || undefined, suffix, decimals });

  useEffect(() => {
    if (pct < 1) {
      firedComplete.current = false;
      return;
    }
    if (firedComplete.current) return;
    firedComplete.current = true;
    if (isPreview) return;
    playWidgetSfx(resolveSfx(config, "sfxOnComplete", "preset:success"), vol);
    void emitWidgetBus("goal", "goal.complete", { current, target, metric });
    if (config.triggerEmoteBurstOnComplete !== false) {
      void emitWidgetBus("goal", "emotewall.burst", { reason: "goal.complete" });
    }
    if (config.triggerCreditsOnComplete !== false) {
      void emitWidgetBus("goal", "credits.play", { reason: "goal.complete" });
    }
  }, [pct, current, target, config, vol, isPreview, metric]);

  const circle = useMemo(() => {
    const r = 54;
    const c = 2 * Math.PI * r;
    return { r, c, dash: c * pct };
  }, [pct]);

  const barGlow = isComplete
    ? `0 0 ${16 * glow}px ${to}aa, 0 0 ${28 * glow}px ${from}66`
    : glow > 0
      ? `0 0 ${8 * glow}px ${from}55`
      : "none";

  const barH = Math.max(8, Math.min(thickness, compact ? 14 : thickness));
  const titleSize = Math.min(fontSize, compact ? 16 : fontSize);
  const metaSize = Math.max(11, Math.round(titleSize * 0.62));

  const milestones = showMilestones
    ? [0.25, 0.5, 0.75].filter((m) => m < 1)
    : [];

  return (
    <motion.div
      className="flex yya-widget-root h-full min-h-[64px] w-full items-center justify-center bg-transparent px-2 py-1.5"
      style={{ opacity, fontFamily }}
      animate={
        isComplete
          ? { filter: ["brightness(1)", "brightness(1.12)", "brightness(1)"] }
          : { filter: "brightness(1)" }
      }
      transition={
        isComplete
          ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
          : { duration: 0.25 }
      }
    >
      {layout === "circle" ? (
        <div className="relative flex flex-col items-center gap-1">
          <div className="relative" style={{ width: 140, height: 140 }}>
            <svg width="140" height="140" className="-rotate-90" aria-hidden>
              <defs>
                <linearGradient id={`goalGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={from} />
                  <stop offset="100%" stopColor={to} />
                </linearGradient>
              </defs>
              <circle
                cx="70"
                cy="70"
                r={circle.r}
                fill="none"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={thickness}
              />
              <motion.circle
                cx="70"
                cy="70"
                r={circle.r}
                fill="none"
                stroke={`url(#goalGrad-${gradId})`}
                strokeWidth={thickness}
                strokeLinecap="round"
                animate={{ strokeDasharray: `${circle.dash} ${circle.c}` }}
                transition={{ type: "spring", stiffness: 90, damping: 20 }}
                style={{ filter: glow > 0 ? `drop-shadow(0 0 ${6 * glow}px ${from})` : undefined }}
              />
            </svg>
            <div
              className="absolute inset-0 flex flex-col items-center justify-center text-white"
              style={{ fontSize: titleSize * 0.9 }}
            >
              {showPercent && (
                <span className="font-bold tabular-nums drop-shadow">
                  <AnimatedCounter value={Math.round(pct * 100)} />%
                </span>
              )}
              {showValue && (
                <span className="mt-0.5 text-[11px] tabular-nums text-white/75">
                  {fmt(Math.round(current * 10) / 10)}
                  <span className="text-white/50"> / </span>
                  {fmt(Math.round(target))}
                </span>
              )}
            </div>
          </div>
          <p
            className="max-w-[200px] truncate text-center font-semibold text-white/95 drop-shadow"
            style={{ fontSize: metaSize + 2 }}
          >
            {title}
          </p>
        </div>
      ) : layout === "minimal" ? (
        <div className="w-full text-white" style={{ fontSize: titleSize }}>
          <div
            className="mb-1 flex items-baseline justify-between gap-2"
            style={{ fontSize: metaSize }}
          >
            <span className="truncate font-medium text-white/80">{title}</span>
            <span className="shrink-0 tabular-nums text-white/90">
              {showValue && (
                <>
                  {fmt(Math.round(current * 10) / 10)}
                  <span className="text-white/50">/</span>
                  {fmt(Math.round(target))}
                </>
              )}
              {showPercent && showValue && <span className="mx-1 text-white/50">·</span>}
              {showPercent && (
                <span className="font-semibold" style={{ color: from }}>
                  {Math.round(pct * 100)}%
                </span>
              )}
            </span>
          </div>
          <div
            className="relative overflow-hidden rounded-full bg-white/10"
            style={{ height: Math.max(6, barH * 0.55) }}
          >
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${Math.max(pct * 100, pct > 0 ? 3 : 0)}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 22 }}
              style={{ background: gradient, boxShadow: barGlow }}
            />
          </div>
        </div>
      ) : (
        <div
          className={`w-full text-white ${
            showBackground
              ? "rounded-2xl border border-white/12 bg-black/50 px-3.5 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-[6px]"
              : "px-1 py-1"
          }`}
          style={{ fontSize: titleSize }}
        >
          <div className="mb-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-wide drop-shadow-sm">{title}</p>
              {isComplete ? (
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/90">
                  Hedef tamamlandı
                </p>
              ) : null}
            </div>
            <div
              className="shrink-0 text-right tabular-nums leading-tight"
              style={{ fontSize: metaSize }}
            >
              {showValue && (
                <p className="text-white/95">
                  <span className="font-semibold">{fmt(Math.round(current * 10) / 10)}</span>
                  <span className="text-white/50"> / </span>
                  <span className="text-white/75">{fmt(Math.round(target))}</span>
                </p>
              )}
              {showPercent && (
                <p className="font-bold" style={{ color: from }}>
                  <AnimatedCounter value={Math.round(pct * 100)} />%
                </p>
              )}
            </div>
          </div>

          <GoalTrack
            theme={theme}
            pct={pct}
            barH={theme === "ince" ? Math.min(barH, 8) : barH}
            from={from}
            to={to}
            gradient={gradient}
            glow={theme === "renk" ? barGlow : "none"}
            milestones={theme === "renk" || theme === "duz" ? milestones : []}
            bumpFlash={bumpFlash}
            metric={metric}
          />

          {isPreview ? (
            <p className="mt-1.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-300/75">
              Önizleme · {Math.round(pct * 100)}%
            </p>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
