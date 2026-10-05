import { describe, expect, it } from "vitest";
import { avcKodek, cerceveCoz, istenenBoyut } from "./canliVideo";

function cerceve(tuval: string, anahtar: boolean, g: number, y: number, pts: bigint, veri: number[]): ArrayBuffer {
  const ad = new TextEncoder().encode(tuval);
  const b = new ArrayBuffer(1 + ad.length + 13 + veri.length);
  const v = new DataView(b);
  v.setUint8(0, ad.length);
  new Uint8Array(b, 1, ad.length).set(ad);
  const s = 1 + ad.length;
  v.setUint8(s, anahtar ? 1 : 0);
  v.setUint16(s + 1, g, true);
  v.setUint16(s + 3, y, true);
  v.setBigInt64(s + 5, pts, true);
  new Uint8Array(b, s + 13).set(veri);
  return b;
}

describe("canlı H.264 çerçevesi", () => {
  it("başlık motorun biçimiyle çözülür", () => {
    const c = cerceveCoz(cerceve("studyo-ana", true, 1280, 720, 1_500_000n, [0, 0, 0, 1, 0x67, 0x64, 0x00, 0x28]))!;
    expect([c.tuval, c.anahtar, c.genislik, c.yukseklik, c.pts]).toEqual(["studyo-ana", true, 1280, 720, 1_500_000]);
    expect([...c.veri]).toEqual([0, 0, 0, 1, 0x67, 0x64, 0x00, 0x28]);
    expect(cerceveCoz(new ArrayBuffer(3))).toBeNull();
  });

  it("SPS'ten kodek dizesi (High 4.0 → avc1.640028); SPS yoksa null", () => {
    expect(avcKodek(new Uint8Array([0, 0, 0, 1, 0x67, 0x64, 0x00, 0x28, 0xac]))).toBe("avc1.640028");
    expect(avcKodek(new Uint8Array([0, 0, 1, 0x27, 0x4d, 0x40, 0x1f, 0]))).toBe("avc1.4d401f");
    expect(avcKodek(new Uint8Array([0, 0, 0, 1, 0x65, 1, 2, 3]))).toBeNull();
  });

  it("istenen boyut aygıt piksel oranıyla, 8'e yuvarlı", () => {
    expect(istenenBoyut(800, 450, 1.25)).toEqual([1000, 560]);
    expect(istenenBoyut(10, 10, 1)).toEqual([64, 64]);
  });
});
