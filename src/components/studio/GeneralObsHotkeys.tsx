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
    <section className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio className="h-4 w-4 text-panel-accent" /> Yayın ve kayıt
        </h3>
        <p className="mt-0.5 text-[11px] leading-snug text-panel-muted">
          OBS'in Ayarlar → Kısayollar → Genel bölümündeki komutlar. Tuş ata, boş bırakırsan kapalı kalır.
        </p>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2">
        {GENERAL_HOTKEYS.map((g) => {
          const hk = generalHotkeyOf(all, g.name);
          return (
            <div key={g.name} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <HotkeyStatusDot
                bindingId={actionBindingId(generalRowId(g.name))}
                hotkey={hk}
                registered={registered}
                failures={failures}
              />
              <span className="min-w-0 flex-1 truncate text-xs text-white" title={g.name}>
                {g.label}
              </span>
              <HotkeyInput
                className="w-28 rounded border border-panel-border bg-black/40 px-1.5 py-1 text-center text-xs"
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
