/**
 * Gelişmiş Ses Özellikleri (OBS "Advanced Audio Properties"): her ses kaynağı için düzey (dB, +26 dB'ye kadar),
 * mono, denge, senkron kaydırma, izleme ve 6 iz (adlandırılmış karışımlar). Değişiklik anında uygulanır.
 * İzleme "izle" seçilirse ses bu bilgisayarın izleme aygıtından (kulaklık/hoparlör) duyulur.
 */
import { useEffect, useState } from "react";
import type { MotorSesDurumu, MotorSesKanali } from "../../lib/api/motor";
import { carpandanDb, dbdenCarpan, dengeMetni, IZLEME_ADLARI } from "../../lib/sesMatematik";
import { Pencere } from "./ortak";

function DbGirdisi({ k, onUygula }: { k: MotorSesKanali; onUygula: (carpan: number) => void }) {
  const db = carpandanDb(k.ses);
  const [m, setM] = useState(Number.isFinite(db) ? db.toFixed(1) : "-inf");
  useEffect(() => setM(Number.isFinite(db) ? db.toFixed(1) : "-inf"), [db]);
  const uygula = () => {
    const v = m.trim().toLowerCase().startsWith("-inf") ? -Infinity : Number(m.replace(",", "."));
    if (Number.isNaN(v) || v > 26) {
      setM(Number.isFinite(db) ? db.toFixed(1) : "-inf");
      return;
    }
    onUygula(dbdenCarpan(v));
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        className="dt-input dt-sayi w-16"
        aria-label={`${k.ad} düzey (dB)`}
        value={m}
        onChange={(e) => setM(e.target.value)}
        onBlur={uygula}
        onKeyDown={(e) => e.key === "Enter" && uygula()}
      />
      <span className="dt-birim">dB</span>
    </span>
  );
}

function SenkronGirdisi({ k, onUygula }: { k: MotorSesKanali; onUygula: (ms: number) => void }) {
  const [m, setM] = useState(String(k.senkron_ms));
  useEffect(() => setM(String(k.senkron_ms)), [k.senkron_ms]);
  const uygula = () => {
    const v = Math.round(Number(m));
    if (Number.isFinite(v) && v >= -950 && v <= 20000) {
      if (v !== k.senkron_ms) onUygula(v);
    } else setM(String(k.senkron_ms));
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        className="dt-input dt-sayi w-16"
        aria-label={`${k.ad} senkron kaydırma (ms)`}
        value={m}
        onChange={(e) => setM(e.target.value)}
        onBlur={uygula}
        onKeyDown={(e) => e.key === "Enter" && uygula()}
      />
      <span className="dt-birim">ms</span>
    </span>
  );
}

export function GelismisSesDiyalogu({
  ses,
  onAyarla,
  onKapat,
}: {
  ses: MotorSesDurumu | null;
  onAyarla: (k: MotorSesKanali, eylem: "ses" | "mono" | "denge" | "senkron" | "izleme" | "izler", deger: number | boolean) => void;
  onKapat: () => void;
}) {
  const izAdlari = ses?.izAdlari ?? [];
  const [yalnizEtkin, setYalnizEtkin] = useState(false);
  const satirlar = (ses?.kaynaklar ?? []).filter((k) => !yalnizEtkin || k.etkin !== false);
  return (
    <Pencere
      baslik="Gelişmiş ses özellikleri"
      genis
      onKapat={onKapat}
      alt={
        <button type="button" className="dt-btn-primary" onClick={onKapat}>
          Kapat
        </button>
      }
    >
      <label className="flex items-center gap-2 px-3 pt-2 text-[12px]">
        <input type="checkbox" checked={yalnizEtkin} onChange={(e) => setYalnizEtkin(e.target.checked)} />
        Yalnız etkin kaynakları göster (programdaki sahnede olanlar)
      </label>
      {!ses || satirlar.length === 0 ? (
        <p className="p-3 text-[12px] dt-soluk">Ses taşıyan kaynak yok.</p>
      ) : (
        <table className="dt-table">
          <thead>
            <tr>
              <th>Kaynak</th>
              <th>Düzey</th>
              <th>Mono</th>
              <th>Denge</th>
              <th>Senkron kaydırma</th>
              <th>İzleme</th>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <th key={i} title={izAdlari[i - 1]} className="text-center">
                  {i}
                  <div className="dt-soluk text-[9px] font-normal">{izAdlari[i - 1]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {satirlar.map((k) => (
              <tr key={k.id}>
                <td className={k.etkin === false ? "dt-soluk" : undefined} title={k.etkin === false ? "Programdaki sahnede değil" : undefined}>
                  {k.ad}
                </td>
                <td>
                  <DbGirdisi k={k} onUygula={(c) => onAyarla(k, "ses", c)} />
                </td>
                <td>
                  <input type="checkbox" aria-label={`${k.ad} mono`} checked={k.mono} onChange={(e) => onAyarla(k, "mono", e.target.checked)} />
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <input
                      type="range"
                      aria-label={`${k.ad} denge`}
                      min={0}
                      max={100}
                      value={Math.round(k.denge * 100)}
                      onChange={(e) => onAyarla(k, "denge", Number(e.target.value) / 100)}
                      onDoubleClick={() => onAyarla(k, "denge", 0.5)}
                    />
                    <span className="dt-soluk w-14 text-[10px]">{dengeMetni(k.denge)}</span>
                  </span>
                </td>
                <td>
                  <SenkronGirdisi k={k} onUygula={(ms) => onAyarla(k, "senkron", ms)} />
                </td>
                <td>
                  <select className="dt-input" aria-label={`${k.ad} izleme`} value={k.izleme} onChange={(e) => onAyarla(k, "izleme", Number(e.target.value))}>
                    {IZLEME_ADLARI.map((a, i) => (
                      <option key={a} value={i}>
                        {a}
                      </option>
                    ))}
                  </select>
                </td>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <td key={i} className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`${k.ad} iz ${i}`}
                      checked={(k.izler & (1 << (i - 1))) !== 0}
                      onChange={() => onAyarla(k, "izler", (k.izler ^ (1 << (i - 1))) & 0x3f)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="px-3 py-2 text-[11px] dt-soluk">
        İzleme: "Yalnız izle" sesi yalnız bu bilgisayarın izleme aygıtına verir (yayına/kayda gitmez); "İzle ve çıkışa ver" ikisine de. İzler, hedeflerin ve
        kaydın hangi karışımı alacağını belirler.
      </p>
    </Pencere>
  );
}
