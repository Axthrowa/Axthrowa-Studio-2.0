/**
 * Sahne / ses kısayollarını işletim sistemi düzeyinde kaydeder.
 *
 * Kayıt Rust tarafında (`sync_global_hotkeys`) yapılır: tepsiye alınca
 * WebView JS donsa bile OS kısayolu OBS/müzik eylemini Rust'ta çalıştırır.
 */

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

/** Kullanıcının yazdığı kısayol → tuş adı eşlemesi (küçük harf anahtarlar). */
const NAMED_KEYS: Record<string, string> = {
  space: "Space",
  spacebar: "Space",
  enter: "Enter",
  return: "Enter",
  esc: "Escape",
  escape: "Escape",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  del: "Delete",
  insert: "Insert",
  ins: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  arrowup: "ArrowUp",
  arrowdown: "ArrowDown",
  arrowleft: "ArrowLeft",
  arrowright: "ArrowRight",
  plus: "Equal",
  minus: "Minus",
  comma: "Comma",
  period: "Period",
};

const REGISTER_DEBOUNCE_MS = 450;

/**
 * `"Ctrl+1"` / `"F5"` gibi bir girdiyi hızlandırıcı biçimine çevirir
 * (doğrulama / UI için; asıl ayrıştırma Rust'ta).
 */
export function toAccelerator(spec: string): string | null {
  const nice = canonicalizeHotkeySpec(spec);
  if (!nice) return null;
  const parts = nice
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return null;

  const mods: string[] = [];
  let key: string | null = null;

  for (const part of parts) {
    if (part === "ctrl" || part === "control") mods.push("Control");
    else if (part === "alt" || part === "option") mods.push("Alt");
    else if (part === "shift") mods.push("Shift");
    else if (part === "win" || part === "super" || part === "meta" || part === "cmd") {
      mods.push("Super");
    } else if (key !== null) {
      return null;
    } else if (/^[a-z]$/.test(part)) key = `Key${part.toUpperCase()}`;
    else if (/^[0-9]$/.test(part)) key = `Digit${part}`;
    else if (/^f([1-9]|1[0-9]|2[0-4])$/.test(part)) key = part.toUpperCase();
    else if (NAMED_KEYS[part]) key = NAMED_KEYS[part];
    else return null;
  }

  if (!key) return null;
  return [...new Set(mods), key].join("+");
}

const MOD_ORDER = ["Ctrl", "Alt", "Shift", "Win"] as const;

/** Elle yazılan / yakalanan spec’i `Ctrl+Shift+F1` biçimine çevirir. */
export function canonicalizeHotkeySpec(raw: string): string | null {
  const parts = String(raw || "")
    .split(/[+＋]/)
    .map((p) => p.trim().toLowerCase().replace(/\s+/g, ""))
    .filter(Boolean);
  if (!parts.length) return null;

  const mods: string[] = [];
  let key: string | null = null;

  const pushMod = (m: string) => {
    if (!mods.includes(m)) mods.push(m);
  };

  for (const part of parts) {
    if (part === "ctrl" || part === "control") pushMod("Ctrl");
    else if (part === "alt" || part === "option") pushMod("Alt");
    else if (part === "shift") pushMod("Shift");
    else if (part === "win" || part === "super" || part === "meta" || part === "cmd" || part === "command") {
      pushMod("Win");
    } else if (key !== null) {
      return null;
    } else if (/^f([1-9]|1[0-9]|2[0-4])$/.test(part)) key = `F${part.slice(1)}`;
    else if (/^[a-z]$/.test(part)) key = part.toUpperCase();
    else if (/^[0-9]$/.test(part)) key = part;
    else if (part.startsWith("key") && /^key[a-z]$/.test(part)) key = part.slice(3).toUpperCase();
    else if (part.startsWith("digit") && /^digit[0-9]$/.test(part)) key = part.slice(5);
    else if (NAMED_KEYS[part]) {
      const n = NAMED_KEYS[part];
      if (n.startsWith("Arrow")) key = n.slice(5);
      else if (n === "Equal") key = "Plus";
      else key = n;
    } else {
      return null;
    }
  }
  if (!key) return null;
  mods.sort((a, b) => MOD_ORDER.indexOf(a as (typeof MOD_ORDER)[number]) - MOD_ORDER.indexOf(b as (typeof MOD_ORDER)[number]));
  return [...mods, key].join("+");
}

