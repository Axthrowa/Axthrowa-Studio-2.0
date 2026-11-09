import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAppPrefs, resolveHareket } from "./appPrefs";

function depo(deger: unknown) {
  vi.stubGlobal("localStorage", { getItem: () => (deger === undefined ? null : JSON.stringify(deger)) });
}

afterEach(() => vi.unstubAllGlobals());

describe("arayüz tercihleri", () => {
  it("eski kayıtta (alan yok) varsayılanlar: rahat, yuvarlak, animasyon açık", () => {
    depo({ theme: "light", locale: "en" });
    expect(loadAppPrefs()).toMatchObject({ theme: "light", locale: "en", yogunluk: "rahat", kose: "yuvarlak", hareket: "acik" });
  });

  it("geçerli değerler korunur, bozuklar varsayılana düşer", () => {
    depo({ yogunluk: "siki", kose: "keskin", hareket: "kapali" });
    expect(loadAppPrefs()).toMatchObject({ yogunluk: "siki", kose: "keskin", hareket: "kapali" });
    depo({ yogunluk: "dev", kose: 3, hareket: null });
    expect(loadAppPrefs()).toMatchObject({ yogunluk: "rahat", kose: "yuvarlak", hareket: "acik" });
  });

  it("işletim sistemi azaltılmış hareketi yalnız 'sistem' seçiliyse dinlenir", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(resolveHareket("acik")).toBe("acik");
    expect(resolveHareket("sistem")).toBe("azaltilmis");
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(resolveHareket("sistem")).toBe("acik");
  });
});
