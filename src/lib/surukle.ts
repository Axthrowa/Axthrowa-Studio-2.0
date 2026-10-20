/**
 * Önizlemede öğe sürükleme (saf — test edilir).
 *
 * Eskiden öğenin MERKEZİ imlecin bulunduğu noktaya atlıyordu: kenarından tutup
 * sürükleyince öğe zıplıyor, sürüklemeden yapılan tek tık bile öğeyi tıklanan
 * yere taşıyordu (çift tıkla yazı düzenleme de öğeyi kaydırırdı). Artık
 * hareket görelidir ve küçük titremeler (eşik altı) sürükleme sayılmaz.
 */

/** Bu kadar pikselden az hareket "tık" sayılır, konum değişmez. */
export const SURUKLEME_ESIGI = 4;

export type Konum = { x: number; y: number };
export type Kilavuz = { v?: number; h?: number };

const sinirla = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Başlangıç konumu (yüzde) + imleç farkı (piksel) → yeni konum (yüzde).
 * Merkeze 1,2 puan yaklaşınca ortaya yapışır ve kılavuz çizgisi döner.
 */
export function suruklenmisKonum(
  bas: Konum,
  dx: number,
  dy: number,
  genislik: number,
  yukseklik: number,
): { konum: Konum; kilavuz: Kilavuz } {
  if (genislik < 1 || yukseklik < 1) return { konum: bas, kilavuz: {} };
  let x = sinirla(bas.x + (dx / genislik) * 100, 2, 98);
  let y = sinirla(bas.y + (dy / yukseklik) * 100, 2, 98);
  const kilavuz: Kilavuz = {};
  if (Math.abs(x - 50) < 1.2) {
    x = 50;
    kilavuz.v = 50;
  }
  if (Math.abs(y - 50) < 1.2) {
    y = 50;
    kilavuz.h = 50;
  }
  return { konum: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }, kilavuz };
}

/** Eşik aşıldı mı (sürükleme mi, tık mı)? */
export function esikAsildi(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= SURUKLEME_ESIGI;
}
