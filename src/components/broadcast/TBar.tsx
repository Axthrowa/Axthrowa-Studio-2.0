/**
 * Studio Mode T-bar (OBS "T-Bar"): geçişi elle sürükler. İlk hareket önizlemedeki sahneye manuel geçiş başlatır;
 * uca bırakılınca geçiş tamamlanır, başa bırakılınca eski programda kalınır, arada bırakılırsa geçiş olduğu yerde
 * durur. Sabit geçişlerde (Kes, Stinger) motor reddeder ve hata gösterilir.
 *
 * Sürükleme sırasında aynı anda tek istek uçar; arada biriken son konum sonra gönderilir (motor boğulmaz).
 */
import { useRef, useState } from "react";
import { motorApi } from "../../lib/api/motor";
import { tbarBirakSonucu } from "../../lib/tbar";

const ADIM = 1000;

export function TBar({ tuval, devreDisi, onHata, onBitti }: { tuval: string; devreDisi: boolean; onHata: (m: string) => void; onBitti: () => void }) {
  const [deger, setDeger] = useState(0);
  const ucuyor = useRef(false);
  const bekleyen = useRef<number | null>(null);
  const surukleniyor = useRef(false);
  const sonDeger = useRef(0);

  const gonder = (konum: number, birak: boolean): Promise<void> =>
    motorApi
      .studyoTbar(tuval, konum / ADIM, birak)
      .then((r) => {
        if (birak) {
          const s = tbarBirakSonucu(konum / ADIM, r.etkin);
          if (s !== "ortada") {
            setDeger(0);
            sonDeger.current = 0;
            onBitti();
          }
        }
      })
      .catch((e: unknown) => {
        setDeger(0);
        surukleniyor.current = false;
        onHata(e instanceof Error ? e.message : String(e));
      });

  const akit = async () => {
    if (ucuyor.current) return;
    ucuyor.current = true;
    try {
      while (bekleyen.current !== null) {
        const k = bekleyen.current;
        bekleyen.current = null;
        await gonder(k, false);
      }
    } finally {
      ucuyor.current = false;
    }
  };

  const hareket = (v: number) => {
    setDeger(v);
    sonDeger.current = v;
    surukleniyor.current = true;
    bekleyen.current = v;
    void akit();
  };

  const birak = () => {
    if (!surukleniyor.current) return;
    surukleniyor.current = false;
    const son = sonDeger.current;
    // Uçan istek bitince bırakma gönderilir (sıra korunur)
    const bekle = () => (ucuyor.current || bekleyen.current !== null ? setTimeout(bekle, 15) : void gonder(son, true));
    bekle();
  };

  return (
    <label className="flex flex-col items-center gap-1 text-[10px] dt-soluk" title="T-bar: sürükleyerek elle geçiş (uca bırakınca tamamlanır)">
      T-bar
      <input
        type="range"
        min={0}
        max={ADIM}
        step={1}
        value={deger}
        disabled={devreDisi}
        aria-label="T-bar"
        aria-valuetext={`%${Math.round((deger / ADIM) * 100)}`}
        className="dt-tbar"
        onChange={(e) => hareket(Number(e.target.value))}
        onPointerUp={birak}
        onKeyUp={birak}
        onBlur={birak}
      />
    </label>
  );
}
