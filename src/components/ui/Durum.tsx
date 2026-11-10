/**
 * Durum bildiren küçük öğeler. Kural: renk tek başına anlam taşımaz — her durum simge + metinle gelir.
 * Kırmızı (`live`) yalnız CANLI içindir; "bağlı değil" nötr gridir, hata sarıdır.
 *
 *   <StatusPill tone="live">CANLI 01:42:10</StatusPill>
 *   <StatusPill tone="neutral" icon={Unplug}>OBS bağlı değil</StatusPill>
 *   <StatusDot tone="ok" label="Bağlı" />
 *   <Meter label="Mikrofon" db={-12.4} peak={-6} />
 */
import type { HTMLAttributes, ReactNode } from "react";
import { CircleCheck, CircleDashed, Info, Radio, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { useI18n } from "../../i18n";
import { KIRPMA_DBFS, dbOrani, sayiBicim } from "./yardimci";

export type Ton = "live" | "rec" | "ok" | "warn" | "err" | "neutral" | "accent";

const TON_SIMGE: Record<Ton, LucideIcon> = {
  live: Radio,
  rec: Radio,
  ok: CircleCheck,
  warn: TriangleAlert,
  err: TriangleAlert,
  neutral: CircleDashed,
  accent: Info,
};

const TON_YAZI: Record<Ton, string> = {
  live: "text-ui-live-ink",
  rec: "text-ui-rec",
  ok: "text-ui-ok",
  warn: "text-ui-warn",
  err: "text-ui-err",
  neutral: "text-ui-fg2",
  accent: "text-ui-accent-text",
};

const TON_NOKTA: Record<Ton, string> = {
  live: "bg-ui-live",
  rec: "bg-ui-rec",
  ok: "bg-ui-ok",
  warn: "bg-ui-warn",
  err: "bg-ui-err",
  neutral: "bg-ui-fg3",
  accent: "bg-ui-accent",
};

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Ton;
  /** Varsayılan simge tona göre seçilir; durum özelse (OBS kapalı → Unplug) verin */
  icon?: LucideIcon;
  children: ReactNode;
};

/** Simgeli durum etiketi. CANLI dolu kırmızı kutu, diğerleri nötr zemin üstünde renkli simge + yazı. */
export function StatusPill({ tone = "neutral", icon, className, children, ...rest }: PillProps) {
  const Simge = icon ?? TON_SIMGE[tone];
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-1 whitespace-nowrap rounded-ui-1 border px-1.5 text-ui-1 font-semibold",
        tone === "live" ? "border-ui-live bg-ui-live" : "border-ui-line bg-ui-s2",
        TON_YAZI[tone],
        className
      )}
      {...rest}
    >
      <Simge aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
      {children}
    </span>
  );
}

/** Sayı / kısa etiket rozeti (durum değil: "12", "Yeni", "Beta"). */
export function Badge({ className, children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-ui-1 bg-ui-s3 px-1 font-mono text-ui-1 text-ui-fg2",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

type DotProps = {
  tone?: Ton;
  /** Görünen metin (renk tek başına anlam taşımaz). `hideLabel` yalnız yanında aynı anlamı veren yazı varsa. */
  label: string;
  hideLabel?: boolean;
  className?: string;
};

/** Nokta + metin. Animasyon ve parlama yok. */
export function StatusDot({ tone = "neutral", label, hideLabel, className }: DotProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ui-2 text-ui-fg2", className)}>
      <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TON_NOKTA[tone])} />
      <span className={cn("whitespace-nowrap", hideLabel && "sr-only")}>{label}</span>
    </span>
  );
}

/** Klavye kısayolu ipucu. */
export function Kbd({ className, children, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4 items-center whitespace-nowrap rounded-ui-1 border border-ui-line2 px-1 font-mono text-ui-1 leading-4 text-ui-fg3",
        className
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
}

type MeterProps = {
  /** Kanal adı (erişilebilir ad, gerekirse görünür) */
  label: string;
  /** Anlık seviye, dBFS (−∞…0) */
  db: number;
  /** Tepe, dBFS. ≥ −1 dBFS kanalı sarıya çevirir ve uyarı simgesi gösterir. */
  peak?: number;
  /** Ölçeğin alt ucu, dBFS */
  min?: number;
  /** Değeri yazıyla göster (`-12,4 dB`) */
  showValue?: boolean;
  /** Kanal adını görünür yaz */
  showLabel?: boolean;
  className?: string;
};

/** Ses seviyesi ölçeri. Kırmızı kırpılma bölgesi yok: kırpılmaya yakın kanal sarı + simge + metin. */
export function Meter({ label, db, peak, min = -60, showValue = true, showLabel, className }: MeterProps) {
  const { t, locale } = useI18n();
  const kirpma = (peak ?? db) >= KIRPMA_DBFS;
  const deger = db === -Infinity ? t("ui.meter.silent") : `${sayiBicim(db, locale)} dB`;
  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-ui-2", className)}>
      {showLabel ? <span className="w-24 shrink-0 truncate text-ui-fg">{label}</span> : null}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={0}
        aria-valuenow={Number.isFinite(db) ? Math.max(min, Math.min(0, db)) : min}
        aria-valuetext={kirpma ? `${deger} — ${t("ui.meter.clip")}` : deger}
        className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-ui-1 border border-ui-line bg-ui-bg"
      >
        <div
          className={cn("absolute inset-y-0 left-0", kirpma ? "bg-ui-warn" : "bg-ui-ok")}
          style={{ width: `${dbOrani(db, min) * 100}%` }}
        />
        {peak !== undefined && Number.isFinite(peak) ? (
          <div className="absolute inset-y-0 w-0.5 bg-ui-fg" style={{ left: `calc(${dbOrani(peak, min) * 100}% - 1px)` }} />
        ) : null}
      </div>
      {showValue ? (
        <span className={cn("flex w-20 shrink-0 items-center justify-end gap-1 whitespace-nowrap font-mono tabular-nums", kirpma ? "text-ui-warn" : "text-ui-fg2")}>
          {kirpma ? <TriangleAlert aria-hidden className="h-3 w-3" /> : null}
          {deger}
        </span>
      ) : null}
    </div>
  );
}
