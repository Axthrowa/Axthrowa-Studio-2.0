import ObsShortcutSettings, { type SceneNavHint } from "../studio/ObsShortcutSettings";
import ObsActionSettings from "../studio/ObsActionSettings";
import SourceVisibilityHotkeys from "../studio/SourceVisibilityHotkeys";
import GeneralObsHotkeys from "../studio/GeneralObsHotkeys";
import ObsHotkeyBrowser from "../studio/ObsHotkeyBrowser";
import type { ActionRow } from "../../lib/obsActions";
import { replaceSection, splitRows, type HotkeyRow } from "../../lib/obsHotkeyCatalog";

/**
 * Kısayollar sekmesi — tüm kısayollar tek yerde.
 *
 * Eskiden sahne/ses/eylem kısayolları her ekranın (Giriş/Çıkış/Mola) 340 px'lik
 * yan sütunundaki "OBS WebSocket" kartına sıkıştırılmıştı; taşıyor, üst üste
 * biniyordu. Bölümler OBS'in kendi Ayarlar → Kısayollar sekmesinin sırasını
 * izler: sahneler, ses, kaynaklar, genel (yayın/kayıt), diğer.
 */

type Props = {
  obs: Record<string, any>;
  scenes: string[];
  inputs: { name: string }[];
  obsConnected: boolean;
  globalHotkeys: Set<string>;
  hotkeyFailures: { id: string; spec: string; reason: string }[];
  hotkeyError: string | null;
  onListeningChange: (listening: boolean) => void;
  /** `obs` diliminin bir parçasını günceller (tüm ekranlara yansır) */
  onPatch: (patch: Record<string, unknown>) => void;
  onGoScene: (scene: string, label: string, hint?: SceneNavHint) => void;
  onAction: (id: string) => void;
  onRunRow: (row: HotkeyRow) => void;
};

export default function HotkeysPage({
  obs,
  scenes,
  inputs,
  obsConnected,
  globalHotkeys,
  hotkeyFailures,
  hotkeyError,
  onListeningChange,
  onPatch,
  onGoScene,
  onAction,
  onRunRow,
}: Props) {
  const all: HotkeyRow[] = Array.isArray(obs.actionHotkeys) ? (obs.actionHotkeys as HotkeyRow[]) : [];
  const parts = splitRows(all);
  const setAll = (next: HotkeyRow[]) => onPatch({ actionHotkeys: next });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-white">Kısayollar</h2>
        <p className="text-xs leading-relaxed text-panel-muted">
          Tuşlar uygulama tepsideyken de çalışır. Noktalar: <span className="text-emerald-300">yeşil</span> =
          kayıtlı, <span className="text-amber-300">sarı</span> = yalnız panel odaktayken,{" "}
          <span className="text-red-300">kırmızı</span> = kaydedilemedi (imleci üzerine getirip sebebini gör).
          {!obsConnected && (
            <span className="ml-1 text-amber-200">
              OBS'e bağlı değil: kaynak ve OBS kısayol listeleri için önce Dashboard'dan bağlan.
            </span>
          )}
        </p>
      </header>

      <ObsShortcutSettings
        obs={obs}
        scenes={scenes}
        inputs={inputs}
        globalHotkeys={globalHotkeys}
        hotkeyFailures={hotkeyFailures}
        hotkeyError={hotkeyError}
        onListeningChange={onListeningChange}
        onPatch={onPatch}
        onGoScene={onGoScene}
        onAction={onAction}
      />

      <SourceVisibilityHotkeys
        rows={parts.source}
        scenes={scenes}
        obsConnected={obsConnected}
        registered={globalHotkeys}
        failures={hotkeyFailures}
        onListeningChange={onListeningChange}
        onChange={(next) => setAll(replaceSection(all, "source", next))}
        onRun={onRunRow}
      />

      <GeneralObsHotkeys
        all={all}
        registered={globalHotkeys}
        failures={hotkeyFailures}
        onListeningChange={onListeningChange}
        onChange={setAll}
      />

      <ObsHotkeyBrowser
        rows={parts.obsHotkey}
        inputs={inputs}
        scenes={scenes}
        obsConnected={obsConnected}
        registered={globalHotkeys}
        failures={hotkeyFailures}
        onListeningChange={onListeningChange}
        onChange={(next) => setAll(replaceSection(all, "obsHotkey", next))}
        onRun={onRunRow}
      />

      <ObsActionSettings
        rows={parts.action as ActionRow[]}
        scenes={scenes}
        inputs={inputs}
        registered={globalHotkeys}
        failures={hotkeyFailures}
        onListeningChange={onListeningChange}
        onChange={(next) => setAll(replaceSection(all, "action", next as HotkeyRow[]))}
        onRun={(row) => onRunRow(row as HotkeyRow)}
        hideKinds={["srcToggle", "obsHotkey"]}
      />
    </div>
  );
}
