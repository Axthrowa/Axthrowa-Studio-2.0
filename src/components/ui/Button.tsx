/**
 * Düğmeler. Ekranda en fazla bir `primary`. `danger` yıkıcı eylem içindir (Yayını bitir, Sil):
 * dolgu değil, CANLI kırmızısı kenar; onay ister (ConfirmDialog).
 *
 *   <Button variant="primary" loading={kaydediliyor}>Kaydet</Button>
 *   <IconButton label="Mikrofonu sustur" shortcut="Ctrl+M"><MicOff /></IconButton>
 */
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "./cn";
import { Tooltip } from "./Tooltip";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARYANT: Record<ButtonVariant, string> = {
  primary: "border-ui-accent bg-ui-accent font-semibold text-ui-accent-ink hover:bg-ui-accent/90",
  secondary: "border-ui-line2 bg-ui-s2 text-ui-fg hover:bg-ui-s3",
  ghost: "border-transparent bg-transparent text-ui-fg2 hover:bg-ui-s2 hover:text-ui-fg",
  danger: "border-ui-danger bg-transparent text-ui-fg hover:bg-ui-danger/10 [&>svg]:text-ui-danger",
};

// md = yoğunluğa bağlı denetim yüksekliği; lg = büyük vuruş alanı (deste, sahne, GO LIVE)
const BOYUT: Record<ButtonSize, string> = {
  sm: "h-5 gap-1 px-1.5 text-ui-2",
  md: "h-ctl gap-1.5 px-2.5 text-ui-2",
  lg: "h-hit gap-2 px-3 text-ui-3",
};

/** Ortak taban: düğme ve düğme gibi görünen bağlantılar için */
export const dugmeSinifi = (variant: ButtonVariant = "secondary", size: ButtonSize = "md") =>
  cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-ui-2 border font-sans font-medium",
    "transition-colors duration-ui ease-ui [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    VARYANT[variant],
    BOYUT[size]
  );

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Sürerken düğme kapalı ve `aria-busy`; metin yerinde kalır (genişlik zıplamaz) */
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", loading, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(dugmeSinifi(variant, size), className)}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "children"> & {
  /** Zorunlu erişilebilir ad; ipucu olarak da gösterilir */
  label: string;
  /** lucide simgesi */
  children: ReactNode;
  variant?: Exclude<ButtonVariant, "primary">;
  size?: ButtonSize;
  /** Basılı (aç/kapa) durumu: `aria-pressed` */
  pressed?: boolean;
  shortcut?: string;
  /** İpucu gösterilsin mi (varsayılan evet) */
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
};

const KARE: Record<ButtonSize, string> = { sm: "h-5 w-5", md: "h-ctl w-ctl", lg: "h-hit w-hit [&>svg]:h-5 [&>svg]:w-5" };

/** Yalnız simgeli düğme. `label` olmadan derlenmez. */
export function IconButton({
  label,
  children,
  variant = "ghost",
  size = "md",
  pressed,
  shortcut,
  tooltip = true,
  tooltipSide,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const dugme = (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        dugmeSinifi(variant, size),
        "px-0",
        KARE[size],
        pressed && "border-ui-line2 bg-ui-s3 text-ui-fg",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      {dugme}
    </Tooltip>
  ) : (
    dugme
  );
}
