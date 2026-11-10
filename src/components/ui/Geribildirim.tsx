/**
 * Boş, yükleniyor ve hata durumları. Her ekran bu üçünü (ve "bağlantı yok"u) tasarlar.
 *
 *   <EmptyState icon={<Inbox />} title="Henüz sahne yok" description="OBS'te bir sahne oluşturun." action={<Button>…</Button>} />
 *   <Skeleton className="h-row w-full" />
 *   <ErrorState title="Güncelleme bilgisi alınamadı" description="İnternet bağlantınızı denetleyin." error={e} onRetry={yenile} />
 */
import type { ComponentProps, ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "./cn";
import { useI18n } from "../../i18n";
import { Button } from "./Button";
import { hataMetni } from "./yardimci";

type EmptyProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Tek eylem (Bağlan, Ekle) */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-pad py-6 text-center", className)}>
      {icon ? <span className="flex text-ui-fg3 [&>svg]:h-6 [&>svg]:w-6">{icon}</span> : null}
      <p className="text-ui-3 font-semibold text-ui-fg">{title}</p>
      {description ? <p className="max-w-sm text-ui-2 text-ui-fg2">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Yükleniyor yer tutucusu (boyutu sınıfla verin). Yalnız görsel: içeren bölgeye `aria-busy` verin ya da
 * `label` ile ekran okuyucuya "Yükleniyor" deyin.
 */
export function Skeleton({ className, label, ...rest }: ComponentProps<"span"> & { label?: boolean }) {
  const { t } = useI18n();
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("block animate-pulse rounded-ui-1 bg-ui-line", className)}
      {...rest}
    >
      {label ? <span className="sr-only">{t("ui.loading")}</span> : null}
    </span>
  );
}

type ErrorProps = {
  /** İnsan diliyle ne olduğu (ham hata metni değil) */
  title?: ReactNode;
  /** Ne yapılabileceği */
  description?: ReactNode;
  /** Ham hata: yalnız açılır "Teknik ayrıntılar" içinde, mono */
  error?: unknown;
  onRetry?: () => void;
  /** Ek eylem (Ayarları aç, Destek) */
  action?: ReactNode;
  /** Ekran okuyucuya hemen bildir (yeni oluşan hata) */
  live?: boolean;
  className?: string;
};

/** Hata durumu: sarı uyarı simgesi + insan diliyle başlık; ham hata kapalı ayrıntıda. */
export function ErrorState({ title, description, error, onRetry, action, live, className }: ErrorProps) {
  const { t } = useI18n();
  const ham = hataMetni(error);
  return (
    <div role={live ? "alert" : undefined} className={cn("flex gap-3 px-pad py-3 text-ui-3", className)}>
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ui-err" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ui-fg">{title ?? t("ui.error.title")}</p>
        {description ? <p className="mt-0.5 text-ui-2 text-ui-fg2">{description}</p> : null}
        {ham ? (
          <details className="mt-2 text-ui-2">
            <summary className="cursor-pointer select-none text-ui-fg2 hover:text-ui-fg">{t("ui.error.details")}</summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-ui-1 border border-ui-line bg-ui-bg p-2 font-mono text-ui-1 text-ui-fg2">
              {ham}
            </pre>
          </details>
        ) : null}
        {onRetry || action ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {onRetry ? (
              <Button onClick={onRetry}>
                <RotateCcw aria-hidden />
                {t("ui.error.retry")}
              </Button>
            ) : null}
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
