/** Emote Combo — index.emotekombosu.css stilleri + Framer Motion zıplama. */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  overlaySyncWsUrl,
  useWidgetSync,
  type WidgetSyncEvent,
} from "../../lib/widgets/useWidgetSync";

type Props = { config: Record<string, unknown> };

type ComboView = {
  label: string;
  url: string;
  count: number;
};

type Bit = {
  id: number;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  burstX: number;
  burstY: number;
  rot: number;
  url: string;
  label: string;
};

function rastgele(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function yerler(n: number): Bit[] {
  return Array.from({ length: n }, (_, i) => {
    const aci = (i / Math.max(1, n)) * Math.PI * 2;
    const r = n === 1 ? 0 : 10 + (i % 4) * 4;
    return {
      id: i,
      x: 50 + Math.cos(aci) * r,
      y: 46 + Math.sin(aci) * r * 0.72,
      fromX: rastgele(-360, 360),
      fromY: rastgele(-280, 280),
      burstX: Math.cos(aci) * rastgele(220, 520),
      burstY: Math.sin(aci) * rastgele(180, 420),
      rot: rastgele(-110, 110),
      url: "",
      label: "",
    };
  });
}

export default function EmoteComboWidget({ config }: Props) {
  const isPreview = Boolean(config._previewMode);
  const burstScale = Number(config.burstScale) || 1.6;
  const opacity = Number(config.opacity ?? 1);
  const scale = Math.min(3, Math.max(0.5, Number(config.scale) || 1));
  const bekleme = Math.max(1500, Number(config.showMs) || 4000);

  const [gorsel, setGorsel] = useState("");
  const [sayi, setSayi] = useState(0);
  const [boom, setBoom] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  const clearTimer = useRef<number | undefined>(undefined);
  const bumpRef = useRef<(next: ComboView) => void>(() => {});

  const bump = (next: ComboView) => {
    if (next.count < 3) return;
    setGorsel(next.url);
    setSayi(next.count);
    setBoom(false);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setBoom(true);
      clearTimer.current = window.setTimeout(() => {
        setSayi(0);
        setBoom(false);
      }, 760);
    }, bekleme);
  };
  bumpRef.current = bump;

  useEffect(() => {
    if (isPreview) return;
    let ws: WebSocket | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(overlaySyncWsUrl());
      } catch {
        retry = window.setTimeout(connect, 2200);
        return;
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data)) as Record<string, unknown>;
          if (msg.type !== "emote_combo_updated") return;
          const count = Number(msg.count) || 0;
          const label = String(
            msg.label || msg.emoteId || msg.emote_id || "Emote"
          );
          const url = String(msg.emoteUrl || msg.emote_url || "");
          bumpRef.current({ label, url, count });
        } catch {
          /* */
        }
      };
      ws.onclose = () => {
        if (!closed) retry = window.setTimeout(connect, 2200);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      try {
        ws?.close();
      } catch {
        /* */
      }
    };
  }, [isPreview]);

  const { subscribe } = useWidgetSync({ kinds: ["chat", "emotecombo"] });
  useEffect(() => {
    if (isPreview) return;
    return subscribe((ev: WidgetSyncEvent) => {
      if (ev.kind === "emotecombo") {
        const raw = (ev.raw || {}) as Record<string, unknown>;
        const nested = (raw.meta && typeof raw.meta === "object" ? raw.meta : {}) as Record<string, unknown>;
        const label = String(nested.emote || ev.message || raw.label || "Emote").split(" ")[0];
        const count = Number(nested.count || raw.count) || 0;
        const url = String(nested.url || nested.emoteUrl || raw.emoteUrl || raw.emote_url || "");
        bumpRef.current({ label, url, count });
      }
    });
  }, [subscribe, isPreview]);

  const adet = sayi >= 3 ? Math.min(6, sayi - 2) : 0;
  const konum = useMemo(() => (adet ? yerler(boom ? 8 : adet) : []), [adet, boom]);

  if (sayi < 3) {
    return <div className="studio-widget-root h-full w-full bg-transparent" style={{ opacity }} />;
  }
  const buyume = Math.min(2.8, 1 + (sayi - 3) * 0.2) * Math.min(burstScale, 2);
  const px = Math.round(76 * buyume);

  return (
    <div
      className="studio-widget-root relative h-full w-full overflow-visible bg-transparent"
      style={{ opacity, transform: `scale(${scale})`, transformOrigin: "center" }}
    >
      {konum.map((b) => (
        <motion.div
          key={b.id}
          className="absolute"
          style={{ left: "50%", top: "46%", width: px, height: px, marginLeft: -px / 2, marginTop: -px / 2 }}
          initial={{ opacity: 0, x: b.fromX, y: b.fromY, scale: 0.4 }}
          animate={
            boom
              ? { opacity: 0, x: b.burstX, y: b.burstY, scale: 1.2, rotate: b.rot }
              : { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }
          }
          transition={{ duration: boom ? 0.75 : 0.35, ease: "easeOut" }}
        >
          {gorsel ? (
            <img src={gorsel} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,.85)]" />
          ) : null}
        </motion.div>
      ))}
    </div>
  );
}
