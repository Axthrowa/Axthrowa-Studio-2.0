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
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(4455);
  const [password, setPassword] = useState("");
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
        setHost(String(obs.host || "127.0.0.1"));
        setPort(Number(obs.port) || 4455);
        setPassword(String(obs.password || ""));
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

  const connect = async () => {
    if (busy) return;
    setBusy("connect");
    setStatus((prev) => ({ ...prev, connecting: true, lastError: null }));
    try {
      const next = await obsControl.connect(host, port, password);
      setStatus(next);
      // Şifre kutusu boşsa kayıtlı şifreyi ezme (aynı adreste); bkz. ConnectionsHub.
      const kayit: Record<string, unknown> = { host, port, automation };
      if (password.trim()) kayit.password = password;
      await patchSettings("panel", { obs: kayit });
      await refresh(true);
      onToast("OBS WebSocket v5 bağlantısı kuruldu");
    } catch (error) {
      const message = String((error as Error)?.message || error);
      setStatus((prev) => ({
        ...prev,
        connected: false,
        connecting: false,
        lastError: message,
      }));
      onToast(message);
    } finally {
      setBusy("");
    }
  };

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
            className="yya-input h-7 w-[5.5rem] px-1 text-[10px]"
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
          className="w-24 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-[11px]"
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
          className="w-24 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-[11px]"
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
    <div className="mx-auto max-w-6xl space-y-2">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold text-white">OBS Kontrol</h2>
          <p className="text-[11px] text-panel-muted">
            Sahneler, mixer ve kısayollar
          </p>
        </div>
        <button
          type="button"
          disabled={!status.connected || !!busy}
          className="yya-btn-ghost h-8 px-3 text-[11px]"
          onClick={() => void refresh()}
        >
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
          Yenile
        </button>
      </header>

      <section className="rounded-xl border border-white/[0.07] bg-[#101216] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
              <Clapperboard className="h-4 w-4 text-panel-accent" /> Sahneler
            </h3>
            <span className="text-[10px] text-panel-muted">{snapshot.scenes.length} sahne</span>
          </div>
          <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {snapshot.scenes.map((scene, index) => {
              const active = scene === snapshot.currentScene;
              return (
                <button
                  key={scene}
                  type="button"
                  disabled={!status.connected || !!busy}
                  onClick={() => void selectScene(scene)}
                  className={`group min-h-16 rounded-lg border px-3 py-2 text-left transition active:scale-[.98] ${
                    active
                      ? "border-panel-accent/60 bg-panel-accent/10 shadow-[inset_0_0_18px_rgba(62,237,254,.08),0_0_14px_rgba(62,237,254,.08)]"
                      : "border-white/[0.07] bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-[9px] tabular-nums text-white/50">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`mt-1 block truncate text-[11px] font-medium ${active ? "text-panel-accent" : "text-white/75"}`}>
                    {scene}
                  </span>
                  {active && <span className="mt-1 block text-[8px] uppercase tracking-widest text-panel-accent/60">Program</span>}
                </button>
              );
            })}
            {!snapshot.scenes.length && (
              <div className="col-span-full flex min-h-24 items-center justify-center text-[11px] text-panel-muted">
                Sahneleri görmek için OBS’e bağlanın.
              </div>
            )}
          </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ControlList
          title="Kaynaklar"
          subtitle={snapshot.currentScene || "Aktif sahne yok"}
          icon={<Camera className="h-4 w-4 text-panel-accent" />}
        >
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
        </ControlList>

        <ControlList
          title="Ses Mixer"
          subtitle="Mikrofon ve masaüstü sesleri"
          icon={<AudioLines className="h-4 w-4 text-panel-accent" />}
        >
          {inputs.map((input) => (
            <ControlRow
              key={input.name}
              label={input.name}
              hint={input.kind}
              enabled={!input.muted}
              enabledText="Açık"
              disabledText="Susturuldu"
              icon={<Mic className={`h-3.5 w-3.5 ${input.muted ? "text-red-300" : "text-panel-accent"}`} />}
              onToggle={() => void updateMute(input)}
              hotkey={mixerHotkey(input.name)}
            />
          ))}
          {!inputs.length && <EmptyRow text="OBS ses girişleri burada görünür." />}
        </ControlList>
      </section>

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

      <section className="rounded-xl border border-white/[0.07] bg-[#101216] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
              <Settings2 className="h-4 w-4 text-panel-accent" /> Reaktif OBS Otomasyonu
            </h3>
            <p className="mt-1 text-[10px] text-panel-muted">
              Yüksek bağış veya emote kombosu eşik değerini aşınca Rust motoru OBS’i tetikler.
            </p>
          </div>
          <ControlSwitch
            enabled={automation.enabled}
            onToggle={() => void saveAutomation({ ...automation, enabled: !automation.enabled })}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
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
          <label className="block text-[10px] text-panel-muted">
            <span className="mb-1 block">Aksiyon</span>
            <select
              className="yya-input h-8 py-1 text-[11px]"
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
          </label>
          <label className="block text-[10px] text-panel-muted">
            <span className="mb-1 block">Hedef sahne</span>
            <select
              className="yya-input h-8 py-1 text-[11px]"
              value={automation.sceneName}
              onChange={(event) =>
                void saveAutomation({ ...automation, sceneName: event.target.value })
              }
            >
              <option value="">— seç —</option>
              {snapshot.scenes.map((scene) => (
                <option key={scene} value={scene}>{scene}</option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] text-panel-muted">
            <span className="mb-1 block">Özel kaynak</span>
            <select
              disabled={automation.action !== "source"}
              className="yya-input h-8 py-1 text-[11px] disabled:opacity-40"
              value={automation.sourceName}
              onChange={(event) =>
                void saveAutomation({ ...automation, sourceName: event.target.value })
              }
            >
              <option value="">— seç —</option>
              {targetSources.map((source) => (
                <option key={source.name} value={source.name}>{source.name}</option>
              ))}
            </select>
          </label>
          <CompactField
            label="Bekleme (sn)"
            type="number"
            value={String(automation.cooldownSec)}
            onChange={(value) => setAutomation((prev) => ({ ...prev, cooldownSec: Math.max(1, Number(value) || 1) }))}
            onBlur={() => void saveAutomation(automation)}
          />
        </div>
      </section>
    </div>
  );
}

function CompactField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-[10px] text-panel-muted ${className}`}>
      <span className="mb-1 block">{label}</span>
      <input
        className="yya-input h-8 py-1 text-[11px]"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </label>
  );
}

function ControlList({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#101216] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white">{icon}{title}</h3>
        <span className="max-w-52 truncate text-[9px] text-panel-muted">{subtitle}</span>
      </div>
      <div className="max-h-52 space-y-1 overflow-y-auto">{children}</div>
    </div>
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-black/20 px-3 py-2">
      {icon}
      <div className="min-w-[6rem] flex-1">
        <p className="truncate text-[11px] font-medium text-white/80">{label}</p>
        <p className="truncate text-[9px] text-panel-muted">{hint}</p>
      </div>
      {hotkey && <div className="flex items-center gap-1.5">{hotkey}</div>}
      <span className={`text-[9px] ${enabled ? "text-panel-accent" : "text-white/50"}`}>
        {enabled ? enabledText : disabledText}
      </span>
      <ControlSwitch enabled={enabled} onToggle={onToggle} />
    </div>
  );
}

function ControlSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative h-5 w-9 rounded-full border transition ${
        enabled ? "border-panel-accent/40 bg-panel-accent/25" : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition ${
          enabled
            ? "left-[18px] bg-panel-accent shadow-[0_0_8px_rgba(62,237,254,.45)]"
            : "left-0.5 bg-white/35"
        }`}
      />
    </button>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-white/[0.07] text-[10px] text-panel-muted">
      {text}
    </div>
  );
}
