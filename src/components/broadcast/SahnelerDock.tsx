/**
 * Sahneler dock'u (OBS "Scenes"): tuvalin sahneleri; tıklama programa alır (Studio Mode'da önizlemeye), Studio
 * Mode'da çift tıklama geçiş yapar. Sürükle-bırak ya da araç çubuğuyla sıralama, F2 yeniden adlandır, Del sil,
 * bağlam menüsünde çoğalt ve geçiş geçersiz kılma.
 */
import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Minus, Plus, Settings2 } from "lucide-react";
import type { MotorGecis, MotorSahneOzeti } from "../../lib/api/motor";
import type { MenuOgesi } from "../ui/BaglamMenusu";

export type SahneEylemleri = {
  sec: (id: string) => void;
  programa: (id: string) => void;
  ekle: () => void;
  sil: (s: MotorSahneOzeti) => void;
  adlandir: (s: MotorSahneOzeti) => void;
  cogalt: (s: MotorSahneOzeti) => void;
  sirala: (ids: string[]) => void;
  gecisGecersiz: (s: MotorSahneOzeti, g: MotorGecis | null) => void;
  /** Sahne filtreleri (verilmezse menüde görünmez — ayrı pencere dock'u) */
  filtreler?: (s: MotorSahneOzeti) => void;
  ekranGoruntusu?: (s: MotorSahneOzeti) => void;
  projektor?: (s: MotorSahneOzeti) => void;
  menuAc: (e: { clientX: number; clientY: number; preventDefault?: () => void }, o: MenuOgesi[]) => void;
};

