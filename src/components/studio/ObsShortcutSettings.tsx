import { Keyboard, Volume2 } from "lucide-react";
import HotkeyInput from "../panel/HotkeyInput";

export type SceneNavHint = "starting" | "ending" | "brb" | "chat";

export type ObsHotkeySlice = {
  sceneMap?: Record<string, string>;
  sceneOnEnd?: string;
  brbScene?: string;
  endingScene?: string;
  startingScene?: string;
  muteAllExceptMic?: boolean;
  hotkeys?: Record<string, string>;
  sceneSwitchHotkeys?: { id: string; scene?: string; hotkey?: string; label?: string }[];
  sourceMuteHotkeys?: { id: string; input?: string; hotkey?: string }[];
};

type Props = {
  obs: ObsHotkeySlice;
  scenes: string[];
  inputs: { name: string }[];
  /** Kaydedilen binding **kimlikleri** (tuş metni değil). */
  globalHotkeys: Set<string>;
  /** Kaydedilemeyenler ve sebepleri — çakışma dahil. */
  hotkeyFailures?: { id: string; spec: string; reason: string }[];
  hotkeyError?: string | null;
  onListeningChange: (listening: boolean) => void;
  onPatch: (patch: ObsHotkeySlice) => void;
  onGoScene: (scene: string, label: string, hint?: SceneNavHint) => void;
  onAction: (id: string) => void;
  /** Dar sütun: iki kartı yan yana değil alt alta diz. */
  stacked?: boolean;
};

