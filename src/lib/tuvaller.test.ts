import { describe, expect, it } from "vitest";
import { EK_TUVAL, ekTuvaller, TUVAL_ADI, tuvalAdi, tuvalleriKaydet } from "./tuvaller";

describe("tuval adları", () => {
  it("yerleşik, ek ve önizleme adları; silinen ek tuval kayıttan düşer", () => {
    expect(tuvalAdi("ana")).toBe("Yatay");
    tuvalleriKaydet([
      { id: "ana", ad: "Yatay", genislik: 1920, yukseklik: 1080, ek: false },
      { id: "tuval-1", ad: "Kare", genislik: 1080, yukseklik: 1080, ek: true },
    ]);
    expect(TUVAL_ADI["tuval-1"]).toBe("Kare");
    expect(tuvalAdi("studyo-tuval-1")).toBe("Kare (önizleme)");
    expect(ekTuvaller().map((t) => t.id)).toEqual(["tuval-1"]);
    tuvalleriKaydet([{ id: "ana", ad: "Yatay", genislik: 1920, yukseklik: 1080, ek: false }]);
    expect(ekTuvaller()).toEqual([]);
    expect(tuvalAdi("tuval-1")).toBe("tuval-1");
  });

  it("ek tuval kimliği kuralı", () => {
    expect(EK_TUVAL.test("tuval-3")).toBe(true);
    expect(EK_TUVAL.test("tuval-0")).toBe(false);
    expect(EK_TUVAL.test("tuval-../x")).toBe(false);
  });
});
