/**
 * Etkileşim penceresi (OBS "Interact"): kaynağın tek başına canlı görüntüsü; üzerindeki fare ve klavye olayları
 * kaynağa (tarayıcı kaynağı vb.) iletilir. Görüntü motorun `etkilesim-<kaynak>` tuvalinden `/ws/motor` ile gelir.
 * Esc pencereyi kapatır (klavye tuzağı olmasın); diğer tuşlar görüntü odaktayken kaynağa gider.
 */
import { useEffect, useRef, useState } from "react";
import { motorApi } from "../../lib/api/motor";
import { dugmeAdi, degistiriciler, kaynakNoktasi, tusOlayi } from "../../lib/etkilesim";
import { useMotorCanli } from "../../lib/motorCanli";
import { hataMetni, Pencere } from "./ortak";

export function EtkilesimPenceresi({ kaynak, ad, onKapat, onToast }: { kaynak: string; ad: string; onKapat: () => void; onToast: (m: string) => void }) {
  const [tuval, setTuval] = useState<{ tuval: string; genislik: number; yukseklik: number } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const alan = useRef<HTMLDivElement>(null);
  const sonHareket = useRef(0);
  const canli = useMotorCanli(!!tuval, { seviye: false, kare: tuval ? { tuval: tuval.tuval, genislik: Math.min(1280, tuval.genislik), fps: 15 } : null });

  useEffect(() => {
    let iptal = false;
    motorApi.etkilesimAc(kaynak).then(
      (t) => !iptal && setTuval(t),
      (e) => !iptal && setHata(hataMetni(e))
    );
    return () => {
      iptal = true;
      void motorApi.etkilesimKapat(kaynak).catch(() => {});
    };
  }, [kaynak]);

  const gonder = (olay: Record<string, unknown>) =>
    void motorApi.etkilesimOlayi(kaynak, olay).catch((e) => {
      onToast(`Etkileşim: ${hataMetni(e)}`);
    });
  const nokta = (e: { clientX: number; clientY: number }): [number, number] | null => {
    const el = alan.current;
    if (!el || !tuval) return null;
    return kaynakNoktasi(e.clientX, e.clientY, el.getBoundingClientRect(), [tuval.genislik, tuval.yukseklik]);
  };
  const kare = canli.kare && tuval && canli.kare.tuval === tuval.tuval ? canli.kare.url : null;

  return (
    <Pencere baslik={`Etkileşim — ${ad}`} genislik={Math.min(1000, Math.max(480, (tuval?.genislik ?? 800) / 2 + 40))} onKapat={onKapat}>
      {hata ? (
        <p className="p-3 text-[12px] dt-uyari-metni">Etkileşim açılamadı: {hata}</p>
      ) : (
        <div className="p-2">
          <div
            ref={alan}
            className="dt-etkilesim-alan"
            role="application"
            aria-label={`${ad} ile etkileşim: tıklama, kaydırma ve yazma kaynağa iletilir`}
            tabIndex={0}
            style={{ aspectRatio: tuval ? `${tuval.genislik} / ${tuval.yukseklik}` : "16 / 9" }}
            onFocus={() => gonder({ tur: "odak", acik: true })}
            onBlur={() => gonder({ tur: "odak", acik: false })}
            onPointerDown={(e) => {
              const p = nokta(e);
              const d = dugmeAdi(e.button);
              if (!p || !d) return;
              e.currentTarget.focus();
              e.currentTarget.setPointerCapture?.(e.pointerId);
              gonder({ tur: "tik", dugme: d, x: p[0], y: p[1], sayi: e.detail || 1, ...degistiriciler(e) });
            }}
            onPointerUp={(e) => {
              const p = nokta(e);
              const d = dugmeAdi(e.button);
              if (p && d) gonder({ tur: "tik", dugme: d, x: p[0], y: p[1], birak: true, sayi: e.detail || 1, ...degistiriciler(e) });
            }}
            onPointerMove={(e) => {
              const simdi = performance.now();
              if (simdi - sonHareket.current < 30) return;
              sonHareket.current = simdi;
              const p = nokta(e);
              if (p) gonder({ tur: "hareket", x: p[0], y: p[1], ...(e.buttons & 1 ? { basili: "sol" } : {}), ...degistiriciler(e) });
            }}
            onPointerLeave={(e) => {
              const p = nokta(e);
              if (p) gonder({ tur: "hareket", x: p[0], y: p[1], ayril: true });
            }}
            onWheel={(e) => {
              const p = nokta(e);
              if (p) gonder({ tur: "tekerlek", x: p[0], y: p[1], dx: -Math.round(e.deltaX), dy: -Math.round(e.deltaY), ...degistiriciler(e) });
            }}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (e.key === "Escape") return; // pencere kapanır
              e.preventDefault();
              e.stopPropagation();
              gonder(tusOlayi(e, false));
            }}
            onKeyUp={(e) => {
              if (e.key === "Escape") return;
              e.preventDefault();
              gonder(tusOlayi(e, true));
            }}
          >
            {kare ? (
              <img src={kare} alt="" draggable={false} className="h-full w-full object-contain" />
            ) : (
              <span className="dt-soluk text-[12px]">{tuval ? "Görüntü bekleniyor…" : "Açılıyor…"}</span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] dt-soluk">
            Tıklama, kaydırma ve klavye bu kaynağa iletilir (görüntüyü önce tıklayın). {tuval ? `${tuval.genislik}×${tuval.yukseklik}` : ""} · Esc kapatır.
          </p>
        </div>
      )}
    </Pencere>
  );
}
