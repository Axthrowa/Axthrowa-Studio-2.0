import { describe, expect, it } from "vitest";
import { canliAdres, canliSatir } from "./motorCanli";
import { carpandanDb, dbdenCarpan, dbdenKonum, dbMetni, dengeMetni, kirpiliyor, konumdanDb, olcerBolgesi, olcerYuzdesi, yuzdeMetni, dusur, soloPlani, soloGeriAl, DUSUS_HIZLARI } from "./sesMatematik";

describe("ses hesapları", () => {
  it("çarpan ↔ dB", () => {
    expect(carpandanDb(1)).toBeCloseTo(0);
    expect(carpandanDb(0.5)).toBeCloseTo(-6.02, 1);
    expect(carpandanDb(0)).toBe(-Infinity);
    expect(dbdenCarpan(-6.0206)).toBeCloseTo(0.5, 3);
    expect(dbdenCarpan(40)).toBe(20);
    expect(dbdenCarpan(-Infinity)).toBe(0);
  });

  it("fader konumu", () => {
    expect(konumdanDb(1)).toBe(-0);
    expect(konumdanDb(0.5)).toBe(-30);
    expect(konumdanDb(0)).toBe(-Infinity);
    expect(dbdenKonum(-30)).toBe(0.5);
    expect(dbdenKonum(6)).toBe(1);
    expect(dbdenKonum(-Infinity)).toBe(0);
  });

  it("metinler ve ölçer", () => {
    expect(dbMetni(-6.02)).toBe("−6.0 dB");
    expect(dbMetni(3.44)).toBe("+3.4 dB");
    expect(dbMetni(-144)).toBe("−∞ dB");
    expect(olcerYuzdesi(0)).toBe(100);
    expect(olcerYuzdesi(-30)).toBe(50);
    expect(olcerYuzdesi(-144)).toBe(0);
    expect(kirpiliyor(-0.2)).toBe(true);
    expect(kirpiliyor(-3)).toBe(false);
    expect([olcerBolgesi(-30), olcerBolgesi(-15), olcerBolgesi(-3)]).toEqual(["yesil", "sari", "kirmizi"]);
    expect([dengeMetni(0.5), dengeMetni(0.25), dengeMetni(1)]).toEqual(["Orta", "Sol %50", "Sağ %100"]);
  });

  it("canlı akış satırları", () => {
    expect(canliAdres("http://127.0.0.1:1234")).toBe("ws://127.0.0.1:1234/ws/motor");
    expect(canliSatir('{"olay":"kare","tuval":"ana","jpeg":"QQ=="}')).toEqual({ tur: "kare", tuval: "ana", jpeg: "QQ==" });
    expect(canliSatir('{"olay":"seviyeler","seviyeler":[{"id":"m","tepe":[-6,-6],"ortalama":[-9,-9]}]}')).toMatchObject({ tur: "seviyeler" });
    expect(canliSatir("bozuk")).toBeNull();
    expect(canliSatir('{"olay":"cikis"}')).toBeNull();
  });
});

describe("yüzde gösterimi", () => {
  it("0 dB %100, −6 dB yaklaşık %50, sessiz %0", () => {
    expect(yuzdeMetni(1)).toBe("%100");
    expect(yuzdeMetni(dbdenCarpan(-6.02))).toBe("%50");
    expect(yuzdeMetni(0)).toBe("%0");
    expect(yuzdeMetni(Number.NaN)).toBe("%0");
  });
});

describe("ölçer düşüşü", () => {
  it("yükselişte anında, düşüşte hız sınırlı", () => {
    expect(dusur(-30, -10, DUSUS_HIZLARI.hizli, 0.1)).toBe(-10);
    expect(dusur(-10, -60, DUSUS_HIZLARI.orta, 0.1)).toBeCloseTo(-11.176);
    expect(dusur(-10, -10.5, DUSUS_HIZLARI.yavas, 1)).toBe(-10.5);
    expect(dusur(Number.NEGATIVE_INFINITY, -20, 10, 0.1)).toBe(-20);
  });
});

describe("solo dinle", () => {
  it("seçilen izlenir, izlenen diğerleri kapanır, geri alma yalnız değişenleri döndürür", () => {
    const k = [
      { id: "mik", izleme: 0 },
      { id: "muzik", izleme: 2 },
      { id: "oyun", izleme: 0 },
    ];
    const p = soloPlani(k, "mik");
    expect(p.degisiklikler).toEqual([
      { id: "mik", izleme: 1 },
      { id: "muzik", izleme: 0 },
    ]);
    expect(soloGeriAl(p.onceki)).toEqual([
      { id: "mik", izleme: 0 },
      { id: "muzik", izleme: 2 },
    ]);
  });
  it("zaten izlenen kanal türünü korur", () => {
    expect(soloPlani([{ id: "a", izleme: 2 }], "a").degisiklikler).toEqual([]);
  });
});
