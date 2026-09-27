import { describe, expect, it } from "vitest";
import { alfaDegistir, duzListe, duzenlenebilir, hextenObsRengi, listeSecili, obsRengiAlfa, obsRengindenHex, sayiAlani, type Ozellik } from "./ozellikFormu";

const oz = (p: Partial<Ozellik>): Ozellik => ({ ad: "x", aciklama: "X", tur: "int", gorunur: true, etkin: true, ...p });

describe("OBS renk biçimi (0xAABBGGRR)", () => {
  it("tamsayı ↔ #RRGGBB, alfa korunur", () => {
    // Test eklentimizin varsayılanı 0xFFCC6633: R=0x33 G=0x66 B=0xCC
    expect(obsRengindenHex(0xffcc6633)).toBe("#3366cc");
    expect(hextenObsRengi("#3366cc")).toBe(0xffcc6633);
    expect(hextenObsRengi("#ff0000", 0x80000000)).toBe(0x800000ff);
    // JSON'da imzalı gelen değer
    expect(obsRengindenHex(-3381709)).toBe("#3366cc");
    expect(() => hextenObsRengi("kırmızı")).toThrow();
  });

  it("opaklık", () => {
    expect(obsRengiAlfa(0x80112233)).toBe(0x80);
    expect(alfaDegistir(0xff112233, 0)).toBe(0x00112233);
    expect(alfaDegistir(0xff112233, 999)).toBe(0xff112233);
  });
});

describe("alan yardımcıları", () => {
  it("sayı alanı sınır ve tamsayı", () => {
    const o = oz({ min: 1, max: 90 });
    expect(sayiAlani("40", o)).toBe(40);
    expect(sayiAlani("200", o)).toBe(90);
    expect(sayiAlani("12,6", o)).toBe(13);
    expect(sayiAlani("", o)).toBeNull();
    expect(sayiAlani("abc", o)).toBeNull();
    expect(sayiAlani("0,25", oz({ tur: "float", min: 0, max: 1 }))).toBe(0.25);
  });

  it("liste seçimi değer türünden bağımsız eşleşir", () => {
    const l = oz({ tur: "list", liste: { tur: "liste", bicim: "int", ogeler: [{ ad: "Sol", deger: 0, devreDisi: false }, { ad: "Sağ", deger: 2, devreDisi: false }] } });
    expect(listeSecili(l, 2)).toBe("1");
    expect(listeSecili(l, "0")).toBe("0");
    expect(listeSecili(l, 5)).toBe("");
  });

  it("gruplar düzleşir; düğme ve bilgi düzenlenemez", () => {
    const g = oz({ tur: "group", grup: [oz({ ad: "a" }), oz({ ad: "b", tur: "bool" })] });
    expect(duzListe([g, oz({ ad: "c" })]).map((x) => x.ad)).toEqual(["x", "a", "b", "c"]);
    expect(duzenlenebilir(oz({ tur: "button" }))).toBe(false);
    expect(duzenlenebilir(oz({ tur: "text", metinTuru: "bilgi" }))).toBe(false);
    expect(duzenlenebilir(oz({ tur: "text", metinTuru: "parola" }))).toBe(true);
  });
});
