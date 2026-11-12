/**
 * Üst şerit (32 px): pencere başlığı + durum şeridi tek satır (Stüdyo Masası). Soldan logo (marka yalnız burada),
 * ortada `children` (durum şeridi), sağda `actions` (Ctrl K, yayın düğmesi) ve pencere düğmeleri.
 * Masaüstünde (tauri.conf.json `decorations: false`) boş yerler pencereyi sürükler (`data-tauri-drag-region`;
 * çift tık büyütür/küçültür). Kapat, işletim sisteminin X'i gibi `CloseRequested` gönderir: "tepsiye küçült /
 * kapat" sorusu (close_prompt) aynen çalışır. Tarayıcıdaki panelde pencere düğmeleri çizilmez, şerit kalır.
 * Tauri 2: `appWindow` kaldırıldı, `getCurrentWindow()` kullanılır.
 */
import { useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import logo from "@/assets/logo.png";
import { useT } from "../../i18n";
import { Tooltip, cn } from "@/components/ui";

const DUGME =
  "flex h-full w-[46px] items-center justify-center bg-transparent text-ui-fg2 transition-colors duration-ui hover:bg-ui-s2 hover:text-ui-fg [&>svg]:h-3.5 [&>svg]:w-3.5";

type Props = {
  /** Durum şeridi */
  children?: ReactNode;
  /** Sağda, pencere düğmelerinden önce (komut paleti, yayın düğmesi) */
  actions?: ReactNode;
  /** Logonun ipucu ve erişilebilir adı */
  title: string;
};

export default function PencereBasligi({ children, actions, title }: Props) {
  const t = useT();
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

  const w = () => getCurrentWindow();

  return (
    <header
      data-tauri-drag-region
      className="relative z-ui-header flex h-8 w-full shrink-0 select-none items-stretch border-b border-ui-line bg-ui-bg font-sans"
    >
      {/* Marka: kendisi de sürükleme alanı */}
      <Tooltip content={`${title} ${__STUDIO_SURUM__}`} side="bottom">
        <span data-tauri-drag-region className="flex h-8 shrink-0 items-center gap-2 pl-3 pr-4">
          <img src={logo} alt="" className="pointer-events-none h-[18px] w-[18px] rounded-ui-1" />
          <span className="pointer-events-none whitespace-nowrap text-[13px] font-semibold text-ui-fg">{title}</span>
        </span>
      </Tooltip>

      <div data-tauri-drag-region className="flex min-w-0 flex-1 items-center gap-3 pr-3">
        {children}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2 pr-2">{actions}</div> : null}

      {/* Pencere düğmeleri: sürükleme alanı DEĞİL, tıklama sürüklemeye dönüşmez */}
      {masaustu ? (
        <div className="flex h-full shrink-0 items-stretch border-l border-ui-line">
          <button type="button" className={DUGME} aria-label={t("pencere.kucult")} title={t("pencere.kucult")} onClick={() => void w().minimize()}>
            <Minus aria-hidden />
          </button>
          <button
            type="button"
            className={DUGME}
            aria-label={buyuk ? t("pencere.onceki") : t("pencere.buyut")}
            title={buyuk ? t("pencere.onceki") : t("pencere.buyut")}
            onClick={() => void w().toggleMaximize()}
          >
            {buyuk ? <Copy aria-hidden className="-scale-x-100" /> : <Square aria-hidden />}
          </button>
          <button
            type="button"
            // Kapat düğmesi işletim sistemi alışkanlığıyla kırmızıya döner (CANLI kırmızısı token'ı, yalnız hover)
            className={cn(DUGME, "hover:bg-ui-live hover:text-ui-live-ink")}
            aria-label={t("pencere.kapat")}
            title={t("pencere.kapat")}
            onClick={() => void w().close()}
          >
            <X aria-hidden />
          </button>
        </div>
      ) : null}
    </header>
  );
}
