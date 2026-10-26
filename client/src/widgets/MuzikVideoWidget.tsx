/**
 * StreamAxT — Şarkı Klipleri widget'ı
 * Developed by AxthrowA
 *
 * `!sr` istekleri (Şarkı İstekleri → "OBS Şarkı Klipleri" kipi) YouTube'da
 * bulunur ve burada video olarak sırayla oynar. Video bitince ya da gömme
 * kapalıysa sunucuya "bitti" denir, sıradaki istek başlar. Sunucu yalnız
 * hâlâ çalan şarkıyı geçirir: iki OBS kaynağı aynı şarkıyı iki kez atlatmaz.
 */
import { useEffect, useRef, useState } from 'react';
import { onizlemeKipi } from '../lib/widget-style.js';

interface Istek {
  id: string;
  title: string;
  url: string;
  requestedBy: string;
}

/** YouTube adresinden video kimliği (music.youtube.com dahil) */
export function videoKimligi(url: string): string {
  return String(url || '').match(/(?:[?&]v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiSozu: Promise<any> | null = null;
function youtubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiSozu ??= new Promise((coz) => {
    const onceki = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      onceki?.();
      coz(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiSozu;
}

export function MuzikVideoWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const onizleme = onizlemeKipi(previewMode);
  const [istek, setIstek] = useState<Istek | null>(null);
  const kutu = useRef<HTMLDivElement>(null);
  const oynatici = useRef<any>(null);
  const calan = useRef('');
  const bitirRef = useRef<() => Promise<unknown>>(async () => {});
  const params = new URLSearchParams(window.location.search);
  const ses = Math.max(0, Math.min(100, Number(params.get('volume') ?? 70)));
  const bilgi = params.get('info') !== '0';

  // Sıradaki istek: 3 sn'de bir (istek gelince en geç 3 sn'de başlar)
  useEffect(() => {
    if (onizleme) return;
    let iptal = false;
    const cek = () =>
      fetch('/api/songrequest/current?video=1')
        .then((r) => r.json())
        .then((d) => {
          if (iptal) return;
          setIstek(d && videoKimligi(d.url) ? { id: d.id, title: d.title, url: d.url, requestedBy: d.requestedBy } : null);
        })
        .catch(() => {});
    cek();
    const t = setInterval(cek, 3000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, [onizleme]);

  // İstek değişince oynatıcıyı kur / videoyu değiştir
  useEffect(() => {
    if (onizleme || !istek || calan.current === istek.id) return;
    calan.current = istek.id;
    const vid = videoKimligi(istek.url);
    const bitir = () =>
      fetch('/api/songrequest/bitti', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: istek.id })
      }).catch(() => {});
    void youtubeApi().then((YT) => {
      if (oynatici.current) {
        oynatici.current.loadVideoById(vid);
        return;
      }
      if (!kutu.current) return;
      oynatici.current = new YT.Player(kutu.current, {
        videoId: vid,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(ses);
            e.target.playVideo();
          },
          // 0 = bitti
          onStateChange: (e: any) => e.data === 0 && void bitirRef.current(),
          // Gömme kapalı / video yok: 2 sn sonra sıradakine
          onError: () => setTimeout(() => void bitirRef.current(), 2000)
        }
      });
    });
    bitirRef.current = bitir;
  }, [istek, onizleme, ses]);

  // Kuyruk boşaldı: son klip ekranda/seste kalmasın
  useEffect(() => {
    if (istek) return;
    calan.current = '';
    oynatici.current?.stopVideo?.();
  }, [istek]);

  const boyut = embedded ? { width: '100%', height: '100%' } : { width: '100vw', height: '100vh' };

  if (onizleme) {
    return (
      <div style={{ ...boyut, position: 'relative', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#666', fontSize: 28 }}>▶ YouTube klibi</div>
        <Bilgi baslik="Teoman — Paramparça" kim="ornekIzleyici" />
      </div>
    );
  }

  return (
    <div style={{ ...boyut, position: 'relative', background: 'transparent', visibility: istek ? 'visible' : 'hidden' }}>
      <div ref={kutu} style={{ width: '100%', height: '100%' }} />
      {istek && bilgi && <Bilgi baslik={istek.title} kim={istek.requestedBy} />}
    </div>
  );
}

function Bilgi({ baslik, kim }: { baslik: string; kim: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 16,
        bottom: 16,
        maxWidth: '80%',
        padding: '8px 14px',
        borderRadius: 10,
        background: 'rgba(0,0,0,.65)',
        color: '#fff',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        textShadow: '0 1px 4px #000'
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🎵 {baslik}</div>
      <div style={{ fontSize: 14, opacity: 0.8 }}>İsteyen: {kim}</div>
    </div>
  );
}

export default MuzikVideoWidget;
