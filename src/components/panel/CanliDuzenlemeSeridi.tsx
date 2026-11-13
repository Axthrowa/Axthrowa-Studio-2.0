import { Broadcast } from "@phosphor-icons/react";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";

/** Tablo A8 — yayın açıkken sahne düzenleyicisinin başında: buradaki değişiklik izleyiciye anında gider */
export default function CanliDuzenlemeSeridi({ className = "" }: { className?: string }) {
  const canli = useAxthrowaStore((s) => s.isLive);
  if (!canli) return null;
  return (
    <div role="status" className={`flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200 ${className}`}>
      <Broadcast aria-hidden className="h-4 w-4 shrink-0" weight="fill" />
      Yayındasın: değişiklik yayında anında görünür
    </div>
  );
}
