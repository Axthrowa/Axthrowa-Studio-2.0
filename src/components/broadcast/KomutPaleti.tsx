/**
 * Komut paleti (Ctrl+K): menü çubuğundaki tüm eylemler ve sahneler tek aranabilir listede. ↑/↓ seç, Enter çalıştır,
 * Esc kapat. Devre dışı eylemler listelenmez.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuOgesi } from "../ui/BaglamMenusu";

export type Komut = { etiket: string; grup: string; kisayol?: string; eylem: () => void };

/** Menülerden komut listesi: ayırıcılar ve devre dışı öğeler düşer; yinelenen etiketler tekilleşir */
export function komutlar(menuler: { ad: string; ogeler: () => MenuOgesi[] }[], ek: Komut[] = []): Komut[] {
  const v: Komut[] = [...ek];
  for (const m of menuler) {
    for (const o of m.ogeler()) {
      if (o === "ayirici" || o.devreDisi) continue;
      v.push({ etiket: o.etiket.replace(/^[☑☐●]\s*/, ""), grup: m.ad, kisayol: o.kisayol, eylem: o.eylem });
    }
  }
  const gorulen = new Set<string>();
  return v.filter((k) => {
    const a = `${k.grup}|${k.etiket}`;
    if (gorulen.has(a)) return false;
    gorulen.add(a);
    return true;
  });
}

/** Türkçe duyarlı, sözcük sırasından bağımsız süzgeç: tüm parçalar etikette ya da grupta geçmeli */
export function suz(liste: Komut[], sorgu: string): Komut[] {
  const parcalar = sorgu.toLocaleLowerCase("tr").split(/\s+/).filter(Boolean);
  if (!parcalar.length) return liste;
  return liste.filter((k) => {
    const m = `${k.grup} ${k.etiket}`.toLocaleLowerCase("tr");
    return parcalar.every((p) => m.includes(p));
  });
}

export function KomutPaleti({ liste, onKapat }: { liste: Komut[]; onKapat: () => void }) {
  const [sorgu, setSorgu] = useState("");
  const [i, setI] = useState(0);
  const kutu = useRef<HTMLInputElement>(null);
  const sonuc = useMemo(() => suz(liste, sorgu).slice(0, 60), [liste, sorgu]);
  useEffect(() => kutu.current?.focus(), []);
  useEffect(() => setI(0), [sorgu]);
  const calistir = (k: Komut | undefined) => {
    if (!k) return;
    onKapat();
    k.eylem();
  };
  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && onKapat()}>
      <div className="dt-modal" role="dialog" aria-label="Komut paleti" style={{ width: 560 }}>
        <input
          ref={kutu}
          className="dt-input m-2 w-[calc(100%-16px)]"
          placeholder="Komut ya da sahne ara… (ör. kayıt, studio, sahne oyun)"
          aria-label="Komut ara"
          value={sorgu}
          onChange={(e) => setSorgu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onKapat();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setI((x) => Math.min(sonuc.length - 1, x + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setI((x) => Math.max(0, x - 1));
            } else if (e.key === "Enter") calistir(sonuc[i]);
          }}
        />
        <div role="listbox" aria-label="Komutlar" className="max-h-[50vh] overflow-auto pb-2">
          {sonuc.length === 0 && <p className="px-3 py-2 text-[12px] dt-soluk">Eşleşen komut yok.</p>}
          {sonuc.map((k, j) => (
            <div key={`${k.grup}|${k.etiket}`} role="option" aria-selected={j === i} className="dt-row" onMouseEnter={() => setI(j)} onClick={() => calistir(k)}>
              <span className="dt-soluk w-28 shrink-0 truncate text-[11px]">{k.grup}</span>
              <span className="min-w-0 flex-1 truncate">{k.etiket}</span>
              {k.kisayol && <span className="dt-menu-kisayol">{k.kisayol}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
