/**
 * `/ws/motor` canlı akışı: ses seviyeleri (20 Hz) ve önizleme kareleri (JPEG). Motor ancak bir abone varken üretir;
 * bağlantı koparsa artan aralıkla yeniden bağlanır. Yalnız yerel bağlantı kabul edilir (sunucu uzaktan reddeder):
 * uzaktan açılan panelde kareler `/api/motor/onizleme` yoklamasıyla gelir.
 */
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "./api";
import type { MotorSeviye } from "./api/motor";

export type CanliAbonelik = { seviye: boolean; kare: { tuval: string; genislik: number; fps: number } | null };

export function canliAdres(taban = API_BASE): string {
  const kok = taban || (typeof location !== "undefined" ? location.origin : "http://127.0.0.1");
  return `${kok.replace(/^http/, "ws")}/ws/motor`;
}

/** Motor satırını çözümler (yalnız bu iki olay) */
export function canliSatir(m: string): { tur: "kare"; tuval: string; jpeg: string } | { tur: "seviyeler"; seviyeler: MotorSeviye[] } | null {
  try {
    const v = JSON.parse(m) as { olay?: string; tuval?: string; jpeg?: string; seviyeler?: MotorSeviye[] };
    if (v.olay === "kare" && typeof v.tuval === "string" && typeof v.jpeg === "string") return { tur: "kare", tuval: v.tuval, jpeg: v.jpeg };
    if (v.olay === "seviyeler" && Array.isArray(v.seviyeler)) return { tur: "seviyeler", seviyeler: v.seviyeler };
  } catch {
    /* bozuk satır yok sayılır */
  }
  return null;
}

/**
 * Canlı akışa abone olur. `etkin` false iken bağlanmaz. Seviyeler bir ref'te tutulur (20 Hz yeniden çizimi
 * bileşen kendisi `requestAnimationFrame` ile yapar); kare durumu yalnız yeni kare gelince değişir.
 */
export function useMotorCanli(etkin: boolean, abonelik: CanliAbonelik) {
  const seviyeler = useRef<Map<string, MotorSeviye>>(new Map());
  const [kare, setKare] = useState<{ tuval: string; url: string } | null>(null);
  const [bagli, setBagli] = useState(false);
  const soket = useRef<WebSocket | null>(null);
  const abonelikMetni = JSON.stringify(abonelik);
  const sonAbonelik = useRef(abonelikMetni);
  sonAbonelik.current = abonelikMetni;

  useEffect(() => {
    if (!etkin) return;
    let kapandi = false;
    let bekleme = 500;
    let zamanlayici: number | undefined;
    const baglan = () => {
      const ws = new WebSocket(canliAdres());
      soket.current = ws;
      ws.onopen = () => {
        bekleme = 500;
        setBagli(true);
        ws.send(sonAbonelik.current);
      };
      ws.onmessage = (e) => {
        if (typeof e.data !== "string") return;
        const s = canliSatir(e.data);
        if (!s) return;
        if (s.tur === "seviyeler") {
          const m = new Map<string, MotorSeviye>();
          for (const x of s.seviyeler) m.set(x.id, x);
          seviyeler.current = m;
        } else {
          setKare({ tuval: s.tuval, url: `data:image/jpeg;base64,${s.jpeg}` });
        }
      };
      ws.onclose = () => {
        setBagli(false);
        soket.current = null;
        if (kapandi) return;
        zamanlayici = window.setTimeout(baglan, bekleme);
        bekleme = Math.min(bekleme * 2, 8000);
      };
      ws.onerror = () => ws.close();
    };
    baglan();
    return () => {
      kapandi = true;
      window.clearTimeout(zamanlayici);
      soket.current?.close();
      soket.current = null;
      setBagli(false);
      seviyeler.current = new Map();
    };
  }, [etkin]);

  // Abonelik değişince (tuval, boyut) açık bağlantıya bildirilir
  useEffect(() => {
    const ws = soket.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(abonelikMetni);
  }, [abonelikMetni]);

  return { seviyeler, kare, bagli };
}
