/** Y2: işaretin tekrar dosyasından dikey (9:16) klip. Kırpma bölgeleri karenin üstünde sürüklenir, köşeden boyutlanır. */
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { API_BASE } from "../../lib/api";

export type Bolge = { x: number; y: number; w: number; h: number };

const EN_AZ = 0.05;

/** Bölgeyi karenin içinde ve en az %5 boyda tutar */
export function bolgeyiSinirla(b: Bolge): Bolge {
  const w = Math.min(1, Math.max(EN_AZ, b.w));
  const h = Math.min(1, Math.max(EN_AZ, b.h));
  return { w, h, x: Math.min(1 - w, Math.max(0, b.x)), y: Math.min(1 - h, Math.max(0, b.y)) };
}

type Surukleme = { ad: "oyun" | "kamera"; tur: "tasi" | "boyut"; px: number; py: number; ilk: Bolge };

export function KlipDuzenleyici({ isaret, onKapat }: { isaret: number; onKapat: () => void }) {
  // Oyun: ortadaki 9:16'ya yakın şerit; kamera: sol üst köşe
  const [oyun, setOyun] = useState<Bolge>({ x: 0.34, y: 0, w: 0.32, h: 1 });
  const [kamera, setKamera] = useState<Bolge | null>(null);
  const [sure, setSure] = useState(30);
  const [durum, setDurum] = useState<{ tur: "bos" | "yapiliyor" | "hata" | "tamam"; metin?: string }>({ tur: "bos" });
  const kutu = useRef<HTMLDivElement>(null);
  const surukle = useRef<Surukleme | null>(null);

  const bas = (ad: Surukleme["ad"], tur: Surukleme["tur"]) => (e: RPointerEvent) => {
    e.stopPropagation();
    surukle.current = { ad, tur, px: e.clientX, py: e.clientY, ilk: ad === "oyun" ? oyun : (kamera as Bolge) };
    try {
      // Fare çerçeveden çıksa da sürükleme sürsün; yakalanamazsa sürükleme yine çalışır
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* geçersiz işaretçi */
    }
  };
  const tasi = (e: RPointerEvent) => {
    const s = surukle.current;
    const r = kutu.current?.getBoundingClientRect();
    if (!s || !r) return;
    const dx = (e.clientX - s.px) / r.width;
    const dy = (e.clientY - s.py) / r.height;
    const yeni = bolgeyiSinirla(s.tur === "tasi" ? { ...s.ilk, x: s.ilk.x + dx, y: s.ilk.y + dy } : { ...s.ilk, w: s.ilk.w + dx, h: s.ilk.h + dy });
    if (s.ad === "oyun") setOyun(yeni);
    else setKamera(yeni);
  };

  const yap = async () => {
    setDurum({ tur: "yapiliyor" });
    try {
      const r = await fetch(`${API_BASE}/api/klip/dikey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isaret, oyun, kamera, sure }),
      });
      if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
      setDurum({ tur: "tamam", metin: ((await r.json()) as { yol: string }).yol });
    } catch (e) {
      setDurum({ tur: "hata", metin: String((e as Error)?.message || e) });
    }
  };

  const cerceve = (ad: Surukleme["ad"], b: Bolge, renk: string, etiket: string) => (
    <div
      className={`absolute cursor-move border-2 ${renk}`}
      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
      onPointerDown={bas(ad, "tasi")}
      onPointerMove={tasi}
      onPointerUp={() => (surukle.current = null)}
    >
      <span className="absolute left-0 top-0 bg-black/70 px-1 text-ui-2 text-white">{etiket}</span>
      <span
        aria-label={`${etiket} boyutu`}
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-white"
        onPointerDown={bas(ad, "boyut")}
        onPointerMove={tasi}
        onPointerUp={() => (surukle.current = null)}
      />
    </div>
  );

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-md border border-white/10 p-2">
      <div ref={kutu} className="relative aspect-video w-full max-w-[480px] touch-none select-none bg-black">
        <img src={`${API_BASE}/api/klip/kare?isaret=${isaret}`} alt="İşaretin ilk karesi" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        {cerceve("oyun", oyun, "border-emerald-400", kamera ? "Oyun (alt)" : "Klip")}
        {kamera && cerceve("kamera", kamera, "border-sky-400", "Kamera (üst)")}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={!!kamera} onChange={(e) => setKamera(e.target.checked ? { x: 0, y: 0, w: 0.25, h: 0.25 } : null)} />
          Kamera üstte
        </label>
        <label className="flex items-center gap-1">
          Süre
          <input type="number" min={1} max={300} value={sure} onChange={(e) => setSure(Number(e.target.value) || 30)} className="w-14 rounded bg-white/5 px-1" />
          sn
        </label>
        <button type="button" disabled={durum.tur === "yapiliyor"} onClick={() => void yap()} className="rounded-md bg-panel-accent/80 px-2 py-0.5 text-white disabled:opacity-60">
          {durum.tur === "yapiliyor" ? "Hazırlanıyor…" : "1080×1920 MP4 yap"}
        </button>
        <button type="button" onClick={onKapat} className="text-panel-muted hover:text-white">
          Kapat
        </button>
      </div>
      {durum.tur === "tamam" && <p className="break-all text-ui-2 text-emerald-300">Yazıldı: {durum.metin}</p>}
      {durum.tur === "hata" && <p className="text-ui-2 text-red-300">{durum.metin}</p>}
    </div>
  );
}
