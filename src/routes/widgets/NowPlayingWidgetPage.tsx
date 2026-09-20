/** OBS Now Playing + Song Request kuyruk */

import { useSearchParams } from "react-router-dom";
import { type NowPlaying } from "../../lib/api";
import { useNowPlaying } from "../../lib/useNowPlaying";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

export default function NowPlayingWidgetPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const [params] = useSearchParams();
  const queueMode = params.get("mode") === "queue";
  const cfg = useOverlayBotConfig();
  const { track, progress } = useNowPlaying(!queueMode);

  if (queueMode) {
    const queue = cfg.songRequest?.queue || [];
    const rows =
      queue.length > 0
        ? queue
        : preview
          ? [
              { user: "Demo", title: "Örnek şarkı 1", url: "", t: Date.now() },
              { user: "Chat", title: "Örnek şarkı 2", url: "", t: Date.now() },
            ]
          : [];
    return (
      <div className="flex h-screen w-screen items-end justify-start bg-transparent p-4 text-white">
        <div className="w-[min(96vw,420px)] rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 backdrop-blur-md">
          {preview && (
            <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
          )}
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300/85">
            Şarkı İsteği
          </div>
          <ul className="space-y-1.5 text-sm">
            {rows.length === 0 && <li className="text-white/70">Kuyruk boş — !sr [şarkı]</li>}
            {rows.map((q, i) => (
              <li key={`${q.user}-${i}`} className="flex justify-between gap-2">
                <span className="truncate font-medium">
                  {i + 1}. {q.title || q.url || "—"}
                </span>
                <span className="shrink-0 text-white/55">{q.user}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const show = track || (preview
    ? ({ title: "Örnek Şarkı", artist: "Demo Sanatçı", albumArt: "", progress: 65_000, duration: 210_000 } as NowPlaying)
    : null);

  if (!show) {
    return (
      <div className="grid h-screen place-items-center bg-transparent p-4 text-white">
        <div className="rounded-xl border border-white/15 bg-zinc-950/80 px-5 py-3 text-sm">
          Şarkı yok — Spotify / YTMD bağla
        </div>
      </div>
    );
  }

  const elapsed = track ? progress : show.progress || 0;
  const duration = show.duration || 0;

  return (
    <div className="flex h-screen w-screen items-end justify-start bg-transparent p-4 text-white">
      <div className="flex max-w-[480px] items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/75 px-4 py-3 backdrop-blur-md">
        {show.albumArt ? (
          <img
            src={show.albumArt}
            alt=""
            className="h-14 w-14 shrink-0 rounded-md object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-white/10 text-xs text-white/50">
            ♪
          </div>
        )}
        <div className="min-w-0 flex-1">
          {preview && !track && (
            <div className="text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
          )}
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">Çalan Şarkı</div>
          <div className="truncate text-base font-semibold">{show.title}</div>
          <div className="truncate text-sm text-white/60">{show.artist}</div>
          {duration > 0 && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, (elapsed / duration) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
