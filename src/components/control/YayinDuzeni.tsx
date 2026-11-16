/**
 * Canlı ekranındaki "Yayın" panelleri. Düzenleme kipinde paneller sürüklenir, sağ alt köşeden boyutlandırılır
 * (klavyede oklar taşır, Shift+oklar boyutlandırır). Yerleşim bu bilgisayarda saklanır.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ETIKET, TUS } from "./donanim";
import { BOSLUK_PX, SABLONLAR, SATIR_PX, SUTUN, eklerleBirlestir, ekPanelMi, kipKutulari, panelEkle, panelKaldir, yerlesimOku, yerlestir, type Kip, type Kutu, type PanelId, type TemelPanelId } from "../../lib/canliYerlesim";
import { EK_PANEL_GRUPLARI } from "../../lib/canliEkPaneller";
import { HataSiniri } from "../ui/HataSiniri";

const YERLESIM_KEY = "studio.canli.yerlesim";
/** Bu genişliğin altında paneller alt alta dizilir: küçük ekranda 12 sütunluk ızgarada panellerin içi sıkışıp iç içe giriyordu */
const DAR_PX = 640;

const anahtar = (kip: Kip) => `${YERLESIM_KEY}.${kip}`;

function kayitliYerlesim(kip: Kip): Kutu[] {
  try {
    // Kipler gelmeden önce tek yerleşim vardı: Canlı kipi onu devralır
    const ham = localStorage.getItem(anahtar(kip)) ?? (kip === "canli" ? localStorage.getItem(YERLESIM_KEY) : null);
    return yerlesimOku(ham, kipKutulari(kip));
  } catch {
    return kipKutulari(kip);
  }
}

function kaydet(kip: Kip, l: Kutu[]) {
  try {
    localStorage.setItem(anahtar(kip), JSON.stringify(l));
  } catch {
    /* saklanamadı: bu oturumda yine geçerli */
  }
}

type Props = {
  /** Hangi kipin yerleşimi: her kipin kendi yerleşimi ve kaydı var (üst bileşen kip değişince bunu `key` ile yeniler) */
  kip: Kip;
  duzenle: boolean;
  onBitti: () => void;
  onGenisSohbet: (genis: boolean) => void;
  /** `baslikEki`: başlığın sağında küçük denetim (ör. Hızlı işlem › Özelleştir) */
  paneller: Record<TemelPanelId, { baslik: string; gosterBaslik: boolean; icerik: ReactNode; baslikEki?: ReactNode }>;
  /** Eklenen panelin başlığı ve içeriği; katalogda yoksa `null` (kayıttan kalmış eski kimlik) */
  ekPanel: (id: string) => { baslik: string; icerik: ReactNode } | null;
};

