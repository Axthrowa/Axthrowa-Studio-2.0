import { Radio } from "lucide-react";
import HotkeyInput from "../panel/HotkeyInput";
import HotkeyStatusDot, { type HotkeyFailure } from "./HotkeyStatusDot";
import { actionBindingId } from "../../lib/obsActions";
import {
  GENERAL_HOTKEYS,
  generalHotkeyOf,
  generalRowId,
  setGeneralHotkey,
  type HotkeyRow,
} from "../../lib/obsHotkeyCatalog";

/**
 * Yayın ve kayıt — OBS'in "Ayarlar → Kısayollar → Genel" bölümündeki sık
 * kullanılanlar: yayın, kayıt, tekrar arabelleği, sanal kamera, ekran görüntüsü.
 * Tuş atayınca satır oluşur, temizleyince silinir; OBS'te hangi tuşları
 * kullandığından bağımsız çalışır (uygulama tuşu yakalayıp OBS'e komut yollar).
 */

type Props = {
  /** Tüm `obs.actionHotkeys` satırları */
  all: HotkeyRow[];
  registered: Set<string>;
  failures: HotkeyFailure[];
  onListeningChange: (listening: boolean) => void;
  onChange: (all: HotkeyRow[]) => void;
};

export default function GeneralObsHotkeys({ all, registered, failures, onListeningChange, onChange }: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass">
      <div className="border-b border-white/[0.06] pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <Radio className="h-4.5 w-4.5 text-panel-accent" /> Yayın ve kayıt
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-white/75">
          OBS'in Ayarlar → Kısayollar → Genel bölümündeki komutlar. Tuş ata, boş bırakırsan kapalı kalır.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {GENERAL_HOTKEYS.map((g) => {
          const hk = generalHotkeyOf(all, g.name);
          return (
            <div key={g.name} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2">
              <HotkeyStatusDot
                bindingId={actionBindingId(generalRowId(g.name))}
                hotkey={hk}
                registered={registered}
                failures={failures}
              />
              <span className="min-w-0 flex-1 truncate text-xs md:text-sm font-semibold text-white" title={g.name}>
                {g.label}
              </span>
              <HotkeyInput
                className="w-32 rounded-lg border border-panel-border bg-black/50 px-2 py-1.5 text-center font-mono text-xs md:text-sm font-medium text-white"
                value={hk}
                onListeningChange={onListeningChange}
                onChange={(v) => onChange(setGeneralHotkey(all, g.name, v))}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
