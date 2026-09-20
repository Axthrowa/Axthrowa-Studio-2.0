import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  /** Görünmezken korunacak yükseklik — kaydırma çubuğu zıplamasın. */
  minHeight?: number;
  /** Görünür alandan bu kadar uzaktayken de hazır tutulur. */
  rootMargin?: string;
  /**
   * Ekrandan çıktıktan bu kadar sonra sökülür. Kısa kaydırmalarda oynatıcının
   * durumu kaybolmasın diye bekliyoruz.
   */
  unmountDelayMs?: number;
  children: ReactNode;
};

/**
 * Çocuklarını yalnızca ekranda görünürken canlı tutar.
 *
 * Panel tek uzun sütun; alt sekme yok. Bu yüzden video kırpma önizlemeleri
 * kullanıcı onlara hiç bakmasa bile ayakta kalıyordu — YouTube'unki tam bir
 * oynatıcı ve WebView2'nin site yalıtımı yüzünden kendi işlemcisinde
 * ~150 MB yer tutuyor, yerel olan ise sürekli kare çözüyor. Görünmeyeni
 * söküp bu maliyeti tamamen kaldırıyoruz.
 */
export default function LazyMount({
  minHeight = 120,
  rootMargin = "300px",
  unmountDelayMs = 20_000,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Desteklenmeyen bir ortamda özelliği tamamen kapatmak yerine her zaman
    // gösteriyoruz: eski davranışa dönmek, bileşeni hiç göstermemekten iyi.
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }

    const iptalZamanlayici = () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const gozlemci = new IntersectionObserver(
      ([giris]) => {
        if (giris.isIntersecting) {
          iptalZamanlayici();
          setMounted(true);
        } else {
          iptalZamanlayici();
          timer.current = window.setTimeout(() => setMounted(false), unmountDelayMs);
        }
      },
      { rootMargin }
    );
    gozlemci.observe(el);
    return () => {
      iptalZamanlayici();
      gozlemci.disconnect();
    };
  }, [rootMargin, unmountDelayMs]);

  return (
    <div ref={ref} style={mounted ? undefined : { minHeight }}>
      {mounted ? children : null}
    </div>
  );
}