export default function YayinDuzeni({ kip, duzenle, onBitti, onGenisSohbet, paneller, ekPanel }: Props) {
  const [yerlesim, setYerlesim] = useState(() => kayitliYerlesim(kip));
  const [dar, setDar] = useState(false);
  const izgara = useRef<HTMLDivElement>(null);
  const hareket = useRef<{ id: PanelId; tur: "tasi" | "boyut"; px: number; py: number; taban: Kutu[] } | null>(null);

  useEffect(() => {
    const el = izgara.current;
    if (!el) return;
    const olc = () => setDar(el.clientWidth > 0 && el.clientWidth < DAR_PX);
    olc();
    const ro = new ResizeObserver(olc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const basla = (id: PanelId, tur: "tasi" | "boyut") => (e: PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    hareket.current = { id, tur, px: e.clientX, py: e.clientY, taban: yerlesim };
  };

  const surukle = (e: PointerEvent<HTMLElement>) => {
    const h = hareket.current;
    const el = izgara.current;
    if (!h || !el) return;
    const sutunAdim = (el.clientWidth + BOSLUK_PX) / SUTUN;
    const dx = Math.round((e.clientX - h.px) / sutunAdim);
    const dy = Math.round((e.clientY - h.py) / (SATIR_PX + BOSLUK_PX));
    const k = h.taban.find((x) => x.id === h.id)!;
    const yeni = h.tur === "tasi" ? { ...k, x: k.x + dx, y: k.y + dy } : { ...k, w: k.w + dx, h: k.h + dy };
    // Hep başlangıçtan hesaplanır: geri çekilince itilen paneller eski yerine döner
    setYerlesim(yerlestir(h.taban, h.id, yeni));
  };

  const birak = () => {
    if (!hareket.current) return;
    hareket.current = null;
    kaydet(kip, yerlesim);
  };

  const tus = (id: PanelId) => (e: KeyboardEvent<HTMLDivElement>) => {
    const yon = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!yon) return;
    e.preventDefault();
    const k = yerlesim.find((x) => x.id === id)!;
    const yeni = e.shiftKey ? { ...k, w: k.w + yon[0], h: k.h + yon[1] } : { ...k, x: k.x + yon[0], y: k.y + yon[1] };
    const sonuc = yerlestir(yerlesim, id, yeni);
    setYerlesim(sonuc);
    kaydet(kip, sonuc);
  };

  const uygula = (kutular: Kutu[], genisSohbet: boolean) => {
    const sonuc = eklerleBirlestir(kutular, yerlesim);
    setYerlesim(sonuc);
    kaydet(kip, sonuc);
    onGenisSohbet(genisSohbet);
  };

  const listeyiYaz = (liste: Kutu[]) => {
    setYerlesim(liste);
    kaydet(kip, liste);
  };

  const duzenlemede = duzenle && !dar;

  return (
    <div className="flex min-h-full flex-col gap-2">
      {duzenle ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-md border border-panel-border bg-panel-card px-3 py-2 text-xs text-white">
          <span className="min-w-0 flex-1">{dar ? "Düzenlemek için pencereyi genişlet." : "Panelleri sürükle, sağ alt köşeden boyutlandır."}</span>
          {SABLONLAR.map((s) => (
            <button key={s.id} type="button" className={`${TUS} h-8 px-3 text-xs font-medium`} onClick={() => uygula(s.kutular, s.genisSohbet)}>
              {s.ad}
            </button>
          ))}
          <button type="button" className={`${TUS} h-8 px-3 text-xs font-medium`} onClick={() => uygula(kipKutulari(kip), false)}>
            Varsayılana dön
          </button>
          <select
            aria-label="Panel ekle"
            className={`${TUS} h-8 px-2 text-xs font-medium`}
            value=""
            onChange={(e) => e.target.value && listeyiYaz(panelEkle(yerlesim, e.target.value as PanelId))}
          >
            <option value="">+ Panel ekle…</option>
            {EK_PANEL_GRUPLARI.map((g) => (
              <optgroup key={g.ad} label={g.ad}>
                {g.paneller.map((p) => (
                  <option key={p.id} value={p.id} disabled={yerlesim.some((k) => k.id === p.id)}>
                    {p.ad}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="button" className={`${TUS} h-8 px-3 text-xs font-bold`} onClick={onBitti}>
            Bitti
          </button>
        </div>
      ) : null}
      <div
        ref={izgara}
        className={dar ? "flex flex-col gap-4" : "grid"}
        style={dar ? undefined : { gridTemplateColumns: `repeat(${SUTUN}, minmax(0, 1fr))`, gridAutoRows: SATIR_PX, gap: BOSLUK_PX }}
      >
        {yerlesim.map((k) => {
          const ek = ekPanelMi(k.id) ? ekPanel(k.id) : null;
          if (ekPanelMi(k.id) && !ek) return null;
          const p: Props["paneller"][TemelPanelId] = ek ? { baslik: ek.baslik, gosterBaslik: true, icerik: ek.icerik } : paneller[k.id as TemelPanelId];
          return (
            <div
              key={k.id}
              className={`relative flex min-h-0 min-w-0 flex-col rounded-md border border-panel-border bg-panel-card ${p.gosterBaslik ? "p-2" : ""} ${dar && k.id === "onizleme" ? "aspect-video" : ""} ${dar && k.id === "ses" ? "h-80" : ""}`}
              style={dar ? (ek ? { height: 480 } : undefined) : { gridColumn: `${k.x + 1} / span ${k.w}`, gridRow: `${k.y + 1} / span ${k.h}` }}
            >
              {p.gosterBaslik ? (
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
                  <h2 className={ETIKET}>{p.baslik}</h2>
                  {p.baslikEki}
                </div>
              ) : null}
              <div className="custom-scrollbar min-h-0 flex-1 overflow-auto"><HataSiniri ad={p.baslik}>{p.icerik}</HataSiniri></div>
              {duzenlemede ? (
                <div
                  role="group"
                  tabIndex={0}
                  aria-label={`${p.baslik}: oklarla taşı, Shift ve oklarla boyutlandır`}
                  onPointerDown={basla(k.id, "tasi")}
                  onPointerMove={surukle}
                  onPointerUp={birak}
                  onPointerCancel={birak}
                  onKeyDown={tus(k.id)}
                  className="absolute inset-0 z-10 flex cursor-move touch-none select-none items-center justify-center rounded-md border-2 border-dashed border-white/30 bg-black/70 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  {p.baslik}
                  {ek ? (
                    <button
                      type="button"
                      className={`${TUS} absolute right-2 top-2 h-7 px-2 text-xs font-medium`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => listeyiYaz(panelKaldir(yerlesim, k.id))}
                    >
                      Kaldır
                    </button>
                  ) : null}
                  <span
                    aria-hidden
                    title="Boyutlandır"
                    onPointerDown={basla(k.id, "boyut")}
                    onPointerMove={surukle}
                    onPointerUp={birak}
                    onPointerCancel={birak}
                    className="absolute bottom-0 right-0 h-6 w-6 cursor-se-resize rounded-br-md rounded-tl-md bg-panel-accent"
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
