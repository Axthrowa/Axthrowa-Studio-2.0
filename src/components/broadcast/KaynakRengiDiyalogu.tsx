/**
 * Kaynak rengi (OBS "Source Color"): kaynağın listedeki satırına renkli şerit. Hazır renkler, özel renk ya da yok.
 * Yalnız düzenleme kolaylığıdır; yayın görüntüsünü etkilemez.
 */
import { useState } from "react";
import { Pencere } from "./ortak";

export const HAZIR_RENKLER = ["#e5484d", "#f76b15", "#f5d524", "#3dd68c", "#12a594", "#3e63dd", "#8e4ec6", "#d6409f"];

export function KaynakRengiDiyalogu({
  ad,
  mevcut,
  onKaydet,
  onKapat,
}: {
  ad: string;
  mevcut: string | null | undefined;
  onKaydet: (renk: string) => void;
  onKapat: () => void;
}) {
  const [renk, setRenk] = useState(mevcut ?? "");
  return (
    <Pencere
      baslik={`Kaynak rengi — ${ad}`}
      genislik={380}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={() => onKaydet("")}>
            Renk yok
          </button>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={!renk} onClick={() => onKaydet(renk)}>
            Uygula
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Hazır renkler">
          {HAZIR_RENKLER.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={renk === r}
              aria-label={r}
              className="h-7 w-7 rounded"
              style={{ background: r, outline: renk === r ? "2px solid var(--dt-text)" : "none", outlineOffset: 2 }}
              onClick={() => setRenk(r)}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px]">
          Özel
          <input type="color" value={renk || "#808080"} onChange={(e) => setRenk(e.target.value)} />
          <span className="dt-sayi dt-soluk">{renk || "—"}</span>
        </label>
      </div>
    </Pencere>
  );
}
