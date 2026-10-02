/**
 * Klipler (SE.Live "Backtrack" karşılığı): kayıt klasöründeki tekrar arabelleği ve kayıt dosyaları; seçilen klip
 * oynatılır, başlangıç/bitiş oynatıcının konumundan alınır ve "Kırp" yeniden kodlamadan yeni bir dosya yazar
 * (motorun remux alt süreci; anahtar kareden başlar). Yalnız bu bilgisayardan; dosyalar adla sunulur.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Scissors } from "lucide-react";
import { motorApi } from "../../lib/api/motor";
import { hataMetni } from "./ortak";

type Klip = { ad: string; boyut: number; zaman: number; tekrar: boolean };

function sure(sn: number) {
  if (!Number.isFinite(sn)) return "—";
  const s = Math.max(0, sn);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

export function KliplerDock({ onToast }: { onToast: (m: string) => void }) {
  const [liste, setListe] = useState<Klip[] | null>(null);
  const [klasor, setKlasor] = useState("");
  const [secili, setSecili] = useState<string | null>(null);
  const [aralik, setAralik] = useState<[number, number] | null>(null);
  const [bicim, setBicim] = useState<"mp4" | "mov" | "mkv">("mp4");
  const [hata, setHata] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  const yukle = useCallback(
    () =>
      motorApi.klipler().then(
        (r) => {
          setListe(r.klipler);
          setKlasor(r.kayitKlasoru);
          setHata(null);
        },
        (e) => setHata(hataMetni(e))
      ),
    []
  );
  useEffect(() => {
    void yukle();
  }, [yukle]);

  const konum = () => video.current?.currentTime ?? 0;
  const kirp = () => {
    if (!secili || !aralik) return;
    const yol = `${klasor.replace(/[\/]+$/, "")}\${secili}`;
    void motorApi.remuxEkle([yol], bicim, aralik).then(
      () => {
        onToast(`Kırpma kuyruğa eklendi (${sure(aralik[0])}–${sure(aralik[1])}); bitince listede görünür`);
        window.setTimeout(() => void yukle(), 2500);
      },
      (e) => onToast(`Kırpılamadı: ${hataMetni(e)}`)
    );
  };
  const gecerli = !!aralik && aralik[1] > aralik[0];

  return (
    <section className="dt-dock h-full" aria-label="Klipler">
      <div className="dt-dock-baslik">
        Klipler
        <span className="dt-bosluk" />
        <button type="button" className="dt-tool" aria-label="Listeyi yenile" title="Listeyi yenile" onClick={() => void yukle()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="dt-dock-govde flex flex-col gap-1.5 p-1.5 text-[12px]">
        {hata && <p className="dt-uyari-metni">{hata}</p>}
        {liste?.length === 0 && <p className="dt-soluk">Kayıt klasöründe klip yok. Tekrar arabelleğini açıp "Tekrarı kaydet" ile klip alın.</p>}
        {!!liste?.length && (
          <select
            className="dt-input"
            aria-label="Klip"
            value={secili ?? ""}
            onChange={(e) => {
              setSecili(e.target.value || null);
              setAralik(null);
            }}
          >
            <option value="">Klip seçin…</option>
            {liste.map((k) => (
              <option key={k.ad} value={k.ad}>
                {k.tekrar ? "↺ " : ""}
                {k.ad} · {(k.boyut / 1e6).toFixed(1)} MB
              </option>
            ))}
          </select>
        )}
        {secili && (
          <>
            {/* Önizleme yalnız bu bilgisayardan: sunucu dosyayı kayıt klasöründen adla verir */}
            <video ref={video} key={secili} src={motorApi.klipUrl(secili)} controls muted className="max-h-56 w-full bg-black" onLoadedMetadata={(e) => setAralik([0, e.currentTarget.duration])} />
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" className="dt-btn" onClick={() => setAralik((a) => [konum(), Math.max(konum() + 0.1, a?.[1] ?? 0)])}>
                Başlangıç = konum
              </button>
              <button type="button" className="dt-btn" onClick={() => setAralik((a) => [Math.min(a?.[0] ?? 0, konum()), konum()])}>
                Bitiş = konum
              </button>
              <span className="dt-sayi dt-soluk">{aralik ? `${sure(aralik[0])} – ${sure(aralik[1])} (${(aralik[1] - aralik[0]).toFixed(1)} sn)` : "—"}</span>
            </div>
            <div className="flex items-center gap-1">
              <select className="dt-input w-20" aria-label="Çıktı biçimi" value={bicim} onChange={(e) => setBicim(e.target.value as "mp4" | "mov" | "mkv")}>
                <option value="mp4">MP4</option>
                <option value="mov">MOV</option>
                <option value="mkv">MKV</option>
              </select>
              <button type="button" className="dt-btn-primary" disabled={!gecerli} onClick={kirp} title="Yeniden kodlamadan kırp (başlangıçtan önceki anahtar kareden başlar)">
                <Scissors className="h-3.5 w-3.5" />
                Kırp
              </button>
            </div>
            <p className="text-[11px] dt-soluk">Kalite kaybı yok; klip başlangıçtan önceki anahtar kareden başlar. Yeni dosya aynı klasöre "… klip a-b" adıyla yazılır.</p>
          </>
        )}
      </div>
    </section>
  );
}
