/**
 * Diyalog: body'ye portal edilir; yoğunluk/köşe token'ları :root'ta olduğu için burada da geçerlidir.
 * Açılınca içeriğe odaklanır (önce `autoFocus`/`data-autofocus`), Tab içeride döner, kapanınca odak
 * açan öğeye geri gelir. Esc ve dışa tıklama yalnız `dismissible` iken kapatır. Bulanık arka plan yok.
 *
 *   <Dialog open={acik} onOpenChange={setAcik} title="Sahneyi yeniden adlandır" footer={<>…</>}>…</Dialog>
 *   <ConfirmDialog open={acik} onOpenChange={setAcik} tone="danger" title="Yayın bitirilsin mi?"
 *     description="İzleyiciler yayını kaybeder." confirmLabel="Yayını bitir" onConfirm={bitir} />
 */
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { useI18n } from "../../i18n";
import { Button, IconButton } from "./Button";
import { ODAKLANABILIR } from "./yardimci";

const GENISLIK = { sm: "max-w-[400px]", md: "max-w-[480px]", lg: "max-w-[720px]" } as const;

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Başlığın solundaki simge */
  icon?: ReactNode;
  children?: ReactNode;
  /** Alt şerit: düğmeler (sağa yaslı) */
  footer?: ReactNode;
  /** `alertdialog`: yalnız düğmeyle kapanan uyarı */
  role?: "dialog" | "alertdialog";
  /** Esc, dışa tıklama ve kapat düğmesi (uyarıda kapalı) */
  dismissible?: boolean;
  size?: keyof typeof GENISLIK;
  className?: string;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  role = "dialog",
  dismissible = true,
  size = "md",
  className,
}: DialogProps) {
  const { t } = useI18n();
  const kutu = useRef<HTMLDivElement>(null);
  const baslikId = useId();
  const aciklamaId = useId();
  // Çağıranlar satır içi işlev veriyor: etki her çizimde yeniden kurulup odağı oynatmasın
  const guncel = useRef({ onOpenChange, dismissible });
  guncel.current = { onOpenChange, dismissible };

  // Odak: içeri al, Tab'ı içeride tut, kapanınca geri ver
  useEffect(() => {
    if (!open) return;
    const onceki = document.activeElement as HTMLElement | null;
    const k = kutu.current;
    if (k && !k.contains(document.activeElement)) {
      const hepsi = [...k.querySelectorAll<HTMLElement>(ODAKLANABILIR)];
      const ilk =
        k.querySelector<HTMLElement>("[data-autofocus]") ??
        hepsi.find((x) => !x.hasAttribute("data-dialog-kapat")) ??
        hepsi[0] ??
        k;
      ilk.focus({ preventScroll: true });
    }
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape" && guncel.current.dismissible) {
        e.stopPropagation();
        guncel.current.onOpenChange(false);
        return;
      }
      if (e.key !== "Tab" || !kutu.current) return;
      const d = [...kutu.current.querySelectorAll<HTMLElement>(ODAKLANABILIR)];
      if (!d.length) return;
      const [bas, son] = [d[0], d[d.length - 1]];
      if (e.shiftKey && document.activeElement === bas) {
        e.preventDefault();
        son.focus();
      } else if (!e.shiftKey && document.activeElement === son) {
        e.preventDefault();
        bas.focus();
      }
    };
    window.addEventListener("keydown", tus);
    return () => {
      window.removeEventListener("keydown", tus);
      if (onceki && document.contains(onceki)) onceki.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      data-state="open"
      className="ui-gir fixed inset-0 z-ui-modal flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={kutu}
        role={role}
        aria-modal="true"
        aria-labelledby={baslikId}
        aria-describedby={description ? aciklamaId : undefined}
        tabIndex={-1}
        data-state="open"
        className={cn(
          "ui-gir-olcek flex max-h-[min(760px,calc(100vh-32px))] w-full flex-col overflow-hidden rounded-ui-2 border border-ui-line2 bg-ui-s1 font-sans text-ui-fg shadow-ui-float outline-none",
          GENISLIK[size],
          className
        )}
      >
        <div className="flex shrink-0 items-start gap-3 px-4 pb-2 pt-4">
          {icon ? <span className="mt-0.5 flex shrink-0 [&>svg]:h-5 [&>svg]:w-5">{icon}</span> : null}
          <div className="min-w-0 flex-1">
            <h2 id={baslikId} className="text-ui-4 font-semibold text-ui-fg">
              {title}
            </h2>
            {description ? (
              <div id={aciklamaId} className="mt-1 text-ui-3 text-ui-fg2">
                {description}
              </div>
            ) : null}
          </div>
          {dismissible ? (
            <IconButton label={t("ui.close")} data-dialog-kapat="" tooltip={false} className="-mr-2 -mt-1" onClick={() => onOpenChange(false)}>
              <X />
            </IconButton>
          ) : null}
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 pt-1 text-ui-3 text-ui-fg">{children}</div> : <div className="pb-2" />}
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-ui-line bg-ui-s2 px-4 py-2">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** `danger`: yıkıcı eylem — odak Vazgeç'te başlar, onay düğmesi kırmızı kenarlı */
  tone?: "primary" | "danger";
  /** Onay sürerken düğme döner, diyalog kapanmaz */
  loading?: boolean;
  icon?: ReactNode;
};

/** Onay penceresi (`alertdialog`). Yıkıcı eylemde varsayılan odak Vazgeç'tedir. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "primary",
  loading,
  icon,
}: ConfirmProps) {
  const { t } = useI18n();
  const tehlikeli = tone === "danger";
  return (
    <Dialog
      open={open}
      onOpenChange={(a) => !loading && onOpenChange(a)}
      role="alertdialog"
      dismissible={!loading}
      size="sm"
      title={title}
      description={description}
      icon={icon}
      footer={
        <>
          <Button variant="ghost" data-autofocus={tehlikeli ? "" : undefined} disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            variant={tehlikeli ? "danger" : "primary"}
            loading={loading}
            data-autofocus={tehlikeli ? undefined : ""}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
