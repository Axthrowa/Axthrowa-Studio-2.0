/**
 * Yayın çalışma alanının ortak masaüstü parçaları: pencere çerçevesi, ad istemi, onay kutusu, menü çubuğu.
 * Tümü klavyeyle kullanılır (Esc kapatır, Enter onaylar; menü çubuğunda ok tuşları).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BaglamMenusu, type MenuOgesi } from "../ui/BaglamMenusu";

export function hataMetni(e: unknown): string {
  return String((e as Error)?.message || e).slice(0, 300);
}

export function Pencere({
  baslik,
  genislik = 520,
  onKapat,
  children,
  alt,
  genis,
}: {
  baslik: string;
  genislik?: number;
  onKapat: () => void;
  children: ReactNode;
  alt?: ReactNode;
  /** Geniş yönetici penceresi (dt-modal-genis) */
  genis?: boolean;
}) {
  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && onKapat()}>
      <div
        className={genis ? "dt-modal dt-modal-genis" : "dt-modal"}
        role="dialog"
        aria-label={baslik}
        style={genis ? undefined : { width: genislik }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onKapat();
          }
        }}
      >
        <div className="dt-dock-baslik">
          {baslik}
          <span className="dt-bosluk" />
          <button type="button" className="dt-tool" aria-label="Kapat" onClick={onKapat}>
            ✕
          </button>
        </div>
        <div className={genis ? "dt-kaydir" : "max-h-[64vh] overflow-auto"}>{children}</div>
        {alt && <div className="flex items-center justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">{alt}</div>}
      </div>
    </div>
  );
}

export function AdIstemi({
  baslik,
  etiket = "Ad",
  baslangic = "",
  onay = "Tamam",
  onKapat,
  onTamam,
}: {
  baslik: string;
  etiket?: string;
  baslangic?: string;
  onay?: string;
  onKapat: () => void;
  onTamam: (ad: string) => void;
}) {
  const [ad, setAd] = useState(baslangic);
  const kutu = useRef<HTMLInputElement>(null);
  useEffect(() => {
    kutu.current?.focus();
    kutu.current?.select();
  }, []);
  const tamam = () => {
    const a = ad.trim();
    if (a) onTamam(a);
  };
  return (
    <Pencere
      baslik={baslik}
      genislik={400}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={!ad.trim()} onClick={tamam}>
            {onay}
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="ad-istemi">{etiket}</label>
        <input id="ad-istemi" ref={kutu} className="dt-input" maxLength={80} value={ad} onChange={(e) => setAd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tamam()} />
      </div>
    </Pencere>
  );
}

export type OnayIstegi = { baslik: string; metin: string; eylem: string; tehlikeli?: boolean; yap: () => void };

export function OnayKutusu({ istek, onKapat }: { istek: OnayIstegi; onKapat: () => void }) {
  return (
    <Pencere
      baslik={istek.baslik}
      genislik={420}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" autoFocus onClick={onKapat}>
            Vazgeç
          </button>
          <button
            type="button"
            className={istek.tehlikeli === false ? "dt-btn-primary" : "dt-btn-danger"}
            onClick={() => {
              onKapat();
              istek.yap();
            }}
          >
            {istek.eylem}
          </button>
        </>
      }
    >
      <p className="px-3 py-3 text-[13px]">{istek.metin}</p>
    </Pencere>
  );
}

export type Menu = { ad: string; ogeler: () => MenuOgesi[] };

/**
 * Menü çubuğu (OBS gibi: Dosya · Düzen · Görünüm …). Tıklayınca açılır; açıkken üzerinde gezinince komşu menüye
 * geçer; ←/→ menüler arasında, ↑/↓ öğeler arasında, Esc kapatır.
 */
export function MenuCubugu({ menuler }: { menuler: Menu[] }) {
  const [acik, setAcik] = useState<number | null>(null);
  const dugmeler = useRef<(HTMLButtonElement | null)[]>([]);
  const konum = (i: number) => {
    const r = dugmeler.current[i]?.getBoundingClientRect();
    return { x: r?.left ?? 0, y: r?.bottom ?? 0 };
  };
  const ac = (i: number) => setAcik(((i % menuler.length) + menuler.length) % menuler.length);
  useEffect(() => {
    if (acik === null) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        ac(acik + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", tus, true);
    return () => window.removeEventListener("keydown", tus, true);
  }, [acik]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = acik !== null ? konum(acik) : null;
  return (
    <div className="dt-menu-cubugu" role="menubar" aria-label="Yayın menüsü">
      {menuler.map((m, i) => (
        <button
          key={m.ad}
          ref={(el) => {
            dugmeler.current[i] = el;
          }}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={acik === i}
          className="dt-menu-baslik"
          onMouseDown={(e) => {
            e.preventDefault();
            // Açık menünün dış tık dinleyicisi önce kapatır; başlığa tekrar tıklama kapalı bırakır
            setAcik(acik === i ? null : i);
          }}
          onMouseEnter={() => acik !== null && acik !== i && setAcik(i)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
              e.preventDefault();
              setAcik(i);
            }
          }}
        >
          {m.ad}
        </button>
      ))}
      {acik !== null && k && <BaglamMenusu key={acik} x={k.x} y={k.y} ogeler={menuler[acik].ogeler()} onKapat={() => setAcik(null)} />}
    </div>
  );
}
