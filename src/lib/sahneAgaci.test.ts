import { describe, expect, it } from "vitest";
import type { MotorSahneOgesi } from "./api/motor";
import { altanSira, boyutlandir, duzListe, kirpilabilir, kirpSurukle, noktadakiOge, noktaKutuda, ogeKutusu, sahneAgaci, tuvaleGore, yapistir, kutuMerkezi, merkezdenDondur } from "./sahneAgaci";

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

describe("Alt+sürükle kırpma", () => {
  it("sol kenar içeri: kırpma artar, sağ kenar yerinde kalır; ölçek kaynak pikseline çevrilir", () => {
    const oge = o("s/a", { konum: [100, 100], olcek: [2, 2] }); // kutu 100,100 200×100
    const k = ogeKutusu(oge)!;
    const r = kirpSurukle(oge, k, { x: 0, y: 0.5 }, [140, 999]);
    expect(r.kirp).toEqual([20, 0, 0, 0]);
    expect(r.konum).toEqual([140, 100]);
    const yeni = ogeKutusu({ ...oge, ...r })!;
    expect(yeni.x + yeni.g).toBe(k.x + k.g);
  });

  it("sağ alt köşe: iki eksen; dışarı çekmek kırpmayı azaltır ama 0'ın altına indirmez", () => {
    const oge = o("s/a", { kirp: [0, 0, 10, 10] }); // kutu 0,0 90×40
    const k = ogeKutusu(oge)!;
    expect(kirpSurukle(oge, k, { x: 1, y: 1 }, [80, 30]).kirp).toEqual([0, 0, 20, 20]);
    expect(kirpSurukle(oge, k, { x: 1, y: 1 }, [500, 500]).kirp).toEqual([0, 0, 0, 0]);
  });

  it("en az 1 px görüntü kalır; merkez hizalamada kutu yerinde kalır", () => {
    const oge = o("s/a", { konum: [50, 25], hizalama: 0 }); // merkez: kutu 0,0 100×50
    const k = ogeKutusu(oge)!;
    const r = kirpSurukle(oge, k, { x: 0, y: 0 }, [1000, 1000]);
    expect(r.kirp).toEqual([99, 49, 0, 0]);
    const yeni = ogeKutusu({ ...oge, ...r })!;
    // Konum tam piksele yuvarlanır: merkez hizalamada yarım piksel kayabilir
    expect([yeni.g, yeni.h]).toEqual([1, 1]);
    expect(Math.abs(yeni.x - 99)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(yeni.y - 49)).toBeLessThanOrEqual(0.5);
  });

  it("sınır kutulu ya da döndürülmüş öğe Alt ile kırpılmaz", () => {
    expect(kirpilabilir(o("s/a"))).toBe(true);
    expect(kirpilabilir(o("s/a", { sinir: [10, 10], sinir_turu: 2 }))).toBe(false);
    expect(kirpilabilir(o("s/a", { aci: 90 }))).toBe(false);
    expect(kirpilabilir(o("s/a", { genislik: 0 }))).toBe(false);
  });
});

describe("döndürme tutamacı", () => {
  const k = { x: 100, y: 100, g: 200, h: 100, aci: 0, ox: 100, oy: 100 };
  it("merkez sabit kalır", () => {
    const merkez = kutuMerkezi(k);
    expect(merkez).toEqual([200, 150]);
    // İmleç merkezin sağında → 90°
    const d = merkezdenDondur(k, [300, 150]);
    expect(d.aci).toBeCloseTo(90);
    const yeni = kutuMerkezi({ ...k, aci: d.aci, ox: d.konum[0], oy: d.konum[1], x: k.x + d.konum[0] - k.ox, y: k.y + d.konum[1] - k.oy });
    expect(yeni[0]).toBeCloseTo(200);
    expect(yeni[1]).toBeCloseTo(150);
  });
  it("imleç üstteyse 0°, adımlı yuvarlama", () => {
    expect(merkezdenDondur(k, [200, 0]).aci).toBeCloseTo(0);
    expect(merkezdenDondur(k, [300, 60], 15).aci % 15).toBe(0);
  });
});
