/**
 * Kısayol kutusu — «Tuş ata» (Ctrl+Alt+1 vb. dahil). — AxthrowA
 * Alt+rakam için keyup yedeği; modifier’lar ref’te tutulur.
 */

import { useEffect, useRef, useState } from "react";
import {
  canonicalizeHotkeySpec,
  eventToSpec,
  toAccelerator
} from "../../lib/globalHotkeys";
import { useT } from "../../i18n";

type Props = {
  value: string;
  onChange: (spec: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
  onListeningChange?: (listening: boolean) => void;
  onCaptured?: (spec: string) => void;
};

const LISTEN_MS = 12000;
const ARM_MS = 180;

let stopOtherListen: (() => void) | null = null;

function isModifierEvent(e: KeyboardEvent): boolean {
  return (
    e.key === "Control" ||
    e.key === "Alt" ||
    e.key === "Shift" ||
    e.key === "Meta" ||
    e.code === "ControlLeft" ||
    e.code === "ControlRight" ||
    e.code === "ShiftLeft" ||
    e.code === "ShiftRight" ||
    e.code === "AltLeft" ||
    e.code === "AltRight" ||
    e.code === "MetaLeft" ||
    e.code === "MetaRight" ||
    e.code === "AltGraph"
  );
}

function mainCodeFromEvent(e: KeyboardEvent): string | null {
  const code = e.code || "";
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(code)) return code.toUpperCase();
  if (/^Key[A-Z]$/i.test(code)) return code.slice(3).toUpperCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  if (
    [
      "Space",
      "Enter",
      "Tab",
      "Backspace",
      "Delete",
      "Insert",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ].includes(code)
  ) {
    return code === "Space" ? "Space" : code;
  }
  if (code === "ArrowUp") return "Up";
  if (code === "ArrowDown") return "Down";
  if (code === "ArrowLeft") return "Left";
  if (code === "ArrowRight") return "Right";
  if (code === "Equal" || code === "NumpadAdd") return "Plus";
  if (code === "Minus" || code === "NumpadSubtract") return "Minus";
  if (code === "Comma") return "Comma";
  if (code === "Period") return "Period";
  return null;
}

