import { describe, expect, it } from "vitest";
import { bagliPlatformlar, hazirMi, hazirlikSatirlari, type HazirlikGirdisi } from "./hazirlik";

const tam: HazirlikGirdisi = {
  obsBagli: true,
  platformlar: { bagli: ["Kick"], toplam: 3 },
  bot: "calisiyor",
  sahneler: { giris: true, mola: true },
  katman: true,
};

describe("hazırlık listesi (UI-4)", () => {
  it("her şey hazırsa beş satır da tamam", () => {
    const s = hazirlikSatirlari(tam);
    expect(s.map((x) => x.id)).toEqual(["obs", "bot", "platformlar", "sahneler", "katman"]);
    expect(hazirMi(s)).toBe(true);
  });

  it("OBS ve bot kapalıyken bağlı satırlar bilinmiyor, eksikler tek düğmeyle", () => {
    const s = hazirlikSatirlari({ obsBagli: false, platformlar: null, bot: "kapali", sahneler: null, katman: null });
    const d = Object.fromEntries(s.map((x) => [x.id, [x.durum, x.eylem]]));
    expect(d).toEqual({
      obs: ["eksik", "Bağlan"],
      bot: ["eksik", "Başlat"],
      platformlar: ["bilinmiyor", "Bağla"],
      sahneler: ["bilinmiyor", "Seç"],
      katman: ["bilinmiyor", "OBS'e ekle"],
    });
    expect(hazirMi(s)).toBe(false);
  });

  it("eksik sahneyi adıyla söyler", () => {
    const s = hazirlikSatirlari({ ...tam, sahneler: { giris: true, mola: false } });
    expect(s.find((x) => x.id === "sahneler")?.aciklama).toBe("Seçilmemiş: mola sahnesi");
  });

  it("bot durumundan bağlı platformları okur", () => {
    expect(bagliPlatformlar({ kick: { connected: true }, twitch: { connected: false }, youtube: null })).toEqual({ bagli: ["Kick"], toplam: 3 });
    expect(bagliPlatformlar(undefined)).toEqual({ bagli: [], toplam: 0 });
  });
});
