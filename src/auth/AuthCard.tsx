import { useState } from "react";
import { Link } from "react-router-dom";
import { PLATFORM_BRAND, type BotPlatform } from "../lib/platformTheme";
import { startPlatformBotLogin } from "./startPlatformLogin";

const ORDER: BotPlatform[] = ["kick", "twitch", "youtube", "discord"];

export default function AuthCard() {
  const [busy, setBusy] = useState<BotPlatform | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onLogin = async (platform: BotPlatform) => {
    setBusy(platform);
    setMsg("");
    setErr("");
    try {
      const r = await startPlatformBotLogin(platform);
      if (r.ok) setMsg(r.message);
      else setErr(r.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Giriş başlatılamadı");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#12141a]/95 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="border-b border-white/[0.05] px-7 py-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          AxthrowA Studio · AxBoT
        </p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-white">
          Platform ile giriş
        </h1>
        <p className="mt-2 text-[13px] leading-snug text-white/50">
          Botrix gibi — hesabınla giriş yap, bot o platforma bağlansın. Şifre yok.
        </p>
      </div>

      <div className="flex flex-col gap-2.5 px-6 py-5">
        {ORDER.map((id) => {
          const b = PLATFORM_BRAND[id];
          return (
            <button
              key={id}
              type="button"
              disabled={!!busy}
              onClick={() => void onLogin(id)}
              className="group flex h-12 items-center justify-center gap-3 rounded-xl px-4 text-[14px] font-semibold transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              style={{ background: b.color, color: b.ink }}
            >
              <PlatformGlyph id={id} />
              {busy === id ? "Bağlanıyor…" : `${b.label} ile giriş`}
            </button>
          );
        })}
      </div>

      {(msg || err) && (
        <div className="px-6 pb-2">
          <p
            className={`rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
              err
                ? "border-red-500/25 bg-red-500/10 text-red-200"
                : "border-teal-500/25 bg-teal-500/10 text-teal-100"
            }`}
          >
            {err || msg}
          </p>
        </div>
      )}

      <div className="space-y-2 border-t border-white/[0.05] px-6 py-4 text-center text-[11px] leading-relaxed text-white/50">
        <p>
          Kick botu yazabilsin diye kanalında{" "}
          <span className="text-white/50">/mod BotAxT</span> verin (Botrix’te botrixlive gibi). Twitch / YouTube’ta
          bot hesabına moderatör yetkisi gerekir.
        </p>
        <Link
          to="/panel?nav=bot"
          className="inline-flex text-[12px] font-medium text-teal-400/90 transition-colors hover:text-teal-300"
        >
          Bot paneline git →
        </Link>
      </div>
    </div>
  );
}

function PlatformGlyph({ id }: { id: BotPlatform }) {
  const cls = "shrink-0 opacity-95";
  if (id === "kick") {
    return (
      <svg className={cls} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 3h5.2v6.4L14.4 3H21l-7.1 8.1L21 21h-6.6l-6.2-7.1V21H3V3z" />
      </svg>
    );
  }
  if (id === "twitch") {
    return (
      <svg className={cls} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4.3 2L2 5.7v14.6h5.1V22l2.9-1.7h4.4L22 14.3V2H4.3zm15.6 11.1l-3.2 3.2h-4.4l-2.5 1.5v-1.5H6.3V3.9h13.6v9.2z" />
        <path d="M15.1 7.1h1.7v5.1H15.1V7.1zm-4.5 0H12.3v5.1H10.6V7.1z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg className={cls} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M23.5 7.2a3 3 0 0 0-2.1-2.1C19.5 4.6 12 4.6 12 4.6s-7.5 0-9.4.5A3 3 0 0 0 .5 7.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-4.8zM9.8 15.5v-7L16 12l-6.2 3.5z" />
      </svg>
    );
  }
  return (
    <svg className={cls} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.3 4.3A19 19 0 0 0 15.1 3l-.2.5a17 17 0 0 1 4.4 2.1 15.6 15.6 0 0 0-13.4 0A13 13 0 0 1 9.1 3l-.3-.0A19 19 0 0 0 3.7 4.3 20.4 20.4 0 0 0 .5 17.5a19.5 19.5 0 0 0 5.9 3 15 15 0 0 0 1.3-2.1l-.1-.1a12.5 12.5 0 0 1-1.9-.9l.1-.1c.4.3 2.9 1.6 8.2 1.6s7.8-1.3 8.2-1.6l.1.1c-.6.4-1.2.7-1.9.9l-.1.1.4.8c.4.7.8 1.4 1.3 2.1a19.4 19.4 0 0 0 5.9-3A20.4 20.4 0 0 0 20.3 4.3zM8.3 14.4c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.6 1.8-.7 1.8-1.6 1.8zm7.4 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.7.8 1.6 1.8-.7 1.8-1.6 1.8z" />
    </svg>
  );
}
