/**
 * AxBoT — tekrarlanan mesaj koruması (B9) (saf)
 * Developed by AxthrowA
 *
 * Denetim B9: AutoMod'da "aynı mesajı tekrar tekrar yazma" kuralı yoktu.
 * Spam botları ve heyecanlanan izleyiciler aynı satırı art arda yapıştırır;
 * büyük harf / link / emoji kuralları bunu yakalamaz.
 *
 * BotRix'te bu kural GÖZLEMLENMEDİ (BOTRIX_UI_INVENTORY §6.1'de beş koruma
 * var) — sınıflandırma: bizim eklememiz, BotRix eşdeğeri UNVERIFIED.
 *
 * Kural: aynı kullanıcı, `pencereSn` içinde, aynı (katlanmış) mesajı
 * `adet` kez yazarsa ihlal. "Merhaba", "MERHABA!!" ve "merhaba" aynı sayılır.
 */
import { trKatla } from '../../core/text.js';

/** Karşılaştırma için normalleştirme: Türkçe katlama, boşluk, sondaki noktalama. */
export function tekrarAnahtari(metin: string): string {
  return trKatla(metin)
    .replace(/\s+/g, ' ')
    .replace(/[!?.,…]+$/u, '')
    .trim();
}

export class TekrarIzleyici {
  private gecmis = new Map<string, Array<{ anahtar: string; zaman: number }>>();

  /**
   * Mesajı kaydeder; pencere içinde aynı mesajın KAÇINCI kez yazıldığını
   * döner (bu mesaj dahil).
   */
  kaydet(kullanici: string, metin: string, pencereMs: number, simdi = Date.now()): number {
    const kim = String(kullanici || '').toLowerCase();
    const anahtar = tekrarAnahtari(metin);
    if (!kim || !anahtar) return 0;
    const esik = simdi - Math.max(1000, pencereMs);
    const liste = (this.gecmis.get(kim) || []).filter((x) => x.zaman > esik);
    liste.push({ anahtar, zaman: simdi });
    // Kullanıcı başına son 30 mesaj yeter
    this.gecmis.set(kim, liste.slice(-30));
    if (this.gecmis.size > 5000) {
      const ilk = this.gecmis.keys().next().value;
      if (ilk) this.gecmis.delete(ilk);
    }
    return liste.filter((x) => x.anahtar === anahtar).length;
  }

  /** İhlal cezasından sonra sayaç sıfırlansın — aynı mesaj her seferinde ceza almasın. */
  sifirla(kullanici: string): void {
    this.gecmis.delete(String(kullanici || '').toLowerCase());
  }
}
