/** Y11: Giriş/Çıkış ekranında "Sıradaki yayın" metni (panel ayarındaki takvimden, dakikada bir yenilenir) */
import { useEffect, useState } from "react";
import { fetchSettings } from "../../lib/api";
import { siradakiMetni, siradakiYayin, takvimAyari } from "../../lib/yayinTakvimi";

export function useSiradakiYayin(acik: boolean): string | null {
  const [metin, setMetin] = useState<string | null>(null);
  useEffect(() => {
    if (!acik) return setMetin(null);
    let iptal = false;
    const oku = () =>
      fetchSettings("panel")
        .then((s) => {
          const a = takvimAyari((s as Record<string, unknown>).yayinTakvimi);
          const y = a.goster ? siradakiYayin(a.liste, Date.now()) : null;
          if (!iptal) setMetin(y ? siradakiMetni(y, Date.now()) : null);
        })
        .catch(() => {});
    void oku();
    const t = setInterval(() => void oku(), 60_000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, [acik]);
  return metin;
}
