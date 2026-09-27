/**
 * Sahne Geçişleri dock'u (OBS "Scene Transitions"): tuvalin geçiş türü, süresi, geçiş özellikleri (luma resmi,
 * stinger dosyası, kaydırma yönü…). Studio Mode açıkken "Geçiş" düğmesi önizlemeyi programa alır.
 */
import { useEffect, useState } from "react";
import { ArrowRightLeft, Settings2 } from "lucide-react";
import type { MotorGecis } from "../../lib/api/motor";

export function GecislerDock({
  gecis,
  turler,
  studyo,
  meşgul,
  onTur,
  onSure,
  onOzellikler,
  onGecis,
}: {
  gecis: MotorGecis | undefined;
  turler: { id: string; ad: string }[];
  studyo: boolean;
  meşgul: boolean;
  onTur: (tur: string) => void;
  onSure: (ms: number) => void;
  onOzellikler: () => void;
  onGecis: () => void;
}) {
  const [sure, setSure] = useState(String(gecis?.sure_ms ?? 300));
  useEffect(() => setSure(String(gecis?.sure_ms ?? 300)), [gecis?.sure_ms]);
  const sureUygula = () => {
    const v = Math.round(Number(sure));
    if (Number.isFinite(v) && v >= 0 && v <= 20000 && v !== gecis?.sure_ms) onSure(v);
    else setSure(String(gecis?.sure_ms ?? 300));
  };
  const kesme = gecis?.tur === "cut_transition";
  return (
    <section className="dt-dock h-full" aria-label="Sahne geçişleri">
      <div className="dt-dock-baslik">Sahne Geçişleri</div>
      <div className="dt-dock-govde">
        <div className="dt-form">
          <label htmlFor="gecis-tur">Geçiş</label>
          <span className="flex items-center gap-1">
            <select id="gecis-tur" className="dt-input min-w-0 flex-1" value={gecis?.tur ?? ""} disabled={!turler.length} onChange={(e) => onTur(e.target.value)}>
              {!turler.some((t) => t.id === gecis?.tur) && gecis?.tur && <option value={gecis.tur}>{gecis.tur}</option>}
              {turler.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.ad}
                </option>
              ))}
            </select>
            <button type="button" className="dt-tool" aria-label="Geçiş özellikleri" title="Geçiş özellikleri" onClick={onOzellikler}>
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </span>
          <label htmlFor="gecis-sure">Süre</label>
          <span className="flex items-center gap-1.5">
            <input
              id="gecis-sure"
              className="dt-input dt-sayi w-20"
              inputMode="numeric"
              value={sure}
              disabled={kesme}
              onChange={(e) => setSure(e.target.value)}
              onBlur={sureUygula}
              onKeyDown={(e) => e.key === "Enter" && sureUygula()}
            />
            <span className="dt-birim">ms</span>
          </span>
        </div>
        {studyo && (
          <div className="px-3 pb-2">
            <button type="button" className="dt-btn-primary w-full" disabled={meşgul} onClick={onGecis} title="Önizlemedeki sahneyi programa al">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Geçiş
            </button>
          </div>
        )}
        {kesme && <p className="px-3 text-[11px] dt-soluk">Kesme anında geçer; süre kullanılmaz.</p>}
      </div>
    </section>
  );
}
