import { describe, expect, it } from "vitest";
import { Bolutleyici, VARSAYILAN } from "./bolutleyici";

const KARE = 1600; // 100 ms @ 16 kHz
const sessiz = () => new Float32Array(KARE);
const konusma = () => new Float32Array(KARE).fill(0.1);

function besle(b: Bolutleyici, kareler: Float32Array[]) {
  return kareler.map((k) => b.besle(k)).filter((x) => x !== null);
}

describe("Bolutleyici", () => {
  it("sessizlikte istek üretmez", () => {
    expect(besle(new Bolutleyici(), Array.from({ length: 50 }, sessiz))).toEqual([]);
  });

  it("konuşmada her saniye ara sonuç, 700 ms sessizlikte kesin sonuç verir", () => {
    const b = new Bolutleyici();
    const r = besle(b, [...Array.from({ length: 5 }, sessiz), ...Array.from({ length: 25 }, konusma), ...Array.from({ length: 7 }, sessiz)]);
    expect(r.filter((x) => !x.kesin).length).toBe(3);
    const son = r.at(-1)!;
    expect(son.kesin).toBe(true);
    // 300 ms ön ses (ilk konuşma karesi dahil) + kalan 2,4 sn konuşma + 700 ms sessizlik
    expect(son.ses.length).toBe(3 * KARE + 24 * KARE + 7 * KARE);
  });

  it("uzun konuşmayı en uzun sürede böler", () => {
    const b = new Bolutleyici();
    const r = besle(b, Array.from({ length: 90 }, konusma));
    expect(r.filter((x) => x.kesin).map((x) => x.ses.length)).toEqual([VARSAYILAN.enUzunSn * VARSAYILAN.ornekHizi]);
  });

  it("durdurunca yarım konuşmayı kesinleştirir", () => {
    const b = new Bolutleyici();
    besle(b, Array.from({ length: 4 }, konusma));
    expect(b.bitir()?.kesin).toBe(true);
    expect(b.bitir()).toBeNull();
  });
});
