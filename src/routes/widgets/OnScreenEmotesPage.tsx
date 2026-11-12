/** OBS Emotes en pantalla — Bot /widgets/emotewall */

import { useCallback, useEffect, useState } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import type { WidgetEvent } from "../../lib/sohbetBot/events";
import { getBotConfig, hydrateBotConfigFromServer, subscribeBotConfig } from "../../lib/sohbetBot";
import { isLocalBotUser } from "../../lib/sohbetBot/botIdentity";
import { useOverlayWidgetEvents } from "../../lib/sohbetBot/useOverlayWidgetEvents";
import { PATLAMA_TAVAN, patlamaAdedi, patlamaSimgesi } from "../../lib/patlamaAdedi";

type Floater = {
  id: string;
  url?: string;
  text: string;
  left: number;
  size: number;
  dur: number;
  sway: number;
};

export default function OnScreenEmotesPage() {
  useObsKeepalive();
  const [items, setItems] = useState<Floater[]>([]);
  const [cfg, setCfg] = useState(() => getBotConfig().emotewall);

  useEffect(() => {
    void hydrateBotConfigFromServer().then((c) => setCfg(c.emotewall));
    return subscribeBotConfig((c) => setCfg(c.emotewall));
  }, []);

  const pushMany = useCallback(
    (list: { url?: string; text: string }[]) => {
      if (cfg?.enabled === false) return;
      const max = Math.min(cfg?.max || 12, PATLAMA_TAVAN);
      const baseDur = cfg?.durationMs || 3500;
      const sway = cfg?.swaySpeed || 1;
      const minSize = Math.max(8, cfg?.minSize ?? 28);
      const maxSize = Math.max(minSize, cfg?.maxSize ?? 64);
      setItems((prev) => {
        const next = [...prev];
        for (const it of list) {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const floater: Floater = {
            id,
            url: it.url,
            text: it.text,
            left: 6 + Math.random() * 88,
            size: minSize + Math.random() * (maxSize - minSize),
            dur: baseDur + Math.random() * 1200,
            sway: sway * (0.6 + Math.random()),
          };
          next.push(floater);
          window.setTimeout(() => {
            setItems((p) => p.filter((x) => x.id !== id));
          }, floater.dur + 100);
        }
        return next.slice(-max);
      });
    },
    [cfg]
  );

  const onEvent = useCallback(
    (ev: WidgetEvent) => {
      if (cfg?.enabled === false) return;
      if (isLocalBotUser(ev.user || "")) return;
      const olay = patlamaAdedi(ev.kind, ev.amount, {
        follow: cfg?.explosionOnFollow !== false,
        sub: cfg?.explosionOnSub !== false,
      });
      if (olay) {
        const simge = patlamaSimgesi(ev.kind);
        pushMany(Array.from({ length: olay }, () => ({ text: simge })));
        return;
      }
      if (ev.kind !== "emote" && ev.kind !== "emotecombo") return;
      if (String(ev.message || "").trim().startsWith("!")) return;
      if (ev.meta?.explosion) {
        const n = Math.min(PATLAMA_TAVAN, Number(ev.meta.count || 8));
        pushMany(
          Array.from({ length: n }, () => ({
            text: String(ev.message || "✨"),
            url: typeof ev.meta?.url === "string" ? ev.meta.url : undefined,
          }))
        );
        return;
      }
      pushMany([
        {
          text: String(ev.meta?.emote || ev.message || "✨"),
          url: typeof ev.meta?.url === "string" ? ev.meta.url : undefined,
        },
      ]);
    },
    [pushMany, cfg]
  );

  useOverlayWidgetEvents(onEvent);

  if (cfg?.enabled === false) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 h-[480px] w-[640px] overflow-hidden bg-transparent">
      {items.map((it) => (
        <div
          key={it.id}
          className="pointer-events-none absolute bottom-0"
          style={{
            left: `${it.left}%`,
            width: it.size,
            height: it.size,
            animation: `emoteFly ${it.dur}ms ease-out forwards`,
            ["--sway" as string]: `${it.sway * 24}px`,
          }}
        >
          {it.url ? (
            <img src={it.url} alt={it.text} className="h-full w-full object-contain drop-shadow-lg" />
          ) : (
            <span className="text-4xl drop-shadow-lg">{it.text}</span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes emoteFly{
          0%{transform:translate(0,0) scale(.7);opacity:0}
          12%{opacity:1}
          50%{transform:translate(var(--sway), -220px) scale(1)}
          100%{transform:translate(calc(var(--sway) * -1), -440px) scale(1.15);opacity:0}
        }
      `}</style>
    </div>
  );
}
