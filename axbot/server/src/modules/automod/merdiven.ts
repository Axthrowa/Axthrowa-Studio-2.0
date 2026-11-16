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

/** En uzun pencere (1440 dk): bundan eski kayıt geri yüklenmez */
const EN_UZUN_PENCERE_MS = 24 * 60 * 60_000;
export type MerdivenKaydi = [string, { adim: number; son: number }][];

export class CezaMerdiveni {
  private kayit = new Map<string, { adim: number; son: number }>();

  /** `degisti`: her ihlalde kalıcı kayıt için (K2); `baslangic`: önceki çalışmadan kalan kayıt */
  constructor(private degisti?: (kayit: MerdivenKaydi) => void, baslangic: unknown = [], simdi = Date.now()) {
    if (!Array.isArray(baslangic)) return;
    for (const g of baslangic) {
      const [k, o] = Array.isArray(g) ? g : [];
      if (typeof k === 'string' && Number.isInteger(o?.adim) && simdi - Number(o?.son) < EN_UZUN_PENCERE_MS) {
        this.kayit.set(k, { adim: Math.min(Math.max(o.adim, 0), MERDIVEN.length - 1), son: Number(o.son) });
      }
    }
  }

  /** İhlali kaydeder, uygulanacak basamağı (0'dan) ve basamağın kendisini döndürür. */
  ilerle(anahtar: string, pencereMs = VARSAYILAN_PENCERE_MS, simdi = Date.now()): { adim: number; basamak: MerdivenBasamagi } {
    const k = anahtar.toLowerCase();
    const o = this.kayit.get(k);
    const adim = o && simdi - o.son < pencereMs ? Math.min(o.adim + 1, MERDIVEN.length - 1) : 0;
    this.kayit.set(k, { adim, son: simdi });
    // shortcut: en çok 5000 kişi (en eskisi düşer), 5000'den fazla aktif ihlalci olursa sınır büyütülmeli
    if (this.kayit.size > 5000) {
      const ilk = this.kayit.keys().next().value;
      if (ilk !== undefined) this.kayit.delete(ilk);
    }
    this.degisti?.([...this.kayit]);
    return { adim, basamak: MERDIVEN[adim] };
  }
}
