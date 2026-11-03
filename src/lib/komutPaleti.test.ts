import { describe, expect, it } from "vitest";
import { katla, komutAra, type Komut } from "./komutPaleti";

const k = (ad: string, anahtar?: string): Komut => ({ id: ad, ad, grup: "Sayfa", anahtar, calistir: () => {} });
const liste = [k("Sohbeti temizle"), k("Çekiliş başlat"), k("Yeni çekiliş listesi"), k("Sonraki şarkı", "resonance müzik")];
const adlar = (s: string) => komutAra(liste, s).map((x) => x.ad);

describe("komut arama", () => {
  it("Türkçe harfleri aynı sayar", () => {
    expect(katla("ÇEKİLİŞ")).toBe("cekilis");
    expect(adlar("cekilis")[0]).toBe("Çekiliş başlat");
    expect(adlar("IŞIK")).toEqual([]);
  });

  it("adın başındaki eşleşmeyi öne alır", () => {
    expect(adlar("çek")).toEqual(["Çekiliş başlat", "Yeni çekiliş listesi"]);
  });

  it("bütün sözcükler ve gizli anahtarlar aranır", () => {
    expect(adlar("resonance sonraki")).toEqual(["Sonraki şarkı"]);
    expect(adlar("çekiliş temizle")).toEqual([]);
  });

  it("boş sorguda hepsi verilen sırada döner", () => {
    expect(komutAra(liste, "  ")).toEqual(liste);
  });
});
