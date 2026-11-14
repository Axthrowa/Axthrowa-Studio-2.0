/** Y13: canlı altyazı katmanı. Panelden gelen `altyazi` iletisini alt ortada gösterir; kesin satır 6 sn sonra silinir. */
import { useEffect, useState } from "react";
import { subscribeOverlaySync } from "../../lib/overlaySyncHub";

const KALMA_MS = 6000;

export default function AltyaziPage() {
  const [metin, setMetin] = useState("");

  useEffect(() => {
    document.body.style.background = "transparent";
    let sil: ReturnType<typeof setTimeout> | undefined;
    const kapat = subscribeOverlaySync({
      onMessage: (ev) => {
        let m: { type?: string; metin?: string; kesin?: boolean };
        try {
          m = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (m.type !== "altyazi") return;
        clearTimeout(sil);
        setMetin(m.metin ?? "");
        if (m.kesin) sil = setTimeout(() => setMetin(""), KALMA_MS);
      },
    });
    return () => {
      clearTimeout(sil);
      kapat();
    };
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-[6%] flex justify-center px-[8%]">
      {metin && (
        <p className="max-w-full rounded-lg bg-black/70 px-5 py-2 text-center text-[40px] font-semibold leading-tight text-white" style={{ textShadow: "0 2px 4px rgba(0,0,0,.8)" }}>
          {metin}
        </p>
      )}
    </div>
  );
}
