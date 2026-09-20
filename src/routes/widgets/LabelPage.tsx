/** OBS Label / recent list / leaderboard snippet */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";

export default function LabelPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const [params] = useSearchParams();
  const kind = (params.get("kind") || "follows") as
    | "follows"
    | "subs"
    | "raids"
    | "redeems"
    | "top";
  const cfg = useOverlayBotConfig();

  const label = cfg.labels.find((l) => l.kind === kind) || {
    kind,
    title:
      kind === "top"
        ? "Top puan"
        : kind === "subs"
          ? "Son aboneler"
          : kind === "raids"
            ? "Son raidler"
            : kind === "redeems"
              ? "Son ödüller"
              : "Son takipler",
    maxItems: 5,
    textColor: "#ffffff",
    accentColor: "#3ecfcf",
  };

  const textColor = label.textColor || "#ffffff";
  const accentColor = label.accentColor || "#3ecfcf";

  const rows = useMemo(() => {
    const n = label.maxItems || 5;
    if (kind === "top") {
      const live = Object.entries(cfg.loyalty)
        .map(([k, v]) => ({
          primary: k.split(":")[1] || k,
          secondary: `${v.points} ${cfg.pointsName}`,
        }))
        .sort((a, b) => Number(b.secondary.split(" ")[0]) - Number(a.secondary.split(" ")[0]))
        .slice(0, n);
      if (live.length || !preview) return live;
      return [
        { primary: "DemoUser", secondary: `1200 ${cfg.pointsName}` },
        { primary: "Viewer42", secondary: `800 ${cfg.pointsName}` },
        { primary: "ChatFan", secondary: `450 ${cfg.pointsName}` },
      ];
    }
    const list =
      kind === "subs"
        ? cfg.recent.subs
        : kind === "raids"
          ? cfg.recent.raids
          : kind === "redeems"
            ? cfg.recent.redeems
            : cfg.recent.follows;
    const mapped = list.slice(0, n).map((x: { user: string; item?: string; amount?: number | string }) => ({
      primary: x.user,
      secondary: String(x.item || x.amount || ""),
    }));
    if (mapped.length || !preview) return mapped;
    return [
      { primary: "ÖrnekKullanıcı", secondary: kind === "raids" ? "12" : "" },
      { primary: "DemoTakipçi", secondary: "" },
    ];
  }, [cfg, kind, label.maxItems, preview]);

  return (
    <div className="flex h-screen w-screen items-start justify-start bg-transparent p-3">
      <div
        className="min-w-[220px] max-w-[360px] rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-3 backdrop-blur-md"
        style={{ color: textColor }}
      >
        {preview && (
          <div className="mb-1 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
        )}
        <div
          className="mb-2 text-[11px] uppercase tracking-[0.18em]"
          style={{ color: accentColor }}
        >
          {label.title}
        </div>
        <ul className="space-y-1.5 text-sm">
          {rows.length === 0 && <li className="opacity-70">Henüz olay yok</li>}
          {rows.map((r, i) => (
            <li key={`${r.primary}-${i}`} className="flex justify-between gap-3">
              <span className="font-medium">{r.primary}</span>
              {r.secondary && <span className="opacity-55">{r.secondary}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
