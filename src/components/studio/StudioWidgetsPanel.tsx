/** BotAxt Widget Studio — %30 ayar / %70 sticky önizleme (Botrix). */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Layers,
  Link2,
  RefreshCw,
  Save,
} from "lucide-react";
import { API_BASE } from "../../lib/api";
import {
  widgetsList,
  widgetsPatchConfig,
  widgetsUpsert,
} from "../../lib/api/studioMedia";
import { cn } from "../../lib/cn";
import {
  groupIdForKind,
  WIDGET_GROUPS,
  type WidgetGroupId,
} from "../../lib/widgets/catalog";
import {
  masterObsUrl,
  type MasterScenePatch,
} from "../../lib/widgets/masterLayout";
import { Switch } from "../ui/switch";
import DynamicWidgetForm from "./DynamicWidgetForm";
import MasterOverlayPreview from "./MasterOverlayPreview";
import WidgetRuntimePanel from "./WidgetRuntimePanel";
import WidgetTestBar from "./WidgetTestBar";

export type StudioWidget = {
  id: string;
  kind: string;
  name: string;
  obs_path: string;
  obs_url?: string;
  group?: string;
  groupLabel?: string;
  config_json?: string;
  config?: Record<string, unknown>;
  enabled: number | boolean;
  schema_version?: number;
  sort_order?: number;
};

type Props = { onToast: (m: string) => void };

function on(v: number | boolean | undefined) {
  return v === true || v === 1;
}

