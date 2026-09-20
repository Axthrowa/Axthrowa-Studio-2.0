/** Master Overlay önizleme — mock alert, dashed placeholder, demo yamaları. */

import type { ReactNode } from "react";

/** Sadece gerçekten render edilemeyen / görünmez widget’lar için placeholder. */
const PREVIEW_PLACEHOLDER = new Set(["redeems", "cloudtts"]);

export function previewConfigPatch(
  kind: string,
  config: Record<string, unknown>,
  isPreviewMode: boolean
): Record<string, unknown> {
  if (!isPreviewMode) return config;
  const k = kind.toLowerCase();
  const next: Record<string, unknown> = { ...config, _previewMode: true };
  if (k === "chat") {
    next._previewDemo = true;
    if (!config.theme) next.theme = "boxed";
    if (config.showEmotes == null) next.showEmotes = true;
    if (config.showBadges == null) next.showBadges = true;
    if (config.textShadow == null) next.textShadow = true;
  }
  if (k === "emotecombo" || k === "emote-combo") {
    next._previewMode = true;
    if (config.threshold == null) next.threshold = 2;
    if (config.showCount == null) next.showCount = true;
    if (config.burstScale == null) next.burstScale = 1.6;
  }
  if (k === "emotewall" || k === "emotes" || k === "cup" || k === "glass") {
    next._previewMode = true;
  }
  if (k === "viewers") {
    next._previewMode = true;
    if (config.mode == null) next.mode = "sum";
    if (!Array.isArray(config.platforms)) next.platforms = ["kick", "twitch"];
  }
  if (k === "activity" || k === "activityfeed") {
    next._previewMode = true;
  }
  if (k === "tts") {
    next._previewMode = true;
  }
  if (k === "subathon") {
    if (!String(config.custom_title ?? "").trim()) {
      next.custom_title = "Subathon";
    }
    if (Number(config.secondsRemaining) <= 0) {
      next.secondsRemaining = 3600;
    }
    if (config.scale == null) next.scale = 1;
  }
  if (k === "goal" || k === "goals") {
    const cur = Number(config.current);
    const tgt = Number(config.target) || 100;
    const start = Number(config.startValue ?? config.start ?? 0) || 0;
    if (!Number.isFinite(cur) || cur <= start) {
      next.current = start + Math.max(1, Math.round((tgt - start) * 0.55));
    }
    if (config.startValue == null && config.start == null) {
      next.startValue = 0;
    }
    if (!config.volume && config.volume !== 0) {
      next.volume = 72;
    }
    if (!config.layout) next.layout = "bar";
    if (config.showPercent == null) next.showPercent = true;
    if (config.showValue == null) next.showValue = true;
    if (config.showMilestones == null) next.showMilestones = true;
    if (config.showBackground == null) next.showBackground = true;
    if (!config.thickness) next.thickness = 18;
    next._previewDemo = true;
  }
  if (k === "kicksubs" || k === "kick-subs" || k === "kick_subs") {
    next._previewMode = true;
    if (!String(config.custom_title ?? "").trim()) next.custom_title = "Kick Aboneler";
    if (!config.theme) next.theme = "kick";
    if (!config.layout) next.layout = "list";
    if (config.showGoal == null) next.showGoal = false;
    if (config.showSessionCount == null) next.showSessionCount = true;
    if (Number(config.goalTarget) <= 0) next.goalTarget = 50;
    if (Number(config.maxItems) <= 0) next.maxItems = 6;
  }
  if (k === "alerts" || k === "alert") {
    next._previewMode = true;
  }
  return next;
}

export function usesPreviewPlaceholder(kind: string, isPreviewMode: boolean): boolean {
  if (!isPreviewMode) return false;
  return PREVIEW_PLACEHOLDER.has(kind.toLowerCase());
}

export function usesPreviewAlertMock(kind: string, isPreviewMode: boolean): boolean {
  // Artık gerçek AlertsWidget önizlemesi kullanılsın
  return false && isPreviewMode && kind.toLowerCase() === "alerts";
}

export function WidgetPlaceholder({
  kind,
  name,
  accent = "#3ecfcf",
}: {
  kind: string;
  name?: string;
  accent?: string;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-transparent p-3">
      <div
        className="flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center"
        style={{
          borderColor: `${accent}88`,
          background: `${accent}12`,
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
          {name || kind}
        </p>
        <p className="mt-2 max-w-[220px] text-[12px] leading-snug text-white/50">
          Canlı olay bekleniyor — önizleme alanı
        </p>
        <p className="mt-1 font-mono text-[10px] text-white/50">{kind}</p>
      </div>
    </div>
  );
}

export function AlertPreviewMock({ config }: { config: Record<string, unknown> }) {
  const accent = String(config.primary_color || config.accent || "#fbbf24");
  const title = String(config.title || "Yeni Abone");
  const user = String(config.preview_user || "DemoKullanıcı");
  const message = String(config.preview_message || `${user} abone oldu! 🎉`);

  return (
    <div className="flex h-full w-full items-center justify-center bg-transparent p-4">
      <div
        className="w-full max-w-md rounded-2xl border px-6 py-5 text-center shadow-2xl backdrop-blur-md"
        style={{
          borderColor: `${accent}55`,
          background: "linear-gradient(145deg, rgba(12,16,24,.92), rgba(8,10,16,.88))",
          boxShadow: `0 20px 48px rgba(0,0,0,.45), 0 0 32px ${accent}33`,
        }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: accent }}
        >
          Örnek Abone Uyarı Kutusu
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-white/50">{title}</p>
        <p className="mt-3 text-xl font-semibold text-white md:text-2xl">{message}</p>
        <p className="mt-2 text-sm text-white/55">Canlı yayında gerçek olaylar burada görünür</p>
      </div>
    </div>
  );
}

export function renderPreviewAwareWidget(
  kind: string,
  config: Record<string, unknown>,
  isPreviewMode: boolean,
  render: (kind: string, cfg: Record<string, unknown>) => ReactNode
): ReactNode {
  const k = kind.toLowerCase();
  const cfg = previewConfigPatch(kind, config, isPreviewMode);

  if (usesPreviewAlertMock(kind, isPreviewMode)) {
    return <AlertPreviewMock config={cfg} />;
  }
  if (usesPreviewPlaceholder(kind, isPreviewMode)) {
    return (
      <WidgetPlaceholder
        kind={k}
        name={String(config._widgetName || config.title || kind)}
        accent={String(config.primary_color || config.accent || "#f59e0b")}
      />
    );
  }
  return render(kind, cfg);
}
