/**
 * Multiview (OBS "Multiview (Pencere)"): üstte önizleme | program, altta tuvalin ilk 8 sahnesi. Görüntü motorun tek
 * `multiview-<tuval>` tuvalinden canlı gelir; etiketler ve çerçeveler burada çizilir (program kırmızı, önizleme yeşil).
 * Sahneye tıklamak: Studio Mode'da önizlemeye alır, değilse programa geçer; Studio Mode'da çift tıklama programa alır.
 */
import { useEffect, useState } from "react";
import { motorApi, type MotorSahneOzeti, type MultiviewDuzeni, type MultiviewHucresi } from "../../lib/api/motor";
import { useMotorCanli } from "../../lib/motorCanli";
import { hataMetni, Pencere } from "./ortak";

export function MultiviewPenceresi({
  tuval,
  tuvalAdi,
  sahneler,
  program,
  onizleme,
  studyo,
  onSec,
  onProgramaAl,
  onKapat,
}: {
  tuval: string;
  tuvalAdi: string;
  sahneler: MotorSahneOzeti[];
  program: string | undefined;
  onizleme: string | null | undefined;
  studyo: boolean;
  onSec: (id: string) => void;
  onProgramaAl: (id: string) => void;
  onKapat: () => void;
}) {
  const [duzen, setDuzen] = useState<MultiviewDuzeni | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  // Sahne listesi (sıra/ad) değişince düzen yeniden kurulur
  const anahtar = sahneler.map((s) => `${s.id}:${s.ad}`).join("|");

  useEffect(() => {
    let iptal = false;
    motorApi.multiview(tuval, "ac").then(
      (d) => !iptal && (setDuzen(d), setHata(null)),
      (e) => !iptal && setHata(hataMetni(e))
    );
    return () => {
      iptal = true;
    };
  }, [tuval, anahtar, studyo]);

  useEffect(() => () => void motorApi.multiview(tuval, "kapat").catch(() => {}), [tuval]);

  const canli = useMotorCanli(!!duzen, { seviye: false, kare: duzen ? { tuval: duzen.tuval, genislik: 1280, fps: 10 } : null });
  const kare = canli.kare && duzen && canli.kare.tuval === duzen.tuval ? canli.kare.url : null;

  const vurgu = (h: MultiviewHucresi): string | undefined => {
    if (h.tur === "program" || (h.tur === "sahne" && h.sahne === program)) return "var(--dt-live)";
    if ((h.tur === "onizleme" && studyo) || (h.tur === "sahne" && studyo && h.sahne === onizleme)) return "var(--dt-ok)";
    return undefined;
  };
  const etiket = (h: MultiviewHucresi) =>
    h.tur === "onizleme" ? (studyo ? "Önizleme" : "Önizleme (Studio Mode kapalı: program)") : h.tur === "program" ? "Program" : (h.ad ?? h.sahne);

  return (
    <Pencere baslik={`Multiview — ${tuvalAdi}`} genis onKapat={onKapat}>
      {hata ? (
        <p className="p-3 text-[12px] dt-uyari-metni">Multiview açılamadı: {hata}</p>
      ) : (
        <div className="p-2">
          <div className="relative w-full bg-black" style={{ aspectRatio: duzen ? `${duzen.genislik} / ${duzen.yukseklik}` : "16 / 9" }}>
            {kare && <img src={kare} alt="" className="absolute inset-0 h-full w-full" draggable={false} />}
            {!kare && <span className="absolute inset-0 flex items-center justify-center text-[12px] dt-soluk">Görüntü bekleniyor…</span>}
            {duzen?.hucreler.map((h) => {
              const renk = vurgu(h);
              const sahne = h.tur === "sahne" ? h.sahne : undefined;
              return (
                <button
                  key={`${h.tur}-${h.sahne ?? ""}`}
                  type="button"
                  className="absolute flex items-end bg-transparent p-0 text-left"
                  style={{
                    left: `${h.kutu[0] * 100}%`,
                    top: `${h.kutu[1] * 100}%`,
                    width: `${h.kutu[2] * 100}%`,
                    height: `${h.kutu[3] * 100}%`,
                    outline: renk ? `3px solid ${renk}` : "1px solid var(--dt-line)",
                    outlineOffset: "-3px",
                    cursor: sahne ? "pointer" : "default",
                  }}
                  aria-label={sahne ? `${etiket(h)} sahnesi${studyo ? ": tıkla önizlemeye al, çift tıkla programa al" : ": tıkla programa al"}` : etiket(h)}
                  disabled={!sahne}
                  onClick={() => sahne && onSec(sahne)}
                  onDoubleClick={() => sahne && studyo && onProgramaAl(sahne)}
                >
                  <span className="m-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{etiket(h)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[11px] dt-soluk">
            {studyo ? "Tıkla: önizlemeye al · Çift tıkla: programa al" : "Tıkla: programa geç"} · Tuvalin ilk 8 sahnesi gösterilir.
          </p>
        </div>
      )}
    </Pencere>
  );
}
