/** Y13: canlı altyazı ayarı. Model ilk kullanımda indirilir: indirme açık onayla başlar. */
import { useEffect, useState } from "react";
import CopyUrl from "@/components/axthrowa/CopyUrl";
import { API_BASE, overlayUrl } from "../../lib/api";
import { altyaziAbone, altyaziBaslat, altyaziDurdur, altyaziDurumu, mikrofonlar, MODELLER, type AltyaziAyar } from "../../lib/altyazi/canliAltyazi";
import { Switch } from "../axthrowa/switch";

const ANAHTAR = "studio.altyazi.v1";
const ALAN = "w-full rounded-md border border-panel-border bg-ui-s2 px-2 py-1.5 text-xs text-white";
type Kayit = AltyaziAyar & { indirilen: string[] };

function oku(): Kayit {
  const v: Kayit = { model: MODELLER[0].id, mikrofon: "", obs: false, esik: 0.012, indirilen: [] };
  try {
    return { ...v, ...JSON.parse(localStorage.getItem(ANAHTAR) || "{}") };
  } catch {
    return v;
  }
}

export function CanliAltyaziKarti() {
  const [ayar, setAyar] = useState(oku);
  const [d, setD] = useState(altyaziDurumu);
  const [mikler, setMikler] = useState<{ id: string; ad: string }[]>([]);
  const [onay, setOnay] = useState(false);

  useEffect(() => altyaziAbone(setD), []);
  useEffect(() => void mikrofonlar().then(setMikler), [d.asama]);

  const kaydet = (a: Kayit) => {
    setAyar(a);
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify(a));
    } catch {
      /* */
    }
  };
  const model = MODELLER.find((m) => m.id === ayar.model) ?? MODELLER[0];
  const indirildi = ayar.indirilen.includes(model.id);
  const calisiyor = d.asama === "dinliyor" || d.asama === "yukleniyor";

  const baslat = async () => {
    if (!indirildi && !onay) return setOnay(true);
    setOnay(false);
    await altyaziBaslat(ayar);
    if (altyaziDurumu().asama === "dinliyor" && !indirildi) kaydet({ ...ayar, indirilen: [...ayar.indirilen, model.id] });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold axt-etiket text-white">Canlı altyazı</h3>
      <p className="text-xs text-white/55">
        Mikrofon bu bilgisayarda metne çevrilir; ses dışarı gönderilmez. Metin OBS katmanında görünür, istersen yayına CEA-608 altyazı olarak da gider.
        Bu sayfa (Studio penceresi) açık kaldıkça çalışır.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-white/70">
          <span>Model</span>
          <select className={ALAN} value={ayar.model} disabled={calisiyor} onChange={(e) => kaydet({ ...ayar, model: e.target.value })}>
            {MODELLER.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/70">
          <span>Mikrofon</span>
          <select className={ALAN} value={ayar.mikrofon} disabled={calisiyor} onChange={(e) => kaydet({ ...ayar, mikrofon: e.target.value })}>
            <option value="">Varsayılan mikrofon</option>
            {mikler.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ad}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/70">
          <span>Ses eşiği (gürültülü odada yükselt): {ayar.esik.toFixed(3)}</span>
          <input type="range" min={0.004} max={0.06} step={0.002} value={ayar.esik} disabled={calisiyor} className="w-full" onChange={(e) => kaydet({ ...ayar, esik: Number(e.target.value) })} />
        </label>
        <label className="flex items-center justify-between gap-2 text-xs text-white/70">
          <span>Yayına altyazı olarak da gönder (OBS, CEA-608)</span>
          <Switch checked={ayar.obs} disabled={calisiyor} onCheckedChange={(v: boolean) => kaydet({ ...ayar, obs: v })} aria-label="Yayına altyazı olarak da gönder" />
        </label>
      </div>

      {onay && (
        <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-100">
          {`${model.ad} modeli Hugging Face'ten indirilecek (${model.boyut}). Bir kez iner, sonra bu bilgisayarda kalır. Onaylamak için tekrar bas.`}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {calisiyor ? (
          <button type="button" className="rounded-md bg-red-500/80 px-3 py-1.5 text-xs font-semibold text-white" onClick={altyaziDurdur}>
            Durdur
          </button>
        ) : (
          <button type="button" className="rounded-md bg-panel-accent px-3 py-1.5 text-xs font-semibold text-white" onClick={() => void baslat()}>
            {onay ? "İndir ve başlat" : indirildi ? "Başlat" : "Modeli indir…"}
          </button>
        )}
        <span className="text-xs text-white/60">
          {d.asama === "yukleniyor" && `Model yükleniyor${d.ilerleme !== null ? ` %${Math.round(d.ilerleme * 100)}` : "…"}`}
          {d.asama === "dinliyor" && `Dinliyor · ${d.aygit}`}
          {d.asama === "hata" && <span className="text-red-300">Başlatılamadı: {d.mesaj}</span>}
        </span>
      </div>
      {d.asama === "dinliyor" && d.mesaj && <p className="text-xs text-amber-200">{d.mesaj}</p>}
      {(d.satirlar.length > 0 || d.ara) && (
        <div className="rounded-md bg-black/30 p-2 text-xs text-white/80" data-ceviri="yok">
          {d.satirlar.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
          {d.ara && <p className="italic text-white/50">{d.ara}</p>}
        </div>
      )}
      <div className="space-y-1">
        <span className="text-xs text-white/60">OBS tarayıcı kaynağı (1920×1080):</span>
        <CopyUrl url={overlayUrl(API_BASE, "widgets/altyazi")} />
      </div>
    </div>
  );
}
