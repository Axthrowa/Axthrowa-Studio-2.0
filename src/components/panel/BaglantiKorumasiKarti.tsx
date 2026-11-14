/** Y12 ayarları: panel ayarında `baglantiKorumasi` */
import { useEffect, useState } from "react";
import { fetchSettings, patchSettings } from "../../lib/api";
import { korumaAyari, type KorumaAyari } from "../../lib/baglantiKorumasi";
import { isObsConnected, listScenes } from "../../lib/obs";
import { Switch } from "../axthrowa/switch";

const ALAN = "w-full rounded-md border border-panel-border bg-[#1c2030] px-2 py-1.5 text-xs text-white";

export function BaglantiKorumasiKarti() {
  const [ayar, setAyar] = useState<KorumaAyari | null>(null);
  const [sahneler, setSahneler] = useState<string[]>([]);
  const [mesaj, setMesaj] = useState("");

  useEffect(() => {
    fetchSettings("panel")
      .then((s) => setAyar(korumaAyari(s.baglantiKorumasi)))
      .catch(() => setMesaj("Ayar okunamadı"));
    if (isObsConnected()) listScenes().then(setSahneler).catch(() => {});
  }, []);

  if (!ayar) return mesaj ? <p className="text-xs text-red-300">{mesaj}</p> : null;
  const yaz = (yama: Partial<KorumaAyari>) => {
    const yeni = { ...ayar, ...yama };
    setAyar(yeni);
    void patchSettings("panel", { baglantiKorumasi: yeni } as never).catch(() => setMesaj("Kaydedilemedi"));
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Bağlantı koruması</h3>
      <p className="text-xs font-medium text-white/75">
        Bit hızı eşiğin altına 5 sn düşerse ya da OBS yeniden bağlanıyorsa seçilen sahneye geçer; ağ 10 sn sakin kalınca önceki sahneye döner.
        AxBoT otomasyonuna &quot;Bit hızı düştü&quot;, &quot;Bağlantı düzeldi&quot; ve &quot;Düşen kare eşiği&quot; olarak da bildirilir.
      </p>
      <label className="flex items-center gap-2 text-xs text-white">
        <Switch checked={ayar.acik} onCheckedChange={(v: boolean) => yaz({ acik: v })} aria-label="Bağlantı koruması" />
        Açık
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-white/70">
          Geçilecek sahne (boş = yalnız bildir)
          <input className={ALAN} list="koruma-sahneleri" value={ayar.sahne} onChange={(e) => yaz({ sahne: e.target.value })} placeholder="Mola" />
          <datalist id="koruma-sahneleri">
            {sahneler.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="text-[11px] text-white/70">
          Bit hızı eşiği (kbps)
          <input className={ALAN} type="number" min={100} value={ayar.esikKbps} onChange={(e) => yaz({ esikKbps: Number(e.target.value) || ayar.esikKbps })} />
        </label>
        <label className="text-[11px] text-white/70">
          Düşen kare eşiği (%)
          <input className={ALAN} type="number" min={1} max={100} value={ayar.kareEsigi} onChange={(e) => yaz({ kareEsigi: Number(e.target.value) || ayar.kareEsigi })} />
        </label>
        <label className="text-[11px] text-white/70">
          Sohbete yazılacak satır (boş = yazma)
          <input className={ALAN} maxLength={200} value={ayar.sohbet} onChange={(e) => yaz({ sohbet: e.target.value })} />
        </label>
      </div>
      {mesaj && <p className="text-xs text-red-300">{mesaj}</p>}
    </div>
  );
}