/** KeyboardEvent → kullanıcı spec'i (`Ctrl+Shift+F5`). Yalnız modifier ise null. */
export function eventToSpec(e: KeyboardEvent): string | null {
  if (e.key === "Control" || e.key === "Alt" || e.key === "Shift" || e.key === "Meta") return null;
  if (e.key === "Escape") return null;
  // Modifier-only code (bazı WebView’ler)
  if (e.code === "ControlLeft" || e.code === "ControlRight" || e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "AltLeft" || e.code === "AltRight" || e.code === "MetaLeft" || e.code === "MetaRight") {
    return null;
  }

  const mods: string[] = [];
  if (e.ctrlKey || e.getModifierState?.("Control") || e.getModifierState?.("AltGraph")) mods.push("Ctrl");
  if (e.altKey || e.getModifierState?.("Alt") || e.getModifierState?.("AltGraph")) mods.push("Alt");
  if (e.shiftKey || e.getModifierState?.("Shift")) mods.push("Shift");
  if (e.metaKey || e.getModifierState?.("Meta")) mods.push("Win");
  const uniq = [...new Set(mods)];

  let main = "";
  const code = e.code || "";
  // code ile yakala: Shift+1 / Alt+1 → Digit1 (e.key bozulabilir)
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(code)) main = code.toUpperCase();
  else if (/^Key[A-Z]$/i.test(code)) main = code.slice(3).toUpperCase();
  else if (/^Digit[0-9]$/.test(code)) main = code.slice(5);
  else if (/^Numpad[0-9]$/.test(code)) main = code.slice(6);
  else if (code === "Space") main = "Space";
  else if (code === "Enter" || code === "NumpadEnter") main = "Enter";
  else if (code === "Tab") main = "Tab";
  else if (code === "Backspace") main = "Backspace";
  else if (code === "Delete") main = "Delete";
  else if (code === "Insert") main = "Insert";
  else if (code === "Home") main = "Home";
  else if (code === "End") main = "End";
  else if (code === "PageUp") main = "PageUp";
  else if (code === "PageDown") main = "PageDown";
  else if (code === "ArrowUp") main = "Up";
  else if (code === "ArrowDown") main = "Down";
  else if (code === "ArrowLeft") main = "Left";
  else if (code === "ArrowRight") main = "Right";
  else if (code === "Equal" || code === "NumpadAdd") main = "Plus";
  else if (code === "Minus" || code === "NumpadSubtract") main = "Minus";
  else if (code === "Comma") main = "Comma";
  else if (code === "Period") main = "Period";
  else {
    const k = e.key;
    if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(k)) main = k.toUpperCase();
    else if (k === " ") main = "Space";
    else if (k.length === 1 && /[a-zA-Z]/.test(k)) main = k.toUpperCase();
    else if (k.length === 1 && /[0-9]/.test(k)) main = k;
    else if (k === "Enter") main = "Enter";
    else if (k === "Tab") main = "Tab";
    else if (k === "Backspace") main = "Backspace";
    else if (k === "Delete") main = "Delete";
    else if (k === "Insert") main = "Insert";
    else if (k === "Home") main = "Home";
    else if (k === "End") main = "End";
    else if (k === "PageUp") main = "PageUp";
    else if (k === "PageDown") main = "PageDown";
    else if (k === "ArrowUp") main = "Up";
    else if (k === "ArrowDown") main = "Down";
    else if (k === "ArrowLeft") main = "Left";
    else if (k === "ArrowRight") main = "Right";
    else if (k === "+" || k === "=") main = "Plus";
    else if (k === "-") main = "Minus";
    else if (k === ",") main = "Comma";
    else if (k === ".") main = "Period";
    else return null;
  }

  return canonicalizeHotkeySpec([...uniq, main].join("+"));
}

export type HotkeyBinding = {
  id: string;
  spec: string;
  /**
   * scene | mic | muteAll | music | srcMute | sfx | clearChat ve OBS
   * aksiyonları: srcToggle | volume | record | filter | sceneNext | scenePrev | obsHotkey
   */
  kind?: string;
  scene?: string;
  input?: string;
  label?: string;
  /** srcToggle (sahnedeki kaynak) / filter (filtrenin sahibi) */
  source?: string;
  filter?: string;
  /** record: toggle | start | stop | pause */
  mode?: string;
  /** volume: dB farkı */
  delta?: number;
  /** obsHotkey: OBS kısayol adı · action: eylem kayıt defteri kimliği */
  name?: string;
  /** action: çoklu yayın hedef kimliği */
  target?: string;
  /** action: onay isteyen eylem onaysız çalışsın */
  confirmed?: boolean;
};

function tauriAvailable() {
  try {
    if (isTauri()) return true;
  } catch {
    /* */
  }
  return !!(globalThis as any).__TAURI_INTERNALS__;
}

/**
 * Kısayolları Rust'a yazar. Dönüş: başarıyla kaydedilen `spec` metinleri.
 * `hotkey-trigger` olayını dinleyerek ses paneli / chat temizleme gibi
 * frontend eylemlerini çalıştırır. — AxthrowA
 */
