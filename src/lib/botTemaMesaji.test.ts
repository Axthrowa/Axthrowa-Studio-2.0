import { describe, expect, it } from "vitest";
import { botTemaMesaji, renkleriOku, yaricapOku } from "./botTemaMesaji";

describe("botTemaMesaji", () => {
  it("köşe ayarını Studio ile aynı yarıçapa çevirir", () => {
    expect(yaricapOku("keskin")).toEqual({ kart: "0.25rem", dugme: "0.1875rem" });
    expect(yaricapOku("az")).toEqual({ kart: "0.625rem", dugme: "0.5rem" });
    expect(yaricapOku(null).kart).toBe("1rem");
  });

  it("panel değişkenlerini botun izinli adlarına yazar", () => {
    const renk = renkleriOku(
      (ad) =>
        ({
          "--panel-bg": "#06161a",
          "--panel-card": "rgba(28, 12, 12, 0.88)",
          "--panel-elevated": "#16213a",
          "--panel-border": "rgba(255, 255, 255, 0.06)",
          "--panel-accent": "#2dd4bf",
          "--title-color": "",
          "--fg-rgb": "255 255 255",
          "--panel-muted": "rgba(255, 255, 255, 0.72)",
        })[ad] || "",
      "keskin",
    );
    expect(botTemaMesaji(renk)).toEqual({
      tur: "studio-tema",
      tema: "studio",
      degiskenler: {
        "--axt-zemin": "#06161a",
        "--axt-yuzey": "rgba(28, 12, 12, 0.88)",
        "--axt-yuzey-2": "#16213a",
        "--axt-kenar": "rgba(255, 255, 255, 0.06)",
        "--axt-vurgu": "#2dd4bf",
        "--axt-metin": "rgb(255 255 255)",
        "--axt-soluk": "rgba(255, 255, 255, 0.72)",
        "--axt-yaricap-kart": "0.25rem",
        "--axt-yaricap-dugme": "0.1875rem",
      },
    });
  });
});
