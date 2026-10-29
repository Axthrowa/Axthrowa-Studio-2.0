import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  Camera,
  Clapperboard,
  Mic,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { fetchSettings, patchSettings } from "../../lib/api";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import HotkeyInput from "../panel/HotkeyInput";
import HotkeyStatusDot, { type HotkeyFailure } from "./HotkeyStatusDot";
import { SOURCE_MODES } from "../../lib/obsActions";
import {
  findMute,
  findSrcToggle,
  muteBindingId,
  setSrcToggleMode,
  srcToggleBindingId,
  upsertMute,
  upsertSrcToggle,
  type MuteRow,
} from "../../lib/rowHotkeys";
import type { HotkeyRow } from "../../lib/obsHotkeyCatalog";
import ObsShortcutSettings, { type ObsHotkeySlice, type SceneNavHint } from "./ObsShortcutSettings";
import {
  obsControl,
  type ObsConnectionStatus,
  type ObsInputInfo,
  type ObsSceneSnapshot,
  type ObsSourceInfo,
} from "../../lib/obsControl";
import { Switch } from "../ui/switch";
import { WidgetCard } from "../ui/WidgetCard";

export type ObsShortcutBridge = {
  obs: ObsHotkeySlice;
  scenes: string[];
  inputs: { name: string }[];
  globalHotkeys: Set<string>;
  hotkeyError?: string | null;
  /** Kaydedilemeyen kısayollar ve sebepleri (satırlardaki nokta için) */
  hotkeyFailures?: HotkeyFailure[];
  onListeningChange: (listening: boolean) => void;
  onPatch: (patch: ObsHotkeySlice) => void;
  onGoScene: (scene: string, label: string, hint?: SceneNavHint) => void;
  onAction: (id: string) => void;
};

type Props = {
  onToast: (message: string) => void;
  shortcuts?: ObsShortcutBridge;
};

type AutomationConfig = {
  enabled: boolean;
  donationThreshold: number;
  comboThreshold: number;
  action: "scene" | "source";
  sceneName: string;
  sourceName: string;
  cooldownSec: number;
};

const DEFAULT_AUTOMATION: AutomationConfig = {
  enabled: false,
  donationThreshold: 1000,
  comboThreshold: 10,
  action: "scene",
  sceneName: "",
  sourceName: "",
  cooldownSec: 30,
};

const EMPTY_STATUS: ObsConnectionStatus = {
  connected: false,
  connecting: false,
  host: "127.0.0.1",
  port: 4455,
};

const EMPTY_SCENES: ObsSceneSnapshot = {
  scenes: [],
  currentScene: "",
  streaming: false,
};

