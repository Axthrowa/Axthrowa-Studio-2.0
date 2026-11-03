/**
 * AxBoT — hız sınırı (S7) (saf)
 * Developed by AxthrowA
 *
 * Denetim S7: "Hiçbir uçta hız sınırı yok". Sunucu yalnız yerelde dinlediği
 * için dış saldırı yüzeyi küçük; asıl riskler:
 *   • panelde kalan bir döngü ya da bozuk bir eklentinin saniyede yüzlerce
 *     istek atması (disk dolar, CPU kilitlenir),
 *   • pahalı uçların (medya yükleme, AI, Discord testi) art arda tetiklenip
 *     kotaları / diski tüketmesi.
 *
 * Kayan pencere: son `pencereMs` içindeki istek sayısı `sinir`i geçerse
 * reddedilir. Bellekte tutulur, yeniden başlatmada sıfırlanır.
 */

export interface HizKurali {
  ad: string;
  /** Eşleşme: HTTP yöntemi (boş = hepsi) ve /api'den sonraki yol deseni. */
  yontem?: string;
  desen: RegExp;
  pencereMs: number;
  sinir: number;
}

/**
 * İlk eşleşen kural uygulanır — özel kurallar genelin ÜSTÜNDE olmalı.
 * Sınırlar gerçek kullanımın çok üstünde seçildi: amaç kaçak döngüyü
 * durdurmak, kullanıcıyı yavaşlatmak değil.
 */
export const HIZ_KURALLARI: HizKurali[] = [
  { ad: 'medya-yukleme', yontem: 'POST', desen: /^\/media\/?$/, pencereMs: 60_000, sinir: 30 },
  { ad: 'ai', yontem: 'POST', desen: /^\/ai\//, pencereMs: 60_000, sinir: 20 },
  { ad: 'discord-test', yontem: 'POST', desen: /^\/integrations\/discord\/test$/, pencereMs: 60_000, sinir: 5 },
  { ad: 'ice-aktarma', yontem: 'POST', desen: /^\/(integrations\/nightbot\/import|alerts\/backup\/import)$/, pencereMs: 60_000, sinir: 10 },
  { ad: 'test-uyari', yontem: 'POST', desen: /^\/alerts\/test$/, pencereMs: 60_000, sinir: 60 },
  { ad: 'yazma', yontem: 'WRITE', desen: /.*/, pencereMs: 60_000, sinir: 300 },
  { ad: 'okuma', yontem: 'GET', desen: /.*/, pencereMs: 60_000, sinir: 1200 }
];

const YAZMA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** İsteğe uyan ilk kural. */
export function kuralBul(yontem: string, yol: string, kurallar: HizKurali[] = HIZ_KURALLARI): HizKurali | null {
  const y = String(yontem || '').toUpperCase();
  for (const k of kurallar) {
    const yontemTutar =
      !k.yontem || k.yontem === y || (k.yontem === 'WRITE' && YAZMA.has(y));
    if (yontemTutar && k.desen.test(yol)) return k;
  }
  return null;
}

export class HizSiniri {
  private kovalar = new Map<string, number[]>();

  /**
   * İsteği kaydeder ve izin verilip verilmediğini döner.
   * Reddedilen istek sayılmaz (sınıra takılan bir döngü pencereyi uzatmasın).
   */
  izinVer(anahtar: string, kural: HizKurali, simdi = Date.now()): { ok: boolean; bekleMs: number } {
    const esik = simdi - kural.pencereMs;
    const liste = (this.kovalar.get(anahtar) || []).filter((t) => t > esik);
    if (liste.length >= kural.sinir) {
      this.kovalar.set(anahtar, liste);
      return { ok: false, bekleMs: Math.max(1, liste[0] + kural.pencereMs - simdi) };
    }
    liste.push(simdi);
    this.kovalar.set(anahtar, liste);
    return { ok: true, bekleMs: 0 };
  }

  /** Süresi dolmuş kovaları atar — bellek büyümesin. */
  temizle(simdi = Date.now(), enUzunPencere = 60_000): void {
    for (const [a, liste] of this.kovalar) {
      if (!liste.length || liste[liste.length - 1] <= simdi - enUzunPencere) this.kovalar.delete(a);
    }
  }

  get boyut(): number {
    return this.kovalar.size;
  }
}
