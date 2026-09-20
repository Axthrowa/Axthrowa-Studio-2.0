import { useEffect, useRef } from "react";

/**
 * Bir `<audio>` öğesi için Web Audio grafiği **yalnızca bir kez** kurulabilir:
 * aynı öğe için ikinci `createMediaElementSource` çağrısı hata verir ve ses
 * ölü bir grafiğe bağlı kaldığı için tamamen susar. Sekme değiştikçe bileşen
 * yeniden monte olduğundan, kaynak düğümünü öğe başına önbelleğe alıyor ve
 * paylaşılan AudioContext'i asla kapatmıyoruz.
 */
const GRAPHS = new WeakMap<HTMLAudioElement, { analyser: AnalyserNode }>();
let sharedCtx: AudioContext | null = null;

function graphFor(audio: HTMLAudioElement): AnalyserNode | null {
  const cached = GRAPHS.get(audio);
  if (cached) return cached.analyser;
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AudioContext();
    }
    const analyser = sharedCtx.createAnalyser();
    analyser.fftSize = 64;
    const source = sharedCtx.createMediaElementSource(audio);
    source.connect(analyser);
    // Analiz düğümü çıkışa da bağlanmalı, yoksa ses duyulmaz.
    analyser.connect(sharedCtx.destination);
    GRAPHS.set(audio, { analyser });
    return analyser;
  } catch {
    // Otomatik oynatma ilkesi ya da CORS — görselleştirici sessizce kapanır,
    // ses normal yoldan çalmaya devam eder.
    return null;
  }
}

export default function AudioVisualizer({
  audio,
  bars = 20,
}: {
  /** Canlı `<audio>` öğesi (ref değil — öğe monte olunca efekt yeniden çalışsın) */
  audio: HTMLAudioElement | null;
  bars?: number;
}) {
  const barsRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    if (!audio) return;
    const analyser = graphFor(audio);
    if (!analyser) return;

    // Tarayıcı bağlamı kullanıcı etkileşimine kadar askıya alabiliyor.
    if (sharedCtx?.state === "suspended") void sharedCtx.resume().catch(() => {});

    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = Math.max(1, Math.floor(data.length / bars));
    // Her karede 20 satır içi `height` yazmak yerleşimi yeniden hesaplatıyor.
    // Çubuklar için 30 fps gözle ayırt edilmiyor, maliyeti yarısı.
    const FRAME_MS = 1000 / 30;
    // Son yazılan yükseklikler — değişmeyen çubuğa dokunmayınca yerleşim
    // sessiz parçalarda tamamen duruyor.
    const last = new Array<number>(bars).fill(-1);
    let raf = 0;
    let lastTs = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - lastTs < FRAME_MS - 1) return;
      lastTs = now;
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < bars; i++) {
        const el = barsRef.current[i];
        if (!el) continue;
        const v = data[i * step] || 0;
        const px = Math.round(Math.max(4, (v / 255) * 64));
        if (px === last[i]) continue;
        last[i] = px;
        el.style.height = `${px}px`;
      }
    };
    raf = requestAnimationFrame(tick);

    // Pencere tepsideyken analiz yapmanın anlamı yok.
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        lastTs = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      // Kaynak düğümü ve bağlam bilerek açık bırakılır — kapatmak öğeyi
      // kalıcı olarak susturur.
    };
  }, [audio, bars]);

  return (
    <div className="visualizer">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}
