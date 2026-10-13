/**
 * StreamAxT — seviye eğrisi (saf hesap)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK; test edilebilir olsun diye ayrıldı.
 */

/**
 * Bir seviyeden diğerine geçmek için gereken XP.
 * `taban * buyume^(seviye-1)` — kademeli zorlaşır.
 */
export function seviyeMaliyeti(seviye: number, taban: number, buyume: number): number {
  const s = Math.max(1, Math.floor(seviye));
  return Math.round(Math.max(1, taban) * Math.pow(Math.max(1, buyume), s - 1));
}

/**
 * Toplam XP'den seviye ve ilerleme hesaplar.
 *
 * Toplam XP saklanır (seviye türetilir): böylece ayar değiştiğinde
 * herkesin seviyesi tutarlı biçimde yeniden hesaplanır — veri kaybı olmaz.
 */
export function seviyeHesapla(
  toplamXp: number,
  ayar: { tabanXp: number; buyume: number; maksSeviye: number }
): { seviye: number; buSeviyedeXp: number; sonrakiIcinXp: number; yuzde: number } {
  let kalan = Math.max(0, Math.floor(Number(toplamXp) || 0));
  let seviye = 0;
  const tavan = Math.max(1, ayar.maksSeviye);

  for (;;) {
    const maliyet = seviyeMaliyeti(seviye + 1, ayar.tabanXp, ayar.buyume);
    if (seviye >= tavan || kalan < maliyet) {
      return {
        seviye,
        buSeviyedeXp: kalan,
        sonrakiIcinXp: maliyet,
        yuzde: Math.min(100, Math.round((kalan / Math.max(1, maliyet)) * 100))
      };
    }
    kalan -= maliyet;
    seviye++;
  }
}

