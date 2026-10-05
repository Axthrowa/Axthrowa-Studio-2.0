/**
 * Canlı önizleme videosu: motorun H.264 akışını (`/ws/motor` ikili iletileri) tarayıcının donanım çözücüsüyle
 * (WebCodecs) doğrudan bir tuvale çizer. Kendi WebSocket bağlantısını açar ve React durumuna dokunmaz — kareler
 * çalışma alanını yeniden çizdirmez. Boyut, kutunun gerçek piksel boyutudur (değişince motor yeniden kodlar).
 * Çözücü kurulamazsa `onDesteksiz` çağrılır; çağıran JPEG/PNG yoluna döner.
 */
import { useEffect, useRef } from "react";
import { canliAdres } from "../../lib/motorCanli";
import { avcKodek, cerceveCoz, istenenBoyut } from "../../lib/canliVideo";

export function CanliVideo({ tuval, className, onDesteksiz }: { tuval: string; className?: string; onDesteksiz?: () => void }) {
  const tuvalEl = useRef<HTMLCanvasElement>(null);
  const desteksiz = useRef(onDesteksiz);
  desteksiz.current = onDesteksiz;

  useEffect(() => {
    const cv = tuvalEl.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;
    let ws: WebSocket | null = null;
    let kapandi = false;
    let bekleme = 500;
    let yeniden: number | undefined;
    let cozucu: VideoDecoder | null = null;
    let boyut = "";
    let anahtarBekle = true;
    let hata = 0;
    let istek: [number, number] | null = null;
    let istekZamani: number | undefined;
    // Tanı: tuval özniteliklerinde bağlantı durumu, istenen boyut, alınan/çizilen kare sayısı (saniyede bir)
    let alinan = 0;
    let cizilen = 0;
    const tani = window.setInterval(() => {
      olc();
      cv.dataset.durum = ws?.readyState === WebSocket.OPEN ? "bagli" : "bagli-degil";
      cv.dataset.istek = istek ? istek.join("x") : "";
      cv.dataset.alinan = String(alinan);
      cv.dataset.cizilen = String(cizilen);
    }, 1000);

    const cozucuKur = (kodek: string) => {
      try {
        cozucu?.close();
      } catch {
        /* zaten kapalı */
      }
      cozucu = new VideoDecoder({
        output: (f) => {
          if (cv.width !== f.displayWidth || cv.height !== f.displayHeight) {
            cv.width = f.displayWidth;
            cv.height = f.displayHeight;
          }
          ctx.drawImage(f, 0, 0);
          f.close();
          hata = 0;
          cizilen++;
        },
        error: () => {
          cozucu = null;
          anahtarBekle = true;
          if (++hata >= 3) desteksiz.current?.();
        },
      });
      cozucu.configure({ codec: kodek, optimizeForLatency: true, hardwareAcceleration: "prefer-hardware" });
    };

    const aboneligiGonder = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const gizli = document.visibilityState === "hidden";
      const ileti = JSON.stringify({ video: gizli || !istek ? null : { tuval, genislik: istek[0], yukseklik: istek[1] } });
      ws.send(ileti);
      cv.dataset.abonelik = ileti;
    };

    const baglan = () => {
      ws = new WebSocket(canliAdres());
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        bekleme = 500;
        aboneligiGonder();
      };
      ws.onmessage = (e) => {
        if (!(e.data instanceof ArrayBuffer)) return;
        const c = cerceveCoz(e.data);
        if (!c || c.tuval !== tuval) return;
        alinan++;
        const b = `${c.genislik}x${c.yukseklik}`;
        if (b !== boyut) {
          boyut = b;
          anahtarBekle = true;
        }
        if (anahtarBekle) {
          if (!c.anahtar) return;
          const kodek = avcKodek(c.veri);
          if (!kodek) return;
          try {
            cozucuKur(kodek);
          } catch {
            desteksiz.current?.();
            return;
          }
          anahtarBekle = false;
        }
        if (!cozucu) return;
        // Çözücü çok geride kaldıysa bir sonraki anahtar kareye atla (gecikme birikmesin)
        if (cozucu.decodeQueueSize > 6 && !c.anahtar) {
          anahtarBekle = true;
          return;
        }
        try {
          cozucu.decode(new EncodedVideoChunk({ type: c.anahtar ? "key" : "delta", timestamp: c.pts, data: c.veri }));
        } catch {
          anahtarBekle = true;
        }
      };
      ws.onclose = () => {
        ws = null;
        if (kapandi) return;
        yeniden = window.setTimeout(baglan, bekleme);
        bekleme = Math.min(bekleme * 2, 8000);
      };
      ws.onerror = () => ws?.close();
    };

    // Kutunun piksel boyutu değişince (300 ms durulunca) yeni boyut istenir. İlk ölçüm hemen yapılır; ResizeObserver
    // çizim adımına bağlı olduğundan (pencere çizilmiyorsa geri çağrı gelmez) boyut saniyede bir de denetlenir.
    const olc = () => {
      const r = cv.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const yeni = istenenBoyut(r.width, r.height, window.devicePixelRatio || 1);
      if (istek && Math.abs(istek[0] - yeni[0]) < 16 && Math.abs(istek[1] - yeni[1]) < 16) return;
      window.clearTimeout(istekZamani);
      istekZamani = window.setTimeout(
        () => {
          istek = yeni;
          aboneligiGonder();
        },
        istek ? 300 : 0
      );
    };
    const ro = new ResizeObserver(olc);
    ro.observe(cv);
    olc();
    const gorunurluk = () => aboneligiGonder();
    document.addEventListener("visibilitychange", gorunurluk);
    baglan();
    return () => {
      kapandi = true;
      window.clearInterval(tani);
      ro.disconnect();
      document.removeEventListener("visibilitychange", gorunurluk);
      window.clearTimeout(yeniden);
      window.clearTimeout(istekZamani);
      ws?.close();
      try {
        cozucu?.close();
      } catch {
        /* */
      }
    };
  }, [tuval]);

  return <canvas ref={tuvalEl} className={className} />;
}
