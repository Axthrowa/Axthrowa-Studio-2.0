/**
 * Eksik dosyalar (OBS "Missing Files"): koleksiyonda diskte bulunmayan medya, görsel, slayt ve yerel tarayıcı sayfası
 * yolları. Her satıra yeni yol yazılır ya da seçilir; "Klasörde ara" aynı adlı dosyaları o klasörde bulup önerir.
 */
import { useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { motorApi, type EksikDosya } from "../../lib/api/motor";
import { hataMetni, Pencere } from "./ortak";

const anahtar = (e: { kaynak: string; alan: string }) => `${e.kaynak}|${e.alan}`;

export function EksikDosyalarPenceresi({ onKapat, onToast, onDegisti }: { onKapat: () => void; onToast: (m: string) => void; onDegisti: () => void }) {
  const [liste, setListe] = useState<EksikDosya[] | null>(null);
  const [yeni, setYeni] = useState<Record<string, string>>({});
  const [klasor, setKlasor] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(
    () =>
      motorApi.eksikDosyalar().then(
        (r) => setListe(r.eksikler),
        (e) => setHata(hataMetni(e))
      ),
    []
  );
  useEffect(() => {
    void yukle();
  }, [yukle]);

  const sec = async (e: EksikDosya | null) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const klasorMu = !e || e.alan.startsWith("files/");
      const s = await open({ directory: klasorMu, multiple: false });
      if (typeof s !== "string") return;
      if (e) setYeni((y) => ({ ...y, [anahtar(e)]: s }));
      else setKlasor(s);
    } catch (x) {
      onToast(`Seçilemedi: ${hataMetni(x)}`);
    }
  };
  const ara = () =>
    void motorApi.eksikDosyaAra(klasor.trim()).then(
      (r) => {
        setYeni((y) => ({ ...y, ...Object.fromEntries(r.oneriler.map((o) => [anahtar(o), o.yol])) }));
        onToast(r.oneriler.length ? `${r.oneriler.length} dosya bulundu; "Uygula" ile yazın` : "Bu klasörde eşleşen dosya yok");
        setHata(null);
      },
      (e) => setHata(hataMetni(e))
    );
  const uygula = (e: EksikDosya) =>
    void motorApi.eksikDosyaDuzelt(e.kaynak, e.alan, (yeni[anahtar(e)] ?? "").trim()).then(
      (r) => {
        onToast(`«${e.ad}» güncellendi${r.kalan ? ` (${r.kalan} eksik kaldı)` : ""}`);
        setHata(null);
        onDegisti();
        void yukle();
      },
      (x) => setHata(hataMetni(x))
    );

  return (
    <Pencere baslik="Eksik dosyalar" genis onKapat={onKapat} alt={<button type="button" className="dt-btn-primary" onClick={onKapat}>Kapat</button>}>
      <div className="flex flex-col gap-3 p-3 text-[12px]">
        {liste === null && !hata && <p className="dt-soluk">Denetleniyor…</p>}
        {liste?.length === 0 && <p>Eksik dosya yok: koleksiyondaki bütün dosya yolları diskte bulunuyor.</p>}
        {!!liste?.length && (
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="ed-klasor">Klasörde ara</label>
              <input id="ed-klasor" className="dt-input min-w-0 flex-1" placeholder="C:\Kayıtlar" value={klasor} onChange={(e) => setKlasor(e.target.value)} />
              {isTauri() && (
                <button type="button" className="dt-btn" onClick={() => void sec(null)}>
                  Seç…
                </button>
              )}
              <button type="button" className="dt-btn" disabled={!klasor.trim()} onClick={ara}>
                Ara
              </button>
            </div>
            <table className="dt-table">
              <thead>
                <tr>
                  <th>Kaynak</th>
                  <th>Eksik yol</th>
                  <th>Yeni yol</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {liste.map((e) => (
                  <tr key={anahtar(e)}>
                    <td>{e.ad}</td>
                    <td className="max-w-[220px] truncate dt-uyari-metni" title={e.yol}>
                      {e.yol}
                    </td>
                    <td>
                      <span className="flex items-center gap-1">
                        <input
                          className="dt-input min-w-0 flex-1"
                          aria-label={`${e.ad} yeni yol`}
                          value={yeni[anahtar(e)] ?? ""}
                          onChange={(x) => setYeni((y) => ({ ...y, [anahtar(e)]: x.target.value }))}
                        />
                        {isTauri() && (
                          <button type="button" className="dt-btn" onClick={() => void sec(e)}>
                            Gözat…
                          </button>
                        )}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="dt-btn" disabled={!(yeni[anahtar(e)] ?? "").trim()} onClick={() => uygula(e)}>
                        Uygula
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {hata && <p className="dt-uyari-metni">{hata}</p>}
      </div>
    </Pencere>
  );
}