export default function ObsControlHub({ onToast, shortcuts }: Props) {
  const [status, setStatus] = useState<ObsConnectionStatus>(EMPTY_STATUS);
  const [snapshot, setSnapshot] = useState<ObsSceneSnapshot>(EMPTY_SCENES);
  const [sources, setSources] = useState<ObsSourceInfo[]>([]);
  const [automationSources, setAutomationSources] = useState<ObsSourceInfo[]>([]);
  const [inputs, setInputs] = useState<ObsInputInfo[]>([]);
  const [automation, setAutomation] = useState<AutomationConfig>(DEFAULT_AUTOMATION);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchSettings("panel");
        const obs = (settings.obs || {}) as Record<string, any>;
        setAutomation({ ...DEFAULT_AUTOMATION, ...(obs.automation || {}) });
      } catch {
        /* Varsayılanlarla aç. */
      }
      try {
        setStatus(await obsControl.status());
      } catch {
        setStatus(EMPTY_STATUS);
      }
    })();
  }, []);

  const refresh = useCallback(async (quiet = false) => {
    try {
      const [nextScenes, nextInputs] = await Promise.all([
        obsControl.scenes(),
        obsControl.inputs(),
      ]);
      setSnapshot(nextScenes);
      setInputs(nextInputs);
      setStatus((prev) => ({ ...prev, connected: true, lastError: null }));
      if (nextScenes.currentScene) {
        setSources(await obsControl.sources(nextScenes.currentScene));
      }
    } catch (error) {
      const message = String((error as Error)?.message || error);
      setStatus((prev) => ({ ...prev, connected: false, lastError: message }));
      if (!quiet) onToast(message);
    }
  }, [onToast]);

  // Kart yüklendiğinde OBS henüz bağlı değilse durum bir daha okunmuyordu: uygulama
  // arka planda bağlanınca sahneler/mixer boş kalıyor, sekme değiştirip dönünce
  // (kart yeniden kurulunca) geliyordu. Bağlanana kadar durumu yokla.
  useEffect(() => {
    if (status.connected) return;
    const id = setVisibleInterval(() => {
      void obsControl
        .status()
        .then((next) => {
          if (next.connected) setStatus(next);
        })
        .catch(() => {});
    }, 1500);
    return () => clearVisibleInterval(id);
  }, [status.connected]);

  useEffect(() => {
    if (!status.connected) return;
    void refresh(true);
    // Pencere görünmüyorken OBS'i yoklama; görününce hemen bir kez yenile.
    const id = setVisibleInterval(() => void refresh(true), 3000);
    return () => clearVisibleInterval(id);
  }, [refresh, status.connected]);

  useEffect(() => {
    if (!status.connected || !automation.sceneName) {
      setAutomationSources([]);
      return;
    }
    void obsControl
      .sources(automation.sceneName)
      .then(setAutomationSources)
      .catch(() => setAutomationSources([]));
  }, [automation.sceneName, status.connected]);

  const selectScene = async (sceneName: string) => {
    if (busy) return;
    setBusy(`scene:${sceneName}`);
    try {
      await obsControl.setScene(sceneName);
      setSnapshot((prev) => ({ ...prev, currentScene: sceneName }));
      setSources(await obsControl.sources(sceneName));
    } catch (error) {
      onToast(String((error as Error)?.message || error));
    } finally {
      setBusy("");
    }
  };

  const updateSource = async (source: ObsSourceInfo) => {
    const visible = !source.visible;
    setSources((prev) =>
      prev.map((item) => (item.name === source.name ? { ...item, visible } : item))
    );
    try {
      await obsControl.setSourceVisible(snapshot.currentScene, source.name, visible);
    } catch (error) {
      setSources((prev) =>
        prev.map((item) =>
          item.name === source.name ? { ...item, visible: source.visible } : item
        )
      );
      onToast(String((error as Error)?.message || error));
    }
  };

  const updateMute = async (input: ObsInputInfo) => {
    const muted = !input.muted;
    setInputs((prev) =>
      prev.map((item) => (item.name === input.name ? { ...item, muted } : item))
    );
    try {
      await obsControl.setMuted(input.name, muted);
    } catch (error) {
      setInputs((prev) =>
        prev.map((item) =>
          item.name === input.name ? { ...item, muted: input.muted } : item
        )
      );
      onToast(String((error as Error)?.message || error));
    }
  };

  const saveAutomation = async (next: AutomationConfig) => {
    setAutomation(next);
    try {
      // YALNIZ otomasyon alanı yazılır. Eskiden `host/port/password` da bu karttaki
      // yerel durumdan yazılıyordu: kart yüklenmeden ya da şifre kutusu boşken bir
      // alan odak kaybedince (onBlur) kayıtlı OBS şifresi sessizce siliniyordu.
      await patchSettings("panel", { obs: { automation: next } });
    } catch (error) {
      onToast(String((error as Error)?.message || "Otomasyon kaydedilemedi"));
    }
  };

  /* ---- satır başına kısayol (kaynaklar ve ses mixeri) ---- */
  const hkObs = (shortcuts?.obs || {}) as Record<string, any>;
  const actionRows: HotkeyRow[] = Array.isArray(hkObs.actionHotkeys) ? hkObs.actionHotkeys : [];
  const muteRows: MuteRow[] = Array.isArray(hkObs.sourceMuteHotkeys) ? hkObs.sourceMuteHotkeys : [];
  const hkNewId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `hk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const sourceHotkey = (sourceName: string) => {
    if (!shortcuts) return null;
    const scene = snapshot.currentScene;
    const row = findSrcToggle(actionRows, scene, sourceName);
    return (
      <>
        <HotkeyStatusDot
          bindingId={srcToggleBindingId(row)}
          hotkey={row?.hotkey || ""}
          registered={shortcuts.globalHotkeys}
          failures={shortcuts.hotkeyFailures || []}
        />
        {row?.hotkey ? (
          <select
            aria-label="Kısayolun işlemi"
            className="h-8 w-[5.5rem] rounded-lg bg-zinc-900/80 px-1.5 text-[11px] text-zinc-200 ring-1 ring-white/5 focus:outline-none focus:ring-axthrowa-violet/60"
            value={String(row.mode || "toggle")}
            onChange={(e) =>
              shortcuts.onPatch({ actionHotkeys: setSrcToggleMode(actionRows, row.id, e.target.value) } as never)
            }
          >
            {SOURCE_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === "toggle" ? "Tersle" : m.label}
              </option>
            ))}
          </select>
        ) : null}
        <HotkeyInput
          className={KISAYOL}
          value={row?.hotkey || ""}
          placeholder="Kısayol"
          onListeningChange={shortcuts.onListeningChange}
          onChange={(v) =>
            shortcuts.onPatch({
              actionHotkeys: upsertSrcToggle(actionRows, scene, sourceName, v, hkNewId()),
            } as never)
          }
        />
      </>
    );
  };

  const mixerHotkey = (inputName: string) => {
    if (!shortcuts) return null;
    const row = findMute(muteRows, inputName);
    return (
      <>
        <HotkeyStatusDot
          bindingId={muteBindingId(row)}
          hotkey={row?.hotkey || ""}
          registered={shortcuts.globalHotkeys}
          failures={shortcuts.hotkeyFailures || []}
        />
        <HotkeyInput
          className={KISAYOL}
          value={row?.hotkey || ""}
          placeholder="Kısayol"
          onListeningChange={shortcuts.onListeningChange}
          onChange={(v) =>
            shortcuts.onPatch({
              sourceMuteHotkeys: upsertMute(muteRows, inputName, v, hkNewId()),
            } as never)
          }
        />
      </>
    );
  };

  const targetSources = useMemo(
    () => automationSources,
    [automationSources]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-6 px-1">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-xl font-semibold tracking-tight text-zinc-100">OBS Kontrol</h2>
          <p className="text-sm leading-relaxed text-zinc-400">Sahneler, ses mikseri, kısayollar ve otomasyon</p>
        </div>
        <button
          type="button"
          disabled={!status.connected || !!busy}
          className={DUGME}
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-4 w-4" />
          Yenile
        </button>
      </header>

      <WidgetCard
        title="Sahneler"
        description="Tıkladığın sahne OBS'te yayına (Program) alınır."
        icon={<Clapperboard className="h-4 w-4 text-axthrowa-violet" />}
        action={<span className="text-xs text-zinc-500">{snapshot.scenes.length} sahne</span>}
      >
        <div className="grid max-h-56 grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
          {snapshot.scenes.map((scene, index) => {
            const active = scene === snapshot.currentScene;
            return (
              <button
                key={scene}
                type="button"
                disabled={!status.connected || !!busy}
                onClick={() => void selectScene(scene)}
                className={`group flex min-h-[4.5rem] flex-col justify-between rounded-xl px-4 py-3 text-left transition-all duration-300 active:scale-[.98] ${
                  active
                    ? "bg-axthrowa-violet/10 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.45),0_0_24px_rgba(139,92,246,0.12)]"
                    : "bg-zinc-900/60 hover:bg-zinc-800/50"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className="font-mono text-[10px] tabular-nums text-zinc-500">{String(index + 1).padStart(2, "0")}</span>
                  {active && <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-axthrowa-violet">Program</span>}
                </span>
                <span className={`mt-2 block truncate text-sm font-medium ${active ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"}`}>
                  {scene}
                </span>
              </button>
            );
          })}
          {!snapshot.scenes.length && <EmptyRow text="Sahneleri görmek için OBS'e bağlan." />}
        </div>
      </WidgetCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetCard
          title="Kaynaklar"
          description={snapshot.currentScene ? `“${snapshot.currentScene}” sahnesindeki kaynaklar` : "Aktif sahne yok"}
          icon={<Camera className="h-4 w-4 text-axthrowa-cyan" />}
        >
          <div className="-mx-2 max-h-64 space-y-0.5 overflow-y-auto">
            {sources.map((source) => (
              <ControlRow
                key={source.name}
                label={source.name}
                hint={source.kind}
                enabled={source.visible}
                onToggle={() => void updateSource(source)}
                hotkey={sourceHotkey(source.name)}
              />
            ))}
            {!sources.length && <EmptyRow text="Aktif sahnenin kaynakları burada görünür." />}
          </div>
        </WidgetCard>

        <WidgetCard
          title="Ses Mikseri"
          description="Mikrofon ve masaüstü sesleri"
          icon={<AudioLines className="h-4 w-4 text-axthrowa-cyan" />}
        >
          <div className="-mx-2 max-h-64 space-y-0.5 overflow-y-auto">
            {inputs.map((input) => (
              <ControlRow
                key={input.name}
                label={input.name}
                hint={input.kind}
                enabled={!input.muted}
                enabledText="Açık"
                disabledText="Susturuldu"
                icon={<Mic className={`h-4 w-4 shrink-0 ${input.muted ? "text-red-400" : "text-axthrowa-cyan"}`} />}
                onToggle={() => void updateMute(input)}
                hotkey={mixerHotkey(input.name)}
              />
            ))}
            {!inputs.length && <EmptyRow text="OBS ses girişleri burada görünür." />}
          </div>
        </WidgetCard>
      </div>

      {shortcuts && (
        <ObsShortcutSettings
          obs={shortcuts.obs}
          scenes={shortcuts.scenes.length ? shortcuts.scenes : snapshot.scenes}
          inputs={shortcuts.inputs.length ? shortcuts.inputs : inputs}
          globalHotkeys={shortcuts.globalHotkeys}
          hotkeyError={shortcuts.hotkeyError}
          onListeningChange={shortcuts.onListeningChange}
          onPatch={shortcuts.onPatch}
          onGoScene={shortcuts.onGoScene}
          onAction={shortcuts.onAction}
        />
      )}

      <WidgetCard
        title="Reaktif OBS Otomasyonu"
        description="Yüksek bağış ya da emote kombosu eşiği aşınca OBS'te sahneye geçer ya da bir kaynağı gösterir."
        icon={<Settings2 className="h-4 w-4 text-axthrowa-violet" />}
        action={
          <Switch
            checked={automation.enabled}
            onCheckedChange={(enabled) => void saveAutomation({ ...automation, enabled })}
            aria-label="Otomasyon açık"
          />
        }
      >
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <CompactField
            label="Bağış eşiği"
            type="number"
            value={String(automation.donationThreshold)}
            onChange={(value) => setAutomation((prev) => ({ ...prev, donationThreshold: Math.max(0, Number(value) || 0) }))}
            onBlur={() => void saveAutomation(automation)}
          />
          <CompactField
            label="Kombo eşiği"
            type="number"
            value={String(automation.comboThreshold)}
            onChange={(value) => setAutomation((prev) => ({ ...prev, comboThreshold: Math.max(0, Number(value) || 0) }))}
            onBlur={() => void saveAutomation(automation)}
          />
          <CompactField
            label="Bekleme (sn)"
            type="number"
            value={String(automation.cooldownSec)}
            onChange={(value) => setAutomation((prev) => ({ ...prev, cooldownSec: Math.max(1, Number(value) || 1) }))}
            onBlur={() => void saveAutomation(automation)}
          />
          <Alan label="Eylem">
            <select
              className={GIRDI}
              value={automation.action}
              onChange={(event) =>
                void saveAutomation({
                  ...automation,
                  action: event.target.value as AutomationConfig["action"],
                })
              }
            >
              <option value="scene">Sahneye geç</option>
              <option value="source">Kaynağı göster</option>
            </select>
          </Alan>
          <Alan label="Hedef sahne">
            <select
              className={GIRDI}
              value={automation.sceneName}
              onChange={(event) => void saveAutomation({ ...automation, sceneName: event.target.value })}
            >
              <option value="">— seç —</option>
              {snapshot.scenes.map((scene) => (
                <option key={scene} value={scene}>{scene}</option>
              ))}
            </select>
          </Alan>
          <Alan label="Gösterilecek kaynak">
            <select
              disabled={automation.action !== "source"}
              className={`${GIRDI} disabled:opacity-40`}
              value={automation.sourceName}
              onChange={(event) => void saveAutomation({ ...automation, sourceName: event.target.value })}
            >
              <option value="">— seç —</option>
              {targetSources.map((source) => (
                <option key={source.name} value={source.name}>{source.name}</option>
              ))}
            </select>
          </Alan>
        </div>
      </WidgetCard>
    </div>
  );
}

