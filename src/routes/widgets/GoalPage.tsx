/** OBS Goal bar */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/smartBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/smartBot/widgetPreview";
import type { StreamGoal } from "../../lib/smartBot/v2";
import GoalWidget from "../../components/widgets/GoalWidget";

const KIND_ALIASES: Record<string, StreamGoal["kind"]> = {
  followers: "followers",
  follower: "followers",
  follow: "followers",
  subs: "subs",
  sub: "subs",
  subscribers: "subs",
  tips: "tips",
  tip: "tips",
  donation: "tips",
  donations: "tips",
  donationgoal: "tips",
  kicks: "kicks",
  kick: "kicks",
  custom: "custom",
};

export default function GoalPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const [params] = useSearchParams();
  const goalId = params.get("id") || "";
  const kindRaw = (params.get("kind") || params.get("type") || "").toLowerCase();
  const kind = KIND_ALIASES[kindRaw];
  const cfg = useOverlayBotConfig();
  const goals = cfg.goals;

  const goal = useMemo(() => {
    const enabled = goals.filter((g) => g.enabled);
    if (goalId) return enabled.find((g) => g.id === goalId) || enabled[0];
    if (kind) return enabled.find((g) => g.kind === kind) || enabled[0];
    return enabled[0];
  }, [goals, goalId, kind]);

  const demo: StreamGoal | null =
    !goal && preview
      ? {
          id: "demo",
          name: kind === "subs" ? "Abone hedefi" : kind === "kicks" ? "KICK hedefi" : "Takipçi hedefi",
          kind: kind || "followers",
          current: 42,
          target: 100,
          enabled: true,
          color: "#3ecfcf",
          layout: "bar",
          showPercent: true,
        }
      : null;

  const g = goal || demo;

  if (!g) {
    return (
      <div className="grid h-screen place-items-center bg-transparent p-4 text-white">
        <div className="rounded-xl border border-white/15 bg-zinc-950/80 px-5 py-3 text-sm">
          Hedef yok — Widget’lar → Hedefler’den ekle
        </div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100));
  const showPct = g.showPercent !== false;
  const layout = g.layout || "bar";
  const color = g.color || "#3ecfcf";
  const kindLabel: Record<string, string> = {
    followers: "Takipçi",
    subs: "Abone",
    tips: "Bağış",
    kicks: "KICKs",
    custom: "Hedef",
  };

  if (layout === "circle") {
    const r = 54;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - pct / 100);
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-transparent p-4 text-white">
        <div className="text-center">
          {!goal && preview && (
            <div className="mb-2 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
          )}
          <div className="relative mx-auto h-36 w-36">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth="10" />
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset .7s ease-out", filter: `drop-shadow(0 0 10px ${color}88)` }}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                {showPct ? (
                  <div className="text-2xl font-semibold tabular-nums">{pct}%</div>
                ) : (
                  <div className="text-lg font-semibold tabular-nums">
                    {g.current}/{g.target}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs uppercase tracking-widest text-white/55">
            {kindLabel[g.kind] || g.kind}
          </div>
          <div className="text-lg font-semibold">{g.name}</div>
          {showPct && (
            <div className="mt-1 text-sm tabular-nums text-white/70">
              {g.current} / {g.target}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (layout === "minimal") {
    return (
      <div className="flex h-screen w-screen items-end justify-center bg-transparent p-4 text-white">
        <div className="w-[min(96vw,480px)] text-center">
          {!goal && preview && (
            <div className="mb-2 text-[10px] uppercase tracking-widest text-amber-300/80">Önizleme</div>
          )}
          <div className="text-sm font-medium" style={{ color }}>
            {g.name}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {g.current}
            <span className="text-white/50"> / {g.target}</span>
            {showPct && <span className="ml-2 text-base text-white/50">{pct}%</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen items-end justify-center bg-transparent p-4 text-white">
      <div className="w-[min(96vw,640px)]">
        <GoalWidget
          config={{
            title: g.name,
            metric: g.kind,
            current: preview && !goal ? 55 : g.current,
            target: g.target,
            startValue: 0,
            color: color,
            colorFrom: color,
            layout: "bar",
            showPercent: showPct,
            theme: g.theme,
            _previewMode: preview && !goal,
          }}
        />
      </div>
    </div>
  );
}
