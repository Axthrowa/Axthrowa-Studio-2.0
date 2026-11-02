import { describe, expect, it } from "vitest";
import { dbYazisi, olcerAdimi, OLCER_BOSTA, onizlemeBeklemesi, sesDbdenYuzde, sesYuzdedenDb } from "./obsAudio";

describe("ses kaydırıcısı", () => {
  it("uçlar OBS sınırlarına denk gelir", () => {
    expect(sesYuzdedenDb(100)).toBe(0);
    expect(sesYuzdedenDb(0)).toBe(-100);
    expect(sesDbdenYuzde(0)).toBe(100);
    expect(sesDbdenYuzde(-100)).toBe(0);
  });

  it("gidiş dönüş aynı yüzdeyi verir", () => {
    for (const y of [1, 25, 50, 80, 99]) expect(sesDbdenYuzde(sesYuzdedenDb(y))).toBe(y);
  });
});

describe("karıştırıcı ölçeri", () => {
  it("yükselişte hemen çıkar, düşerken yumuşak iner", () => {
    const a = olcerAdimi(OLCER_BOSTA, -10, 16, 100);
    expect(a.deger).toBe(-10);
    const b = olcerAdimi(a, -40, 1000, 1100);
    expect(b.deger).toBeCloseTo(-33.53, 1);
    expect(b.tepe).toBe(-10);
  });

  it("tepe çizgisi bekledikten sonra iner, sessizlikte taban aşılmaz", () => {
    const a = olcerAdimi(OLCER_BOSTA, -10, 16, 0);
    const b = olcerAdimi(a, -Infinity, 1000, 2000);
    expect(b.tepe).toBeLessThan(-10);
    let d = b;
    for (let i = 0; i < 10; i++) d = olcerAdimi(d, -Infinity, 1000, 3000 + i * 1000);
    expect(d.deger).toBe(-60);
    expect(d.tepe).toBe(-60);
  });

  it("dB yazısı", () => {
    expect(dbYazisi(-100)).toBe("-inf dB");
    expect(dbYazisi(-8)).toBe("-8.0 dB");
  });
});

describe("önizleme hızı", () => {
  it("hızlı OBS'te ~15 kare/sn, yavaş OBS'te bekleme uzar", () => {
    expect(onizlemeBeklemesi(10) + 10).toBe(66);
    expect(onizlemeBeklemesi(200)).toBe(200);
    expect(onizlemeBeklemesi(5000)).toBe(1000);
  });
});
