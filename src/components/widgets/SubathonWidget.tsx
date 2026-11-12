/** Subathon — gerçek zamanlı WS motoru, özel başlık, dinamik ölçek. */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useSubathonEvents,
  type SubathonEventPayload,
} from "../../lib/widgets/useSubathonEvents";

type Props = {
  config: Record<string, unknown>;
  onConfigPatch?: (p: Record<string, unknown>) => void;
};

function fmt(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function readEndsAtMs(config: Record<string, unknown>): number | null {
  const raw = config.endsAt;
  if (raw == null || String(raw).trim() === "") return null;
  const ms = new Date(String(raw)).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function remainingFromConfig(config: Record<string, unknown>, bonusSec = 0): number {
  const endMs = readEndsAtMs(config);
  if (endMs != null) {
    return Math.max(0, Math.floor((endMs - Date.now()) / 1000) + bonusSec);
  }
  return Math.max(0, Math.floor(Number(config.secondsRemaining) || 3600) + bonusSec);
}

function cfgNum(config: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = Number(config[k]);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return 0;
}

function displayTitle(config: Record<string, unknown>): string {
  const custom = String(config.custom_title ?? "").trim();
  if (custom && custom.toLowerCase() !== "tema ismi") return custom;
  return "Subathon";
}

export default function SubathonWidget({ config }: Props) {
  const [remaining, setRemaining] = useState(() => remainingFromConfig(config));
  const [bonusSec, setBonusSec] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [lastBoost, setLastBoost] = useState(0);
  const endsAtMsRef = useRef<number | null>(readEndsAtMs(config));

  const title = displayTitle(config);
  const scale = Math.min(3, Math.max(0.5, Number(config.scale) || 1));
  const perFollow = cfgNum(config, "time_per_follow", "secondsPerFollow");
  const perSub = cfgNum(config, "time_per_sub", "secondsPerSub") || 180;
  const perDonation = cfgNum(
    config,
    "time_per_donation",
    "secondsPerTip",
    "secondsPerDonation"
  ) || 60;
  const perKick = cfgNum(config, "time_per_kick", "secondsPerKick", "secondsPerRaid") || 120;
  const tipUnit = Number(config.tipUnit) || 1;
  const freeze = Boolean(config.autoFreezeWhenZero ?? true);
  const color = String(config.primary_color || config.color || "#FFFFFF");
  const accent = String(config.accent || config.primary_color || "#22d3ee");
  const fontSize = Number(config.fontSize) || 48;
  const fontFamily = String(
    config.font_family || config.fontFamily || "JetBrains Mono, monospace"
  );
  const bgOp =
    config.background_opacity != null
      ? Math.min(1, Math.max(0, Number(config.background_opacity) / 100))
      : 0;
  const opacity = Number(config.opacity ?? 1);
  const theme = String(config.theme || "neon").toLowerCase();
  const bgUrl = String(config.custom_bg_url || "");
  const showEndsAt = Boolean(config.showEndsAt);
  const usesEndsAt = readEndsAtMs(config) != null;

  useEffect(() => {
    endsAtMsRef.current = readEndsAtMs(config);
    setBonusSec(0);
    setRemaining(remainingFromConfig(config));
  }, [config.secondsRemaining, config.endsAt]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (usesEndsAt) {
        setRemaining(remainingFromConfig(config, bonusSec));
        return;
      }
      setRemaining((r) => {
        if (freeze && r <= 0) return 0;
        return Math.max(0, r - 1);
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [freeze, usesEndsAt, config, bonusSec]);

  const addSeconds = useCallback(
    (sec: number) => {
      if (sec <= 0) return;
      setPulse((p) => p + 1);
      setLastBoost(sec);
      if (usesEndsAt && endsAtMsRef.current != null) {
        endsAtMsRef.current = Math.max(Date.now(), endsAtMsRef.current) + sec * 1000;
        setBonusSec((b) => b + sec);
        setRemaining(Math.max(0, Math.floor((endsAtMsRef.current - Date.now()) / 1000)));
        return;
      }
      setRemaining((r) => r + sec);
    },
    [usesEndsAt]
  );

  const handleEvent = useCallback(
    (ev: SubathonEventPayload) => {
      const k = ev.kind;
      if (k === "follow") {
        addSeconds(perFollow);
        return;
      }
      if (k === "sub") {
        addSeconds(perSub);
        return;
      }
      if (k === "kick" || k === "raid" || k === "host") {
        addSeconds(perKick);
        return;
      }
      if (k === "tip" || k === "donation" || k === "bits") {
        const amt =
          typeof ev.amount === "number"
            ? ev.amount
            : Number(String(ev.amount || "").replace(",", ".")) || tipUnit;
        const units = Math.max(1, Math.floor(amt / tipUnit));
        addSeconds(units * perDonation);
      }
    },
    [addSeconds, perFollow, perSub, perKick, perDonation, tipUnit]
  );

  useSubathonEvents(handleEvent, true);

  const urgent = remaining < 60;
  const displayColor = urgent ? "#ef4444" : color;
  const boosted = pulse > 0;

  const shell =
    theme === "minimal"
      ? { boxShadow: "none" as const, background: `rgba(8,12,20,${bgOp > 0 ? bgOp : 0.2})` }
      : theme === "cyberpunk"
        ? {
            boxShadow: `0 0 48px ${accent}88, inset 0 0 0 1px #e879f966`,
            background: `rgba(18,8,24,${bgOp > 0 ? bgOp : 0.55})`,
          }
        : {
            boxShadow: boosted
              ? `0 0 48px rgba(74,222,128,0.75), 0 0 24px ${accent}88, inset 0 0 0 1px ${accent}66`
              : `0 0 40px ${accent}55, inset 0 0 0 1px ${accent}66`,
            background: `rgba(8,12,20,${bgOp > 0 ? bgOp : 0.35})`,
          };

  const endsAtLabel =
    usesEndsAt && config.endsAt
      ? (() => {
          const d = new Date(String(config.endsAt));
          return Number.isNaN(d.getTime())
            ? String(config.endsAt)
            : d.toLocaleString("tr-TR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
        })()
      : null;

  return (
    <div
      className="studio-widget-root flex h-full w-full items-center justify-center bg-transparent"
      style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
        ...(bgUrl
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.55)), url(${bgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {}),
      }}
    >
      <motion.div
        className="rounded-2xl px-8 py-5 text-center backdrop-blur"
        style={{ fontFamily, ...shell }}
        animate={
          boosted
            ? {
                scale: [1, 1.04, 1],
                borderColor: ["rgba(74,222,128,0)", "rgba(74,222,128,0.85)", "rgba(74,222,128,0)"],
              }
            : { scale: 1 }
        }
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: accent }}
        >
          {title}
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={pulse}
            initial={{ scale: 1, y: 0, filter: "brightness(1)" }}
            animate={{
              scale: boosted ? [1, 1.14, 1] : 1,
              y: boosted ? [0, -6, 0] : 0,
              filter: boosted
                ? ["brightness(1)", "brightness(1.5)", "brightness(1)"]
                : "brightness(1)",
            }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className={`mt-1 font-bold tabular-nums tracking-tight ${urgent ? "animate-pulse" : ""}`}
            style={{
              color: boosted ? "#4ade80" : displayColor,
              fontSize,
              textShadow: boosted
                ? "0 0 32px rgba(74, 222, 128, 0.95), 0 0 12px rgba(250, 204, 21, 0.65)"
                : `0 0 24px ${urgent ? "#ef444499" : accent + "99"}`,
            }}
          >
            {fmt(remaining)}
          </motion.p>
        </AnimatePresence>
        {boosted && lastBoost > 0 ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1 text-[11px] font-semibold text-emerald-300"
          >
            +{lastBoost}s eklendi
          </motion.p>
        ) : null}
        {showEndsAt && endsAtLabel ? (
          <p className="mt-2 text-[11px] font-medium text-white/55">
            Bitiş · {endsAtLabel}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
