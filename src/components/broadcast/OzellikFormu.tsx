/**
 * Genel özellik formu: libobs'un özellik tanımını (kaynak, eklenti kaynağı, ileride filtre/geçiş/kodlayıcı) panelin
 * kendi form öğeleriyle gösterir. Değişiklik anında uygulanır; görünürlüğü değişen alanlar için tanım yeniden okunur.
 * Parola alanlarının değeri sunucudan hiç gelmez; yalnız "kayıtlı" bilgisi gösterilir.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  alfaDegistir,
  duzenlenebilir,
  hextenObsRengi,
  listeSecili,
  obsRengiAlfa,
  obsRengindenHex,
  sayiAlani,
  type Ozellik,
  type OzellikTanimi,
} from "../../lib/ozellikFormu";

type Props = {
  baslik: string;
  oku: () => Promise<OzellikTanimi>;
  yaz: (ayarlar: Record<string, unknown>) => Promise<unknown>;
  onKapat: () => void;
};

function Alan({
  o,
  ayarlar,
  gizliDolu,
  degistir,
}: {
  o: Ozellik;
  ayarlar: Record<string, unknown>;
  gizliDolu: Record<string, boolean>;
  degistir: (ad: string, v: unknown, hemen?: boolean) => void;
}) {
  const deger = ayarlar[o.ad];
  const kimlik = `oz-${o.ad}`;
  const kilitli = !o.etkin;
  const etiket = (
    <label htmlFor={kimlik} title={o.ipucu}>
      {o.aciklama || o.ad}
    </label>
  );
  switch (o.tur) {
    case "bool":
      return (
        <>
          <span />
          <label className="inline-flex items-center gap-2" title={o.ipucu}>
            <input id={kimlik} type="checkbox" disabled={kilitli} checked={Boolean(deger)} onChange={(e) => degistir(o.ad, e.target.checked, true)} />
            {o.aciklama || o.ad}
          </label>
        </>
      );
    case "int":
    case "float":
      return (
        <>
          {etiket}
          <span className="inline-flex items-center gap-1">
            <input
              id={kimlik}
              className="dt-input w-28 dt-sayi"
              type="number"
              disabled={kilitli}
              min={o.min}
              max={o.max}
              step={o.adim || (o.tur === "int" ? 1 : 0.01)}
              defaultValue={typeof deger === "number" ? deger : ""}
              key={String(deger)}
              onBlur={(e) => {
                const n = sayiAlani(e.target.value, o);
                if (n !== null) degistir(o.ad, n, true);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            {o.sonek && <span className="dt-soluk">{o.sonek}</span>}
            {o.min !== undefined && o.max !== undefined && (
              <span className="dt-soluk text-[11px]">
                {o.min}–{o.max}
              </span>
            )}
          </span>
        </>
      );
    case "text":
      if (o.metinTuru === "bilgi") {
        return (
          <>
            <span />
            <p className="dt-soluk text-[12px]">{o.aciklama}</p>
          </>
        );
      }
      if (o.metinTuru === "parola") {
        return (
          <>
            {etiket}
            <input
              id={kimlik}
              className="dt-input"
              type="password"
              autoComplete="off"
              disabled={kilitli}
              placeholder={gizliDolu[o.ad] ? "Kayıtlı (değiştirmek için yazın)" : ""}
              onBlur={(e) => e.target.value && degistir(o.ad, e.target.value, true)}
            />
          </>
        );
      }
      return (
        <>
          {etiket}
          {o.metinTuru === "cok_satir" ? (
            <textarea
              id={kimlik}
              className="dt-input min-h-16"
              disabled={kilitli}
              defaultValue={String(deger ?? "")}
              onBlur={(e) => degistir(o.ad, e.target.value, true)}
            />
          ) : (
            <input
              id={kimlik}
              className="dt-input"
              disabled={kilitli}
              defaultValue={String(deger ?? "")}
              onBlur={(e) => degistir(o.ad, e.target.value, true)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          )}
        </>
      );
    case "path":
      return (
        <>
          {etiket}
          <span className="flex gap-1">
            <input
              id={kimlik}
              className="dt-input min-w-0 flex-1"
              disabled={kilitli}
              defaultValue={String(deger ?? "")}
              key={String(deger ?? "")}
              onBlur={(e) => degistir(o.ad, e.target.value, true)}
            />
            {isTauri() && (
              <button
                type="button"
                className="dt-btn"
                disabled={kilitli}
                onClick={async () => {
                  const s = await open({ directory: o.yolTuru === "klasor", multiple: false });
                  if (typeof s === "string") degistir(o.ad, s, true);
                }}
              >
                Gözat…
              </button>
            )}
          </span>
        </>
      );
    case "list": {
      const l = o.liste;
      if (!l) return null;
      const donustur = (i: number) => l.ogeler[i]?.deger;
      if (l.tur === "duzenlenebilir") {
        return (
          <>
            {etiket}
            <span>
              <input id={kimlik} className="dt-input" list={`${kimlik}-l`} disabled={kilitli} defaultValue={String(deger ?? "")} onBlur={(e) => degistir(o.ad, e.target.value, true)} />
              <datalist id={`${kimlik}-l`}>
                {l.ogeler.map((x, i) => (
                  <option key={i} value={String(x.deger)}>
                    {x.ad}
                  </option>
                ))}
              </datalist>
            </span>
          </>
        );
      }
      return (
        <>
          {etiket}
          <select id={kimlik} className="dt-input" disabled={kilitli} value={listeSecili(o, deger)} onChange={(e) => degistir(o.ad, donustur(Number(e.target.value)), true)}>
            {listeSecili(o, deger) === "" && <option value="">—</option>}
            {l.ogeler.map((x, i) => (
              <option key={i} value={String(i)} disabled={x.devreDisi}>
                {x.ad || String(x.deger)}
              </option>
            ))}
          </select>
        </>
      );
    }
    case "color":
    case "color_alpha":
      return (
        <>
          {etiket}
          <span className="inline-flex items-center gap-2">
            <input id={kimlik} type="color" disabled={kilitli} value={obsRengindenHex(deger)} onChange={(e) => degistir(o.ad, hextenObsRengi(e.target.value, deger))} />
            {o.tur === "color_alpha" && (
              <label className="inline-flex items-center gap-1 dt-soluk">
                Opaklık
                <input
                  type="range"
                  min={0}
                  max={255}
                  disabled={kilitli}
                  value={obsRengiAlfa(deger)}
                  onChange={(e) => degistir(o.ad, alfaDegistir(deger, Number(e.target.value)))}
                />
              </label>
            )}
          </span>
        </>
      );
    case "group":
      return (
        <fieldset className="col-span-2 border-t border-[color:var(--dt-line)] pt-1">
          <legend className="dt-etiket">{o.aciklama || o.ad}</legend>
          <div className="dt-form px-0">
            {(o.grup ?? []).filter((x) => x.gorunur).map((x) => (
              <Alan key={x.ad} o={x} ayarlar={ayarlar} gizliDolu={gizliDolu} degistir={degistir} />
            ))}
          </div>
        </fieldset>
      );
    default:
      return (
        <>
          <span className="dt-etiket">{o.aciklama || o.ad}</span>
          <span className="dt-soluk text-[12px]">
            {o.tur === "button" ? "Düğme alanları desteklenmiyor (OBS 32.2'de kullanımdan kalktı)" : "Bu alan türü panelde henüz düzenlenemiyor"}
          </span>
        </>
      );
  }
}

/** Özellik formu gövdesi (pencere çerçevesi olmadan) — filtre ve geçiş pencerelerinde gömülü kullanılır */
export function OzellikGovdesi({ oku, yaz, bos = "Ayarlanabilir özellik yok." }: Pick<Props, "oku" | "yaz"> & { bos?: string }) {
  const [tanim, setTanim] = useState<OzellikTanimi | null>(null);
  const [hata, setHata] = useState("");
  const [kayit, setKayit] = useState<"" | "kaydediliyor" | "kaydedildi">("");
  const bekleyen = useRef<Record<string, unknown>>({});
  const zaman = useRef<number | null>(null);

  const yukle = useCallback(async () => {
    try {
      setTanim(await oku());
    } catch (e) {
      setHata(String((e as Error).message || e).slice(0, 300));
    }
  }, [oku]);

  useEffect(() => {
    setTanim(null);
    setHata("");
    void yukle();
  }, [yukle]);

  const gonder = useCallback(async () => {
    const parca = bekleyen.current;
    bekleyen.current = {};
    if (!Object.keys(parca).length) return;
    setKayit("kaydediliyor");
    try {
      await yaz(parca);
      setKayit("kaydedildi");
      // Görünürlüğü ayara bağlı alanlar olabilir: tanımı yenile
      await yukle();
    } catch (e) {
      setHata(String((e as Error).message || e).slice(0, 300));
      setKayit("");
    }
  }, [yaz, yukle]);

  const degistir = (ad: string, v: unknown, hemen = false) => {
    bekleyen.current[ad] = v;
    setTanim((t) => (t ? { ...t, ayarlar: { ...t.ayarlar, [ad]: v } } : t));
    if (zaman.current) window.clearTimeout(zaman.current);
    zaman.current = window.setTimeout(() => void gonder(), hemen ? 0 : 250);
  };

  const gorunen = (tanim?.ozellikler ?? []).filter((o) => o.gorunur);
  return (
    <>
      {!tanim && !hata && <p className="p-3 dt-soluk">Özellikler okunuyor…</p>}
      {tanim && gorunen.length === 0 && <p className="p-3 dt-soluk">{bos}</p>}
      {tanim && gorunen.length > 0 && (
        <div className="dt-form">
          {gorunen.map((o) => (
            <Alan key={o.ad} o={o} ayarlar={tanim.ayarlar} gizliDolu={tanim.gizliDolu ?? {}} degistir={degistir} />
          ))}
        </div>
      )}
      {tanim && gorunen.some((o) => !duzenlenebilir(o) && o.tur !== "group" && o.metinTuru !== "bilgi") && (
        <p className="px-3 pb-2 text-[12px] dt-soluk">Bazı alan türleri henüz düzenlenemiyor; değerleri korunur.</p>
      )}
      {hata && <p className="px-3 pb-2 text-[12px] dt-hata-metni">{hata}</p>}
      <p className="px-3 pb-2 text-[11px] dt-soluk" aria-live="polite">
        {kayit === "kaydediliyor" ? "Uygulanıyor…" : kayit === "kaydedildi" ? "Uygulandı" : "Değişiklikler anında uygulanır"}
      </p>
    </>
  );
}

export function OzellikFormu({ baslik, oku, yaz, onKapat }: Props) {
  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && onKapat()}>
      <div className="dt-modal" role="dialog" aria-label={`Özellikler: ${baslik}`} style={{ width: 520 }} onKeyDown={(e) => e.key === "Escape" && onKapat()}>
        <div className="dt-dock-baslik">Özellikler — {baslik}</div>
        <div className="max-h-[60vh] overflow-auto">
          <OzellikGovdesi oku={oku} yaz={yaz} bos="Bu kaynağın ayarlanabilir özelliği yok." />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">
          <button type="button" className="dt-btn" onClick={onKapat}>
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
