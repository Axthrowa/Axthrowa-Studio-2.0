/**
 * Kick Aboneler — kompakt Botrix tarzı liste + hedef + kısa alert.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useSubathonEvents } from "../../lib/widgets/useSubathonEvents";
import { useWidgetSync } from "../../lib/widgets/useWidgetSync";
import {
  playWidgetSfx,
  resolveSfx,
  volFromConfig,
} from "../../lib/widgets/widgetBus";

type Props = { config: Record<string, unknown> };

type KickSubEntry = {
  id: string;
  user: string;
  months: number;
  gifted: boolean;
  gifter?: string;
  ts: number;
};

type ThemeId = "kick" | "neon" | "glass" | "minimal" | "cyber";

const THEMES: Record<
  ThemeId,
  { accent: string; text: string; muted: string; card: string; border: string; gift: string; track: string }
> = {
  kick: {
    accent: "#3EEDFE",
    text: "#f4f4f5",
    muted: "#a1a1aa",
    card: "rgba(10,14,12,0.82)",
    border: "rgba(83,252,24,0.28)",
    gift: "#fbbf24",
    track: "rgba(255,255,255,0.12)",
  },
  neon: {
    accent: "#22d3ee",
    text: "#ecfeff",
    muted: "#67e8f9",
    card: "rgba(6,14,22,0.88)",
    border: "rgba(34,211,238,0.32)",
    gift: "#f472b6",
    track: "rgba(34,211,238,0.15)",
  },
  glass: {
    accent: "#e2e8f0",
    text: "#f8fafc",
    muted: "#94a3b8",
    card: "rgba(15,23,42,0.65)",
    border: "rgba(255,255,255,0.14)",
    gift: "#fde68a",
    track: "rgba(255,255,255,0.1)",
  },
  minimal: {
    accent: "#ffffff",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.55)",
    card: "transparent",
    border: "rgba(255,255,255,0.12)",
    gift: "#fbbf24",
    track: "rgba(255,255,255,0.18)",
  },
  cyber: {
    accent: "#ff2bd6",
    text: "#f5f3ff",
    muted: "#c4b5fd",
    card: "rgba(12,8,28,0.88)",
    border: "rgba(255,43,214,0.32)",
    gift: "#00e5ff",
    track: "rgba(255,43,214,0.16)",
  },
};

const DEMO: KickSubEntry[] = [
  { id: "d1", user: "AxthrowA", months: 12, gifted: false, ts: Date.now() - 5_000 },
  { id: "d2", user: "NeonFox", months: 3, gifted: true, gifter: "KickKing", ts: Date.now() - 15_000 },
  { id: "d3", user: "StreamBuddy", months: 1, gifted: false, ts: Date.now() - 30_000 },
];

function tpl(template: string, e: KickSubEntry): string {
  return template
    .split("{user}")
    .join(e.user)
    .split("{months}")
    .join(String(e.months))
    .split("{gift}")
    .join(e.gifted ? (e.gifter ? ` · hediye (${e.gifter})` : " · hediye") : "");
}

function monthsOf(raw: unknown, message?: string): number {
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  const m = String(message || "").match(/(\d+)\s*ay/i);
  return m ? Number(m[1]) || 1 : 1;
}

function giftedOf(message?: string, raw?: Record<string, unknown>): boolean {
  if (raw?.gifted === true || raw?.is_gift === true) return true;
  const t = String(message || "").toLowerCase();
  return t.includes("hediye") || t.includes("gift");
}

export default function KickSubsWidget({ config }: Props) {
  const isPreview = Boolean(config._previewMode);
  const maxItems = Math.max(1, Math.min(20, Number(config.maxItems) || 6));
  const themeKey = String(config.theme || "kick") as ThemeId;
  const theme = THEMES[themeKey] || THEMES.kick;
  const layout = String(config.layout || "list"); // list | alert | combined
  const showTitle = config.showTitle !== false;
  const showMonths = config.showMonths !== false;
  const showGifted = config.showGifted !== false;
  const showSessionCount = config.showSessionCount !== false;
  const showGoal = config.showGoal === true;
  const showAlert = layout === "alert" || layout === "combined";
  const showList = layout !== "alert";
  const title = String(config.custom_title || config.title || "Kick Aboneler").trim();
  const listTemplate = String(
    config.listTemplate || `{user}${showMonths ? " · {months} ay" : ""}{gift}`
  );
  const alertTemplate = String(config.alertTemplate || "{user} abone oldu{gift}");
  const fontFamily = String(config.fontFamily || "Outfit, system-ui, sans-serif");
  const fontSize = Math.max(12, Math.min(36, Number(config.fontSize) || 16));
  const accent = String(config.accent || theme.accent);
  const textColor = String(config.color || theme.text);
  const alertMs = Math.max(2000, Math.min(12000, Number(config.alertDurationMs) || 4500));
  const goalTarget = Math.max(1, Number(config.goalTarget) || 50);
  const goalStart = Math.max(0, Number(config.goalStart) || 0);
  const opacity = Number(config.opacity ?? 1);
  const vol = volFromConfig(config, 0.65);
  const sfxOn = config.sfxEnabled !== false;

  const [subs, setSubs] = useState<KickSubEntry[]>(() =>
    isPreview ? DEMO.slice(0, maxItems) : []
  );
  const [sessionCount, setSessionCount] = useState(() =>
    isPreview ? DEMO.length : Math.max(0, Number(config.sessionCount) || 0)
  );
  const [goalCurrent, setGoalCurrent] = useState(() => {
    if (isPreview) return Math.min(goalTarget, goalStart + 18);
    return Math.max(goalStart, Number(config.goalCurrent) || goalStart);
  });
  const [toast, setToast] = useState<KickSubEntry | null>(null);

  const pushSub = useCallback(
    (entry: KickSubEntry) => {
      setSubs((prev) => {
        if (prev.some((x) => x.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, maxItems);
      });
      setSessionCount((n) => n + 1);
      setGoalCurrent((c) => c + 1);
      if (showAlert) {
        setToast(entry);
        window.setTimeout(() => {
          setToast((t) => (t?.id === entry.id ? null : t));
        }, alertMs);
      }
      if (sfxOn && !isPreview) {
        void playWidgetSfx(resolveSfx(config, "sfxOnSub", "preset:chime"), vol);
      }
    },
    [alertMs, config, isPreview, maxItems, sfxOn, showAlert, vol]
  );

  useSubathonEvents((ev) => {
    if (isPreview || (ev.kind !== "sub" && ev.kind !== "host")) return;
    if (ev.kind !== "sub") return;
    const user = String(ev.user || "Abone").trim() || "Abone";
    const gifted = giftedOf(ev.message, ev.raw);
    pushSub({
      id: `sub-${String(ev.raw?.t || Date.now())}-${user}`,
      user,
      months: monthsOf(ev.amount ?? ev.raw?.months, ev.message),
      gifted,
      gifter: gifted
        ? String(ev.raw?.gifter || ev.raw?.gifter_username || "").trim() || undefined
        : undefined,
      ts: Date.now(),
    });
  }, !isPreview);

  const { subscribe } = useWidgetSync({ kinds: ["sub", "subscription", "alert"] });
  useEffect(() => {
    if (isPreview) return;
    return subscribe((ev) => {
      const k = String(ev.kind || "").toLowerCase();
      if (k !== "sub" && k !== "subscription" && !(k === "alert" && String(ev.message || "").toLowerCase().includes("abone"))) {
        return;
      }
      const user = String(ev.user || ev.message || "Abone").trim() || "Abone";
      const raw = (ev.raw || {}) as Record<string, unknown>;
      const gifted = giftedOf(ev.message || ev.text, raw);
      pushSub({
        id: String(ev.id || `ws-${Date.now()}-${user}`),
        user,
        months: monthsOf(ev.amount ?? raw.months, ev.message || ev.text),
        gifted,
        gifter: gifted
          ? String(raw.gifter || raw.gifter_username || "").trim() || undefined
          : undefined,
        ts: Number(ev.t) || Date.now(),
      });
    });
  }, [isPreview, pushSub, subscribe]);

  useEffect(() => {
    if (!isPreview) return;
    setSubs(DEMO.slice(0, maxItems));
    setToast(null);
  }, [isPreview, maxItems]);

  const pct = Math.min(
    1,
    Math.max(0, (goalCurrent - goalStart) / Math.max(1, goalTarget - goalStart))
  );

  // Alert-only layout: tek kart
  if (layout === "alert") {
    const sample = toast || (isPreview ? DEMO[0] : null);
    return (
      <div
        className="yya-widget-root flex h-full w-full items-center justify-center p-3"
        style={{ fontFamily, opacity }}
      >
        <AnimatePresence mode="wait">
          {sample ? (
            <motion.div
              key={sample.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full max-w-sm rounded-2xl border px-4 py-3 text-center"
              style={{
                background: theme.card,
                borderColor: sample.gifted ? theme.gift : theme.border,
                color: textColor,
                boxShadow: `0 12px 36px rgba(0,0,0,.4), 0 0 24px ${accent}22`,
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: accent }}
              >
                {sample.gifted && showGifted ? "Hediye Abone" : "Yeni Abone"}
              </p>
              <p className="mt-1 font-semibold" style={{ fontSize: fontSize * 1.1 }}>
                {tpl(alertTemplate, sample)}
              </p>
            </motion.div>
          ) : (
            <p className="text-sm" style={{ color: theme.muted }}>
              Abone alert bekleniyor…
            </p>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      className="yya-widget-root flex h-full w-full flex-col justify-end p-2"
      style={{ fontFamily, opacity, color: textColor }}
    >
      <div
        className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border"
        style={{
          background: theme.card,
          borderColor: theme.border,
          boxShadow: theme.card === "transparent" ? "none" : "0 10px 32px rgba(0,0,0,.35)",
        }}
      >
        {/* Header */}
        {(showTitle || showSessionCount || showGoal) && (
          <div className="shrink-0 space-y-1.5 border-b px-3 py-2" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between gap-2">
              {showTitle ? (
                <h3 className="truncate font-bold" style={{ fontSize, color: accent }}>
                  {title}
                </h3>
              ) : (
                <span />
              )}
              {showSessionCount ? (
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[12px] font-bold tabular-nums"
                  style={{ background: `${accent}22`, color: accent }}
                >
                  {sessionCount}
                </span>
              ) : null}
            </div>
            {showGoal ? (
              <div>
                <div
                  className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wide"
                  style={{ color: theme.muted }}
                >
                  <span>Hedef</span>
                  <span className="font-mono normal-case tabular-nums">
                    {goalCurrent}/{goalTarget}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: theme.track }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${pct * 100}%`,
                      background: `linear-gradient(90deg, ${accent}, ${theme.gift})`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Brief toast inside card */}
        <AnimatePresence>
          {showAlert && toast ? (
            <motion.div
              key={toast.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b"
              style={{ borderColor: theme.border, background: `${accent}14` }}
            >
              <p className="px-3 py-1.5 text-center text-[12px] font-semibold" style={{ color: accent }}>
                {tpl(alertTemplate, toast)}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* List */}
        {showList ? (
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {subs.length === 0 ? (
              <li className="px-1 py-3 text-center text-[12px]" style={{ color: theme.muted }}>
                Abone bekleniyor…
              </li>
            ) : (
              subs.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  style={{
                    background: e.gifted && showGifted ? `${theme.gift}14` : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black"
                    style={{
                      background: e.gifted && showGifted ? theme.gift : accent,
                      color: "#0a0c12",
                    }}
                  >
                    {e.gifted && showGifted ? "G" : "K"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize }}>
                    {tpl(listTemplate, e)}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
