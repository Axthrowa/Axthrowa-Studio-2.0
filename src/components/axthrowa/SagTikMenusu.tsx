/**
 * Tarayıcının sağ tık menüsü ("İncele", "Geri", "Yeniden yükle") masaüstü uygulamasında görünmesin;
 * yerine farenin altında açılan AxthrowA menüsü. Metin kutusunda Kes/Kopyala/Yapıştır/Tümünü seç (tarayıcı
 * menüsü kapanınca sağ tıkla yapıştırma kaybolmasın), seçili yazıda Kopyala.
 * Geliştirmede Shift + sağ tık tarayıcı menüsünü açar (İncele için).
 */
import { useEffect, useRef, useState } from "react";
import { ClipboardPaste, Copy, RefreshCw, Scissors, TextSelect } from "lucide-react";

type Oge = { ad: string; ikon: typeof Copy; kisayol?: string; yap: () => void; kapali?: boolean };
type Durum = { x: number; y: number; ogeler: Oge[] } | null;

function duzenlenebilir(el: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | HTMLElement | null {
  const e = el as HTMLElement | null;
  if (!e) return null;
  if (e instanceof HTMLTextAreaElement) return e;
  if (e instanceof HTMLInputElement && /^(text|search|url|email|number|password|tel)$/i.test(e.type)) return e;
  const ce = e.closest?.("[contenteditable=''], [contenteditable='true']") as HTMLElement | null;
  return ce;
}

/** Menünün ekrana sığan konumu */
export function menuKonumu(x: number, y: number, w: number, h: number, ekranW: number, ekranH: number, pay = 8) {
  return { x: Math.max(pay, Math.min(x, ekranW - w - pay)), y: Math.max(pay, Math.min(y, ekranH - h - pay)) };
}

export default function SagTikMenusu() {
  const [durum, setDurum] = useState<Durum>(null);
  const [konum, setKonum] = useState<{ x: number; y: number } | null>(null);
  const kutu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ac = (e: MouseEvent) => {
      if (import.meta.env.DEV && e.shiftKey) return;
      e.preventDefault();
      const alan = duzenlenebilir(e.target);
      const secim = window.getSelection()?.toString() || "";
      const ogeler: Oge[] = [];
      if (alan) {
        alan.focus();
        const salt = (alan as HTMLInputElement).readOnly || (alan as HTMLInputElement).disabled;
        const secili = "selectionStart" in alan && typeof (alan as HTMLInputElement).selectionStart === "number"
          ? (alan as HTMLInputElement).selectionStart !== (alan as HTMLInputElement).selectionEnd
          : !!secim;
        ogeler.push(
          { ad: "Kes", ikon: Scissors, kisayol: "Ctrl+X", kapali: salt || !secili, yap: () => document.execCommand("cut") },
          { ad: "Kopyala", ikon: Copy, kisayol: "Ctrl+C", kapali: !secili, yap: () => document.execCommand("copy") },
          {
            ad: "Yapıştır",
            ikon: ClipboardPaste,
            kisayol: "Ctrl+V",
            kapali: salt,
            // insertText: React'ın onChange'i tetiklensin (değer doğrudan yazılırsa durum güncellenmez)
            yap: () => void navigator.clipboard?.readText().then((t) => t && document.execCommand("insertText", false, t)).catch(() => {}),
          },
          { ad: "Tümünü seç", ikon: TextSelect, kisayol: "Ctrl+A", yap: () => document.execCommand("selectAll") }
        );
      } else if (secim) {
        ogeler.push({ ad: "Kopyala", ikon: Copy, kisayol: "Ctrl+C", yap: () => void navigator.clipboard?.writeText(secim).catch(() => {}) });
      }
      ogeler.push({ ad: "Paneli yenile", ikon: RefreshCw, kisayol: "F5", yap: () => window.location.reload() });
      setKonum(null);
      setDurum({ x: e.clientX, y: e.clientY, ogeler });
    };
    document.addEventListener("contextmenu", ac);
    return () => document.removeEventListener("contextmenu", ac);
  }, []);

  // Açılınca ekrana sığdır, ilk öğeye odaklan; dışa tıklama, Esc, kaydırma, pencere boyutu kapatır
  useEffect(() => {
    if (!durum) return;
    const r = kutu.current?.getBoundingClientRect();
    if (r) setKonum(menuKonumu(durum.x, durum.y, r.width, r.height, window.innerWidth, window.innerHeight));
    kutu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    const kapat = () => setDurum(null);
    const disari = (e: MouseEvent) => !kutu.current?.contains(e.target as Node) && kapat();
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") return kapat();
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const dugmeler = [...(kutu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || [])];
      const i = dugmeler.indexOf(document.activeElement as HTMLButtonElement);
      dugmeler[(i + (e.key === "ArrowDown" ? 1 : -1) + dugmeler.length) % dugmeler.length]?.focus();
    };
    window.addEventListener("mousedown", disari, true);
    window.addEventListener("keydown", tus);
    window.addEventListener("resize", kapat);
    window.addEventListener("scroll", kapat, true);
    return () => {
      window.removeEventListener("mousedown", disari, true);
      window.removeEventListener("keydown", tus);
      window.removeEventListener("resize", kapat);
      window.removeEventListener("scroll", kapat, true);
    };
  }, [durum]);

  if (!durum) return null;
  return (
    <div
      ref={kutu}
      role="menu"
      // İlk çizimde ölçülene dek görünmez (köşeden zıplamasın)
      style={{ left: konum?.x ?? durum.x, top: konum?.y ?? durum.y, visibility: konum ? "visible" : "hidden" }}
      className="fixed z-[600] min-w-[13rem] overflow-hidden rounded-xl bg-axthrowa-card p-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.6)] animate-zoom-in before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:border-t before:border-white/5"
      onContextMenu={(e) => e.preventDefault()}
    >
      {durum.ogeler.map((o, i) => {
        const Ikon = o.ikon;
        const ayrac = i > 0 && o.ad === "Paneli yenile";
        return (
          <div key={o.ad}>
            {ayrac && <div className="mx-2 my-1 h-px bg-white/5" />}
            <button
              type="button"
              role="menuitem"
              disabled={o.kapali}
              // Odak metin kutusundan kaymasın: kes/kopyala/yapıştır seçime uygulanır
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setDurum(null);
                o.yap();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:bg-zinc-800/60 focus-visible:text-zinc-100 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35"
            >
              <Ikon className="h-4 w-4 text-zinc-500" />
              <span className="flex-1">{o.ad}</span>
              {o.kisayol ? <span className="font-mono text-[11px] text-zinc-600">{o.kisayol}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
