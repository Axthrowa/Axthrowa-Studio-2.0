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
          const tipLike = ["tips", "tip", "donation", "donate", "bağış", "bagis"].includes(
            metricNow
          );
          // Donasyon webhook absolute current yalnızca bağış hedeflerine
          // Test bump da current gönderir — metric fark etmeksizin uygula eğer target da varsa
          const hasTarget = (m as { target?: unknown }).target != null;
          if (tipLike || hasTarget) {
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

          <div
            className="relative overflow-hidden rounded-full bg-white/[0.12] ring-1 ring-inset ring-white/15"
            style={{ height: barH }}
          >
            {milestones.map((m) => (
              <span
                key={m}
                className="pointer-events-none absolute top-0 z-[1] h-full w-px bg-white/25"
                style={{ left: `${m * 100}%` }}
              />
            ))}
            <motion.div
              className="relative h-full rounded-full"
              animate={{ width: `${Math.max(pct * 100, pct > 0 ? 4 : 0)}%` }}
              transition={{ type: "spring", stiffness: 95, damping: 20 }}
              style={{ background: gradient, boxShadow: barGlow }}
            >
              {pct > 0.03 ? (
                <span
                  className="absolute right-0 top-1/2 h-[140%] w-3 -translate-y-1/2 rounded-full opacity-80"
                  style={{
                    background: `radial-gradient(circle, ${to}ee 0%, transparent 70%)`,
                    filter: "blur(1px)",
                  }}
                />
              ) : null}
              {pct > 0.02 ? (
                <motion.span
                  className="absolute inset-y-0 right-0 w-10 opacity-50"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${to}99)`,
                  }}
                  animate={{ opacity: [0.25, 0.7, 0.25] }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                />
              ) : null}
            </motion.div>

            <AnimatePresence>
              {bumpFlash > 0 ? (
                <motion.span
                  key={bumpFlash}
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${from}55, transparent)`,
                  }}
                  initial={{ opacity: 0, x: "-30%" }}
                  animate={{ opacity: [0, 0.85, 0], x: "60%" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55 }}
                />
              ) : null}
            </AnimatePresence>
          </div>

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
