import { describe, expect, it } from "vitest";
import type { MotorSahneOgesi } from "./api/motor";
import { altanSira, boyutlandir, duzListe, noktadakiOge, noktaKutuda, ogeKutusu, sahneAgaci, tuvaleGore, yapistir } from "./sahneAgaci";

const o = (oge: string, ek: Partial<MotorSahneOgesi> = {}): MotorSahneOgesi => ({
  oge,
  kaynak: oge.split("/")[1] ?? oge,
  konum: [0, 0],
  olcek: [1, 1],
  sinir: null,
  gorunur: true,
  hizalama: 5,
  genislik: 100,
  yukseklik: 50,
  ...ek,
});

describe("sahne ağacı", () => {
  it("motor sırasından üstten alta ağaç ve düz liste", () => {
    const m = [o("s/arka"), o("s/g1", { grup: true }), o("s/b", { ust: "s/g1" }), o("s/c", { ust: "s/g1" }), o("s/yazi")];
    const a = sahneAgaci(m);
    expect(a.map((d) => d.oge.oge)).toEqual(["s/yazi", "s/g1", "s/arka"]);
    expect(a[1].cocuklar.map((c) => c.oge)).toEqual(["s/c", "s/b"]);
    expect(duzListe(a, new Set()).length).toBe(3);
    expect(duzListe(a, new Set(["s/g1"])).map((x) => [x.oge.oge, x.derinlik])).toEqual([
      ["s/yazi", 0],
      ["s/g1", 0],
      ["s/c", 1],
      ["s/b", 1],
      ["s/arka", 0],
    ]);
    expect(altanSira(a, "s/yazi")).toBe(2);
    expect(altanSira(a, "s/arka")).toBe(0);
    expect(altanSira(a, "yok")).toBe(-1);
  });
});

describe("önizleme geometrisi", () => {
  it("kutu: ölçek, kırpma, sınır, hizalama", () => {
    expect(ogeKutusu(o("s/a", { konum: [10, 20], olcek: [2, 2] }))).toMatchObject({ x: 10, y: 20, g: 200, h: 100 });
    expect(ogeKutusu(o("s/a", { kirp: [10, 0, 10, 10] }))).toMatchObject({ g: 80, h: 40 });
    expect(ogeKutusu(o("s/a", { sinir: [1920, 1080], sinir_turu: 2 }))).toMatchObject({ g: 1920, h: 1080 });
    // Orta hizalama: konum kutunun merkezi
    expect(ogeKutusu(o("s/a", { konum: [100, 100], hizalama: 0 }))).toMatchObject({ x: 50, y: 75 });
    // Sağ alt hizalama
    expect(ogeKutusu(o("s/a", { konum: [100, 100], hizalama: 10 }))).toMatchObject({ x: 0, y: 50 });
    expect(ogeKutusu(o("s/a", { genislik: 0 }))).toBeNull();
  });

  it("isabet: döndürme ve üstteki öğe", () => {
    const k = ogeKutusu(o("s/a", { konum: [0, 0], aci: 90 }))!;
    // 90° döndürülmüş 100×50 kutu: (−25, 50) içinde, (50, 25) dışında
    expect(noktaKutuda(k, -25, 50)).toBe(true);
    expect(noktaKutuda(k, 50, 25)).toBe(false);
    const a = sahneAgaci([o("s/alt", { genislik: 500, yukseklik: 500 }), o("s/ust", { konum: [10, 10] }), o("s/gizli", { gorunur: false })]);
    expect(noktadakiOge(a, 20, 20)?.oge).toBe("s/ust");
    expect(noktadakiOge(a, 300, 300)?.oge).toBe("s/alt");
    expect(noktadakiOge(a, 900, 900)).toBeNull();
  });

  it("yapışma: kenar ve merkez", () => {
    const oge = o("s/a", { konum: [0, 0] });
    const k = ogeKutusu(oge)!;
    expect(yapistir([7, 5], k, [1920, 1080])).toEqual([0, 0]);
    expect(yapistir([1815, 400], k, [1920, 1080])).toEqual([1820, 400]);
    expect(yapistir([905, 400], k, [1920, 1080])).toEqual([910, 400]);
    expect(yapistir([300, 300], k, [1920, 1080])).toEqual([300, 300]);
  });

  it("boyutlandırma: köşe oranı korur, kenar tek eksen, sınırlı öğe", () => {
    const oge = o("s/a", { konum: [100, 100] });
    const k = ogeKutusu(oge)!;
    // Sağ alt köşe (200,150) → (300,200): oran korunur → ölçek 2
    const r = boyutlandir(oge, k, { x: 1, y: 1 }, [300, 200], false);
    expect(r).toEqual({ konum: [100, 100], olcek: [2, 2] });
    // Serbest (Shift)
    expect(boyutlandir(oge, k, { x: 1, y: 1 }, [300, 150], true).olcek).toEqual([2, 1]);
    // Sol kenar: sağ kenar sabit, yalnız x
    expect(boyutlandir(oge, k, { x: 0, y: 0.5 }, [50, 999], false)).toEqual({ konum: [50, 100], olcek: [1.5, 1] });
    // Sol üst köşe: sağ alt sabit → konum değişir
    expect(boyutlandir(oge, k, { x: 0, y: 0 }, [0, 50], false)).toEqual({ konum: [0, 50], olcek: [2, 2] });
    const sinirli = o("s/b", { konum: [0, 0], sinir: [100, 50], sinir_turu: 2 });
    expect(boyutlandir(sinirli, ogeKutusu(sinirli)!, { x: 1, y: 1 }, [200, 60], true)).toEqual({ konum: [0, 0], sinir: [200, 60] });
  });

  it("tuvale göre: sığdır, uzat, ortala", () => {
    const oge = o("s/a", { konum: [7, 9] });
    expect(tuvaleGore(oge, [1920, 1080], "sigdir")).toMatchObject({ sinir: [1920, 1080], sinir_turu: 2 });
    expect(tuvaleGore(oge, [1920, 1080], "uzat")).toMatchObject({ sinir_turu: 1 });
    expect(tuvaleGore(oge, [1920, 1080], "ortala")).toEqual({ konum: [910, 515] });
    expect(tuvaleGore(oge, [1920, 1080], "yatay-ortala")).toEqual({ konum: [910, 9] });
  });
});
