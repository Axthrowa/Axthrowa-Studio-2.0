/**
 * Yeniden muxla (OBS "Dosya › Yeniden muxla"): kayıtları yeniden kodlamadan MP4/MOV/MKV kabına kopyalar. Kayıt
 * klasöründeki son kayıtlar listelenir; masaüstü uygulamasında başka klasörden dosya da seçilebilir. Çıktı aynı
 * klasöre aynı adla yazılır; var olan dosyanın üzerine yazılmaz. Kuyruk sırayla işlenir, pencere kapansa da sürer.
 */
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { motorApi, type RemuxDurumu } from "../../lib/api/motor";
import { hataMetni, Pencere } from "./ortak";

const DURUM_ADI: Record<string, string> = { bekliyor: "Bekliyor", suruyor: "Sürüyor", tamam: "Tamam", hata: "Hata", iptal: "İptal edildi" };

function dosyaAdi(yol: string) {
  return yol.split(/[\\/]/).pop() ?? yol;
}

function boyutMetni(b: number) {
  return b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(2)} GB` : `${(b / (1 << 20)).toFixed(1)} MB`;
}

export function RemuxPenceresi({ onKapat, onToast }: { onKapat: () => void; onToast: (m: string) => void }) {
  const [d, setD] = useState<RemuxDurumu | null>(null);
  const [secili, setSecili] = useState<string[]>([]);
  const [ekYollar, setEkYollar] = useState<string[]>([]);
  const [bicim, setBicim] = useState<"mp4" | "mov" | "mkv">("mp4");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    const yenile = () =>
      motorApi
        .remux()
        .then((x) => !iptal && setD(x))
        .catch((e) => !iptal && setHata(hataMetni(e)));
    void yenile();
    const t = setInterval(yenile, 700);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, []);

  const liste = [...(d?.kayitlar.map((k) => k.yol) ?? []), ...ekYollar.filter((y) => !d?.kayitlar.some((k) => k.yol === y))];
  const sec = (y: string) => setSecili((s) => (s.includes(y) ? s.filter((x) => x !== y) : [...s, y]));
  const dosyaSec = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const s = await open({ multiple: true, filters: [{ name: "Kayıt", extensions: ["mkv", "flv", "ts", "mov", "mp4", "m4v"] }] });
      const yeni = (Array.isArray(s) ? s : s ? [s] : []).map(String);
      setEkYollar((e) => [...e, ...yeni]);
      setSecili((x) => [...x, ...yeni.filter((y) => !x.includes(y))]);
    } catch (e) {
      onToast(`Dosya seçilemedi: ${hataMetni(e)}`);
    }
  };
  const baslat = () =>
    void motorApi
      .remuxEkle(secili, bicim)
      .then((r) => {
        onToast(`${r.eklenen} dosya yeniden muxlama kuyruğuna eklendi`);
        setSecili([]);
        setHata(null);
      })
      .catch((e) => setHata(hataMetni(e)));

  const suruyor = !!d?.isler.some((i) => i.durum === "bekliyor" || i.durum === "suruyor");
  return (
    <Pencere
      baslik="Yeniden muxla"
      genislik={640}
      onKapat={onKapat}
      alt={
        <>
          {suruyor && (
            <button type="button" className="dt-btn" onClick={() => void motorApi.remuxIptal().catch((e) => setHata(hataMetni(e)))}>
              Tümünü iptal et
            </button>
          )}
          {!!d?.isler.length && !suruyor && (
            <button type="button" className="dt-btn" onClick={() => void motorApi.remuxTemizle()}>
              Listeyi temizle
            </button>
          )}
          <button type="button" className="dt-btn" onClick={onKapat}>
            Kapat
          </button>
          <button type="button" className="dt-btn-primary" disabled={secili.length === 0} onClick={baslat}>
            Yeniden muxla ({secili.length})
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-3 text-[12px]">
        <p className="dt-soluk">
          Kayıt yeniden kodlanmaz, yalnız kabı değişir (kalite kaybı yok). Çıktı aynı klasöre aynı adla yazılır; aynı adda dosya varsa üzerine
          yazılmaz.
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="rm-bicim">Çıktı biçimi</label>
          <select id="rm-bicim" className="dt-input w-24" value={bicim} onChange={(e) => setBicim(e.target.value as "mp4" | "mov" | "mkv")}>
            <option value="mp4">MP4</option>
            <option value="mov">MOV</option>
            <option value="mkv">MKV</option>
          </select>
          {isTauri() && (
            <button type="button" className="dt-btn ml-auto" onClick={() => void dosyaSec()}>
              Başka dosya seç…
            </button>
          )}
        </div>
        <div className="dt-dock-govde max-h-56 overflow-auto rounded border border-[var(--dt-line)]" role="listbox" aria-label="Kayıtlar" aria-multiselectable>
          {liste.length === 0 && <p className="p-2 dt-soluk">{d ? `Kayıt klasöründe (${d.kayitKlasoru}) muxlanacak kayıt yok.` : "Yükleniyor…"}</p>}
          {liste.map((y) => {
            const k = d?.kayitlar.find((x) => x.yol === y);
            return (
              <label key={y} className="flex items-center gap-2 px-2 py-1" role="option" aria-selected={secili.includes(y)}>
                <input type="checkbox" checked={secili.includes(y)} onChange={() => sec(y)} />
                <span className="min-w-0 flex-1 truncate" title={y}>
                  {dosyaAdi(y)}
                </span>
                {k && <span className="dt-sayi dt-soluk">{boyutMetni(k.boyut)}</span>}
              </label>
            );
          })}
        </div>
        {hata && <p className="dt-uyari-metni">{hata}</p>}
        {!!d?.isler.length && (
          <div className="flex flex-col gap-1" aria-label="Kuyruk">
            {d.isler.map((i) => (
              <div key={i.girdi + i.cikti} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate" title={`${i.girdi} → ${i.cikti}`}>
                  {dosyaAdi(i.girdi)} → {dosyaAdi(i.cikti)}
                </span>
                <progress className="w-32" style={{ accentColor: "var(--panel-accent)" }} max={1} value={i.ilerleme} aria-label={`${dosyaAdi(i.girdi)} ilerleme`} />
                <span className={`w-24 text-right ${i.durum === "hata" ? "dt-uyari-metni" : "dt-soluk"}`} title={i.hata}>
                  {DURUM_ADI[i.durum]}
                  {i.sonuc?.erken_bitti ? " (yarım)" : ""}
                </span>
                {i.hata && <span className="basis-full text-[11px] dt-uyari-metni">{i.hata}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Pencere>
  );
}
