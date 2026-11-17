/**
 * "Hareketi azalt" (WID-6): katman adresine `?hareket=az` eklenince parçacık (konfeti, emote yağmuru,
 * ışık süpürmesi) ve sarsıntı kapanır. Tek URL sayfasında adres bütün katmanlar için geçerlidir.
 *
 * Bilerek işletim sisteminin `prefers-reduced-motion` ayarına bakılmaz: katman izleyiciye gider, yayıncının
 * Windows ayarı efekti kapatmamalı (bkz. kutlama.ts).
 */
export function hareketAz(arama: string = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(arama).get('hareket') === 'az';
}
