import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, okJson } from "./api";

/** Sunucudaki `ytdl::Phase` ile birebir. */
export type DownloadPhase =
  | "bos"
  | "araclar"
  | "indiriliyor"
  | "birlestiriliyor"
  | "bitti"
  | "hata"
  | "iptal";

export type VideoDownload = {
  phase: DownloadPhase;
  url: string;
  /** 0..100; bilinmiyorsa -1 */
  percent: number;
  message: string;
  file: string | null;
};

const BOS: VideoDownload = { phase: "bos", url: "", percent: -1, message: "", file: null };

/** İş bitti mi — bittiyse bağlantıyı boşuna açık tutmuyoruz. */
function bittiMi(p: DownloadPhase) {
  return p === "bos" || p === "bitti" || p === "hata" || p === "iptal";
}

function normalize(raw: unknown): VideoDownload {
  const d = (raw ?? {}) as Partial<VideoDownload>;
  return {
    phase: (d.phase as DownloadPhase) || "bos",
    url: typeof d.url === "string" ? d.url : "",
    percent: typeof d.percent === "number" ? d.percent : -1,
    message: typeof d.message === "string" ? d.message : "",
    file: typeof d.file === "string" ? d.file : null,
  };
}

/**
 * YouTube arka planının yerele indirilmesini yürütür ve ilerlemeyi izler.
 *
 * WebSocket yalnızca iş sürerken açık kalıyor. Panel günün büyük kısmını
 * boşta geçirdiği için sürekli açık bir bağlantı, sırf bu özellik uğruna
 * gereksiz bir soket ve düzenli çerçeve trafiği demekti.
 */
export function useVideoDownload(onBitti?: (dosya: string) => void) {
  const [durum, setDurum] = useState<VideoDownload>(BOS);
  const wsRef = useRef<WebSocket | null>(null);
  // Etkin callback'i ref'te tutuyoruz: değişmesi bağlantıyı koparmasın.
  const bittiRef = useRef(onBitti);
  bittiRef.current = onBitti;

  const kapat = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch {
      /* zaten kapalı */
    }
    wsRef.current = null;
  }, []);

  const baglan = useCallback(() => {
    if (wsRef.current) return;
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/ws/overlay-sync`);
    } catch {
      return;
    }
    wsRef.current = sock;
    sock.onmessage = (ev) => {
      let veri: any;
      try {
        veri = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (veri?.type !== "video-download") return;
      const yeni = normalize(veri);
      setDurum(yeni);
      if (bittiMi(yeni.phase)) {
        if (yeni.phase === "bitti" && yeni.file) bittiRef.current?.(yeni.file);
        kapat();
      }
    };
    sock.onclose = () => {
      if (wsRef.current === sock) wsRef.current = null;
    };
  }, [kapat]);

  // Panel indirme sürerken yeniden açılmış olabilir; devam eden işi yakala.
  useEffect(() => {
    let iptal = false;
    fetch(`${API_BASE}/api/videos/download`)
      .then(okJson)
      .then((d) => {
        if (iptal) return;
        const mevcut = normalize(d);
        setDurum(mevcut);
        if (!bittiMi(mevcut.phase)) baglan();
      })
      .catch(() => {});
    return () => {
      iptal = true;
      kapat();
    };
  }, [baglan, kapat]);

  const indir = useCallback(
    async (url: string) => {
      setDurum({ phase: "araclar", url, percent: -1, message: "Başlatılıyor…", file: null });
      baglan();
      try {
        const res = await fetch(`${API_BASE}/api/videos/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) {
          const metin = await res.text().catch(() => "");
          setDurum({
            phase: "hata",
            url,
            percent: -1,
            message: metin || "İndirme başlatılamadı",
            file: null,
          });
          kapat();
        }
      } catch {
        setDurum({ phase: "hata", url, percent: -1, message: "Sunucuya ulaşılamadı", file: null });
        kapat();
      }
    },
    [baglan, kapat]
  );

  const iptalEt = useCallback(() => {
    void fetch(`${API_BASE}/api/videos/download/cancel`, { method: "POST" }).catch(() => {});
  }, []);

  const temizle = useCallback(() => setDurum(BOS), []);

  return { durum, indir, iptalEt, temizle };
}
