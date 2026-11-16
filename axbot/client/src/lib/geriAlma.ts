/**
 * Anlık kaydedilen sayfaların geri alma yığını (A4, saf). Yığında kaydedilmiş hâller durur:
 * her başarılı kayıtta bir önceki kayıtlı hâl eklenir. Ctrl+Z önce kaydedilmemiş değişikliği atar,
 * yoksa son kaydı geri alır.
 */

export const GERI_ALMA_SINIRI = 30;

export function kayitEkle<T>(yigin: T[], oncekiKayitli: T): T[] {
  return [...yigin, oncekiKayitli].slice(-GERI_ALMA_SINIRI);
}

/**
 * Ctrl+Z hedefi. `kaydedilmemis`: ekrandaki hâl kayıtlı hâlden farklı mı.
 * Döner: geri yüklenecek hâl ve kalan yığın; geri alınacak bir şey yoksa `null`.
 */
export function geriAlHedefi<T>(yigin: T[], kayitli: T | null, kaydedilmemis: boolean): { hedef: T; yigin: T[] } | null {
  if (kaydedilmemis && kayitli !== null) return { hedef: kayitli, yigin };
  if (!yigin.length) return null;
  return { hedef: yigin[yigin.length - 1], yigin: yigin.slice(0, -1) };
}

/** Odak yazı alanındaysa Ctrl+Z tarayıcının kendi metin geri almasıdır */
export function yaziAlaniMi(el: { tagName?: string; isContentEditable?: boolean; type?: string } | null): boolean {
  const ad = (el?.tagName || '').toUpperCase();
  if (ad === 'TEXTAREA' || el?.isContentEditable) return true;
  if (ad !== 'INPUT') return false;
  return !['checkbox', 'radio', 'range', 'color', 'button', 'submit'].includes((el?.type || 'text').toLowerCase());
}
