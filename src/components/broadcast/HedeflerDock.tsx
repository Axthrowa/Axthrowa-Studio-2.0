/**
 * Hedefler dock'u (çoklu yayın): hedef başına tuval, ses izi, durum, bit hızı, düşen kare; her hedef bağımsız
 * başlar/durur (biri durunca diğerleri sürer). İstatistikler dock'u: motor FPS, kare süresi, geciken/atlanan kare,
 * CPU, bellek ve çıktı başına ayrıntı. GPU kullanımı libobs'ta yok — gösterilmez.
 */
import { useEffect, useRef, useState } from "react";
import { CIKIS_DURUM_ETIKETI, cikisEtkin, hedefBaslatilabilir, type MotorDurumu } from "../../lib/api/motor";
import { boyutMetni, kalanKayitSn, sureMetni } from "../../lib/kayitSuresi";


export const TUVAL_ADI: Record<string, string> = { ana: "Yatay", dikey: "Dikey" };

type Istatistik = NonNullable<MotorDurumu["istatistik"]> & { atlanan_kare?: number; video_kare?: number; cpu?: number; bellek_mb?: number };

/** Çıktı başına bit hızı (kbps): iki yoklama arasındaki bayt farkından */
export function useBitHizi(ist: Istatistik | null | undefined): Record<string, number> {
  const onceki = useRef<{ t: number; bayt: Record<string, number> } | null>(null);
  const [hiz, setHiz] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!ist) return;
    const t = performance.now();
    const bayt = Object.fromEntries(ist.cikislar.map((c) => [c.id, c.bayt]));
    const o = onceki.current;
    if (o && t - o.t > 300) {
      const sn = (t - o.t) / 1000;
      setHiz(Object.fromEntries(ist.cikislar.map((c) => [c.id, Math.max(0, ((bayt[c.id] - (o.bayt[c.id] ?? bayt[c.id])) * 8) / 1000 / sn)])));
    }
    onceki.current = { t, bayt };
  }, [ist]);
  return hiz;
}

