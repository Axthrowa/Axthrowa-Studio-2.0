/**
 * Sahne koleksiyonları (OBS "Scene Collection" menüsünün yöneticisi): listele, yeni, çoğalt, yeniden adlandır,
 * geç, kaldır (yedek klasörüne taşınır), yedekle, dışa aktar, içe aktar (bu uygulamanın ya da OBS'in JSON'u),
 * OBS'in koleksiyon klasöründen içe aktar (yalnız bu bilgisayarda; OBS dosyalarına yazılmaz).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motorApi, type MotorKoleksiyonOzeti } from "../../lib/api/motor";
import { AdIstemi, hataMetni, OnayKutusu, Pencere, type OnayIstegi } from "./ortak";

export function KoleksiyonYoneticisi({ onToast, onDegisti, onKapat }: { onToast: (m: string) => void; onDegisti: () => void; onKapat: () => void }) {
  const [liste, setListe] = useState<MotorKoleksiyonOzeti[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [istem, setIstem] = useState<{ baslik: string; baslangic: string; yap: (ad: string) => Promise<unknown> } | null>(null);
  const [onay, setOnay] = useState<OnayIstegi | null>(null);
  const [obsDosyalari, setObsDosyalari] = useState<{ dosya: string; boyut: number }[] | null>(null);
  const [rapor, setRapor] = useState<string[] | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const dosya = useRef<HTMLInputElement>(null);

  const yukle = useCallback(async () => {
    try {
      const r = await motorApi.koleksiyonlar();
      setListe(r.liste);
      setSecili((s) => s ?? r.etkin);
    } catch (e) {
      onToast(`Koleksiyonlar okunamadı: ${hataMetni(e)}`);
    }
  }, [onToast]);
  useEffect(() => {
    void yukle();
  }, [yukle]);

  const yap = async (etiket: string, f: () => Promise<unknown>, bitti?: (r: unknown) => string | null) => {
    setMesgul(true);
    try {
      const r = await f();
      const m = bitti?.(r);
      if (m) onToast(m);
      onDegisti();
    } catch (e) {
      onToast(`${etiket}: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
      void yukle();
    }
  };

  const k = liste.find((x) => x.id === secili) ?? null;
  const iceAktarRaporu = (r: unknown) => {
    const x = r as { kaynak?: number; sahne?: number; grup?: number; filtre?: number; notlar?: string[] };
    if (x.notlar) setRapor([`${x.sahne ?? 0} sahne, ${x.kaynak ?? 0} kaynak, ${x.grup ?? 0} grup, ${x.filtre ?? 0} filtre aktarıldı.`, ...x.notlar]);
    return "Koleksiyon içe aktarıldı";
  };

  const dosyaSecildi = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      onToast("Dosya çok büyük (en çok 20 MB)");
      return;
    }
    let veri: unknown;
    try {
      veri = JSON.parse(await f.text());
    } catch {
      onToast("Dosya JSON değil");
      return;
    }
    // OBS koleksiyonu "sources" dizisi taşır; bu uygulamanınki "surum" + "sahneler"
    const obs = !!veri && typeof veri === "object" && Array.isArray((veri as { sources?: unknown }).sources);
    const ad = f.name.replace(/\.json$/i, "");
    await yap("İçe aktarılamadı", () => motorApi.koleksiyon({ eylem: obs ? "obs-ice-aktar" : "ice-aktar", veri, ad: obs ? `OBS: ${ad}` : ad }), obs ? iceAktarRaporu : () => "Koleksiyon içe aktarıldı");
  };

  return (
    <Pencere baslik="Sahne koleksiyonları" genislik={640} onKapat={onKapat} alt={<button type="button" className="dt-btn-primary" onClick={onKapat}>Kapat</button>}>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 180px" }}>
        <div role="listbox" aria-label="Koleksiyonlar" className="min-h-[220px] border-r border-[color:var(--dt-line)]">
          {liste.map((x) => (
            <div key={x.id} role="option" aria-selected={x.id === secili} className="dt-row" onClick={() => setSecili(x.id)} onDoubleClick={() => !x.etkin && void yap("Geçilemedi", () => motorApi.koleksiyon({ eylem: "gec", id: x.id }), () => `«${x.ad}» koleksiyonuna geçildi`)}>
              <span className="dt-nokta" data-durum={x.etkin ? "hazir" : undefined} />
              <span className="min-w-0 flex-1 truncate">{x.ad}</span>
              <span className="dt-soluk text-[10px]">
                {x.sahne ?? "?"} sahne · {x.kaynak ?? "?"} kaynak
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 p-2">
          <button type="button" className="dt-btn" disabled={mesgul || !k || k.etkin} onClick={() => k && void yap("Geçilemedi", () => motorApi.koleksiyon({ eylem: "gec", id: k.id }), () => `«${k.ad}» koleksiyonuna geçildi`)}>
            Bu koleksiyona geç
          </button>
          <button type="button" className="dt-btn" disabled={mesgul} onClick={() => setIstem({ baslik: "Yeni koleksiyon", baslangic: "Yeni koleksiyon", yap: (ad) => motorApi.koleksiyon({ eylem: "yeni", ad }) })}>
            Yeni…
          </button>
          <button type="button" className="dt-btn" disabled={mesgul || !k} onClick={() => k && setIstem({ baslik: "Koleksiyonu çoğalt", baslangic: `${k.ad} (kopya)`, yap: (ad) => motorApi.koleksiyon({ eylem: "cogalt", id: k.id, ad }) })}>
            Çoğalt…
          </button>
          <button type="button" className="dt-btn" disabled={mesgul || !k} onClick={() => k && setIstem({ baslik: "Yeniden adlandır", baslangic: k.ad, yap: (ad) => motorApi.koleksiyon({ eylem: "adlandir", id: k.id, ad }) })}>
            Yeniden adlandır…
          </button>
          <button type="button" className="dt-btn" disabled={mesgul || !k} onClick={() => k && void yap("Yedeklenemedi", () => motorApi.koleksiyon({ eylem: "yedekle", id: k.id }), (r) => `Yedek: ${(r as { yedek?: string }).yedek ?? ""}`)}>
            Yedekle
          </button>
          <a className={`dt-btn ${!k ? "pointer-events-none opacity-50" : ""}`} href={k ? motorApi.koleksiyonDisaAktarUrl(k.id) : undefined} download>
            Dışa aktar
          </a>
          <button type="button" className="dt-btn" disabled={mesgul} onClick={() => dosya.current?.click()}>
            İçe aktar (dosya)…
          </button>
          <input ref={dosya} type="file" accept=".json,application/json" hidden onChange={(e) => void dosyaSecildi(e.target.files?.[0]).finally(() => (e.target.value = ""))} />
          <button
            type="button"
            className="dt-btn"
            disabled={mesgul}
            title="OBS'in koleksiyon klasörünü (yalnız okuyarak) listeler"
            onClick={() => void motorApi.koleksiyon({ eylem: "obs-listesi" }).then((r) => setObsDosyalari(r.dosyalar ?? [])).catch((e) => onToast(`OBS klasörü okunamadı: ${hataMetni(e)}`))}
          >
            OBS'ten içe aktar…
          </button>
          <button
            type="button"
            className="dt-btn-danger"
            disabled={mesgul || !k || k.etkin}
            title={k?.etkin ? "Etkin koleksiyon kaldırılamaz" : "Yedek klasörüne taşınır"}
            onClick={() =>
              k &&
              setOnay({
                baslik: "Koleksiyonu kaldır",
                metin: `«${k.ad}» listeden kaldırılacak; dosyası yedek klasörüne taşınır (silinmez).`,
                eylem: "Kaldır",
                yap: () => void yap("Kaldırılamadı", () => motorApi.koleksiyon({ eylem: "sil", id: k.id }), () => `«${k.ad}» yedeğe taşındı`),
              })
            }
          >
            Kaldır…
          </button>
        </div>
      </div>
      {obsDosyalari && (
        <div className="border-t border-[color:var(--dt-line)]">
          <div className="dt-dock-baslik">
            OBS koleksiyonları <span className="dt-soluk font-normal">· %APPDATA%\obs-studio\basic\scenes</span>
          </div>
          {obsDosyalari.length === 0 && <p className="p-3 text-[12px] dt-soluk">OBS koleksiyonu bulunamadı.</p>}
          {obsDosyalari.map((f) => (
            <div key={f.dosya} className="dt-row">
              <span className="min-w-0 flex-1 truncate">{f.dosya.replace(/\.json$/i, "")}</span>
              <span className="dt-soluk text-[10px]">{(f.boyut / 1024).toFixed(0)} KB</span>
              <button type="button" className="dt-btn" disabled={mesgul} onClick={() => void yap("İçe aktarılamadı", () => motorApi.koleksiyon({ eylem: "obs-ice-aktar", dosya: f.dosya }), iceAktarRaporu)}>
                İçe aktar
              </button>
            </div>
          ))}
          <p className="px-3 py-2 text-[11px] dt-soluk">
            İçe aktarılan koleksiyon yeni bir koleksiyon olarak eklenir; geçene dek motora yüklenmez. Yakalama kaynakları (oyun, pencere, ekran, kamera)
            geçişte çalışmaya başlar.
          </p>
        </div>
      )}
      {rapor && (
        <div className="border-t border-[color:var(--dt-line)] p-3 text-[12px]" role="status">
          {rapor.map((r, i) => (
            <p key={i} className={i ? "dt-soluk" : undefined}>
              {r}
            </p>
          ))}
        </div>
      )}
      {istem && (
        <AdIstemi
          baslik={istem.baslik}
          baslangic={istem.baslangic}
          onKapat={() => setIstem(null)}
          onTamam={(ad) => {
            const i = istem;
            setIstem(null);
            void yap(i.baslik, () => i.yap(ad));
          }}
        />
      )}
      {onay && <OnayKutusu istek={onay} onKapat={() => setOnay(null)} />}
    </Pencere>
  );
}
