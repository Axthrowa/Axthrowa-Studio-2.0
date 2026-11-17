/**
 * Sistem sağlığı: uygulamanın (WebView2, bot ve diğer alt süreçler dahil) anlık CPU ve RAM kullanımı.
 * Rust 3 sn'de bir ölçer (`performans::telemetri_dongusu`); Tauri dışında ya da ilk ölçümden önce görünmez.
 */
import { Cpu, Memory } from "@phosphor-icons/react";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { Tooltip } from "./tooltip";
import { cn } from "../../lib/cn";

function renk(cpu: number) {
  if (cpu >= 85) return "text-red-400";
  if (cpu >= 60) return "text-orange-400";
  return "text-axthrowa-cyan";
}

export default function SistemSagligi() {
  const s = useAxthrowaStore((d) => d.sistem);
  if (!s) return null;
  const ram = s.ramMb >= 1024 ? `${(s.ramMb / 1024).toFixed(1)} GB` : `${s.ramMb} MB`;
  return (
    <Tooltip content={`Sistem sağlığı · ${s.surecSayisi} süreç (uygulama, WebView2, bot)`}>
      <div
        className="flex items-center gap-3 rounded-full bg-axthrowa-card/80 px-3 py-1.5 font-mono text-[11px] text-zinc-300 shadow-panel"
        aria-label={`İşlemci yüzde ${Math.round(s.cpu)}, bellek ${ram}`}
      >
        <span className="flex items-center gap-1.5">
          <Cpu weight="duotone" className={cn("h-3.5 w-3.5 transition-colors duration-300", renk(s.cpu))} />
          {s.cpu.toFixed(1)}%
        </span>
        <span className="flex items-center gap-1.5">
          <Memory weight="duotone" className="h-3.5 w-3.5 text-axthrowa-violet" />
          {ram}
        </span>
      </div>
    </Tooltip>
  );
}
