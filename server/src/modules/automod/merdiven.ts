/**
 * Ceza merdiveni (B2): aynı kişinin art arda ihlalleri artan cezayla karşılanır.
 * Basamaklar: uyarı → 1 dk → 10 dk → kalıcı ban. Kişi `pencereMs` boyunca temiz kalırsa baştan başlar.
 * Saf: yalnız hangi basamağın uygulanacağına karar verir.
 */
export type MerdivenBasamagi = { tur: 'uyari' } | { tur: 'timeout'; saniye: number } | { tur: 'ban' };

export const MERDIVEN: readonly MerdivenBasamagi[] = [
  { tur: 'uyari' },
  { tur: 'timeout', saniye: 60 },
  { tur: 'timeout', saniye: 600 },
  { tur: 'ban' }
];

export const VARSAYILAN_PENCERE_MS = 30 * 60_000;

export class CezaMerdiveni {
  private kayit = new Map<string, { adim: number; son: number }>();

  /** İhlali kaydeder, uygulanacak basamağı (0'dan) ve basamağın kendisini döndürür. */
  ilerle(anahtar: string, pencereMs = VARSAYILAN_PENCERE_MS, simdi = Date.now()): { adim: number; basamak: MerdivenBasamagi } {
    const k = anahtar.toLowerCase();
    const o = this.kayit.get(k);
    const adim = o && simdi - o.son < pencereMs ? Math.min(o.adim + 1, MERDIVEN.length - 1) : 0;
    this.kayit.set(k, { adim, son: simdi });
    // shortcut: yalnız bellekte ve en çok 5000 kişi; bot yeniden başlayınca merdiven sıfırlanır
    if (this.kayit.size > 5000) {
      const ilk = this.kayit.keys().next().value;
      if (ilk !== undefined) this.kayit.delete(ilk);
    }
    return { adim, basamak: MERDIVEN[adim] };
  }
}
