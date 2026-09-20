/**
 * AlertWidget — Botrix master overlay
 * Style · Disposition · Animation · Typography · Text FX · TTS · Audio
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { renderTemplateNodes } from "../../lib/alerts/template";
import {
  formatAlertTemplate,
  speakAlertTts,
  type AlertAnimIn,
  type AlertLayoutMode,
  type AlertTypeConfig,
} from "../../lib/alerts/types";

export type AlertWidgetProps = {
  visible: boolean;
  template: string;
  vars: { name?: string; amount?: string | number; message?: string };
  config: AlertTypeConfig;
  mediaUrl?: string;
  soundUrl?: string;
  previewChrome?: boolean;
  className?: string;
};

function motionFor(anim: AlertAnimIn) {
  switch (anim) {
    case "none":
      return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
    case "bounce":
      return {
        initial: { opacity: 0, y: 40, scale: 0.85 },
        animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, bounce: 0.45 } },
        exit: { opacity: 0, y: -20, scale: 0.95 },
      };
    case "slide":
    case "slide-up":
      return { initial: { opacity: 0, y: 48 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -32 } };
    case "slide-down":
      return { initial: { opacity: 0, y: -48 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 32 } };
    case "slide-left":
      return { initial: { opacity: 0, x: 64 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -48 } };
    case "slide-right":
      return { initial: { opacity: 0, x: -64 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 48 } };
    case "zoom":
      return { initial: { opacity: 0, scale: 0.55 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.1 } };
    case "zoom-down":
      return {
        initial: { opacity: 0, scale: 1.35, y: -24 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9, y: 16 },
      };
    case "flip":
      return {
        initial: { opacity: 0, rotateX: 75, scale: 0.9 },
        animate: { opacity: 1, rotateX: 0, scale: 1 },
        exit: { opacity: 0, rotateX: -40 },
      };
    case "glitch":
      return {
        initial: { opacity: 0, x: -8, filter: "hue-rotate(90deg)" },
        animate: {
          opacity: 1,
          x: [0, -4, 4, -2, 0],
          filter: ["hue-rotate(90deg)", "hue-rotate(0deg)"],
          transition: { duration: 0.55 },
        },
        exit: { opacity: 0, x: 6 },
      };
    default:
      return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  }
}

function layoutClass(mode: AlertLayoutMode) {
  if (mode === "side-by-side") return "flex flex-row items-center justify-center gap-4 text-left";
  if (mode === "text-over") return "relative flex flex-col items-center justify-end";
  return "flex flex-col items-center justify-center gap-3 text-center";
}

function textEffectClass(fx?: string) {
  if (fx === "wiggle") return "alert-fx-wiggle";
  if (fx === "wave") return "alert-fx-wave";
  if (fx === "shine") return "alert-fx-shine";
  if (fx === "skew") return "alert-fx-skew";
  if (fx === "elastic") return "alert-fx-elastic";
  if (fx === "bounce") return "alert-fx-bounce";
  if (fx === "pulse") return "alert-fx-pulse";
  if (fx === "shake") return "alert-fx-shake";
  return "";
}

function styleShell(cfg: AlertTypeConfig) {
  const mode = cfg.styleMode || "compact";
  if (mode === "minimal") return "px-2 py-1 text-center";
  if (mode === "card") {
    return "rounded-2xl border border-white/15 bg-zinc-950/85 px-8 py-6 text-center shadow-2xl backdrop-blur-md";
  }
  if (mode === "banner") {
    return "rounded-xl border px-8 py-5 text-center shadow-[0_20px_60px_rgba(0,0,0,.45)] backdrop-blur-md";
  }
  return "px-2 py-1 text-center";
}

export default function AlertWidget({
  visible,
  template,
  vars,
  config,
  mediaUrl,
  soundUrl,
  previewChrome,
  className,
}: AlertWidgetProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const m = motionFor(config.animIn || "fade");
  const plain = formatAlertTemplate(template, vars);

  useEffect(() => {
    if (!visible) return;
    if (soundUrl) {
      try {
        audioRef.current?.pause();
        const a = new Audio(soundUrl);
        a.volume = Math.min(1, Math.max(0, Number(config.volume) || 0.8));
        audioRef.current = a;
        void a.play().catch(() => undefined);
      } catch {
        /* */
      }
    }
    if (config.ttsEnabled) {
      speakAlertTts(plain, config);
    }
    return () => {
      try {
        audioRef.current?.pause();
        window.speechSynthesis?.cancel();
      } catch {
        /* */
      }
    };
  }, [visible, soundUrl, config.volume, config.ttsEnabled, config.ttsLang, plain, vars.name, template]);

  const media = mediaUrl || (config.mediaPath.startsWith("http") ? config.mediaPath : "");
  const showMsg = !config.hideMessage && vars.message;
  const nodes = renderTemplateNodes(template, vars, {
    text: config.textColor,
    highlight: config.nameColor,
  });

  const textBlock = (
    <div
      className={`${styleShell(config)} ${textEffectClass(config.textEffect)} ${
        config.layout === "text-over"
          ? "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10"
          : "max-w-[min(92vw,640px)]"
      }`}
      style={{
        fontFamily: config.fontFamily,
        fontSize: `clamp(1rem, ${config.fontSize / 18}vw, ${config.fontSize}px)`,
        fontWeight: config.fontWeight || 700,
        letterSpacing: `${config.letterSpacing || 0}px`,
        borderColor: config.styleMode === "banner" || config.styleMode === "card" ? `${config.nameColor}55` : undefined,
        background:
          config.styleMode === "banner" ? `${config.nameColor}22` : undefined,
        textShadow:
          config.textShadow > 0
            ? `0 0 ${config.textShadow}px rgba(0,0,0,.9), 0 2px 14px rgba(0,0,0,.55)`
            : "0 2px 12px rgba(0,0,0,.45)",
        transform: `translate(${config.posX || 0}px, ${config.posY || 0}px)`,
        lineHeight: 1.25,
      }}
    >
      {nodes}
      {showMsg ? (
        <div className="mt-2 text-sm font-medium opacity-75" style={{ color: config.textColor }}>
          {vars.message}
        </div>
      ) : null}
    </div>
  );

  const mediaBlock = media ? (
    /\.(mp4|webm|mov)(\?|$)/i.test(media) ? (
      <video
        key={media}
        src={media}
        autoPlay
        muted
        playsInline
        loop
        className={
          config.layout === "side-by-side"
            ? "h-28 w-28 shrink-0 rounded-xl object-cover shadow-2xl"
            : "max-h-[38vh] max-w-[min(90vw,420px)] rounded-xl object-contain drop-shadow-2xl"
        }
      />
    ) : (
      <img
        src={media}
        alt=""
        className={
          config.layout === "side-by-side"
            ? "h-28 w-28 shrink-0 rounded-xl object-cover shadow-2xl"
            : config.layout === "text-over"
              ? "max-h-[42vh] max-w-[min(90vw,480px)] rounded-xl object-contain"
              : "max-h-[38vh] max-w-[min(90vw,420px)] rounded-xl object-contain drop-shadow-2xl"
        }
      />
    )
  ) : previewChrome ? (
    <div
      className={
        config.layout === "side-by-side"
          ? "flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-[10px] text-white/50"
          : "flex h-32 w-48 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 text-xs text-white/50"
      }
    >
      Medya yok
    </div>
  ) : null;

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className || ""}`}
      style={
        previewChrome
          ? {
              backgroundImage:
                "linear-gradient(45deg,#1a1a1a 25%,transparent 25%),linear-gradient(-45deg,#1a1a1a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1a1a1a 75%),linear-gradient(-45deg,transparent 75%,#1a1a1a 75%)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0,0 12px,12px -12px,-12px 0",
              backgroundColor: "#111",
            }
          : undefined
      }
    >
      {config.customCss ? <style>{config.customCss}</style> : null}
      <style>{`
        .alert-fx-wiggle { animation: alertWiggle 1.2s ease-in-out infinite; display:inline-block; }
        .alert-fx-wave { animation: alertWave 1.4s ease-in-out infinite; display:inline-block; }
        .alert-fx-shine { background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); background-size: 200% 100%; -webkit-background-clip: text; animation: alertShine 2s linear infinite; }
        .alert-fx-skew { animation: alertSkew 1.1s ease-in-out infinite; display:inline-block; }
        .alert-fx-elastic { animation: alertElastic 1.3s ease-in-out infinite; display:inline-block; }
        .alert-fx-bounce { animation: alertBounce .9s ease-in-out infinite; display:inline-block; }
        .alert-fx-pulse { animation: alertPulse 1.1s ease-in-out infinite; display:inline-block; }
        .alert-fx-shake { animation: alertShake .5s linear infinite; display:inline-block; }
        @keyframes alertWiggle { 0%,100% { transform: rotate(-1.5deg) } 50% { transform: rotate(1.5deg) } }
        @keyframes alertWave { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes alertShine { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
        @keyframes alertSkew { 0%,100% { transform: skewX(0) } 50% { transform: skewX(-6deg) } }
        @keyframes alertElastic { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(1.06) } }
        @keyframes alertBounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        @keyframes alertPulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.85; transform:scale(1.03) } }
        @keyframes alertShake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-3px) } 75% { transform: translateX(3px) } }
      `}</style>
      <AnimatePresence mode="wait">
        {visible ? (
          <motion.div
            key={`${vars.name}-${template}-${config.layout}-${config.animIn}`}
            className={`alert-root ${layoutClass(config.layout)}`}
            style={{ perspective: 800 }}
            initial={m.initial}
            animate={m.animate}
            exit={m.exit}
          >
            {config.layout === "text-over" ? (
              <div className="relative inline-flex max-w-full flex-col items-center">
                {mediaBlock}
                {textBlock}
              </div>
            ) : (
              <>
                {mediaBlock}
                {textBlock}
              </>
            )}
          </motion.div>
        ) : previewChrome ? (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} className="text-sm text-white/50">
            Önizleme · test butonuna bas
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
