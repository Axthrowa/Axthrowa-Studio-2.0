/**
 * OBS Browser Source — Ses Paneli çıkışı. — AxthrowA
 * CEF otomatik oynatma kilidi açılır; panel cue → burada sırayla çalar.
 */

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/api";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { sfxCandidateUrls, stopAllSounds, type SoundPad } from "../../lib/soundboard";
import { isStaleCue } from "../../lib/sfxCue";

type SfxCue = {
  id?: number | string;
  file?: string;
  volume?: number;
  stop?: boolean;
  /** Panelin komutu yazdığı an (ms) — bayat komutları elemek için. */
  t?: number;
};

async function unlockAudio(): Promise<boolean> {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      if (ctx.state === "suspended") await ctx.resume();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch {
    /* */
  }
  try {
    const a = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
    );
    a.volume = 0.001;
    await a.play();
    a.pause();
    return true;
  } catch {
    return false;
  }
}

function playUrl(url: string, volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.volume = volume;
    a.preload = "auto";
    const done = () => {
      a.removeAttribute("src");
      a.load();
      resolve();
    };
    a.addEventListener("ended", done);
    a.addEventListener("error", () => reject(new Error("audio error")));
    a.src = url;
    void a.play().then(undefined, reject);
  });
}

async function playCueFile(pad: SoundPad): Promise<void> {
  const vol = Math.min(1, Math.max(0, (Number(pad.volume) || 80) / 100));
  const urls = sfxCandidateUrls(pad.file);
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (ct.includes("text/html")) continue;
      const blob = await res.blob();
      if (blob.size < 64) continue;
      const obj = URL.createObjectURL(blob);
      try {
        await playUrl(obj, vol);
        return;
      } finally {
        URL.revokeObjectURL(obj);
      }
    } catch (e) {
      lastErr = e;
      try {
        await playUrl(url, vol);
        return;
      } catch (e2) {
        lastErr = e2;
      }
    }
  }
  throw lastErr || new Error("play failed");
}

export default function SfxPage() {
  useObsKeepalive();
  const [status, setStatus] = useState("bağlanıyor…");
  const lastId = useRef<string>("");
  const unlocked = useRef(false);
  const cueQueue = useRef<SfxCue[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add("obs-transparent");
    return () => document.documentElement.classList.remove("obs-transparent");
  }, []);

  useEffect(() => {
    void unlockAudio().then((ok) => {
      unlocked.current = ok;
      setStatus(ok ? "hazır — ses açık" : "hazır — OBS Advanced → Control audio via OBS");
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let attempt = 0;

    const drain = async () => {
      if (busy.current || cancelled) return;
      const cue = cueQueue.current.shift();
      if (!cue) return;
      busy.current = true;
      if (!unlocked.current) unlocked.current = await unlockAudio();
      try {
        if (cue.stop) {
          cueQueue.current = [];
          stopAllSounds({ relay: false });
          setStatus("durdu");
        } else if (cue.file) {
          setStatus(`çalıyor: ${cue.file}`);
          await playCueFile({
            id: String(cue.id || "cue"),
            name: String(cue.file),
            file: String(cue.file),
            hotkey: "",
            volume: Math.min(100, Math.max(0, Number(cue.volume) || 80)),
          });
          if (!cancelled) setStatus("hazır — ses açık");
        }
      } catch {
        if (!cancelled) setStatus("çalınamadı — dosya / OBS ses?");
      } finally {
        busy.current = false;
        void drain();
      }
    };

    const handleCue = (cue: SfxCue | null | undefined) => {
      if (!cue || typeof cue !== "object") return;
      const id = String(cue.id ?? "");
      if (id && id === lastId.current) return;
      // Sayfa yeniden yüklenince sunucu son `_sfxCue`'yu tekrar gönderiyor;
      // saniyeler önceki bir komut bir daha çalmasın. Kimlik yine de işaretlenir.
      if (isStaleCue(cue, Date.now())) {
        if (id) lastId.current = id;
        return;
      }
      if (id) lastId.current = id;
      if (cue.stop === true) {
        cueQueue.current = [{ id, stop: true }];
        void drain();
        return;
      }
      if (!cue.file) return;
      cueQueue.current.push(cue);
      void drain();
    };

    const connect = () => {
      if (cancelled) return;
      const url = `${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`;
      try {
        ws = new WebSocket(url);
      } catch {
        schedule();
        return;
      }
      const sock = ws;
      sock.onopen = () => {
        attempt = 0;
        if (!cancelled) setStatus(unlocked.current ? "hazır — ses açık" : "hazır");
      };
      sock.onclose = () => {
        if (!cancelled) setStatus("yeniden bağlanıyor…");
        schedule();
      };
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg?.type === "sfx-play") {
            handleCue(msg);
            return;
          }
          if (msg?.type === "sfx-stop") {
            handleCue({ id: msg.id ?? Date.now(), stop: true });
            return;
          }
          if (msg?.type === "settings" && msg.screen === "panel") {
            handleCue(msg.data?._sfxCue);
          }
        } catch {
          /* */
        }
      };
    };

    const schedule = () => {
      if (cancelled) return;
      const delay = Math.min(12_000, 800 * 2 ** Math.min(attempt, 4));
      attempt += 1;
      retry = window.setTimeout(connect, delay);
    };

    connect();
    return () => {
      cancelled = true;
      if (retry) window.clearTimeout(retry);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, []);

  return (
    <div
      className="sfx-overlay"
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        background: "transparent",
        color: "rgba(255,255,255,0.45)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-start",
        padding: 10,
        pointerEvents: "none",
        userSelect: "none",
      }}
      title="AxthrowA SFX — OBS’te kaynak sesini aç (Control audio via OBS)"
    >
      <span>SFX · {status}</span>
    </div>
  );
}
