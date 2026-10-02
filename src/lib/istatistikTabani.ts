/**
 * İstatistikler › Sıfırla (OBS "Reset"): sayaçlar o andaki değerlerden itibaren gösterilir. Motor sayaçlarına
 * dokunulmaz; arayüz bir taban tutar. Sayaç tabandan küçükse (motor yeniden başladı) taban yok sayılır.
 */
export type Sayaclar = {
  geciken: number;
  toplam: number;
  atlanan?: number;
  videoKare?: number;
  cikislar: Record<string, { kare: number; dusen: number; bayt: number }>;
};

const fark = (simdi: number, taban: number | undefined) => (taban != null && simdi >= taban ? simdi - taban : simdi);

export function tabandanFark(s: Sayaclar, taban: Sayaclar | null): Sayaclar {
  if (!taban) return s;
  // Toplam kare azaldıysa motor yeniden başlamıştır: tüm taban geçersiz
  if (s.toplam < taban.toplam) return s;
  return {
    geciken: fark(s.geciken, taban.geciken),
    toplam: fark(s.toplam, taban.toplam),
    atlanan: s.atlanan == null ? undefined : fark(s.atlanan, taban.atlanan),
    videoKare: s.videoKare == null ? undefined : fark(s.videoKare, taban.videoKare),
    cikislar: Object.fromEntries(
      Object.entries(s.cikislar).map(([id, c]) => {
        const t = taban.cikislar[id];
        // Çıktı yeniden başladıysa (kare azaldı) kendi tabanı geçersiz
        const gecerli = t && c.kare >= t.kare && c.bayt >= t.bayt;
        return [id, gecerli ? { kare: c.kare - t.kare, dusen: fark(c.dusen, t.dusen), bayt: c.bayt - t.bayt } : c];
      })
    ),
  };
}