/** Kart içi giriş: kenarlık yok, ince iç ışık; odakta menekşe */
const GIRDI =
  "h-10 w-full rounded-xl bg-zinc-900/80 px-3 text-sm text-zinc-100 ring-1 ring-white/5 transition-all duration-300 placeholder:text-zinc-600 focus:outline-none focus:ring-axthrowa-violet/60";
const DUGME =
  "inline-flex items-center gap-2 rounded-xl bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-300 transition-all duration-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40";
const KISAYOL =
  "w-24 rounded-lg bg-zinc-900/80 px-2 py-1.5 text-center font-mono text-[11px] text-zinc-200 ring-1 ring-white/5 transition-all duration-300 focus:outline-none focus:ring-axthrowa-violet/60";

function Alan({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function CompactField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
}) {
  return (
    <Alan label={label}>
      <input className={GIRDI} type={type} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
    </Alan>
  );
}

function ControlRow({
  label,
  hint,
  enabled,
  enabledText = "Görünür",
  disabledText = "Gizli",
  icon,
  onToggle,
  hotkey,
}: {
  label: string;
  hint: string;
  enabled: boolean;
  enabledText?: string;
  disabledText?: string;
  icon?: React.ReactNode;
  onToggle: () => void;
  /** Satırın kısayol kutusu (nokta + tuş) */
  hotkey?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-xl px-3 py-2.5 transition-all duration-300 hover:bg-zinc-800/50">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-medium tracking-tight text-zinc-100">{label}</p>
          <p className="truncate text-xs text-zinc-500">{hint}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {hotkey && <div className="flex items-center gap-1.5">{hotkey}</div>}
        <span className={`w-16 text-right text-[11px] ${enabled ? "text-axthrowa-cyan" : "text-zinc-500"}`}>
          {enabled ? enabledText : disabledText}
        </span>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`${label}: ${enabled ? enabledText : disabledText}`} />
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="col-span-full flex min-h-24 items-center justify-center rounded-xl bg-zinc-900/50 px-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}
