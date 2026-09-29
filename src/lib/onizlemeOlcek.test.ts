import { describe, expect, it } from "vitest";
import { kutuBoyutu, olcekMetni, yakinlastir } from "./onizlemeOlcek";

const alan = { g: 960, y: 700 };
const tuval: [number, number] = [1920, 1080];

describe("önizleme ölçekleme", () => {
  it("sığdır: en-boy korunarak alana sığar", () => {
    expect(kutuBoyutu(alan, tuval, { tur: "sigdir" })).toEqual({ g: 960, y: 540 });
    expect(kutuBoyutu({ g: 2000, y: 540 }, tuval, { tur: "sigdir" })).toEqual({ g: 960, y: 540 });
  });
  it("tuval: %100 tuval boyutu", () => {
    expect(kutuBoyutu(alan, tuval, { tur: "tuval" })).toEqual({ g: 1920, y: 1080 });
    expect(olcekMetni(alan, tuval, { tur: "tuval" })).toBe("%100");
  });
  it("yakınlaştır ve uzaklaştır 1,25 kat, sınırlar içinde; 1'e dönünce sığdır", () => {
    const k1 = yakinlastir(alan, tuval, { tur: "sigdir" }, 1);
    expect(k1).toEqual({ tur: "yakin", oran: 1.25 });
    expect(kutuBoyutu(alan, tuval, k1).g).toBe(1200);
    expect(yakinlastir(alan, tuval, k1, -1)).toEqual({ tur: "sigdir" });
    let k = { tur: "sigdir" } as ReturnType<typeof yakinlastir>;
    for (let i = 0; i < 30; i++) k = yakinlastir(alan, tuval, k, 1);
    expect(k).toEqual({ tur: "yakin", oran: 8 });
    for (let i = 0; i < 60; i++) k = yakinlastir(alan, tuval, k, -1);
    expect(k).toEqual({ tur: "yakin", oran: 0.25 });
  });
  it("tuval kipinden yakınlaştırma mevcut boyuttan sürer", () => {
    const k = yakinlastir(alan, tuval, { tur: "tuval" }, 1);
    expect(k.tur).toBe("yakin");
    expect(kutuBoyutu(alan, tuval, k).g).toBe(2400);
    expect(olcekMetni(alan, tuval, { tur: "sigdir" })).toBe("");
  });
});