function HedefSatiri({
  hedef: h,
  tuvaller,
  bitHizi,
  dusen,
  mesgul,
  calisiyor,
  onBaslat,
  onDurdur,
}: {
  hedef: MotorDurumu["hedefler"][number];
  tuvaller: string[];
  bitHizi: number | undefined;
  dusen: number | undefined;
  mesgul: boolean;
  calisiyor: boolean;
  onBaslat: (tuval: string, iz: number) => void;
  onDurdur: () => void;
}) {
  const [tuval, setTuval] = useState(h.tuval ?? "ana");
  const [iz, setIz] = useState((h.iz ?? 0) + 1);
  useEffect(() => {
    if (h.tuval) setTuval(h.tuval);
    if (h.iz != null) setIz(h.iz + 1);
  }, [h.tuval, h.iz]);
  const etkin = cikisEtkin(h.durum);
  const b = hedefBaslatilabilir(h, calisiyor);
  const nokta = h.durum === "canli" ? "canli" : h.durum === "yeniden_baglaniyor" || h.durum === "basarisiz" ? "uyari" : undefined;
  return (
    <tr>
      <td>{h.ad}</td>
      <td className="dt-soluk">{h.platform}</td>
      <td>
        <select className="dt-input" aria-label={`${h.ad} tuvali`} value={tuval} disabled={etkin || tuvaller.length < 2} onChange={(e) => setTuval(e.target.value)}>
          {tuvaller.map((t) => (
            <option key={t} value={t}>
              {TUVAL_ADI[t]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select className="dt-input" aria-label={`${h.ad} ses izi`} value={iz} disabled={etkin} onChange={(e) => setIz(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <option key={i} value={i}>
              İz {i}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span className="inline-flex items-center gap-1.5">
          <span className="dt-nokta" data-durum={nokta} />
          {CIKIS_DURUM_ETIKETI[h.durum] ?? h.durum}
          {h.durum === "basarisiz" && h.kod != null && <span className="dt-soluk">(kod {h.kod})</span>}
        </span>
      </td>
      <td className="dt-sayi text-right">{etkin && bitHizi != null ? `${Math.round(bitHizi)} kbps` : "—"}</td>
      <td className="dt-sayi text-right">{etkin && dusen != null ? dusen : "—"}</td>
      <td className="text-right">
        {etkin ? (
          <button type="button" className="dt-btn" disabled={mesgul} onClick={onDurdur}>
            Durdur
          </button>
        ) : (
          <button type="button" className="dt-btn" disabled={!b.olur || mesgul} title={b.neden ?? "Bu hedefe yayını başlat"} onClick={() => onBaslat(tuval, iz)}>
            Başlat
          </button>
        )}
      </td>
    </tr>
  );
}

export function HedeflerDock({
  d,
  tuvaller,
  mesgul,
  bitHizi,
  onBaslat,
  onDurdur,
}: {
  d: MotorDurumu;
  tuvaller: string[];
  mesgul: boolean;
  bitHizi: Record<string, number>;
  onBaslat: (id: string, tuval: string, iz: number) => void;
  onDurdur: (id: string) => void;
}) {
  const cikis = (id: string) => d.istatistik?.cikislar.find((c) => c.id === id);
  return (
    <section className="dt-dock h-full" aria-label="Hedefler">
      <div className="dt-dock-baslik">
        Hedefler <span className="dt-soluk font-normal">· her hedef bağımsız</span>
      </div>
      <div className="dt-dock-govde">
        {d.hedefler.length === 0 ? (
          <p className="p-3 text-[12px]">Hedef yok. Hedefler menüsünden ya da Kontrol Merkezi → Hedefler panelinden ekleyin.</p>
        ) : (
          <table className="dt-table">
            <thead>
              <tr>
                <th>Hedef</th>
                <th>Platform</th>
                <th>Tuval</th>
                <th>Ses izi</th>
                <th>Durum</th>
                <th className="text-right">Bit hızı</th>
                <th className="text-right">Düşen</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.hedefler.map((h) => (
                <HedefSatiri
                  key={h.id}
                  hedef={h}
                  tuvaller={tuvaller}
                  bitHizi={bitHizi[`h-${h.id}`]}
                  dusen={cikis(`h-${h.id}`)?.dusen_kare}
                  mesgul={mesgul}
                  calisiyor={d.calisiyor}
                  onBaslat={(t, iz) => onBaslat(h.id, t, iz)}
                  onDurdur={() => onDurdur(h.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export function IstatistikDock({ d, bitHizi }: { d: MotorDurumu; bitHizi: Record<string, number> }) {
  const ist = d.istatistik as Istatistik | null;
  return (
    <section className="dt-dock h-full" aria-label="İstatistikler">
      <div className="dt-dock-baslik">İstatistikler</div>
      <div className="dt-dock-govde">
        {!ist ? (
          <p className="p-3 text-[12px] dt-soluk">Motor çalışmıyor.</p>
        ) : (
          <>
            <div className="dt-form">
              <span className="dt-etiket">FPS</span>
              <span className="dt-sayi">{ist.fps.toFixed(2)}</span>
              <span className="dt-etiket">Ortalama kare süresi</span>
              <span className="dt-sayi">{ist.ortalama_kare_ms.toFixed(2)} ms</span>
              <span className="dt-etiket">Geciken kare (işleme)</span>
              <span className="dt-sayi">
                {ist.geciken_kare} / {ist.toplam_kare}
              </span>
              {ist.atlanan_kare != null && (
                <>
                  <span className="dt-etiket">Atlanan kare (kodlama)</span>
                  <span className="dt-sayi">
                    {ist.atlanan_kare} / {ist.video_kare ?? "—"}
                  </span>
                </>
              )}
              {ist.cpu != null && (
                <>
                  <span className="dt-etiket">CPU (motor)</span>
                  <span className="dt-sayi">%{ist.cpu.toFixed(1)}</span>
                </>
              )}
              {ist.bellek_mb != null && (
                <>
                  <span className="dt-etiket">Bellek (motor)</span>
                  <span className="dt-sayi">{ist.bellek_mb.toFixed(0)} MB</span>
                </>
              )}
              <span className="dt-etiket">Kayıt diski boş alan</span>
              <span className="dt-sayi">{boyutMetni(d.kayit.diskBos)}</span>
              <span className="dt-etiket">Kalan kayıt süresi</span>
              <span className="dt-sayi" title="Boş alan ÷ ölçülen kayıt bit hızı (yalnız kayıt sürerken)">
                {sureMetni(kalanKayitSn(d.kayit.diskBos, bitHizi["kayit"]))}
              </span>
              <span className="dt-etiket">GPU (3D)</span>
              {d.gpu ? (
                <span className="dt-sayi" title="Windows performans sayaçları (GPU Engine, 3D): sistem geneli ve yayın motoru süreci">
                  sistem %{d.gpu.sistem.toFixed(1)}
                  {d.gpu.motor != null && ` · motor %${d.gpu.motor.toFixed(1)}`}
                </span>
              ) : (
                <span className="dt-soluk" title="Bu sistemde GPU performans sayacı okunamadı">ölçülemiyor</span>
              )}
            </div>
            <table className="dt-table">
              <thead>
                <tr>
                  <th>Çıktı</th>
                  <th>Durum</th>
                  <th className="text-right">Bit hızı</th>
                  <th className="text-right">Kare</th>
                  <th className="text-right">Düşen</th>
                  <th className="text-right">Gönderilen</th>
                </tr>
              </thead>
              <tbody>
                {ist.cikislar.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id.startsWith("h-") ? (d.hedefler.find((h) => `h-${h.id}` === c.id)?.ad ?? c.id) : c.id === "kayit" ? "Kayıt" : c.id === "tekrar" ? "Tekrar arabelleği" : c.id}</td>
                    <td>{CIKIS_DURUM_ETIKETI[c.durum] ?? c.durum}</td>
                    <td className="dt-sayi text-right">{c.etkin && bitHizi[c.id] != null ? `${Math.round(bitHizi[c.id])} kbps` : "—"}</td>
                    <td className="dt-sayi text-right">{c.kare}</td>
                    <td className="dt-sayi text-right">{c.dusen_kare}</td>
                    <td className="dt-sayi text-right">{(c.bayt / 1e6).toFixed(1)} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