export function SahnelerDock({
  sahneler,
  tumSahneler,
  program,
  onizleme,
  studyo,
  secili,
  gecisTurleri,
  eylem,
}: {
  /** Bu tuvalin sahneleri (gösterim sırası) */
  sahneler: MotorSahneOzeti[];
  /** Tüm sahneler (sıralama tüm listeye uygulanır) */
  tumSahneler: MotorSahneOzeti[];
  program: string | undefined;
  onizleme: string | null | undefined;
  studyo: boolean;
  secili: string | null;
  gecisTurleri: { id: string; ad: string }[];
  eylem: SahneEylemleri;
}) {
  const [surukle, setSurukle] = useState<string | null>(null);
  const liste = useRef<HTMLDivElement>(null);
  const seciliSahne = sahneler.find((s) => s.id === secili) ?? null;

  /** Bu tuvalin sahnelerinin yeni sırasını tüm listeye yerleştirir */
  const yeniSira = (tuvalSirasi: string[]): string[] => {
    const kume = new Set(tuvalSirasi);
    const kalan = [...tuvalSirasi];
    return tumSahneler.map((s) => (kume.has(s.id) ? kalan.shift()! : s.id));
  };
  const tasi = (id: string, fark: number | "ust" | "alt") => {
    const ids = sahneler.map((s) => s.id);
    const i = ids.indexOf(id);
    if (i < 0) return;
    ids.splice(i, 1);
    const j = fark === "ust" ? 0 : fark === "alt" ? ids.length : Math.max(0, Math.min(ids.length, i + fark));
    ids.splice(j, 0, id);
    eylem.sirala(yeniSira(ids));
  };

  const menu = (s: MotorSahneOzeti): MenuOgesi[] => [
    ...(studyo ? [{ etiket: "Programa al", eylem: () => eylem.programa(s.id) } as MenuOgesi, "ayirici" as const] : []),
    { etiket: "Çoğalt", eylem: () => eylem.cogalt(s) },
    { etiket: "Yeniden adlandır", kisayol: "F2", eylem: () => eylem.adlandir(s) },
    ...(eylem.filtreler ? [{ etiket: "Filtreler…", eylem: () => eylem.filtreler?.(s) } as MenuOgesi] : []),
    ...(eylem.ekranGoruntusu ? [{ etiket: "Ekran görüntüsü (sahne)", eylem: () => eylem.ekranGoruntusu?.(s) } as MenuOgesi] : []),
    ...(eylem.projektor ? [{ etiket: "Projektör (pencere)", eylem: () => eylem.projektor?.(s) } as MenuOgesi] : []),
    { etiket: "Kaldır", kisayol: "Del", tehlikeli: true, devreDisi: sahneler.length <= 1 || s.id === program, eylem: () => eylem.sil(s) },
    "ayirici",
    { etiket: "Yukarı taşı", devreDisi: sahneler[0]?.id === s.id, eylem: () => tasi(s.id, -1) },
    { etiket: "Aşağı taşı", devreDisi: sahneler.at(-1)?.id === s.id, eylem: () => tasi(s.id, 1) },
    { etiket: "En üste", eylem: () => tasi(s.id, "ust") },
    { etiket: "En alta", eylem: () => tasi(s.id, "alt") },
    "ayirici",
    { etiket: `Geçiş geçersiz kılma: ${s.gecis ? (gecisTurleri.find((t) => t.id === s.gecis?.tur)?.ad ?? s.gecis.tur) : "yok"}`, devreDisi: true, eylem: () => undefined },
    { etiket: "Geçersiz kılmayı kaldır", devreDisi: !s.gecis, eylem: () => eylem.gecisGecersiz(s, null) },
    ...gecisTurleri.slice(0, 8).map(
      (t): MenuOgesi => ({ etiket: `Bu sahneye geçerken: ${t.ad}`, eylem: () => eylem.gecisGecersiz(s, { tur: t.id, sure_ms: s.gecis?.sure_ms ?? 300 }) })
    ),
  ];

  return (
    <section className="dt-dock h-full" aria-label="Sahneler">
      <div className="dt-dock-baslik">Sahneler</div>
      <div
        ref={liste}
        className="dt-dock-govde"
        role="listbox"
        aria-label="Sahneler"
        tabIndex={0}
        onKeyDown={(e) => {
          const i = sahneler.findIndex((s) => s.id === secili);
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const j = e.key === "ArrowDown" ? Math.min(sahneler.length - 1, i + 1) : Math.max(0, i - 1);
            if (sahneler[j]) eylem.sec(sahneler[j].id);
          } else if (e.key === "F2" && seciliSahne) {
            e.preventDefault();
            eylem.adlandir(seciliSahne);
          } else if (e.key === "Delete" && seciliSahne) {
            e.preventDefault();
            eylem.sil(seciliSahne);
          } else if (e.key === "Enter" && seciliSahne && studyo) {
            eylem.programa(seciliSahne.id);
          }
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) eylem.menuAc(e, [{ etiket: "Sahne ekle", eylem: eylem.ekle }]);
        }}
      >
        {sahneler.map((s) => {
          const programda = s.id === program;
          const onizlemede = studyo && s.id === onizleme;
          return (
            <div
              key={s.id}
              role="option"
              aria-selected={s.id === secili}
              className="dt-row"
              draggable
              data-surukle-hedef={surukle && surukle !== s.id ? "true" : undefined}
              onDragStart={(e) => {
                setSurukle(s.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setSurukle(null)}
              onDragOver={(e) => surukle && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!surukle || surukle === s.id) return;
                const ids = sahneler.map((x) => x.id).filter((x) => x !== surukle);
                ids.splice(ids.indexOf(s.id), 0, surukle);
                eylem.sirala(yeniSira(ids));
                setSurukle(null);
              }}
              onClick={() => eylem.sec(s.id)}
              onDoubleClick={() => studyo && eylem.programa(s.id)}
              onContextMenu={(e) => {
                eylem.sec(s.id);
                eylem.menuAc(e, menu(s));
              }}
              title={studyo ? "Tıkla: önizlemeye al · Çift tıkla: programa geç" : "Tıkla: programa geç"}
            >
              <span className="dt-nokta" data-durum={programda ? "canli" : onizlemede ? "hazir" : undefined} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s.ad}</span>
              {s.gecis && (
                <span className="dt-soluk text-[10px]" title="Geçiş geçersiz kılma">
                  {gecisTurleri.find((t) => t.id === s.gecis?.tur)?.ad ?? s.gecis.tur}
                </span>
              )}
              {programda && <span className="text-[10px] font-semibold" style={{ color: "var(--dt-live)" }}>PROGRAM</span>}
              {onizlemede && !programda && <span className="text-[10px] font-semibold" style={{ color: "var(--dt-ok)" }}>ÖNİZLEME</span>}
            </div>
          );
        })}
      </div>
      <div className="dt-arac-cubugu">
        <button type="button" className="dt-tool" aria-label="Sahne ekle" title="Sahne ekle" onClick={eylem.ekle}>
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="dt-tool" aria-label="Sahneyi kaldır" title="Sahneyi kaldır (Del)" disabled={!seciliSahne || sahneler.length <= 1} onClick={() => seciliSahne && eylem.sil(seciliSahne)}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="dt-tool"
          aria-label="Sahne seçenekleri"
          title="Sahne seçenekleri"
          disabled={!seciliSahne}
          onClick={(e) => seciliSahne && eylem.menuAc(e, menu(seciliSahne))}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <span className="dt-bosluk" />
        <button type="button" className="dt-tool" aria-label="Yukarı taşı" title="Yukarı taşı" disabled={!seciliSahne} onClick={() => seciliSahne && tasi(seciliSahne.id, -1)}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="dt-tool" aria-label="Aşağı taşı" title="Aşağı taşı" disabled={!seciliSahne} onClick={() => seciliSahne && tasi(seciliSahne.id, 1)}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