function newId(prefix: string) {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Kısayolun durumu. Üç ayrı hâl var — eskiden ikisi tek "sarı" içindeydi:
 * - yeşil: küresel kayıt tutuyor
 * - kırmızı: kaydedilemedi (çoğunlukla başka bir eylemle aynı tuş)
 * - sarı: kayıt bekliyor / yalnız panel odaktayken çalışır
 * Durum, **binding kimliği** üzerinden okunuyor; aynı tuşu paylaşan iki satırda
 * tuş metni ikisini ayırt edemiyordu.
 */
function HotkeyDot({
  id,
  spec,
  registered,
  failures,
}: {
  id: string;
  spec: string;
  registered: Set<string>;
  failures: { id: string; spec: string; reason: string }[];
}) {
  const fail = failures.find((f) => f.id === id);
  const ok = !!spec && registered.has(id);
  const color = !spec
    ? "bg-amber-400"
    : fail
      ? "bg-red-400"
      : ok
        ? "bg-emerald-400"
        : "bg-amber-400";
  const title = !spec
    ? "Kısayol atanmadı"
    : fail
      ? `Kaydedilemedi: ${fail.reason}`
      : ok
        ? "Küresel kayıt tutuyor — uygulama tepsideyken de çalışır"
        : "Yalnızca panel odaktayken çalışır";
  return <span className={"size-2 shrink-0 rounded-full " + color} title={title} />;
}

export default function ObsShortcutSettings({
  obs,
  scenes,
  inputs,
  globalHotkeys,
  hotkeyFailures = [],
  hotkeyError,
  onListeningChange,
  onPatch,
  onGoScene,
  onAction,
  stacked = false,
}: Props) {
  const map = obs.sceneMap || {};
  const hotkeys = obs.hotkeys || {};
  const extras = obs.sceneSwitchHotkeys || [];
  const sourceMutes = obs.sourceMuteHotkeys || [];
  const exceptMic = obs.muteAllExceptMic !== false;

  const patchHotkey = (id: string, value: string) =>
    onPatch({ hotkeys: { ...hotkeys, [id]: value } });

  const roleScenes = (
    [
      ["starting", "Giriş", map.starting || obs.startingScene || ""],
      ["ending", "Bitiş", map.ending || obs.endingScene || ""],
      ["brb", "Mola", map.brb || obs.brbScene || ""],
      ["game", "Oyun", map.game || obs.sceneOnEnd || ""],
    ] as const
  );

  return (
    // Geniş sayfada (OBS Kontrol) iki sütun; 340 px'lik yan sütunda tek sütun.
    // Grid sütunları `minmax(0,1fr)`: yoksa çocuk içeriğinin en küçük genişliğine
    // kadar küçülemez ve dar kutunun (270 px) sağından taşardı.
    <div
      className={
        stacked
          ? "grid grid-cols-[minmax(0,1fr)] gap-3"
          : "grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      }
    >
      <section className="min-w-0 rounded-xl border border-white/[0.07] bg-[#101216] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-semibold text-white">
            <Keyboard className="h-4 w-4 text-panel-accent" /> Sahne kısayolları
          </h3>
          <button
            type="button"
            className="yya-btn-ghost h-7 px-2 text-[10px]"
            onClick={() =>
              onPatch({
                sceneSwitchHotkeys: [...extras, { id: newId("sc"), label: "", scene: "", hotkey: "" }],
              })
            }
          >
            + Sahne
          </button>
        </div>
        <p className="mb-2 text-[10px] text-panel-muted">
          Yeşil = tepsideyken de çalışır · Sarı = yalnız panel odaktayken · Kırmızı = kaydedilemedi (imleci üzerine getirip sebebi gör). Bir yerde değişince tüm sekmelere yazılır.
        </p>
        {hotkeyError && (
          <p className="mb-2 text-[10px] text-amber-300">
            Bazı kısayollar kaydedilemedi: {hotkeyError}
          </p>
        )}
        <div className="space-y-2">
          {roleScenes.map(([id, label, sceneVal]) => {
            // Sabit varsayılan yok: kullanıcı temizlediyse gerçekten boş.
            const hk = hotkeys[id] || "";
            return (
              <div key={id} className="space-y-1 rounded-lg border border-white/[0.06] bg-black/20 p-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-md bg-panel-accent/80 px-2 py-1.5 text-[11px] font-medium"
                    onClick={() =>
                      onGoScene(sceneVal, label, id === "game" ? undefined : (id as SceneNavHint))
                    }
                  >
                    {label}
                  </button>
                  <HotkeyDot id={id} spec={hk} registered={globalHotkeys} failures={hotkeyFailures} />
                  <HotkeyInput
                    className="w-16 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-[11px]"
                    value={hk}
                    title="Kısayol"
                    onListeningChange={onListeningChange}
                    onChange={(v) => patchHotkey(id, v)}
                  />
                </div>
                <select
                  className="w-full rounded border border-panel-border bg-black/40 px-2 py-1.5 text-[11px] text-white"
                  value={scenes.includes(sceneVal) ? sceneVal : sceneVal ? sceneVal : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const sceneMap = { ...map, [id]: v };
                    const extra: ObsHotkeySlice = { sceneMap };
                    if (id === "game") extra.sceneOnEnd = v;
                    if (id === "brb") extra.brbScene = v;
                    if (id === "ending") extra.endingScene = v;
                    if (id === "starting") extra.startingScene = v;
                    onPatch(extra);
                  }}
                >
                  <option value="">{label} sahnesi…</option>
                  {sceneVal && !scenes.includes(sceneVal) && (
                    <option value={sceneVal}>{sceneVal} (listede yok)</option>
                  )}
                  {scenes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          {extras.map((row, idx) => {
            const hk = row.hotkey || "";
            const sceneName = row.scene || "";
            const customLabel = (row.label || "").trim() || sceneName || "Sahne";
            return (
              <div
                key={row.id || idx}
                className="space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-2 py-1 text-[11px]"
                    value={row.label || ""}
                    placeholder="İsim (ör. Just Chatting)"
                    onChange={(e) => {
                      const next = [...extras];
                      next[idx] = { ...next[idx], label: e.target.value };
                      onPatch({ sceneSwitchHotkeys: next });
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded bg-panel-accent/80 px-2 py-1 text-[11px] font-medium"
                    disabled={!sceneName}
                    onClick={() => onGoScene(sceneName, customLabel)}
                  >
                    Geç
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded bg-red-900/50 px-2 py-1 text-[11px] text-red-200"
                    onClick={() =>
                      onPatch({ sceneSwitchHotkeys: extras.filter((_, i) => i !== idx) })
                    }
                  >
                    Sil
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {scenes.length > 0 ? (
                    <select
                      className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-1 py-1 text-[11px]"
                      value={scenes.includes(sceneName) ? sceneName : ""}
                      onChange={(e) => {
                        const next = [...extras];
                        next[idx] = { ...next[idx], scene: e.target.value };
                        onPatch({ sceneSwitchHotkeys: next });
                      }}
                    >
                      <option value="">OBS sahnesi…</option>
                      {sceneName && !scenes.includes(sceneName) && (
                        <option value={sceneName}>{sceneName} (listede yok)</option>
                      )}
                      {scenes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-1 py-1 text-[11px]"
                      value={sceneName}
                      placeholder="OBS sahne adı (önce Bağlan)"
                      onChange={(e) => {
                        const next = [...extras];
                        next[idx] = { ...next[idx], scene: e.target.value };
                        onPatch({ sceneSwitchHotkeys: next });
                      }}
                    />
                  )}
                  <HotkeyDot id={`sceneSwitch:${row.id}`} spec={hk} registered={globalHotkeys} failures={hotkeyFailures} />
                  <HotkeyInput
                    className="w-24 shrink-0 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-[11px]"
                    value={hk}
                    placeholder="Ctrl+5"
                    onListeningChange={onListeningChange}
                    onChange={(v) => {
                      const next = [...extras];
                      next[idx] = { ...next[idx], hotkey: v };
                      onPatch({ sceneSwitchHotkeys: next });
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-white/[0.07] bg-[#101216] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
          <Volume2 className="h-4 w-4 text-panel-accent" /> Ses kısayolları
        </h3>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-md bg-red-700/80 px-2 py-2 text-[11px]"
            onClick={() => onAction("stopStream")}
          >
            Stop Stream
          </button>
          <button
            type="button"
            className="rounded-md bg-black/40 px-2 py-2 text-[11px]"
            onClick={() => onAction("mic")}
          >
            Mikrofon aç/kapa
          </button>
          <button
            type="button"
            className="rounded-md bg-black/40 px-2 py-2 text-[11px]"
            onClick={() => onAction("muteAll")}
          >
            {exceptMic ? "Diğer sesler aç/kapa" : "Tüm sesler aç/kapa"}
          </button>
          <button
            type="button"
            className="rounded-md bg-black/40 px-2 py-2 text-[11px]"
            onClick={() => onAction("music")}
          >
            Müzik aç/kapa
          </button>
        </div>

        <label className="mb-2 flex items-start gap-2 text-[11px]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={exceptMic}
            onChange={(e) => onPatch({ muteAllExceptMic: e.target.checked })}
          />
          <span>
            Toplu ses kapatırken mikrofonu hariç tut
            <span className="mt-0.5 block text-[10px] text-panel-muted">
              Açıkken “diğer sesler” kısayolu mikrofona dokunmaz.
            </span>
          </span>
        </label>

        <div className="space-y-1.5">
          {(
            [
              ["mic", "Mikrofon aç/kapa"],
              ["muteAll", exceptMic ? "Diğer sesler aç/kapa" : "Tüm sesler aç/kapa"],
              ["music", "Müzik aç/kapa"],
            ] as const
          ).map(([id, label]) => {
            const hk = hotkeys[id] || "";
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px]">{label}</span>
                <HotkeyDot id={id} spec={hk} registered={globalHotkeys} failures={hotkeyFailures} />
                <HotkeyInput
                  className="w-28 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-[11px]"
                  value={hk}
                  placeholder="örn. Ctrl+M"
                  onListeningChange={onListeningChange}
                  onChange={(v) => patchHotkey(id, v)}
                />
              </div>
            );
          })}
        </div>

        <hr className="my-3 border-white/[0.07]" />
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-[11px] font-semibold text-white">Kaynak ses kısayolları</h4>
          <button
            type="button"
            className="yya-btn-ghost h-7 px-2 text-[10px]"
            onClick={() =>
              onPatch({
                sourceMuteHotkeys: [...sourceMutes, { id: newId("sm"), input: "", hotkey: "" }],
              })
            }
          >
            + Kaynak
          </button>
        </div>
        <div className="space-y-2">
          {sourceMutes.map((row, idx) => {
            const hk = row.hotkey || "";
            const inputName = row.input || "";
            return (
              <div
                key={row.id || idx}
                className="space-y-1.5 rounded-lg border border-white/[0.06] bg-black/20 p-2"
              >
                <div className="flex items-center gap-2">
                  <select
                    className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-1 py-1 text-[11px]"
                    value={inputName}
                    onChange={(e) => {
                      const next = [...sourceMutes];
                      next[idx] = { ...next[idx], input: e.target.value };
                      onPatch({ sourceMuteHotkeys: next });
                    }}
                  >
                    <option value="">Kaynak seç…</option>
                    {inputName && !inputs.some((i) => i.name === inputName) && (
                      <option value={inputName}>{inputName} (yok)</option>
                    )}
                    {inputs.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="shrink-0 rounded bg-black/40 px-2 py-1 text-[11px]"
                    disabled={!inputName}
                    onClick={() => onAction(`srcMute:${row.id}`)}
                  >
                    Aç/Kapa
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded bg-red-900/50 px-2 py-1 text-[11px] text-red-200"
                    onClick={() =>
                      onPatch({ sourceMuteHotkeys: sourceMutes.filter((_, i) => i !== idx) })
                    }
                  >
                    Sil
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-panel-muted">Kısayol</span>
                  <HotkeyDot id={`srcMute:${row.id}`} spec={hk} registered={globalHotkeys} failures={hotkeyFailures} />
                  <HotkeyInput
                    className="w-28 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-[11px]"
                    value={hk}
                    placeholder="örn. Ctrl+1"
                    onListeningChange={onListeningChange}
                    onChange={(v) => {
                      const next = [...sourceMutes];
                      next[idx] = { ...next[idx], hotkey: v };
                      onPatch({ sourceMuteHotkeys: next });
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
