import { useEffect, useRef, useState } from "react";
import { baseFromUrl, streamaxtStatus } from "../../lib/streamaxt";
import { overlaySyncWsUrl } from "../../lib/widgets/useWidgetSync";

/**
 * AxBoT sesli komut dinleyicisini (`/sesli-dinleyici`) panelde gizli ve sürekli açık tutar: Bot sekmesi kapalıyken,
 * başka sekmedeyken ya da oyun oynarken de komutlar çalışır. Sesli komutlar AxBoT'ta kapalıysa sayfa mikrofonu
 * açmaz. Genel "Sesli komut: bas-konuş" kısayolu Rust'tan `sesli-ptt` olarak yayınlanır; buradan çerçeveye iletilir.
 */
export default function SesliDinleyiciCercevesi() {
  const [kok, setKok] = useState<string | null>(null);
  const cerceve = useRef<HTMLIFrameElement | null>(null);

  // AxBoT çalışıyor mu? (panel onu kendisi başlatıyor; sonradan da açılabilir)
  useEffect(() => {
    let iptal = false;
    const yokla = () =>
      streamaxtStatus()
        .then((s) => !iptal && setKok(s.running ? baseFromUrl(s.url) : null))
        .catch(() => !iptal && setKok(null));
    void yokla();
    const t = window.setInterval(yokla, 15_000);
    return () => {
      iptal = true;
      window.clearInterval(t);
    };
  }, []);

  // Genel kısayol → çerçeve
  useEffect(() => {
    if (!kok) return;
    let ws: WebSocket | null = null;
    let kapandi = false;
    let yeniden: number | undefined;
    const baglan = () => {
      ws = new WebSocket(overlaySyncWsUrl());
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data));
          if (m?.type === "sesli-ptt" && typeof m.basili === "boolean") {
            cerceve.current?.contentWindow?.postMessage({ tur: "sesli-ptt", basili: m.basili }, kok);
          }
        } catch {
          /* ilgisiz ileti */
        }
      };
      ws.onclose = () => {
        if (!kapandi) yeniden = window.setTimeout(baglan, 3000);
      };
    };
    baglan();
    return () => {
      kapandi = true;
      window.clearTimeout(yeniden);
      ws?.close();
    };
  }, [kok]);

  if (!kok) return null;
  return (
    <iframe
      ref={cerceve}
      title="Sesli komut dinleyicisi"
      aria-hidden="true"
      tabIndex={-1}
      src={`${kok}/sesli-dinleyici?otomatik=1`}
      allow="microphone; autoplay"
      // display:none değil: bazı motorlar görünmeyen çerçevede zamanlayıcıları kısıyor
      style={{ position: "fixed", width: 1, height: 1, left: -10, top: -10, opacity: 0, pointerEvents: "none", border: 0 }}
    />
  );
}