function parseConfig(w: StudioWidget): Record<string, unknown> {
  let base: Record<string, unknown> = {};
  if (w.config && typeof w.config === "object") base = { ...w.config };
  else if (w.config_json) {
    try {
      const j = JSON.parse(w.config_json);
      if (j && typeof j === "object") base = j as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return enrichConfigForForm(w.kind, base);
}

function enrichConfigForForm(
  kind: string,
  cfg: Record<string, unknown>
): Record<string, unknown> {
  const c = { ...cfg };
  const k = (kind || "").toLowerCase();
  if (k === "poll" || k === "polls") {
    if (c.question == null) c.question = "Bugün ne oynayalım?";
    if (!Array.isArray(c.options) || (c.options as unknown[]).length === 0) {
      c.options = ["Evet", "Hayır"];
    }
    if (c.command == null) c.command = "!oy";
  }
  if (k === "wheel" || k === "fortunewheel") {
    const slices =
      (Array.isArray(c.slices) && c.slices) ||
      (Array.isArray(c.segments) && c.segments) ||
      [
        { label: "VIP", color: "#22d3ee" },
        { label: "Ban", color: "#EF4444" },
        { label: "100 Puan", color: "#ff8a5b" },
      ];
    if (!Array.isArray(c.slices) || (c.slices as unknown[]).length === 0) c.slices = slices;
    if (!Array.isArray(c.segments) || (c.segments as unknown[]).length === 0) {
      c.segments = c.slices;
    }
    if (c.command == null) c.command = "!cark";
  }
  if (k === "goal" || k === "goals") {
    if (c.startValue == null) c.startValue = 0;
    if (c.target == null) c.target = 100;
    const cur = Number(c.current);
    if (!Number.isFinite(cur) || cur <= 0) c.current = 50;
    if (c.volume == null) c.volume = 72;
    if (c.glowIntensity == null) c.glowIntensity = 1;
    if (c.sfxEnabled == null) c.sfxEnabled = true;
    if (c.sfxPreset == null) c.sfxPreset = "success";
    if (c.layout == null) c.layout = "bar";
    if (c.showPercent == null) c.showPercent = true;
    if (c.showValue == null) c.showValue = true;
    // Eski dar/alt slot → önizlemede görünür alan
    const h = Number(c.height);
    const y = Number(c.position_y ?? c.posY ?? 0);
    if (!Number.isFinite(h) || h < 100) c.height = 140;
    if (!Number.isFinite(Number(c.width)) || Number(c.width) < 400) c.width = 1200;
    if (!Number.isFinite(y) || y > 900) {
      c.position_y = 820;
      c.posY = 820;
    }
    if (c.position_x == null && c.posX == null) {
      c.position_x = 360;
      c.posX = 360;
    }
    if (c.z_index == null || Number(c.z_index) < 20) c.z_index = 45;
    c.enabled = c.enabled === false || c.enabled === 0 ? c.enabled : true;
  }
  if (k === "credits" || k === "moviecredits") {
    if (c.title == null) c.title = "Teşekkürler";
    if (c.footer_message == null) {
      c.footer_message = String(c.closingMessage || "İzlediğiniz için teşekkürler!");
    }
    if (c.scroll_speed == null) c.scroll_speed = 5;
  }
  if (k === "songrequest" || k === "now-playing") {
    if (c.command == null) c.command = "!sr";
    if (c.volume == null) c.volume = 70;
    else if (Number(c.volume) > 0 && Number(c.volume) <= 1) {
      c.volume = Math.round(Number(c.volume) * 100);
    }
    if (c.show_video == null) c.show_video = false;
  }
  if (k === "chat") {
    if (c.font_family == null) c.font_family = String(c.fontFamily || "Outfit");
    if (c.primary_color == null) c.primary_color = String(c.accent || "#22d3ee");
    if (c.background_opacity == null) {
      const op = Number(c.opacity);
      c.background_opacity = Number.isFinite(op) ? Math.round(op * 100) : 55;
    }
  }
  if (k === "subathon") {
    if (c.custom_title == null || String(c.custom_title).trim().toLowerCase() === "tema ismi") {
      c.custom_title = "Subathon";
    }
    delete c.title;
    if (c.font_family == null) c.font_family = String(c.fontFamily || "JetBrains Mono");
    if (c.primary_color == null) c.primary_color = String(c.accent || "#22d3ee");
    if (c.background_opacity == null) c.background_opacity = 35;
    if (c.endsAt == null) c.endsAt = "";
    if (c.showEndsAt == null) c.showEndsAt = false;
    if (c.scale == null) c.scale = 1;
    if (c.time_per_follow == null) c.time_per_follow = Number(c.secondsPerFollow ?? 120);
    if (c.time_per_sub == null) c.time_per_sub = Number(c.secondsPerSub ?? 300);
    if (c.time_per_donation == null) c.time_per_donation = Number(c.secondsPerTip ?? 60);
    if (c.time_per_kick == null) c.time_per_kick = Number(c.secondsPerKick ?? 180);
    c.secondsPerFollow = c.time_per_follow;
    c.secondsPerSub = c.time_per_sub;
    c.secondsPerTip = c.time_per_donation;
    c.secondsPerKick = c.time_per_kick;
  }
  if (k === "emotewall" || k === "cup" || k === "emotecombo") {
    if (c.mass == null) c.mass = 1;
    if (c.friction == null) c.friction = k === "cup" ? 0.2 : 0.02;
    if (c.frictionAir == null) c.frictionAir = k === "cup" ? 0.01 : 0.012;
    if (c.restitution == null) c.restitution = k === "cup" ? 0.32 : 0.82;
  }
  if (k === "kicksubs" || k === "kick-subs" || k === "kick_subs") {
    if (!String(c.custom_title ?? "").trim()) c.custom_title = "Kick Aboneler";
    if (c.layout == null) c.layout = "list";
    if (c.theme == null) c.theme = "kick";
    if (c.maxItems == null) c.maxItems = 6;
    if (c.showTitle == null) c.showTitle = true;
    if (c.showMonths == null) c.showMonths = true;
    if (c.showGifted == null) c.showGifted = true;
    if (c.showSessionCount == null) c.showSessionCount = true;
    if (c.showGoal == null) c.showGoal = false;
    if (c.fontSize == null) c.fontSize = 16;
    if (c.accent == null) c.accent = "#3EEDFE";
    const h = Number(c.height);
    const w = Number(c.width);
    if (!Number.isFinite(h) || h < 200) c.height = 380;
    if (!Number.isFinite(w) || w < 240) c.width = 360;
    if (c.position_x == null && c.posX == null) {
      c.position_x = 40;
      c.posX = 40;
    }
    if (c.position_y == null && c.posY == null) {
      c.position_y = 120;
      c.posY = 120;
    }
  }

  // Select sibling dizileri — form dropdown’ları için (eski DB satırları)
  const ensureArr = (key: string, defaults: string[]) => {
    if (!Array.isArray(c[key]) || (c[key] as unknown[]).length === 0) {
      c[key] = defaults;
    }
  };
  if (k === "goal" || k === "goals") {
    ensureArr("layouts", ["bar", "circle", "minimal"]);
    ensureArr("metrics", ["followers", "subs", "tips", "kick"]);
    ensureArr("sfxPresets", ["none", "chime", "coin", "boom", "levelup", "sparkle", "success"]);
  }
  if (k === "chat") {
    ensureArr("themes", [
      "boxed",
      "clean",
      "transparent",
      "bubbles",
      "streamline",
      "side",
      "neon",
      "glitch",
    ]);
    ensureArr("messageAnims", ["slide", "fade", "pop"]);
  }
  if (k === "kicksubs" || k === "kick-subs" || k === "kick_subs") {
    ensureArr("layouts", ["list", "combined", "alert"]);
    ensureArr("themes", ["kick", "neon", "glass", "minimal", "cyber"]);
  }
  if (k === "subathon") {
    ensureArr("themes", ["neon", "minimal", "cyberpunk"]);
  }
  if (k === "hypetrain" || k === "hype") {
    ensureArr("themes", ["neon", "minimal", "cyberpunk"]);
  }
  if (k === "cup" || k === "glass") {
    ensureArr("vessels", ["cup", "glass", "bowl"]);
    ensureArr("physicsModes", ["matter", "simple"]);
    ensureArr("spawnOn", ["bits", "tip", "sub", "follow"]);
    ensureArr("bodyKinds", ["circle", "emote"]);
  }
  if (k === "emotewall" || k === "emotes") {
    ensureArr("physicsModes", ["matter", "simple"]);
  }
  if (k === "tts" || k === "cloudtts") {
    ensureArr("engines", ["browser", "cloud"]);
  }
  if (k === "viewers") {
    if (!Array.isArray(c.platforms) || (c.platforms as unknown[]).length === 0) {
      c.platforms = ["kick", "twitch"];
    }
    if (c.mode == null) c.mode = "sum";
  }
  if (k === "raffles" || k === "giveaway") {
    if (c.revealEffect == null) c.revealEffect = "confetti";
  }
  if (k === "activity" || k === "activityfeed") {
    if (c.anim == null) c.anim = "slide";
  }
  if (k === "shoutout" || k === "shoutouts") {
    if (c.animIn == null) c.animIn = "fade";
    if (c.animOut == null) c.animOut = "fade";
  }

  if (c.enabled == null) c.enabled = true;
  if (c.position_x == null) c.position_x = Number(c.posX ?? 0) || 0;
  if (c.position_y == null) c.position_y = Number(c.posY ?? 0) || 0;
  if (c.width == null) c.width = 480;
  if (c.height == null) c.height = 320;
  if (c.z_index == null) c.z_index = 10;
  if (c.scale == null) c.scale = 1;
  if (c.fontSize == null && c.font_size != null) c.fontSize = Number(c.font_size) || 18;
  if (c.fontSize == null) c.fontSize = 18;
  return c;
}

const ALL_TAB: WidgetGroupId | "all" = "all";

export default function StudioWidgetsPanel({ onToast }: Props) {
  const [widgets, setWidgets] = useState<StudioWidget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [configs, setConfigs] = useState<Record<string, Record<string, unknown>>>({});
  const configsRef = useRef(configs);
  configsRef.current = configs;
  const [busy, setBusy] = useState(false);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [tab, setTab] = useState<WidgetGroupId | "all">("all");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/api/botaxt/widgets/seed`, { method: "POST" }).catch(
        () => null
      );
      const res = await widgetsList();
      const list = ((res.widgets || []) as StudioWidget[]).sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          (a.name || "").localeCompare(b.name || "", "tr")
      );
      setWidgets(list);
      const cfgMap: Record<string, Record<string, unknown>> = {};
      for (const w of list) cfgMap[w.id] = parseConfig(w);
      setConfigs(cfgMap);
      if (list.length && (!selectedId || !list.some((w) => w.id === selectedId))) {
        setSelectedId(list[0].id);
      }
    } catch (e) {
      onToast(String((e as Error).message || "Widget’lar yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [onToast, selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => widgets.find((w) => w.id === selectedId) || null,
    [widgets, selectedId]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: widgets.length };
    for (const w of widgets) {
      const g = (w.group as WidgetGroupId) || groupIdForKind(w.kind);
      map[g] = (map[g] || 0) + 1;
    }
    return map;
  }, [widgets]);

  const filtered = useMemo(() => {
    if (tab === ALL_TAB) return widgets;
    return widgets.filter(
      (w) => ((w.group as WidgetGroupId) || groupIdForKind(w.kind)) === tab
    );
  }, [widgets, tab]);

  const copyMasterObs = async () => {
    try {
      await navigator.clipboard.writeText(masterObsUrl(API_BASE || "http://127.0.0.1:8843"));
      setCopiedMaster(true);
      onToast("Master Overlay URL kopyalandı");
      window.setTimeout(() => setCopiedMaster(false), 2000);
    } catch {
      onToast("Kopyalama başarısız");
    }
  };

  const saveConfig = async (w: StudioWidget) => {
    setBusy(true);
    try {
      await widgetsPatchConfig(w.id, configs[w.id] || {});
      onToast(`${w.name} kaydedildi`);
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async (w: StudioWidget, enabled: boolean) => {
    setBusy(true);
    try {
      const cfg = { ...(configs[w.id] || parseConfig(w)), enabled };
      await widgetsUpsert({
        id: w.id,
        kind: w.kind,
        name: w.name,
        obs_path: w.obs_path,
        enabled,
        config: cfg,
        sort_order: w.sort_order,
      });
      setConfigs((prev) => ({ ...prev, [w.id]: cfg }));
      setWidgets((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, enabled } : x))
      );
      onToast(enabled ? "Widget aktif" : "Widget pasif");
    } catch (e) {
      onToast(String((e as Error).message || "Güncellenemedi"));
    } finally {
      setBusy(false);
    }
  };

  const setField = (id: string, key: string, value: unknown) => {
    setConfigs((prev) => {
      const cur = { ...(prev[id] || {}) };
      const numericKeys = new Set([
        "fontSize",
        "font_size",
        "width",
        "height",
        "scale",
        "opacity",
        "volume",
        "position_x",
        "position_y",
        "posX",
        "posY",
        "z_index",
      ]);
      let nextVal = value;
      if (numericKeys.has(key)) {
        const n = typeof value === "number" ? value : Number(value);
        nextVal = Number.isFinite(n) ? n : cur[key] ?? 0;
      }
      cur[key] = nextVal;
      if (key === "position_x") cur.posX = nextVal;
      if (key === "position_y") cur.posY = nextVal;
      if (key === "posX") cur.position_x = nextVal;
      if (key === "posY") cur.position_y = nextVal;
      if (key === "fontSize") cur.font_size = nextVal;
      if (key === "font_size") cur.fontSize = nextVal;
      if (key === "slices") cur.segments = nextVal;
      if (key === "segments") cur.slices = nextVal;
      if (key === "footer_message") cur.closingMessage = nextVal;
      if (key === "closingMessage") cur.footer_message = nextVal;
      if (key === "scroll_speed") {
        const n = Number(nextVal) || 5;
        cur.speedSec = Math.max(10, 110 - n * 10);
      }
      if (key === "font_family") cur.fontFamily = nextVal;
      if (key === "primary_color") {
        cur.color = nextVal;
        cur.accent = nextVal;
      }
      if (key === "background_opacity") {
        const n = Number(nextVal);
        cur.opacity = Number.isFinite(n)
          ? Math.min(1, Math.max(0, n / 100))
          : cur.opacity;
      }
      if (key === "command") {
        cur.voteCommand = nextVal;
        cur.requestCommand = nextVal;
      }
      if (key === "time_per_follow") cur.secondsPerFollow = nextVal;
      if (key === "time_per_sub") cur.secondsPerSub = nextVal;
      if (key === "time_per_donation") {
        cur.secondsPerTip = nextVal;
        cur.secondsPerDonation = nextVal;
      }
      if (key === "time_per_kick") {
        cur.secondsPerKick = nextVal;
        cur.secondsPerRaid = nextVal;
      }
      if (key === "custom_title") {
        delete cur.title;
      }
      if (key === "metric" || key === "goalType") {
        const m = String(nextVal || "");
        const labels: Record<string, string> = {
          followers: "Takipçi Hedefi",
          subs: "Abone Hedefi",
          tips: "Bağış Hedefi",
          kick: "Kick Hedefi",
        };
        if (labels[m]) cur.title = labels[m];
      }
      return { ...prev, [id]: cur };
    });
  };

  const applyScene = useCallback((id: string, patch: MasterScenePatch) => {
    setSelectedId(id);
    setConfigs((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  }, []);

  const commitScene = useCallback(
    async (id: string, patch: MasterScenePatch) => {
      setSelectedId(id);
      const cfg = { ...(configsRef.current[id] || {}), ...patch };
      setConfigs((prev) => ({ ...prev, [id]: cfg }));
      try {
        await widgetsPatchConfig(id, cfg);
      } catch (e) {
        onToast(String((e as Error).message || "Sahne kaydedilemedi"));
      }
    },
    [onToast]
  );

  const previewWidgets = useMemo(
    () =>
      widgets.map((w) => ({
        ...w,
        config: configs[w.id] || parseConfig(w),
      })),
    [widgets, configs]
  );

  if (!editorOpen || !selected) {
    return (
      <section
        className="mx-auto w-full max-w-[1400px] space-y-3 p-1"
        data-ui="botaxt-widget-library"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="yya-label">Studio</p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-white/90">Widget’lar</h2>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className="yya-btn-ghost"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Yenile
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void copyMasterObs()}
              className="yya-btn-primary"
            >
              <Link2 className="h-3.5 w-3.5" />
              {copiedMaster ? "Kopyalandı" : "OBS Master"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-0.5 rounded-lg border border-white/[0.05] bg-black/30 p-0.5">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150",
              tab === "all"
                ? "bg-emerald-500/15 text-emerald-400"
                : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            )}
          >
            Tümü ({counts.all || 0})
          </button>
          {WIDGET_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setTab(g.id)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150",
                tab === g.id
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
              )}
            >
              {g.label} ({counts[g.id] || 0})
            </button>
          ))}
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((w) => (
              <motion.button
                key={w.id}
                type="button"
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={() => {
                  setSelectedId(w.id);
                  setEditorOpen(true);
                }}
                className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.06]"
              >
                <span
                  className="grid size-8 place-items-center rounded-md border border-white/[0.06] bg-white/[0.03]"
                >
                  <Layers className="h-3.5 w-3.5 text-white/70" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-white/90">
                    {w.name}
                  </span>
                  <span className="block text-[11px] text-white/50">
                    {w.kind}
                    {on(w.enabled) ? " · aktif" : " · pasif"}
                  </span>
                </span>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    on(w.enabled) ? "bg-emerald-500" : "bg-white/20"
                  )}
                />
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </section>
    );
  }

  return (
    <section
      className="botaxt-widget-studio w-full overflow-hidden rounded-lg border border-white/[0.05] bg-[#0c0d10]"
      data-ui="botaxt-studio-editor-30-70"
    >
      <div className="grid min-h-[min(84vh,940px)] lg:grid-cols-[minmax(300px,34fr)_66fr]">
        <aside className="relative z-30 flex min-h-0 flex-col border-b border-white/[0.05] bg-[#0c0d10] lg:border-b-0 lg:border-r">
          <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.05] px-2.5 py-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Geri"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-white/90">{selected.name}</p>
              <p className="yya-label truncate normal-case tracking-normal">{selected.kind}</p>
            </div>
            <Switch
              checked={on(selected.enabled)}
              disabled={busy}
              onCheckedChange={(v) => void toggleEnabled(selected, v)}
            />
          </header>

          <div className="relative z-30 min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-2.5 py-2.5">
            <DynamicWidgetForm
              kind={selected.kind}
              config={configs[selected.id] || {}}
              onChange={(key, value) => setField(selected.id, key, value)}
            />
            <WidgetRuntimePanel
              kind={selected.kind}
              config={configs[selected.id] || {}}
              onToast={onToast}
              onConfigPatch={(key, value) => setField(selected.id, key, value)}
            />
          </div>

          <footer className="relative z-30 shrink-0 border-t border-white/[0.05] p-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveConfig(selected)}
              className="yya-btn-primary w-full"
            >
              <Save className="h-3.5 w-3.5" />
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </footer>
        </aside>

        <div className="relative z-10 flex min-h-0 flex-col bg-[#090a0c] lg:sticky lg:top-0 lg:h-[min(84vh,940px)]">
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5 sm:p-3">
            <div className="flex items-center justify-between">
              <p className="yya-label">Canlı önizleme</p>
              <button
                type="button"
                onClick={() => void copyMasterObs()}
                className="text-[11px] text-white/50 transition-colors hover:text-emerald-400"
              >
                {copiedMaster ? "Link kopyalandı" : "OBS link"}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-visible rounded-lg border border-white/[0.05]">
              <MasterOverlayPreview
                widgets={previewWidgets}
                liveConfigs={configs}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                checkerboard
                onRemove={(id) => {
                  const w = widgets.find((x) => x.id === id);
                  if (w) void toggleEnabled(w, false);
                }}
                onRemoveAll={() => {
                  void (async () => {
                    for (const w of widgets.filter((x) => on(x.enabled))) {
                      await toggleEnabled(w, false);
                    }
                  })();
                }}
                onSceneChange={applyScene}
                onSceneCommit={(id, patch) => void commitScene(id, patch)}
                className="h-full"
              />
            </div>
            <WidgetTestBar
              kind={selected.kind}
              busy={busy}
              onToast={onToast}
              onAfterTest={() => void load()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
