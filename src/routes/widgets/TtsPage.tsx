/** OBS TTS / CloudTTS — Botaxt /widgets/tts + cloudtts (yerel SpeechSynthesis) */

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { getBotConfig, hydrateBotConfigFromServer, subscribeBotConfig } from "../../lib/smartBot";
import type { WidgetEvent } from "../../lib/smartBot/events";
import { useOverlayWidgetEvents } from "../../lib/smartBot/useOverlayWidgetEvents";

function speak(
  text: string,
  opts: { volume: number; rate: number; pitch: number; lang: string; voice?: string }
) {
  try {
    if (!window.speechSynthesis) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang || "tr-TR";
    u.volume = Math.min(1, Math.max(0, opts.volume));
    u.rate = Math.min(2, Math.max(0.5, opts.rate));
    u.pitch = Math.min(2, Math.max(0, opts.pitch));
    if (opts.voice) {
      const voices = window.speechSynthesis.getVoices() || [];
      const match = voices.find(
        (v) =>
          v.name.toLowerCase() === opts.voice!.toLowerCase() ||
          v.voiceURI.toLowerCase() === opts.voice!.toLowerCase()
      );
      if (match) u.voice = match;
    }
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export default function TtsPage() {
  useObsKeepalive();
  const [params] = useSearchParams();
  const cloudMode = params.get("mode") === "cloud" || params.get("cloud") === "1";
  const cfgRef = useRef(getBotConfig());
  const warnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void hydrateBotConfigFromServer().then((c) => {
      cfgRef.current = c;
    });
    return subscribeBotConfig((c) => {
      cfgRef.current = c;
    });
  }, []);

  useEffect(() => {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!voices.length && warnRef.current) warnRef.current.classList.remove("hidden");
  }, []);

  const handle = useCallback((ev: WidgetEvent) => {
    const cfg = cfgRef.current;
    const tts = cfg.tts;
    if (!tts?.enabled && ev.kind !== "tts" && ev.kind !== "test") return;
    if (ev.kind !== "tts" && ev.kind !== "test") return;
    let text = (ev.message || "").trim();
    if (!text) return;
    if (tts.skipCommands && text.startsWith("!")) return;
    if (tts.spamFilter) {
      const caps = (text.match(/[A-ZĞÜŞİÖÇ]/g) || []).length;
      if (text.length > 8 && caps / text.length > 0.7) return;
    }
    const blocked = (tts.blacklist || []).some((w) => w && text.toLowerCase().includes(w.toLowerCase()));
    if (blocked) return;
    text = text.slice(0, tts.maxLen || 120);
    const lang =
      (typeof ev.meta?.lang === "string" && ev.meta.lang) || tts.lang || "tr-TR";
    const voice =
      (typeof ev.meta?.voice === "string" && ev.meta.voice) || tts.voice || "";
    const ok = speak(`${ev.user}: ${text}`, {
      volume: tts.volume ?? 0.8,
      rate: tts.rate ?? 1,
      pitch: tts.pitch ?? 1,
      lang,
      voice,
    });
    if (!ok && warnRef.current) warnRef.current.classList.remove("hidden");
  }, []);

  useOverlayWidgetEvents(handle);

  return (
    <div className="grid h-screen w-screen place-items-center bg-transparent text-white/50">
      <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-xs backdrop-blur">
        {cloudMode ? "CloudTTS (yerel ses motoru)" : "TTS Overlay"} aktif
        <div className="mt-1 text-white/50">OBS Browser Source ses çıkarır</div>
      </div>
      <div ref={warnRef} className="warning-box absolute bottom-6 hidden rounded-lg border border-amber-400/40 bg-black/70 px-4 py-3 text-center text-sm text-amber-100">
        <h1 className="text-base font-semibold">Ses bulunamadı</h1>
        <p className="mt-1 text-white/60">Tarayıcı / OBS Speech Synthesis desteklemiyor olabilir.</p>
      </div>
    </div>
  );
}
