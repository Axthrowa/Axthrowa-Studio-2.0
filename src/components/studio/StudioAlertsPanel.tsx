/**
 * Studio Alerts — BotRix panel/alerts Advanced Settings tam kapsam
 * Subscription · Gift Sub · Followers · Host · Tip/Donate · KICKs
 * Style · Animation · Disposition · Voice TTS · Typography · Text animation · Tests · Variants
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Copy, ImagePlus, Plus, Save, Volume2 } from "lucide-react";
import { API_BASE, overlayUrl } from "../../lib/api";
import { botaxtApi } from "../../lib/api/botaxt";
import {
  alertVariantsDelete,
  alertVariantsList,
  alertVariantsUpsert,
  alertsList,
  alertsUpsert,
  mediaImportFile,
  mediaPlayableUrls,
} from "../../lib/api/studioMedia";
import {
  ALERT_EVENT_TABS,
  ANIM_IN_OPTIONS,
  ANIM_OUT_OPTIONS,
  FONT_OPTIONS,
  LAYOUT_OPTIONS,
  STYLE_OPTIONS,
  TEXT_EFFECT_OPTIONS,
  TTS_LANG_OPTIONS,
  configFromDbRow,
  configToDbRow,
  defaultAlertType,
  defaultAlertsConfig,
  isAlertEventId,
  type AlertAnimIn,
  type AlertAnimOut,
  type AlertEventId,
  type AlertLayoutMode,
  type AlertStyleMode,
  type AlertTextEffect,
  type AlertTypeConfig,
} from "../../lib/alerts/types";
import { TEMPLATE_CHIPS, highlightTemplateEditor } from "../../lib/alerts/template";
import { AlertQueueEngine } from "../../lib/alerts/queueEngine";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Switch } from "../ui/switch";
import AlertWidget from "../widgets/AlertWidget";
import { cn } from "../../lib/cn";

type Props = { onToast: (m: string) => void };

type StudioVariant = {
  id: string;
  type_id: string;
  name: string;
  min_amount: number;
  max_amount?: number | null;
  enabled: number | boolean;
  template: string;
  media_path?: string | null;
  sound_path?: string | null;
  duration_ms?: number;
  volume?: number;
  anim_in?: string | null;
};

type PreviewPlay = {
  template: string;
  vars: { name: string; amount: string; message: string };
  config: AlertTypeConfig;
  mediaUrl?: string;
  soundUrl?: string;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
      {children}
    </p>
  );
}

async function pickMediaFile(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Medya",
          extensions: [
            "mp4",
            "webm",
            "mov",
            "mkv",
            "mp3",
            "wav",
            "ogg",
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif",
          ],
        },
      ],
    });
    if (!selected || Array.isArray(selected)) return null;
    return selected;
  } catch {
    return null;
  }
}

async function resolveUrl(path?: string) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const m = await mediaPlayableUrls(path);
    return m.streamUrl;
  } catch {
    return `${API_BASE}/media/file?path=${encodeURIComponent(path)}`;
  }
}

function pathLeaf(p?: string) {
  if (!p) return "Seçilmedi";
  if (/^https?:\/\//i.test(p)) return p.slice(0, 48);
  return p.replace(/\\/g, "/").split("/").pop() || p;
}

function on(v: number | boolean | undefined) {
  return v === true || v === 1;
}

export default function StudioAlertsPanel({ onToast }: Props) {
  const [configs, setConfigs] = useState(defaultAlertsConfig);
  const [activeId, setActiveId] = useState<AlertEventId>("sub");
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [variantTab, setVariantTab] = useState(false);
  const [variants, setVariants] = useState<StudioVariant[]>([]);
  const [preview, setPreview] = useState<PreviewPlay | null>(null);
  const [queueLen, setQueueLen] = useState(0);
  const mediaCache = useRef<Record<string, string>>({});
  const engineRef = useRef<AlertQueueEngine<PreviewPlay> | null>(null);

  const draft = configs[activeId];
  const tab = ALERT_EVENT_TABS.find((t) => t.id === activeId)!;
  const obsUrl = overlayUrl(API_BASE || "http://127.0.0.1:8843", "overlay/alerts");

  useEffect(() => {
    engineRef.current = new AlertQueueEngine<PreviewPlay>({
      onPlay: (item) => {
        setPreview(item);
        setQueueLen(engineRef.current?.length ?? 0);
      },
      getDurationMs: (item) => Math.max(1500, item.config.durationSec * 1000),
      onIdle: () => {
        setPreview(null);
        setQueueLen(0);
      },
    });
    return () => engineRef.current?.clear();
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      let a = await alertsList();
      let list = (a.alerts || []) as Record<string, unknown>[];
      if (list.length === 0) {
        try {
          await botaxtApi.seedAlerts();
          a = await alertsList();
          list = (a.alerts || []) as Record<string, unknown>[];
        } catch {
          /* */
        }
      }
      setConfigs((prev) => {
        const next = { ...prev };
        for (const t of ALERT_EVENT_TABS) {
          const row = list.find((r) => String(r.id) === t.id);
          next[t.id] = row ? configFromDbRow(row) : defaultAlertType(t.id);
        }
        return next;
      });
      const v = await alertVariantsList();
      setVariants((v.variants || []) as StudioVariant[]);
    } catch (e) {
      onToast(String((e as Error).message || "Alertler yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (p: Partial<AlertTypeConfig>) => {
    setConfigs((c) => ({ ...c, [activeId]: { ...c[activeId], ...p } }));
  };

  const save = async () => {
    setBusy(true);
    try {
      await alertsUpsert(configToDbRow(activeId, draft, tab.label));
      onToast("Alert kaydedildi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  const saveToggle = async (id: AlertEventId, enabled: boolean) => {
    const cfg = { ...configs[id], enabled };
    setConfigs((c) => ({ ...c, [id]: cfg }));
    try {
      const label = ALERT_EVENT_TABS.find((t) => t.id === id)?.label || id;
      await alertsUpsert(configToDbRow(id, cfg, label));
    } catch (e) {
      onToast(String((e as Error).message || "Toggle kaydedilemedi"));
      await load();
    }
  };

  const importMedia = async (target: "media" | "sound") => {
    const picked = await pickMediaFile();
    if (!picked) return;
    setBusy(true);
    try {
      const m = await mediaImportFile(picked, "alerts");
      if (target === "media") patch({ mediaPath: m.path });
      else patch({ soundPath: m.path });
      mediaCache.current[m.path] = m.streamUrl;
      onToast(target === "media" ? "Görsel yüklendi" : "Ses yüklendi");
    } catch (e) {
      onToast(String((e as Error).message || "Medya yüklenemedi"));
    } finally {
      setBusy(false);
    }
  };

  const enqueuePreview = useCallback(
    async (id: AlertEventId) => {
      const cfg = configs[id];
      const meta = ALERT_EVENT_TABS.find((t) => t.id === id)!;
      const mediaUrl =
        (cfg.mediaPath && mediaCache.current[cfg.mediaPath]) || (await resolveUrl(cfg.mediaPath));
      const soundUrl =
        (cfg.soundPath && mediaCache.current[cfg.soundPath]) || (await resolveUrl(cfg.soundPath));
      if (cfg.mediaPath && mediaUrl) mediaCache.current[cfg.mediaPath] = mediaUrl;
      if (cfg.soundPath && soundUrl) mediaCache.current[cfg.soundPath] = soundUrl;
      engineRef.current?.enqueue({
        template: cfg.template,
        vars: { name: meta.testUser, amount: meta.testAmount, message: meta.testMessage },
        config: cfg,
        mediaUrl,
        soundUrl,
      });
      setQueueLen(engineRef.current?.length ?? 0);
    },
    [configs]
  );

  const testLive = async (id: AlertEventId) => {
    const meta = ALERT_EVENT_TABS.find((t) => t.id === id)!;
    void enqueuePreview(id);
    try {
      await botaxtApi.testAlert({
        kind: id,
        type_id: id,
        user: meta.testUser,
        message: meta.testMessage || undefined,
        amount: meta.testAmount || undefined,
      });
      onToast(`Test: ${meta.label}`);
    } catch (e) {
      onToast(String((e as Error).message || "Canlı test gönderilemedi (önizleme çalıştı)"));
    }
  };

  const activeVariants = useMemo(
    () =>
      variants
        .filter((v) => v.type_id === activeId)
        .sort((a, b) => a.min_amount - b.min_amount),
    [variants, activeId]
  );

  const addVariant = async () => {
    setBusy(true);
    try {
      await alertVariantsUpsert({
        type_id: activeId,
        name: `Varyant ≥ 50`,
        min_amount: 50,
        enabled: true,
        template: draft.template,
        duration_ms: draft.durationSec * 1000,
        volume: draft.volume,
        anim_in: draft.animIn,
      });
      onToast("Varyant eklendi");
      const all = await alertVariantsList();
      setVariants((all.variants || []) as StudioVariant[]);
    } catch (e) {
      onToast(String((e as Error).message || "Önce alert’i kaydedin"));
    } finally {
      setBusy(false);
    }
  };

  const previewMedia = useMemo(() => {
    if (preview?.mediaUrl) return preview.mediaUrl;
    const p = draft.mediaPath;
    if (!p) return undefined;
    return mediaCache.current[p];
  }, [preview, draft.mediaPath]);

  const inputCls =
    "h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-[13px] text-white outline-none focus:border-emerald-400/40";

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col gap-4 overflow-y-auto px-1 pb-8 text-white">
      {/* Widget URL */}
      <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-center text-[13px] font-semibold text-red-400">
          Bu linki kimseyle paylaşmayın, sohbete yapıştırmayın
        </p>
        <FieldLabel>Widget URL</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <input readOnly value={obsUrl} className={`${inputCls} min-w-0 flex-1 font-mono text-[12px]`} />
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={cn(
              "h-10 rounded-xl border px-4 text-[12px] font-semibold",
              showAdvanced
                ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                : "border-emerald-400/50 text-emerald-300 hover:bg-emerald-400/10"
            )}
          >
            Advanced settings
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(obsUrl);
              onToast("OBS URL kopyalandı");
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-[13px] font-bold text-black"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-[12px] font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> Kaydet
          </button>
        </div>
        {showAdvanced ? (
          <p className="text-[12px] text-white/50">
            OBS → Browser Source → URL · Width 800 · Height 600 · Shutdown when not visible
          </p>
        ) : null}
      </div>

      {/* Test alerts */}
      <div>
        <p className="mb-2 text-[13px] font-medium text-white/70">Test alerts — aşağıdaki düğmelerle deneyin:</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ALERT_EVENT_TABS.map((t) => (
            <button
              key={`test-${t.id}`}
              type="button"
              onClick={() => void testLive(t.id)}
              className="flex h-12 items-center justify-between rounded-xl bg-emerald-400 px-4 text-left text-[14px] font-bold text-black transition hover:bg-emerald-300"
            >
              <span>{t.label}</span>
              <span className="flex size-7 items-center justify-center rounded-md bg-black/90 text-emerald-300">
                <Plus className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex flex-wrap gap-1">
          {ALERT_EVENT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveId(t.id);
                setVariantTab(false);
              }}
              className={cn(
                "relative px-4 py-3 text-[13px] font-semibold transition",
                activeId === t.id && !variantTab ? "text-white" : "text-white/50 hover:text-white/70"
              )}
            >
              {t.label}
              {activeId === t.id && !variantTab ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 bg-emerald-400" />
              ) : null}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVariantTab(true)}
            className={cn(
              "relative px-4 py-3 text-[13px] font-semibold transition",
              variantTab ? "text-white" : "text-white/50 hover:text-white/70"
            )}
          >
            Alert variants
            {variantTab ? <span className="absolute inset-x-2 -bottom-px h-0.5 bg-emerald-400" /> : null}
          </button>
        </div>
      </div>

      {variantTab ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-white/60">Eşik bazlı varyantlar (ör. bağış ≥ 50)</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void addVariant()}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-400 px-3 text-[12px] font-bold text-black"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          {activeVariants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[13px] text-white/50">
              Henüz varyant yok
            </p>
          ) : (
            activeVariants.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3"
              >
                <input
                  className="h-9 min-w-[120px] flex-1 rounded-lg border border-white/10 bg-black/40 px-2 text-[12px] text-white"
                  value={v.name}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((x) => (x.id === v.id ? { ...x, name: e.target.value } : x))
                    )
                  }
                />
                <input
                  type="number"
                  className="h-9 w-24 rounded-lg border border-white/10 bg-black/40 px-2 text-[12px] text-white"
                  value={v.min_amount}
                  onChange={(e) =>
                    setVariants((prev) =>
                      prev.map((x) =>
                        x.id === v.id ? { ...x, min_amount: Number(e.target.value) || 0 } : x
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="h-9 rounded-lg border border-emerald-400/40 px-3 text-[11px] font-semibold text-emerald-300"
                  onClick={() =>
                    void alertVariantsUpsert({
                      id: v.id,
                      type_id: v.type_id,
                      name: v.name,
                      min_amount: v.min_amount,
                      enabled: on(v.enabled),
                      template: v.template,
                      duration_ms: v.duration_ms,
                      volume: v.volume,
                      anim_in: v.anim_in,
                      media_path: v.media_path,
                      sound_path: v.sound_path,
                    }).then(() => onToast("Varyant kaydedildi"))
                  }
                >
                  Save
                </button>
                <button
                  type="button"
                  className="h-9 rounded-lg border border-rose-400/30 px-3 text-[11px] text-rose-300"
                  onClick={() =>
                    void alertVariantsDelete(v.id).then(async () => {
                      onToast("Silindi");
                      const all = await alertVariantsList();
                      setVariants((all.variants || []) as StudioVariant[]);
                    })
                  }
                >
                  Sil
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2">
              <div>
                <p className="text-[13px] font-semibold text-white/90">{tab.label}</p>
                <p className="text-[11px] text-white/50">Active alert</p>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(v) => void saveToggle(activeId, v)}
                aria-label="Enabled"
              />
            </div>

            {showAdvanced ? (
              <Accordion
                type="multiple"
                defaultValue={[
                  "style",
                  "animation",
                  "disposition",
                  "media",
                  "voice",
                  "typography",
                  "textfx",
                  "template",
                  "advanced",
                ]}
              >
                {/* STYLE */}
                <AccordionItem value="style">
                  <AccordionTrigger>Style</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Style mode</FieldLabel>
                        <select
                          className={inputCls}
                          value={draft.styleMode}
                          onChange={(e) => patch({ styleMode: e.target.value as AlertStyleMode })}
                        >
                          {STYLE_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Alert duration (sn)</FieldLabel>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          className={inputCls}
                          value={draft.durationSec}
                          onChange={(e) =>
                            patch({ durationSec: Math.max(1, Number(e.target.value) || 6) })
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel>Min amount (eşik)</FieldLabel>
                        <input
                          type="number"
                          min={0}
                          className={inputCls}
                          value={draft.minAmount}
                          onChange={(e) => patch({ minAmount: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* ANIMATION */}
                <AccordionItem value="animation">
                  <AccordionTrigger>Animation</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Entrance</FieldLabel>
                        <select
                          className={inputCls}
                          value={draft.animIn}
                          onChange={(e) => patch({ animIn: e.target.value as AlertAnimIn })}
                        >
                          {ANIM_IN_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Exit</FieldLabel>
                        <select
                          className={inputCls}
                          value={draft.animOut}
                          onChange={(e) => patch({ animOut: e.target.value as AlertAnimOut })}
                        >
                          {ANIM_OUT_OPTIONS.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* DISPOSITION */}
                <AccordionItem value="disposition">
                  <AccordionTrigger>Disposition</AccordionTrigger>
                  <AccordionContent>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      {LAYOUT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => patch({ layout: opt.id as AlertLayoutMode })}
                          className={cn(
                            "rounded-xl border px-2 py-3 text-center transition",
                            draft.layout === opt.id
                              ? "border-emerald-400/50 bg-emerald-400/10"
                              : "border-white/10 bg-white/[0.03] hover:border-white/20"
                          )}
                        >
                          <span className="block text-[12px] font-semibold">{opt.label}</span>
                          <span className="mt-1 block text-[10px] text-white/50">{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Vertical text position ({draft.posY})</FieldLabel>
                        <input
                          type="range"
                          min={-40}
                          max={40}
                          value={draft.posY}
                          onChange={(e) => patch({ posY: Number(e.target.value) })}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div>
                        <FieldLabel>Horizontal text position ({draft.posX})</FieldLabel>
                        <input
                          type="range"
                          min={-40}
                          max={40}
                          value={draft.posX}
                          onChange={(e) => patch({ posX: Number(e.target.value) })}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* MEDIA */}
                <AccordionItem value="media">
                  <AccordionTrigger>Image &amp; Sound</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      <div>
                        <FieldLabel>Image (URL veya yükle)</FieldLabel>
                        <div className="flex gap-2">
                          <input
                            className={`${inputCls} min-w-0 flex-1 text-[12px]`}
                            value={draft.mediaPath}
                            onChange={(e) => patch({ mediaPath: e.target.value })}
                            placeholder="https://…gif / png"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void importMedia("media")}
                            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-emerald-400/40 px-3 text-[12px] font-semibold text-emerald-300"
                          >
                            <ImagePlus className="h-3.5 w-3.5" /> Yükle
                          </button>
                        </div>
                        <p className="mt-1 truncate text-[10px] text-white/50">{pathLeaf(draft.mediaPath)}</p>
                      </div>
                      <div>
                        <FieldLabel>Sound (URL veya yükle)</FieldLabel>
                        <div className="flex gap-2">
                          <input
                            className={`${inputCls} min-w-0 flex-1 text-[12px]`}
                            value={draft.soundPath}
                            onChange={(e) => patch({ soundPath: e.target.value })}
                            placeholder="https://….mp3"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void importMedia("sound")}
                            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-emerald-400/40 px-3 text-[12px] font-semibold text-emerald-300"
                          >
                            <Volume2 className="h-3.5 w-3.5" /> Yükle
                          </button>
                        </div>
                        <p className="mt-1 truncate text-[10px] text-white/50">{pathLeaf(draft.soundPath)}</p>
                      </div>
                      <div>
                        <FieldLabel>Volume (0–100) — %{Math.round(draft.volume * 100)}</FieldLabel>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(draft.volume * 100)}
                          onChange={(e) => patch({ volume: Number(e.target.value) / 100 })}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* VOICE TTS */}
                <AccordionItem value="voice">
                  <AccordionTrigger>Voice (TTS)</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <FieldLabel>Language / Dialect</FieldLabel>
                        <select
                          className={inputCls}
                          value={draft.ttsEnabled ? draft.ttsLang : ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            patch({ ttsEnabled: !!v, ttsLang: v || "tr-TR" });
                          }}
                        >
                          {TTS_LANG_OPTIONS.map((l) => (
                            <option key={l.id || "off"} value={l.id}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>TTS volume — %{Math.round(draft.ttsVolume * 100)}</FieldLabel>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          disabled={!draft.ttsEnabled}
                          value={Math.round(draft.ttsVolume * 100)}
                          onChange={(e) => patch({ ttsVolume: Number(e.target.value) / 100 })}
                          className="w-full accent-emerald-400 disabled:opacity-40"
                        />
                      </div>
                      <div>
                        <FieldLabel>TTS rate — {draft.ttsRate.toFixed(2)}</FieldLabel>
                        <input
                          type="range"
                          min={50}
                          max={200}
                          disabled={!draft.ttsEnabled}
                          value={Math.round(draft.ttsRate * 100)}
                          onChange={(e) => patch({ ttsRate: Number(e.target.value) / 100 })}
                          className="w-full accent-emerald-400 disabled:opacity-40"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel>TTS pitch — {draft.ttsPitch.toFixed(2)}</FieldLabel>
                        <input
                          type="range"
                          min={50}
                          max={200}
                          disabled={!draft.ttsEnabled}
                          value={Math.round(draft.ttsPitch * 100)}
                          onChange={(e) => patch({ ttsPitch: Number(e.target.value) / 100 })}
                          className="w-full accent-emerald-400 disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* TYPOGRAPHY */}
                <AccordionItem value="typography">
                  <AccordionTrigger>Typography</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Top text color (name)</FieldLabel>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            className="h-10 w-12 rounded-lg border border-white/10 bg-transparent"
                            value={draft.nameColor}
                            onChange={(e) => patch({ nameColor: e.target.value })}
                          />
                          <input
                            className={`${inputCls} flex-1 text-[12px]`}
                            value={draft.nameColor}
                            onChange={(e) => patch({ nameColor: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <FieldLabel>Bottom text color</FieldLabel>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            className="h-10 w-12 rounded-lg border border-white/10 bg-transparent"
                            value={draft.textColor}
                            onChange={(e) => patch({ textColor: e.target.value })}
                          />
                          <input
                            className={`${inputCls} flex-1 text-[12px]`}
                            value={draft.textColor}
                            onChange={(e) => patch({ textColor: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <FieldLabel>Font family</FieldLabel>
                        <select
                          className={inputCls}
                          value={draft.fontFamily}
                          onChange={(e) => patch({ fontFamily: e.target.value })}
                        >
                          {FONT_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f.split(",")[0]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Font size ({draft.fontSize}px)</FieldLabel>
                        <input
                          type="number"
                          min={12}
                          max={96}
                          className={inputCls}
                          value={draft.fontSize}
                          onChange={(e) => patch({ fontSize: Number(e.target.value) || 32 })}
                        />
                      </div>
                      <div>
                        <FieldLabel>Font weight ({draft.fontWeight})</FieldLabel>
                        <input
                          type="range"
                          min={300}
                          max={900}
                          step={100}
                          value={draft.fontWeight}
                          onChange={(e) => patch({ fontWeight: Number(e.target.value) })}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div>
                        <FieldLabel>Letter spacing ({draft.letterSpacing}px)</FieldLabel>
                        <input
                          type="range"
                          min={-2}
                          max={12}
                          value={draft.letterSpacing}
                          onChange={(e) => patch({ letterSpacing: Number(e.target.value) })}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel>Text shadow ({draft.textShadow}px)</FieldLabel>
                        <input
                          type="range"
                          min={0}
                          max={24}
                          value={draft.textShadow}
                          onChange={(e) => patch({ textShadow: Number(e.target.value) })}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-[13px] text-white/75 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={draft.hideMessage}
                          onChange={(e) => patch({ hideMessage: e.target.checked })}
                          className="size-4 accent-emerald-400"
                        />
                        Hide user message
                      </label>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* TEXT ANIMATION */}
                <AccordionItem value="textfx">
                  <AccordionTrigger>Text animation</AccordionTrigger>
                  <AccordionContent>
                    <FieldLabel>Effect</FieldLabel>
                    <select
                      className={inputCls}
                      value={draft.textEffect}
                      onChange={(e) => patch({ textEffect: e.target.value as AlertTextEffect })}
                    >
                      {TEXT_EFFECT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </AccordionContent>
                </AccordionItem>

                {/* TEMPLATE */}
                <AccordionItem value="template">
                  <AccordionTrigger>Message / Template</AccordionTrigger>
                  <AccordionContent>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {TEMPLATE_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() =>
                            patch({
                              template: `${draft.template}${draft.template.endsWith(" ") ? "" : " "}${chip}`.trim(),
                            })
                          }
                          className="rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={draft.template}
                      onChange={(e) => patch({ template: e.target.value })}
                      rows={3}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-[13px] text-white outline-none focus:border-emerald-400/40"
                    />
                    <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed">
                      {highlightTemplateEditor(draft.template)}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* CUSTOM CSS */}
                <AccordionItem value="advanced">
                  <AccordionTrigger>Custom CSS / HTML extras</AccordionTrigger>
                  <AccordionContent>
                    <FieldLabel>Custom CSS</FieldLabel>
                    <textarea
                      rows={4}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[11px] text-white/85"
                      value={draft.customCss}
                      onChange={(e) => patch({ customCss: e.target.value })}
                      placeholder=".alert-root { … }"
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[13px] text-white/50">
                Advanced settings kapalı — açmak için üstteki düğmeye basın.
              </p>
            )}
          </div>

          {/* Preview */}
          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c10] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Preview
                </span>
                <span className="text-[10px] text-white/50">
                  Queue: {queueLen + (preview ? 1 : 0)}
                </span>
              </div>
              <div className="h-[300px] w-full">
                <AlertWidget
                  visible={!!preview}
                  template={preview?.template || draft.template}
                  vars={
                    preview?.vars || {
                      name: tab.testUser,
                      amount: tab.testAmount,
                      message: tab.testMessage,
                    }
                  }
                  config={preview?.config || draft}
                  mediaUrl={preview?.mediaUrl || previewMedia}
                  soundUrl={preview?.soundUrl}
                  previewChrome
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void enqueuePreview(activeId)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[12px] font-medium hover:bg-white/[0.09]"
              >
                Önizle
              </button>
              <button
                type="button"
                onClick={() => void testLive(activeId)}
                className="rounded-xl bg-emerald-400 px-3 py-2.5 text-[12px] font-bold text-black hover:bg-emerald-300"
              >
                Test (OBS)
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// re-export helper used by loaders
export { isAlertEventId };
