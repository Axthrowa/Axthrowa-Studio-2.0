/**
 * Özel pencere başlığı (tauri.conf.json `decorations: false`). Şeridin boş yeri pencereyi sürükler
 * (`data-tauri-drag-region`; çift tık büyütür/küçültür), sağda küçült / büyüt / kapat.
 * Kapat, işletim sisteminin X'i gibi `CloseRequested` gönderir: uygulamanın "tepsiye küçült / kapat"
 * sorusu (close_prompt) aynen çalışır. Yalnız masaüstü uygulamasında çizilir (tarayıcıdaki panelde yok).
 * Tauri 2: `appWindow` kaldırıldı, `getCurrentWindow()` kullanılır.
 */
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Broadcast, Copy, Minus, Square, X } from "@phosphor-icons/react";

const DUGME =
  "flex h-full w-12 items-center justify-center bg-transparent text-zinc-400 transition-colors duration-200 focus-visible:outline-none focus-visible:bg-zinc-800/70";

export default function PencereBasligi() {
  const masaustu = isTauri();
  const [buyuk, setBuyuk] = useState(false);

  // Büyüt simgesi pencerenin gerçek durumunu göstersin (çift tık, Win+Yukarı ile de değişir)
  useEffect(() => {
    if (!masaustu) return;
    const w = getCurrentWindow();
    let birak: (() => void) | undefined;
    void w.isMaximized().then(setBuyuk).catch(() => {});
    void w
      .onResized(() => void w.isMaximized().then(setBuyuk).catch(() => {}))
      .then((f) => (birak = f))
      .catch(() => {});
    return () => birak?.();
  }, [masaustu]);

  if (!masaustu) return null;
  const w = () => getCurrentWindow();

  return (
    <div data-tauri-drag-region className="flex h-12 w-full shrink-0 select-none items-center justify-between border-b border-white/5 bg-axthrowa-dark">
      {/* Marka: kendisi de sürükleme alanı (yazının üstünden tutunca da pencere kayar) */}
      <div data-tauri-drag-region className="flex h-full items-center gap-2.5 pl-4">
        <span data-tauri-drag-region className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-axthrowa-violet to-axthrowa-cyan text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
          <Broadcast weight="bold" className="pointer-events-none h-3.5 w-3.5" />
        </span>
        <span data-tauri-drag-region className="text-[13px] font-semibold tracking-wide text-zinc-200">
          AxthrowA Studio <span className="font-normal text-zinc-500">{__YYA_SURUM__}</span>
        </span>
      </div>

      {/* Pencere düğmeleri: sürükleme alanı DEĞİL, tıklama sürüklemeye dönüşmez */}
      <div className="flex h-full items-stretch">
        <button type="button" className={`${DUGME} hover:bg-zinc-800/70 hover:text-zinc-100`} aria-label="Küçült" title="Küçült" onClick={() => void w().minimize()}>
          <Minus weight="bold" className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`${DUGME} hover:bg-zinc-800/70 hover:text-zinc-100`}
          aria-label={buyuk ? "Önceki boyut" : "Büyüt"}
          title={buyuk ? "Önceki boyut" : "Büyüt"}
          onClick={() => void w().toggleMaximize()}
        >
          {buyuk ? <Copy weight="bold" className="h-3.5 w-3.5 -scale-x-100" /> : <Square weight="bold" className="h-3.5 w-3.5" />}
        </button>
        <button type="button" className={`${DUGME} hover:bg-red-500/90 hover:text-white`} aria-label="Kapat" title="Kapat" onClick={() => void w().close()}>
          <X weight="bold" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