/**
 * Rust'ın az önce işlediği binding kimlikleri.
 *
 * Kayıtlı bir kısayolda işletim sistemi hem global kısayolu (Rust) hem de
 * pencere odaktaysa WebView `keydown`'unu tetikliyor. İkisi de çalışınca tek
 * tuş iki eylem yapıyordu. Rust tetiklediğinde id buraya yazılır, local yedek
 * kısa bir pencere boyunca o id'yi atlar.
 */
const nativeHandled = new Map<string, number>();
const NATIVE_GUARD_MS = 500;

function markHandledByNative(id: string) {
  nativeHandled.set(id, Date.now());
}

/** Local `keydown` yedeği bu id'yi atlamalı mı? */
export function wasHandledByNative(id: string): boolean {
  const t = nativeHandled.get(id);
  if (t == null) return false;
  if (Date.now() - t > NATIVE_GUARD_MS) {
    nativeHandled.delete(id);
    return false;
  }
  return true;
}

/** Rust'tan dönen kayıt sonucu. */
export type HotkeyFailure = { id: string; spec: string; reason: string };

export function useGlobalHotkeys(
  bindings: HotkeyBinding[],
  onTrigger: (id: string) => void,
  opts?: { paused?: boolean; onError?: (info: { id: string; kind: string; message: string }) => void }
): { registered: Set<string>; failures: HotkeyFailure[]; error: string | null } {
  // Küme artık **binding kimliği** tutuyor, tuş metni değil. Eskiden metin
  // tutulduğu için aynı tuşu paylaşan iki binding'de yanlış pozitif oluyordu:
  // kaydedilmemiş ses kısayolu "kayıtlı" görünüyor, local yedek de onu
  // atlıyordu — kısayol tamamen ölüyordu.
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<HotkeyFailure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onTriggerRef = useRef(onTrigger);
  const onErrorRef = useRef(opts?.onError);
  onErrorRef.current = opts?.onError;
  onTriggerRef.current = onTrigger;
  const firstMountRef = useRef(true);
  const paused = !!opts?.paused;

  const imza = paused
    ? "__paused__"
    : bindings
        .map(
          (b) =>
            `${b.id}=${b.spec}|${b.kind || ""}|${b.scene || ""}|${b.input || ""}|${b.source || ""}|${b.filter || ""}|${b.mode || ""}|${b.delta ?? ""}|${b.name || ""}`
        )
        .join(";");

  useEffect(() => {
    if (!tauriAvailable()) return undefined;

    let iptal = false;
    const delay = paused || firstMountRef.current ? 0 : REGISTER_DEBOUNCE_MS;
    firstMountRef.current = false;
    let unlisten: (() => void) | undefined;
    let unlistenErr: (() => void) | undefined;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await invoke<{ ok: string[]; failed: HotkeyFailure[] }>("sync_global_hotkeys", {
            bindings: paused
              ? []
              : bindings.map((b) => ({
                  id: b.id,
                  spec: b.spec,
                  kind: b.kind || "",
                  scene: b.scene || "",
                  input: b.input || "",
                  label: b.label || "",
                  source: b.source || "",
                  filter: b.filter || "",
                  mode: b.mode || "",
                  delta: Number(b.delta) || 0,
                  name: b.name || "",
                })),
          });
          if (iptal) return;
          setRegistered(new Set(res?.ok || []));
          setFailures(res?.failed || []);
          setError(null);
        } catch (e: any) {
          if (iptal) return;
          setRegistered(new Set());
          setFailures([]);
          setError(String(e?.message || e));
        }
      })();
    }, delay);

    void (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        // Rust'ta bir kısayol hata verirse (OBS'e bağlanılamadı, kaynak yok…)
        // kullanıcıya göster; yayın sürümünde hiçbir yere yazılmıyordu.
        const unErr = await listen<{ id: string; kind: string; message: string }>("hotkey-error", (ev) => {
          if (ev.payload) onErrorRef.current?.(ev.payload);
        });
        unlistenErr = unErr;
        unlisten = await listen<string>("hotkey-trigger", (ev) => {
          const id = ev.payload;
          if (!id) return;
          if (
            id === "clearChat" ||
            id === "sfxStop" ||
            id.startsWith("sfx:") ||
            id === "mic" ||
            id === "muteAll" ||
            id === "music" ||
            id.startsWith("act:") ||
            id.startsWith("srcMute:")
          ) {
            // Rust bu id'yi işledi: local keydown yedeği aynı anda ikinci kez
            // tetiklemesin. Aksi hâlde tek tuşa basınca hem sahne değişiyor
            // hem ses çalıyordu.
            markHandledByNative(id);
            if (id.startsWith("sfx:") || id === "clearChat" || id === "sfxStop") {
              onTriggerRef.current(id);
            }
          }
        });
      } catch {
        /* tarayıcı / eski paket */
      }
    })();

    return () => {
      iptal = true;
      window.clearTimeout(timer);
      try {
        unlisten?.();
        unlistenErr?.();
      } catch {
        /* */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imza, paused]);

  return { registered, failures, error };
}
