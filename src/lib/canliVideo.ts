/**
 * Canlı H.264 önizleme çerçeveleri (`/ws/motor` ikili iletileri): başlık çözümü ve WebCodecs yapılandırması.
 *
 * Çerçeve (küçük endian): `u8 ad uzunluğu` + tuval adı + `u8 bayrak (1 = anahtar kare)` + `u16 genişlik` +
 * `u16 yükseklik` + `i64 pts (µs)` + Annex B H.264 (anahtar karede SPS/PPS başta).
 */

export type CanliCerceve = { tuval: string; anahtar: boolean; genislik: number; yukseklik: number; pts: number; veri: Uint8Array };

export function cerceveCoz(b: ArrayBuffer): CanliCerceve | null {
  const v = new DataView(b);
  if (b.byteLength < 1) return null;
  const n = v.getUint8(0);
  const bas = 1 + n;
  if (b.byteLength < bas + 13) return null;
  const tuval = new TextDecoder().decode(new Uint8Array(b, 1, n));
  return {
    tuval,
    anahtar: v.getUint8(bas) === 1,
    genislik: v.getUint16(bas + 1, true),
    yukseklik: v.getUint16(bas + 3, true),
    pts: Number(v.getBigInt64(bas + 5, true)),
    veri: new Uint8Array(b, bas + 13),
  };
}

/** Annex B akışındaki SPS'ten (NAL 7) WebCodecs kodek dizesi: `avc1.PPCCLL` */
export function avcKodek(veri: Uint8Array): string | null {
  for (let i = 0; i + 4 < veri.length; i++) {
    const uc = veri[i] === 0 && veri[i + 1] === 0 && veri[i + 2] === 1;
    if (!uc) continue;
    const nal = veri[i + 3];
    if ((nal & 0x1f) === 7 && i + 6 < veri.length) {
      const h = (x: number) => x.toString(16).padStart(2, "0");
      return `avc1.${h(veri[i + 4])}${h(veri[i + 5])}${h(veri[i + 6])}`;
    }
  }
  return null;
}

/** Tarayıcı (WebView2) donanım H.264 çözücüsü sunuyor mu */
export function videoDestekli(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { VideoDecoder?: unknown }).VideoDecoder === "function";
}

/** Önizleme alanının piksel boyutu (CSS × aygıt piksel oranı), 8'e yuvarlı; 64'ten küçük olmaz */
export function istenenBoyut(cssG: number, cssY: number, oran: number): [number, number] {
  const r = (x: number) => Math.max(64, Math.round((x * Math.max(1, oran)) / 8) * 8);
  return [r(cssG), r(cssY)];
}
