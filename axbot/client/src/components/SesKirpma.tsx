/** Ses adresinin yanında: sesin uzunluğu, kaçıncı saniyeden başlasın, en fazla kaç saniye çalsın ve kırpılmış hâli dinleme. */
import { useEffect, useRef, useState } from 'react';
import { kirpmaOku, kirpmaYaz } from '../lib/sesKirpma';

const sn = (v: number) => `${(Math.round(v * 10) / 10).toLocaleString('tr-TR')} sn`;

export function SesKirpma({ url, degistir }: { url: string; degistir: (yeni: string) => void }) {
  const { temiz, baslangic, sure } = kirpmaOku(url);
  const [uzunluk, setUzunluk] = useState<number | null>(null);
  const [caliyor, setCaliyor] = useState(false);
  const ses = useRef<HTMLAudioElement | null>(null);

  // Yalnız üst bilgi yüklenir: dosyanın tamamı inmez
  useEffect(() => {
    setUzunluk(null);
    if (!temiz) return;
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => setUzunluk(Number.isFinite(a.duration) ? a.duration : null);
    a.src = temiz;
    return () => {
      a.onloadedmetadata = null;
      a.removeAttribute('src');
      a.load();
    };
  }, [temiz]);

  const durdur = () => {
    ses.current?.pause();
    ses.current = null;
    setCaliyor(false);
  };
  useEffect(() => durdur, [url]);

  const dinle = () => {
    if (caliyor) return durdur();
    const a = new Audio(temiz);
    a.volume = 0.6;
    a.currentTime = baslangic;
    // Bitişi tarayıcıya bırakmadan burada da uygula: önizleme widget'la aynı yerde kesilsin
    a.ontimeupdate = () => {
      if (sure && a.currentTime >= baslangic + sure) durdur();
    };
    a.onended = durdur;
    ses.current = a;
    setCaliyor(true);
    a.play().catch(durdur);
  };

  if (!temiz) return null;
  const alan = 'w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white';
  const kalan = uzunluk === null ? null : Math.max(0, uzunluk - baslangic);
  const caldigi = kalan === null ? null : sure ? Math.min(sure, kalan) : kalan;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
      <span>{uzunluk === null ? 'Uzunluk okunamadı' : `Ses: ${sn(uzunluk)}`}</span>
      <label className="flex items-center gap-1">
        Başla
        <input
          type="number"
          min={0}
          max={uzunluk ?? undefined}
          step={0.5}
          value={baslangic}
          aria-label="Sesin başlayacağı saniye"
          className={alan}
          onChange={(e) => degistir(kirpmaYaz(url, Number(e.target.value), sure))}
        />
        sn
      </label>
      <label className="flex items-center gap-1">
        En fazla
        <input
          type="number"
          min={0}
          step={0.5}
          value={sure}
          aria-label="En fazla çalma süresi (0 sonuna kadar)"
          className={alan}
          onChange={(e) => degistir(kirpmaYaz(url, baslangic, Number(e.target.value)))}
        />
        sn (0 = sonuna kadar)
      </label>
      <button type="button" onClick={dinle} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white hover:bg-white/10">
        {caliyor ? 'Durdur' : 'Dinle'}
      </button>
      {uzunluk !== null && baslangic >= uzunluk ? (
        <span role="alert" className="text-amber-300">Başlangıç sesin sonundan sonra: ses hiç çalmaz</span>
      ) : caldigi !== null ? (
        <span>Çalacağı süre: {sn(caldigi)}</span>
      ) : null}
    </div>
  );
}
