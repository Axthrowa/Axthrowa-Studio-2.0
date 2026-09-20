/** Modern tarih-saat alanı — native datetime-local, Night Signal stili. */

import { Calendar } from "lucide-react";
import { cn } from "../../lib/cn";

type Props = {
  value: string;
  onChange: (isoLocal: string) => void;
  disabled?: boolean;
  className?: string;
};

/** value: ISO veya `YYYY-MM-DDTHH:mm` */
export default function DateField({ value, onChange, disabled, className }: Props) {
  let local = "";
  try {
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, "0");
        local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
        local = value.slice(0, 16);
      }
    }
  } catch {
    local = "";
  }

  return (
    <label
      className={cn(
        "relative flex items-center gap-2 rounded-xl border border-panel-border/80 bg-black/25 px-3 py-2",
        className
      )}
    >
      <Calendar className="h-4 w-4 shrink-0 text-panel-accent" />
      <input
        type="datetime-local"
        disabled={disabled}
        className="w-full bg-transparent text-[13px] text-white outline-none [color-scheme:dark]"
        value={local}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange("");
            return;
          }
          const d = new Date(v);
          onChange(Number.isNaN(d.getTime()) ? v : d.toISOString());
        }}
      />
    </label>
  );
}
