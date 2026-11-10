/**
 * Form denetimleri. Yükseklik yoğunluğa (`--ctl`), köşe tercihe (`--r-2`) bağlı; zemin `ui-bg`
 * (koyu temada panelden koyu, açık temada açık gri — her skinde okunur).
 *
 *   <Input placeholder="Ara" leading={<Search />} />
 *   <Select value={v} onChange={(e) => setV(e.target.value)}>…<option/></Select>
 *   <Switch checked={acik} onCheckedChange={setAcik} aria-label="Otomatik bağlan" />
 *   <Slider label="Ses" value={-12} min={-60} max={0} step={0.1} unit="dB" onValueChange={setDb} />
 */
import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";
import { useI18n } from "../../i18n";
import { sayiBicim } from "./yardimci";

const ALAN =
  "w-full min-w-0 rounded-ui-2 border border-ui-line2 bg-ui-bg font-sans text-ui-3 text-ui-fg outline-none " +
  "transition-colors duration-ui placeholder:text-ui-fg3 hover:border-ui-fg3 focus-visible:border-ui-accent " +
  "aria-[invalid=true]:border-ui-err disabled:cursor-not-allowed disabled:opacity-50";

type InputProps = ComponentProps<"input"> & {
  /** Sol simge (ör. arama) */
  leading?: ReactNode;
  /** Hatalı değer: kenar sarı + `aria-invalid` (iletiyi alanın altında metinle verin) */
  invalid?: boolean;
};

export function Input({ leading, invalid, className, type = "text", ...rest }: InputProps) {
  const alan = (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(ALAN, "h-ctl px-2", leading ? "pl-7" : null, className)}
      {...rest}
    />
  );
  if (!leading) return alan;
  return (
    <span className="relative flex min-w-0 flex-1 items-center">
      <span aria-hidden className="pointer-events-none absolute left-2 flex text-ui-fg3 [&>svg]:h-3.5 [&>svg]:w-3.5">
        {leading}
      </span>
      {alan}
    </span>
  );
}

export function Textarea({ invalid, className, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn(ALAN, "min-h-16 px-2 py-1.5 leading-[18px]", className)} {...rest} />;
}

/** Yerel `<select>`: klavye, ekran okuyucu ve açılır liste işletim sisteminden. */
export function Select({
  invalid,
  className,
  wrapperClassName,
  children,
  ...rest
}: ComponentProps<"select"> & { invalid?: boolean; /** Sarmalayıcı (esnek satırda genişlik/`shrink-0`) */ wrapperClassName?: string }) {
  return (
    <span className={cn("relative inline-flex min-w-0", wrapperClassName)}>
      <select aria-invalid={invalid || undefined} className={cn(ALAN, "h-ctl appearance-none pl-2 pr-6", className)} {...rest}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ui-fg3" />
    </span>
  );
}

type SwitchProps = Omit<ComponentProps<"button">, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Aç/kapa (`role="switch"`). Erişilebilir adı yanındaki `<label htmlFor>` ya da `aria-label` verir. */
export function Switch({ checked, onCheckedChange, className, disabled, ...rest }: SwitchProps) {
  const state = checked ? "checked" : "unchecked";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={state}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "peer relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-ui",
        "bg-ui-line2 data-[state=checked]:bg-ui-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...rest}
    >
      <span
        data-state={state}
        className={cn(
          "pointer-events-none absolute left-0.5 block h-3 w-3 rounded-full bg-ui-fg2 transition-transform duration-ui ease-ui",
          "data-[state=checked]:translate-x-3 data-[state=checked]:bg-ui-accent-ink"
        )}
      />
    </button>
  );
}

type SecimProps = Omit<ComponentProps<"input">, "type"> & { label?: ReactNode };

const SECIM = "h-3.5 w-3.5 shrink-0 cursor-pointer accent-ui-accent disabled:cursor-not-allowed";

/** Onay kutusu (yerel; `label` verilirse tıklanabilir etiketle sarılır). */
export function Checkbox({ label, className, ...rest }: SecimProps) {
  const kutu = <input type="checkbox" className={cn(SECIM, !label && className)} {...rest} />;
  return label ? <Etiketli className={className}>{kutu}{label}</Etiketli> : kutu;
}

/** Seçenek düğmesi; aynı gruptakiler aynı `name`. */
export function Radio({ label, className, ...rest }: SecimProps) {
  const kutu = <input type="radio" className={cn(SECIM, !label && className)} {...rest} />;
  return label ? <Etiketli className={className}>{kutu}{label}</Etiketli> : kutu;
}

function Etiketli({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <label className={cn("inline-flex min-h-ctl cursor-pointer items-center gap-2 text-ui-3 text-ui-fg has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      {children}
    </label>
  );
}

type SliderProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Birim her zaman yazılır: dB, %, ms, px, kbps */
  unit: string;
  /** Ondalık basamak (varsayılan adımdan) */
  digits?: number;
  /** Etiketi görünür yaz (varsayılan evet) */
  showLabel?: boolean;
};

/** Birimli kaydırıcı: değer dilin sayı biçiminde ve birimiyle yanında yazar (`-12,4 dB`). */
export function Slider({ label, value, onValueChange, min, max, step = 1, unit, digits, showLabel = true, className, id, ...rest }: SliderProps) {
  const { locale } = useI18n();
  const otoId = useId();
  const kimlik = id ?? otoId;
  const basamak = digits ?? (String(step).split(".")[1]?.length || 0);
  const metin = `${sayiBicim(value, locale, basamak)} ${unit}`;
  return (
    <div className={cn("flex min-w-0 items-center gap-2 text-ui-2", className)}>
      {showLabel ? (
        <label htmlFor={kimlik} className="w-24 shrink-0 truncate text-ui-fg2">
          {label}
        </label>
      ) : null}
      <input
        id={kimlik}
        type="range"
        aria-label={showLabel ? undefined : label}
        aria-valuetext={metin}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="h-4 min-w-0 flex-1 cursor-pointer accent-ui-accent disabled:cursor-not-allowed disabled:opacity-50"
        {...rest}
      />
      <output htmlFor={kimlik} className="w-16 shrink-0 text-right font-mono tabular-nums text-ui-fg">
        {metin}
      </output>
    </div>
  );
}
