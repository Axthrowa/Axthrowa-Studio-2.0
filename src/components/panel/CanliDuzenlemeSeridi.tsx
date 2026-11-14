import { Broadcast } from "@phosphor-icons/react";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { useOnizlemeTaslagi } from "../../lib/onizlemeTaslagi";

/**
 * Tablo A8 — yayın açıkken sahne düzenleyicisinin başında. A8b: "Önce önizlemede dene" açıkken değişiklik yalnız
 * önizlemede görünür, "Yayına uygula" ile izleyiciye gider.
 */
export default function CanliDuzenlemeSeridi({ className = "" }: { className?: string }) {
  const canli = useAxthrowaStore((s) => s.isLive);
  const { acik, bekleyen, ac, uygula } = useOnizlemeTaslagi();
  if (!canli) return null;
  return (
    <div role="status" className={`flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200 ${className}`}>
      <Broadcast aria-hidden className="h-4 w-4 shrink-0" weight="fill" />
      <span>{acik ? "Yayındasın: değişiklik önce önizlemede görünür" : "Yayındasın: değişiklik yayında anında görünür"}</span>
      <label className="flex cursor-pointer items-center gap-1 font-medium">
        <input type="checkbox" checked={acik} onChange={(e) => ac(e.target.checked)} />
        Önce önizlemede dene
      </label>
      {bekleyen && (
        <button
          type="button"
          className="rounded-md bg-red-500/80 px-2 py-0.5 text-white hover:bg-red-500"
          onClick={() => void uygula().catch(() => {})}
        >
          Yayına uygula
        </button>
      )}
    </div>
  );
}
