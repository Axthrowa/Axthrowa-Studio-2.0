import { describe, expect, it } from "vitest";
import { etkinVurguRengi, etkinYaziRengi, hex6 } from "./textStyles";

describe("yazı rengi seçici", () => {
  it("kısa hex renk seçicinin anlayacağı biçime açılır", () => {
    expect(hex6("#fff")).toBe("#ffffff");
    expect(hex6("#A1B2C3")).toBe("#a1b2c3");
    expect(hex6("rgb(1,2,3)")).toBeUndefined();
    expect(hex6(undefined)).toBeUndefined();
  });

  it("şablon rengini gösterir (yoksa beyaz seçmek değişiklik sayılmıyordu)", () => {
    expect(etkinYaziRengi("title", { textColor: "#ffcc00" })).toBe("#ffcc00");
    expect(etkinYaziRengi("title", { textColor: "#ffcc00", textStyles: { title: { color: "#112233" } } })).toBe("#112233");
    expect(etkinYaziRengi("eyebrow", { eyebrowColor: "#b39dff" })).toBe("#b39dff");
    expect(etkinYaziRengi("credits", {})).toBe("#ffffff");
  });

  it("vurgu rengi: yazının kendi vurgusu → genel vurgu → varsayılan", () => {
    expect(etkinVurguRengi("title", { accent: "#00ff00" })).toBe("#00ff00");
    expect(etkinVurguRengi("title", { accent: "#00ff00", textStyles: { title: { accentColor: "#ff0000" } } })).toBe("#ff0000");
    expect(etkinVurguRengi("sub", {})).toBe("#7c5cff");
  });
});
