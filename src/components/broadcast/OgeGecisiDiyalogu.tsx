/**
 * Öğe gösterme/gizleme geçişi (OBS "Show Transition" / "Hide Transition"): tür (kurulu geçişlerden) ve süre. "Yok"
 * geçişi kaldırır; öğe anında görünür/gizlenir.
 */
import { useState } from "react";
import type { MotorOgeGecisi } from "../../lib/api/motor";
import { Pencere } from "./ortak";

export function OgeGecisiDiyalogu({
  ad,
  goster,
  mevcut,
  turler,
  onKaydet,
  onKapat,
}: {
  ad: string;
  goster: boolean;
  mevcut: MotorOgeGecisi | null | undefined;
  turler: { id: string; ad: string }[];
  onKaydet: (g: MotorOgeGecisi | null) => void;
  onKapat: () => void;
}) {
  const [tur, setTur] = useState(mevcut?.tur ?? "");
  const [sure, setSure] = useState(String(mevcut?.sure_ms ?? 300));
  const sureSayi = Math.round(Number(sure));
  const gecerli = tur === "" || (Number.isFinite(sureSayi) && sureSayi >= 50 && sureSayi <= 20000);
  const baslik = `${goster ? "Gösterme" : "Gizleme"} geçişi — ${ad}`;
  return (
    <Pencere
      baslik={baslik}
      genislik={420}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={!gecerli} onClick={() => onKaydet(tur ? { tur, sure_ms: sureSayi } : null)}>
            Uygula
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="og-tur">Geçiş</label>
        <select id="og-tur" className="dt-input" value={tur} onChange={(e) => setTur(e.target.value)}>
          <option value="">Yok (anında)</option>
          {turler.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ad}
            </option>
          ))}
        </select>
        <label htmlFor="og-sure">Süre</label>
        <span className="inline-flex items-center gap-1.5">
          <input id="og-sure" className="dt-input dt-sayi w-24" inputMode="numeric" disabled={!tur} value={sure} onChange={(e) => setSure(e.target.value)} />
          <span className="dt-birim">ms (50–20000)</span>
        </span>
        <span />
        <span className="text-[11px] dt-soluk">
          Öğe {goster ? "gösterilirken" : "gizlenirken"} bu geçiş oynatılır (göz simgesi, kısayol ya da otomasyonla).
        </span>
      </div>
    </Pencere>
  );
}
