/** OBS Activity feed */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { saveBotConfig } from "../../lib/smartBot";
import { emitWidgetEvent } from "../../lib/smartBot/events";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";
import { useSubathonEvents } from "../../lib/widgets/useSubathonEvents";
import { useWidgetSync } from "../../lib/widgets/useWidgetSync";

type FeedItem = {
  id: string;
  kind: "follow" | "sub" | "raid" | "redeem" | "bits" | "tip";
  user: string;
  detail?: string;
  t: number;
};

export default function ActivityFeedPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const [params] = useSearchParams();
  const obsMode = params.get("obs") === "1";
  const cfg = useOverlayBotConfig();
  const [skipped, setSkipped] = useState<string | null>(null);
  const [live, setLive] = useState<FeedItem[]>([]);
  const feed = cfg.activityFeed || {
    muted: false,
    paused: false,
    maxItems: 12,
    showFollow: true,
    showSub: true,
    showRaid: true,
    showRedeem: true,
    showBits: true,
    hideControls: true,
  };
  const hideControls = obsMode && feed.hideControls !== false;
  const maxItems = Math.max(1, feed.maxItems || 12);

  const pushLive = useCallback(
    (item: FeedItem) => {
      setLive((prev) => {
        if (prev.some((x) => x.id === item.id)) return prev;
        return [item, ...prev].slice(0, maxItems);
      });
    },
    [maxItems]
  );

  const { subscribe } = useWidgetSync({
    kinds: ["follow", "sub", "raid", "bits", "tip", "donation", "redeem"],
  });

  useEffect(() => {
    if (preview) return;
    return subscribe((ev) => {
      const k = String(ev.kind || "").toLowerCase();
      const kind: FeedItem["kind"] | null =
        k === "follow"
          ? "follow"
          : k === "sub"
            ? "sub"
            : k === "raid"
              ? "raid"
              : k === "bits"
                ? "bits"
                : k === "tip" || k === "donation"
                  ? "tip"
                  : k === "redeem"
                    ? "redeem"
                    : null;
      if (!kind) return;
      if (kind === "follow" && feed.showFollow === false) return;
      if (kind === "sub" && feed.showSub === false) return;
      if (kind === "raid" && feed.showRaid === false) return;
      if (kind === "redeem" && feed.showRedeem === false) return;
      if ((kind === "bits" || kind === "tip") && feed.showBits === false) return;
      pushLive({
        id: String(ev.id || `${kind}-${ev.t || Date.now()}`),
        kind,
        user: String(ev.user || "Kullanıcı"),
        detail: ev.amount != null ? String(ev.amount) : ev.message || undefined,
        t: Number(ev.t) || Date.now(),
      });
    });
  }, [subscribe, preview, feed, pushLive]);

  useSubathonEvents((ev) => {
    if (preview) return;
    const kind: FeedItem["kind"] | null =
      ev.kind === "follow"
        ? "follow"
        : ev.kind === "sub"
          ? "sub"
          : ev.kind === "raid"
            ? "raid"
            : ev.kind === "bits"
              ? "bits"
              : ev.kind === "tip" || ev.kind === "donation"
                ? "tip"
                : null;
    if (!kind) return;
    pushLive({
      id: `sa-${kind}-${Date.now()}-${ev.user || ""}`,
      kind,
      user: String(ev.user || "Kullanıcı"),
      detail: ev.amount != null ? String(ev.amount) : ev.message || undefined,
      t: Date.now(),
    });
  }, !preview);

  const items = useMemo<FeedItem[]>(() => {
    const r = cfg.recent;
    const fromCfg: FeedItem[] = [
      ...(feed.showFollow !== false
        ? (r.follows || []).map((x, i) => ({
            id: `f-${x.t}-${i}`,
            kind: "follow" as const,
            user: x.user,
            t: x.t,
          }))
        : []),
      ...(feed.showSub !== false
        ? (r.subs || []).map((x, i) => ({
            id: `s-${x.t}-${i}`,
            kind: "sub" as const,
            user: x.user,
            t: x.t,
          }))
        : []),
      ...(feed.showRaid !== false
        ? (r.raids || []).map((x, i) => ({
            id: `r-${x.t}-${i}`,
            kind: "raid" as const,
            user: x.user,
            detail: x.amount ? String(x.amount) : undefined,
            t: x.t,
          }))
        : []),
      ...(feed.showRedeem !== false
        ? (r.redeems || []).map((x, i) => ({
            id: `d-${x.t}-${i}`,
            kind: "redeem" as const,
            user: x.user,
            detail: x.item,
            t: x.t,
          }))
        : []),
      ...(feed.showBits !== false
        ? ((r as { bits?: { user: string; amount?: number; t: number }[] }).bits || []).map(
            (x, i) => ({
              id: `b-${x.t}-${i}`,
              kind: "bits" as const,
              user: x.user,
              detail: x.amount != null ? String(x.amount) : undefined,
              t: x.t,
            })
          )
        : []),
    ];

    const merged = [...live, ...fromCfg]
      .filter((x) => x.id !== skipped)
      .sort((a, b) => b.t - a.t)
      .slice(0, maxItems);

    if (merged.length || !preview) return merged;
    const demo: FeedItem[] = [];
    if (feed.showFollow !== false)
      demo.push({ id: "demo1", kind: "follow", user: "DemoTakipçi", t: Date.now() });
    if (feed.showSub !== false)
      demo.push({ id: "demo2", kind: "sub", user: "DemoAbone", t: Date.now() - 1000 });
    if (feed.showBits !== false)
      demo.push({ id: "demo3", kind: "bits", user: "BitFan", detail: "100", t: Date.now() - 2000 });
    return demo.slice(0, maxItems);
  }, [cfg.recent, skipped, preview, feed, maxItems, live]);

  const patchFeed = (p: Partial<typeof feed>) => {
    saveBotConfig((prev) => ({
      ...prev,
      activityFeed: { ...(prev.activityFeed || feed), ...p },
    }));
  };

  return (
    <div className="flex h-screen w-screen items-end justify-end bg-transparent p-4 text-white">
      <div className="w-[min(96vw,360px)] rounded-xl border border-white/10 bg-zinc-950/80 p-3 backdrop-blur-md">
        {preview && (
          <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
        )}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/85">Aktivite</div>
          {!hideControls && (
            <div className="flex gap-1 text-[10px]">
              <button
                type="button"
                className="rounded bg-white/10 px-2 py-0.5"
                onClick={() => patchFeed({ muted: !feed.muted })}
              >
                {feed.muted ? "Ses aç" : "Sessiz"}
              </button>
              <button
                type="button"
                className="rounded bg-white/10 px-2 py-0.5"
                onClick={() => patchFeed({ paused: !feed.paused })}
              >
                {feed.paused ? "Devam" : "Duraklat"}
              </button>
              <button
                type="button"
                className="rounded bg-white/10 px-2 py-0.5"
                onClick={() => {
                  if (items[0]) setSkipped(items[0].id);
                  void emitWidgetEvent({ kind: "test", user: "skip", message: "skip" });
                }}
              >
                Atla
              </button>
            </div>
          )}
        </div>
        {feed.paused ? (
          <div className="text-sm text-white/70">Duraklatıldı</div>
        ) : (
          <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto text-sm">
            {items.length === 0 && <li className="text-white/70">Henüz olay yok</li>}
            {items.map((it) => (
              <li key={it.id} className="flex justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                <span>
                  <span className="text-white/50">{it.kind}</span>{" "}
                  <span className="font-medium">{it.user}</span>
                </span>
                {it.detail && <span className="text-white/55">{it.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
