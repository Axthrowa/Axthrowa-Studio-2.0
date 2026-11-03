import { Keyboard, AlertCircle } from "lucide-react";
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
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      {/* Header Deck */}
      <header className="rounded-2xl border border-white/[0.07] bg-panel-card/60 p-3 shadow-glass space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-panel-accent/30 bg-panel-accent/15 text-panel-accent shadow-glow-sm">
              <Keyboard className="size-5.5" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                Stüdyo Kısayolları
              </h2>
              <p className="text-sm font-medium text-white/80">
                Tüm global ve yerel kısayol atamalarını tek merkezden yönetin
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-300 font-semibold">
              <span className="size-2 rounded-full bg-emerald-400 shadow-glow-sm" />
              Küresel Kayıtlı
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-300 font-semibold">
              <span className="size-2 rounded-full bg-amber-400" />
              Panel Odaklı
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-red-300 font-semibold">
              <span className="size-2 rounded-full bg-red-400" />
              Çakışma / Hata
            </span>
          </div>
        </div>

        {!obsConnected && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs md:text-sm text-amber-200">
            <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">
              <span className="font-bold">OBS bağlantısı aktif değil: </span>
              Kaynak ve sahne kısayol listelerini senkronize etmek için önce Dashboard üzerinden OBS WebSocket bağlantısını kurun.
            </div>
          </div>
        )}
      </header>

      {/* Sections */}
      <div className="grid items-start gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <div className="xl:col-span-2">
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
        </div>

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

        {/* Tek kalan yarım kart sağda boşluk bırakıyordu */}
        <div className="xl:col-span-2">
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

        {/* İki sıra sütunlu liste: yarım genişlikte adlar kesiliyordu */}
        <div className="xl:col-span-2">
        <GeneralObsHotkeys
          all={all}
          registered={globalHotkeys}
          failures={hotkeyFailures}
          onListeningChange={onListeningChange}
          onChange={setAll}
        />
        </div>
      </div>
    </div>
  );
}
