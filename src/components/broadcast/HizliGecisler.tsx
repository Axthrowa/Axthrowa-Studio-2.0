/**
 * Studio Mode hızlı geçişleri (OBS "Quick Transitions"): her düğme önizlemeyi kendi geçişi ve süresiyle programa alır;
 * dock'taki seçili geçiş değişmez. Sağ tık: kaldır. "+" yeni düğme ekler.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import type { MotorAdliGecis, MotorHizliGecis } from "../../lib/api/motor";
import type { MenuOgesi } from "../ui/BaglamMenusu";
import { Pencere } from "./ortak";

export function hizliEtiket(h: MotorHizliGecis, gecisler: MotorAdliGecis[]): string {
  const g = gecisler.find((x) => x.id === h.gecis);
  const ad = g?.ad ?? h.gecis;
  return g?.tur === "cut_transition" ? ad : `${ad} ${h.sure_ms} ms`;
}

export function HizliGecisler({
  hizli,
  gecisler,
  devreDisi,
  onGec,
  onEkle,
  onSil,
  menuAc,
}: {
  hizli: MotorHizliGecis[];
  gecisler: MotorAdliGecis[];
  devreDisi: boolean;
  onGec: (id: string) => void;
  onEkle: () => void;
  onSil: (id: string) => void;
  menuAc: (e: { clientX: number; clientY: number; preventDefault?: () => void }, ogeler: MenuOgesi[]) => void;
}) {
  return (
    <div className="flex w-full flex-col items-stretch gap-1" aria-label="Hızlı geçişler">
      {hizli.map((h) => {
        const etiket = hizliEtiket(h, gecisler);
        return (
          <button
            key={h.id}
            type="button"
            className="dt-btn text-[11px]"
            disabled={devreDisi}
            title={`Hızlı geçiş: ${etiket} (sağ tık: kaldır)`}
            onClick={() => onGec(h.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              menuAc(e, [
                {
                  etiket: `Kaldır: ${etiket}`,
                  tehlikeli: true,
                  eylem: () => onSil(h.id),
                },
              ]);
            }}
          >
            {etiket}
          </button>
        );
      })}
      <button type="button" className="dt-tool self-center" aria-label="Hızlı geçiş ekle" title="Hızlı geçiş ekle" onClick={onEkle}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function HizliGecisEkleDiyalogu({
  gecisler,
  varsayilanSure,
  onEkle,
  onKapat,
}: {
  gecisler: MotorAdliGecis[];
  varsayilanSure: number;
  onEkle: (gecis: string, sureMs: number) => void;
  onKapat: () => void;
}) {
  const [gecis, setGecis] = useState(gecisler[0]?.id ?? "");
  const [sure, setSure] = useState(String(varsayilanSure));
  const ms = Math.round(Number(sure));
  const kesme = gecisler.find((g) => g.id === gecis)?.tur === "cut_transition";
  const gecerli = !!gecis && (kesme || (Number.isFinite(ms) && ms >= 0 && ms <= 20000));
  return (
    <Pencere
      baslik="Hızlı geçiş ekle"
      genislik={380}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={!gecerli} onClick={() => onEkle(gecis, kesme ? 0 : ms)}>
            Ekle
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="hg-gecis">Geçiş</label>
        <select id="hg-gecis" className="dt-input" value={gecis} onChange={(e) => setGecis(e.target.value)}>
          {gecisler.map((g) => (
            <option key={g.id} value={g.id}>
              {g.ad}
            </option>
          ))}
        </select>
        <label htmlFor="hg-sure">Süre</label>
        <span className="inline-flex items-center gap-1.5">
          <input id="hg-sure" className="dt-input dt-sayi w-24" inputMode="numeric" disabled={kesme} value={sure} onChange={(e) => setSure(e.target.value)} />
          <span className="dt-birim">ms</span>
        </span>
      </div>
    </Pencere>
  );
}
