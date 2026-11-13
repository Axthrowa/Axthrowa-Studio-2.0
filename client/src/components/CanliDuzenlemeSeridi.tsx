/**
 * Tablo A8 — yayın açıkken uyarı ve katman düzenleyicisinin başında durur:
 * buradaki değişiklik OBS'teki katmana anında gider. Yayın bilgisi `/api/status` → `canli`.
 */
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';

export function CanliDuzenlemeSeridi() {
  const [canli, setCanli] = useState(false);
  useEffect(() => {
    let iptal = false;
    const cek = () =>
      fetch('/api/status')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !iptal && setCanli(d?.canli?.canli === true))
        .catch(() => {});
    cek();
    const t = setInterval(cek, 10_000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, []);
  if (!canli) return null;
  return (
    <div role="status" className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200">
      <Radio className="h-4 w-4 shrink-0" aria-hidden />
      Yayındasın: değişiklik yayında anında görünür
    </div>
  );
}
