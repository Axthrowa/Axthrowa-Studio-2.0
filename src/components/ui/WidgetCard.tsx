/**
 * AxthrowA kartı: kenarlık yok; ayrım kart zemini, geniş yumuşak gölge ve üstten vuran ince yansımayla.
 * Başlık ile açıklama birbirine yakın, sağdaki eylem (düğme/anahtar) bu gruptan belirgin uzak.
 *
 *   <WidgetCard title="Sahneler" description="OBS'teki sahneler" action={<Switch … />}>…</WidgetCard>
 */
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  title: string;
  description?: string;
  /** Başlık satırının sağı: düğme, anahtar, sayaç */
  action?: ReactNode;
  /** Başlığın solundaki küçük simge */
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function WidgetCard({ title, description, action, icon, children, className }: Props) {
  return (
    <section
      className={cn(
        "relative rounded-2xl bg-axthrowa-card px-6 py-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:border-t before:border-white/5",
        className
      )}
    >
      <header className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100">
            {icon}
            {title}
          </h3>
          {description ? <p className="text-sm leading-relaxed text-zinc-400">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
      </header>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export default WidgetCard;
