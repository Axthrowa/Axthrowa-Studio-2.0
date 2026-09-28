/**
 * Deinterlace (OBS "Deinterlacing"): geçmeli (interlaced) görüntü veren yakalama kartı / kamera / medya kaynağı için
 * kip ve alan sırası. Kaynak başına saklanır; kaynağın tüm sahnelerdeki öğelerini etkiler.
 */
import { useState } from "react";
import { DEINTERLACE_KIPLERI } from "../../lib/api/motor";
import { Pencere } from "./ortak";

export function DeinterlaceDiyalogu({
  ad,
  mevcut,
  onKaydet,
  onKapat,
}: {
  ad: string;
  mevcut: [number, number] | undefined;
  onKaydet: (kip: number, alan: number) => void;
  onKapat: () => void;
}) {
  const [kip, setKip] = useState(mevcut?.[0] ?? 0);
  const [alan, setAlan] = useState(mevcut?.[1] ?? 0);
  return (
    <Pencere
      baslik={`Deinterlace — ${ad}`}
      genislik={420}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" onClick={() => onKaydet(kip, alan)}>
            Uygula
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="di-kip">Kip</label>
        <select id="di-kip" className="dt-input" value={kip} onChange={(e) => setKip(Number(e.target.value))}>
          {DEINTERLACE_KIPLERI.map((k) => (
            <option key={k.kip} value={k.kip}>
              {k.ad}
            </option>
          ))}
        </select>
        <label htmlFor="di-alan">Alan sırası</label>
        <select id="di-alan" className="dt-input" value={alan} disabled={kip === 0} onChange={(e) => setAlan(Number(e.target.value))}>
          <option value={0}>Üst alan önce</option>
          <option value={1}>Alt alan önce</option>
        </select>
        <span />
        <span className="text-[11px] dt-soluk">Yalnız geçmeli görüntü veren kaynaklarda (yakalama kartı, kamera, medya) etkisi görülür.</span>
      </div>
    </Pencere>
  );
}
