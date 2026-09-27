import { describe, expect, it } from "vitest";
import { cikisEtkin, hedefBaslatilabilir, izDegistir, KAYNAK_TURLERI, type MotorHedef } from "./motor";

const hedef = (d: Partial<MotorHedef> = {}): MotorHedef => ({
  id: "twitch",
  ad: "Twitch",
  platform: "twitch",
  etkin: true,
  anahtarVar: true,
  tuval: null,
  iz: null,
  durum: "hazir",
  kod: null,
  yonlendiricideCanli: false,
  ...d,
});

describe("hedefBaslatilabilir", () => {
  it("motor, anahtar, yönlendirici ve durum koşulları", () => {
    expect(hedefBaslatilabilir(hedef(), true).olur).toBe(true);
    expect(hedefBaslatilabilir(hedef(), false).neden).toMatch(/Motor/);
    expect(hedefBaslatilabilir(hedef({ anahtarVar: false }), true).neden).toMatch(/anahtar/);
    expect(hedefBaslatilabilir(hedef({ yonlendiricideCanli: true }), true).neden).toMatch(/yönlendirici/);
    expect(hedefBaslatilabilir(hedef({ durum: "canli" }), true).olur).toBe(false);
    expect(hedefBaslatilabilir(hedef({ durum: "durduruldu" }), true).olur).toBe(true);
    expect(hedefBaslatilabilir(hedef({ durum: "basarisiz" }), true).olur).toBe(true);
    expect(cikisEtkin("yeniden_baglaniyor")).toBe(true);
    expect(cikisEtkin("durduruldu")).toBe(false);
  });
});

describe("izDegistir", () => {
  it("tek izi aç/kapatır, son izi kapatmaz", () => {
    expect(izDegistir(0x3f, 1)).toBe(0x3e);
    expect(izDegistir(0b10, 1)).toBe(0b11);
    expect(izDegistir(0b10, 2)).toBe(0b10); // son açık iz kapanmaz
    expect(izDegistir(0x3f, 6)).toBe(0x1f);
  });
});

describe("kaynak türleri", () => {
  it("yakalama yapan ve ses taşıyan türler açıkça işaretli", () => {
    const yakalayan = KAYNAK_TURLERI.filter((k) => k.yakalar).map((k) => k.tur);
    expect(yakalayan.sort()).toEqual(["ekran", "kamera", "masaustu", "mikrofon", "oyun", "pencere", "uygulama_sesi"]);
    expect(KAYNAK_TURLERI.filter((k) => k.ses).map((k) => k.tur).sort()).toEqual(["masaustu", "medya", "mikrofon", "tarayici", "uygulama_sesi"]);
    expect(new Set(KAYNAK_TURLERI.map((k) => k.tur)).size).toBe(KAYNAK_TURLERI.length);
  });
});
