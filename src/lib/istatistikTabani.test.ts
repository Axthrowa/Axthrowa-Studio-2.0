import { describe, expect, it } from "vitest";
import { tabandanFark, type Sayaclar } from "./istatistikTabani";

const s = (toplam: number, kare: number): Sayaclar => ({ geciken: toplam / 10, toplam, atlanan: 2, videoKare: toplam, cikislar: { kayit: { kare, dusen: 1, bayt: kare * 1000 } } });

describe("istatistik sıfırlama", () => {
  it("tabandan fark", () => {
    const f = tabandanFark(s(1000, 500), s(400, 100));
    expect(f).toMatchObject({ geciken: 60, toplam: 600, atlanan: 0, videoKare: 600 });
    expect(f.cikislar.kayit).toEqual({ kare: 400, dusen: 0, bayt: 400000 });
  });
  it("taban yoksa olduğu gibi; motor yeniden başladıysa taban yok sayılır", () => {
    expect(tabandanFark(s(10, 5), null)).toEqual(s(10, 5));
    expect(tabandanFark(s(10, 5), s(400, 100))).toEqual(s(10, 5));
  });
  it("yeniden başlayan çıktının tabanı yok sayılır, sonradan eklenen çıktı olduğu gibi", () => {
    const simdi = { ...s(1000, 50), cikislar: { kayit: { kare: 50, dusen: 0, bayt: 5 }, yeni: { kare: 7, dusen: 0, bayt: 9 } } };
    const f = tabandanFark(simdi, s(400, 100));
    expect(f.cikislar.kayit).toEqual({ kare: 50, dusen: 0, bayt: 5 });
    expect(f.cikislar.yeni).toEqual({ kare: 7, dusen: 0, bayt: 9 });
  });
});
