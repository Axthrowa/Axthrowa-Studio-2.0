/** OBS Viewer count overlay */

import { useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/sohbetBot/useOverlayWidgetEvents";

export default function ViewerCountPage() {
  useObsKeepalive();
  const [params] = useSearchParams();
  const cfg = useOverlayBotConfig();
  const label = params.get("label") || cfg.viewerLabel || "İzleyici";
  const count = cfg.viewerCount || 0;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent text-white">
      <div className="rounded-xl border border-white/10 bg-zinc-950/70 px-8 py-5 text-center backdrop-blur-md">
        <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-white/55">{label}</div>
        <div className="font-mono text-5xl font-semibold tabular-nums md:text-6xl">{count}</div>
      </div>
    </div>
  );
}
