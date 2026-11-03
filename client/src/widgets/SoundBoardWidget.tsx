/**
 * AxBoT — Ses/Video Panosu katmanı (tarayıcı kaynağı: /widgets/pano)
 * Developed by AxthrowA
 *
 * Sunucu sıradaki isteği gönderir (`pano_oynat`); katman yayıncının kendi ses/videosunu oynatır, sesle birlikte
 * görsel/GIF ve "kim → ne" yazısını gösterir, bitince (ya da süre sınırında) `pano_bitti` bildirir. Sunucu
 * `pano_durdur` gönderirse (atla) hemen keser. Önizleme kipinde (?preview=1) örnek kutu gösterir, ses çalmaz.
 */
import { useEffect, useRef, useState } from 'react';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { konumStili, type PanoGorunum } from '../lib/pano.js';

interface Istek {
  id: string;
  ad: string;
  tur: 'audio' | 'video';
  medyaUrl: string;
  gorselUrl: string | null;
  ses: number;
  sureSn: number;
  kullanici: string;
}

const VARSAYILAN_GORUNUM: PanoGorunum = { konum: 'orta', genislikYuzde: 40, adGoster: true };

export function SoundBoardWidget({ previewMode = false }: { previewMode?: boolean }) {
  const onizleme = onizlemeKipi(previewMode);
  const [istek, setIstek] = useState<Istek | null>(null);
  const [gorunum, setGorunum] = useState<PanoGorunum>(VARSAYILAN_GORUNUM);
  const ws = useRef<WebSocket | null>(null);
  const ses = useRef<HTMLAudioElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const sinir = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calan = useRef<string | null>(null);

  const bitir = (id: string) => {
    if (calan.current !== id) return;
    calan.current = null;
    if (sinir.current) clearTimeout(sinir.current);
    setIstek(null);
    try {
      ws.current?.send(JSON.stringify({ action: 'pano_bitti', id }));
    } catch {
      /* bağlantı yoksa sunucu süre sınırında ilerler */
    }
  };

  useEffect(() => {
    if (onizleme) {
      setIstek({ id: 'onizleme', ad: 'Örnek ses', tur: 'audio', medyaUrl: '', gorselUrl: null, ses: 0, sureSn: 5, kullanici: 'İzleyici' });
      return;
    }
    let kapandi = false;
    let bekle = 1000;
    let yeniden: ReturnType<typeof setTimeout> | null = null;
    const baglan = () => {
      const s = new WebSocket(wsAdresi('pano'));
      ws.current = s;
      s.onopen = () => (bekle = 1000);
      s.onmessage = (e) => {
        let m: any;
        try {
          m = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (m.type === 'pano_oynat' && m.oge) {
          if (m.gorunum) setGorunum(m.gorunum);
          calan.current = m.oge.id;
          setIstek(m.oge);
          if (sinir.current) clearTimeout(sinir.current);
          const id = m.oge.id;
          sinir.current = setTimeout(() => bitir(id), Math.max(1, Number(m.oge.sureSn) || 15) * 1000);
        } else if (m.type === 'pano_durdur' && m.id === calan.current) {
          bitir(m.id);
        }
      };
      s.onclose = () => {
        ws.current = null;
        if (kapandi) return;
        yeniden = setTimeout(baglan, bekle);
        bekle = Math.min(bekle * 2, 10000);
      };
    };
    baglan();
    return () => {
      kapandi = true;
      if (yeniden) clearTimeout(yeniden);
      if (sinir.current) clearTimeout(sinir.current);
      ws.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onizleme]);

  // Yeni istek: ses düzeyi ve oynatma
  useEffect(() => {
    if (!istek || onizleme) return;
    const el = istek.tur === 'video' ? video.current : ses.current;
    if (!el) return;
    el.volume = Math.min(1, Math.max(0, istek.ses / 100));
    el.currentTime = 0;
    void el.play().catch(() => bitir(istek.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [istek?.id]);

  if (!istek) return <div className="fixed inset-0 bg-transparent" />;
  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent pointer-events-none" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="absolute flex flex-col items-center gap-2" style={konumStili(gorunum)}>
        {istek.tur === 'video' ? (
          <video
            ref={video}
            src={istek.medyaUrl || undefined}
            className="w-full rounded-xl shadow-2xl"
            playsInline
            onEnded={() => bitir(istek.id)}
            onError={() => bitir(istek.id)}
          />
        ) : (
          <>
            {istek.gorselUrl && <img src={istek.gorselUrl} alt="" className="w-full rounded-xl object-contain shadow-2xl" />}
            {istek.medyaUrl && <audio ref={ses} src={istek.medyaUrl} onEnded={() => bitir(istek.id)} onError={() => bitir(istek.id)} />}
          </>
        )}
        {gorunum.adGoster && (
          <div
            className="rounded-full bg-black/70 px-4 py-1.5 text-center text-lg font-extrabold text-white"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,.8)' }}
          >
            {istek.kullanici} <span className="text-cyan-300">▶</span> {istek.ad}
          </div>
        )}
      </div>
    </div>
  );
}

export default SoundBoardWidget;