export default function HotkeyInput({
  value,
  onChange,
  className = "min-w-[7.5rem] rounded-lg border border-white/[0.09] bg-black/40 px-2 py-1 text-center font-mono text-xs text-white placeholder:text-panel-muted outline-none transition-all focus:border-panel-accent/60 focus:ring-1 focus:ring-panel-accent/30",
  placeholder = "Ctrl+Alt+1",
  title = "Kısayol — Tuş ata ile kombinasyon yakala veya elle yaz (Ctrl+Alt+1)",
  onListeningChange,
  onCaptured,
}: Props) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const [listening, setListening] = useState(false);
  const [leftMs, setLeftMs] = useState(LISTEN_MS);
  const [hint, setHint] = useState("");
  const [preview, setPreview] = useState("");
  const [draft, setDraft] = useState(value);
  const endAt = useRef(0);
  const armedAt = useRef(0);
  const capturedRef = useRef(false);
  const modsRef = useRef({ ctrl: false, alt: false, shift: false, win: false });
  const onChangeRef = useRef(onChange);
  const onCapturedRef = useRef(onCaptured);
  const onListeningChangeRef = useRef(onListeningChange);
  onChangeRef.current = onChange;
  onCapturedRef.current = onCaptured;
  onListeningChangeRef.current = onListeningChange;

  useEffect(() => {
    if (!listening) setDraft(value);
  }, [value, listening]);

  const stopListen = (notify = true) => {
    setListening(false);
    setPreview("");
    if (notify) onListeningChangeRef.current?.(false);
  };

  const startListen = () => {
    stopOtherListen?.();
    onListeningChangeRef.current?.(true);
    armedAt.current = Date.now() + ARM_MS;
    endAt.current = Date.now() + LISTEN_MS;
    capturedRef.current = false;
    modsRef.current = { ctrl: false, alt: false, shift: false, win: false };
    setLeftMs(LISTEN_MS);
    setPreview("…");
    setHint("");
    setListening(true);
  };

  const commitSpec = (spec: string) => {
    if (capturedRef.current) return;
    const nice = canonicalizeHotkeySpec(spec);
    if (!nice || !toAccelerator(nice)) {
      setHint(tRef.current("hotkey.unsupported"));
      return;
    }
    capturedRef.current = true;
    setDraft(nice);
    onChangeRef.current(nice);
    onCapturedRef.current?.(nice);
    setHint("");
    setPreview("");
    stopListen(true);
  };

  useEffect(() => {
    if (!listening) return;

    const stopSelf = () => stopListen(true);
    stopOtherListen = stopSelf;

    const tick = window.setInterval(() => {
      const left = Math.max(0, endAt.current - Date.now());
      setLeftMs(left);
      if (left <= 0) stopListen(true);
    }, 100);

    const syncMods = (e: KeyboardEvent) => {
      modsRef.current = {
        ctrl: !!(e.ctrlKey || e.getModifierState?.("Control")),
        alt: !!(e.altKey || e.getModifierState?.("Alt") || e.getModifierState?.("AltGraph")),
        shift: !!(e.shiftKey || e.getModifierState?.("Shift")),
        win: !!(e.metaKey || e.getModifierState?.("Meta")),
      };
      // AltGraph = Ctrl+Alt (sağ Alt)
      if (e.getModifierState?.("AltGraph")) {
        modsRef.current.ctrl = true;
        modsRef.current.alt = true;
      }
      const parts: string[] = [];
      if (modsRef.current.ctrl) parts.push("Ctrl");
      if (modsRef.current.alt) parts.push("Alt");
      if (modsRef.current.shift) parts.push("Shift");
      if (modsRef.current.win) parts.push("Win");
      setPreview(parts.length ? `${parts.join("+")}+…` : "…");
    };

    const buildFromModsAndCode = (e: KeyboardEvent): string | null => {
      const main = mainCodeFromEvent(e);
      if (!main) return null;
      const m = modsRef.current;
      // keyup anında modifier bayrakları düşmüş olabilir — event + ref birleştir
      const ctrl = m.ctrl || e.ctrlKey || !!e.getModifierState?.("Control") || !!e.getModifierState?.("AltGraph");
      const alt = m.alt || e.altKey || !!e.getModifierState?.("Alt") || !!e.getModifierState?.("AltGraph");
      const shift = m.shift || e.shiftKey || !!e.getModifierState?.("Shift");
      const win = m.win || e.metaKey || !!e.getModifierState?.("Meta");
      const parts: string[] = [];
      if (ctrl) parts.push("Ctrl");
      if (alt) parts.push("Alt");
      if (shift) parts.push("Shift");
      if (win) parts.push("Win");
      parts.push(main);
      return canonicalizeHotkeySpec(parts.join("+"));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (capturedRef.current) return;
      if (e.repeat) return;
      if (Date.now() < armedAt.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setHint("");
        stopListen(true);
        return;
      }

      if (isModifierEvent(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        syncMods(e);
        return;
      }

      syncMods(e);
      e.preventDefault();
      e.stopImmediatePropagation();

      // Önce standart yol; Alt+rakam için code yedeği
      const spec = eventToSpec(e) || buildFromModsAndCode(e);
      if (!spec) {
        setHint(tRef.current("hotkey.unsupported"));
        return;
      }
      commitSpec(spec);
    };

    // Alt+rakam: bazı WebView’lerde keydown yutulur, keyup gelir
    const onKeyUp = (e: KeyboardEvent) => {
      if (capturedRef.current) return;
      if (Date.now() < armedAt.current) return;
      if (isModifierEvent(e)) {
        syncMods(e);
        return;
      }
      if (!mainCodeFromEvent(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const spec = buildFromModsAndCode(e) || eventToSpec(e);
      if (spec) commitSpec(spec);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      if (stopOtherListen === stopSelf) stopOtherListen = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChangeRef.current("");
      setDraft("");
      return;
    }
    const nice = canonicalizeHotkeySpec(trimmed);
    if (!nice || !toAccelerator(nice)) {
      setHint(tRef.current("hotkey.unsupported"));
      setDraft(value);
      return;
    }
    setDraft(nice);
    setHint("");
    onChangeRef.current(nice);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          className={`${className} ${
            listening
              ? "!border-amber-500/80 !bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
              : ""
          }`}
          value={listening ? preview || draft : draft}
          placeholder={placeholder}
          title={title}
          readOnly={listening}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (!listening) commitDraft(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <button
          type="button"
          className={
            "shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-150 active:scale-95 " +
            (listening
              ? "border-amber-500/60 bg-amber-500 text-black shadow-glow animate-pulse"
              : "border-panel-accent/30 bg-panel-accent/15 text-panel-accent hover:border-panel-accent/50 hover:bg-panel-accent/25")
          }
          title={t("hotkey.listenHint")}
          onPointerDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (listening) stopListen(true);
            else startListen();
          }}
        >
          {listening ? `${Math.ceil(leftMs / 1000)}s` : t("hotkey.listen")}
        </button>
      </div>
      {listening || hint ? (
        <span className="max-w-[18rem] text-[10px] font-medium leading-tight text-amber-300">
          {listening
            ? `${t("hotkey.listenHint")}${preview ? ` · ${preview}` : ""}`
            : hint}
        </span>
      ) : null}
    </div>
  );
}
