import { describe, expect, it } from "vitest";
import { kurulumGerekli, sahneTahmini, sahneYamalari } from "./kurulum";

describe("ilk kurulum (U1)", () => {
  it("temiz veride gerekli; bitince ya da OBS elle ayarlıysa değil; ayar okunamadıysa satır gösterilmez", () => {
    expect(kurulumGerekli({})).toBe(true);
    expect(kurulumGerekli({ obs: { host: "127.0.0.1", port: 4455, password: "" } })).toBe(true);
    expect(kurulumGerekli({ kurulumBitti: true })).toBe(false);
    expect(kurulumGerekli({ obs: { host: "127.0.0.1", port: 4455, password: "x" } })).toBe(false);
    expect(kurulumGerekli(null)).toBe(false);
  });

  it("sahne eşlemesi Ekranlar sayfasının alanlarına yazılır; boş seçim dokunmaz", () => {
    expect(sahneYamalari({ giris: "Başlıyor", oyun: "Oyun", mola: "Mola" })).toEqual({
      starting: { obs: { startingScene: "Başlıyor", sceneOnEnd: "Oyun", returnScene: "Oyun", sceneMap: { starting: "Başlıyor", game: "Oyun" } } },
      brb: { obs: { brbEndScene: "Oyun", returnScene: "Oyun", brbScene: "Mola", sceneMap: { brb: "Mola" } } },
    });
    expect(sahneYamalari({ mola: "Mola" })).toEqual({ brb: { obs: { brbScene: "Mola", sceneMap: { brb: "Mola" } } } });
    expect(sahneYamalari({})).toEqual({});
  });

  it("sahne adlarından tahmin", () => {
    expect(sahneTahmini(["Yayın Başlıyor", "Oyun", "BRB"])).toEqual({ giris: "Yayın Başlıyor", oyun: "Oyun", mola: "BRB" });
    expect(sahneTahmini(["Sahne 1"])).toEqual({ giris: undefined, oyun: undefined, mola: undefined });
  });
});
