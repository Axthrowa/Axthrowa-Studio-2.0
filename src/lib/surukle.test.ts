import { describe, expect, it } from "vitest";
import { esikAsildi, suruklenmisKonum } from "./surukle";
import { metniTemizle } from "../components/overlay/YerindeMetin";

describe("önizlemede sürükleme", () => {
  it("hareket göreli: öğe imlecin altına atlamaz", () => {
    // 1920x1080 tuvalde 192 px sağa = %10
    expect(suruklenmisKonum({ x: 30, y: 40 }, 192, 0, 1920, 1080).konum).toEqual({ x: 40, y: 40 });
    expect(suruklenmisKonum({ x: 30, y: 40 }, 0, -108, 1920, 1080).konum).toEqual({ x: 30, y: 30 });
  });
  it("tuval dışına taşmaz, merkeze yapışır", () => {
    expect(suruklenmisKonum({ x: 95, y: 50 }, 500, 0, 1000, 1000).konum.x).toBe(98);
    const r = suruklenmisKonum({ x: 49, y: 20 }, 5, 0, 1000, 1000);
    expect(r.konum.x).toBe(50);
    expect(r.kilavuz.v).toBe(50);
  });
  it("küçük titreme sürükleme sayılmaz (tık konumu değiştirmez)", () => {
    expect(esikAsildi(2, 2)).toBe(false);
    expect(esikAsildi(4, 0)).toBe(true);
  });
});

describe("yerinde yazı düzenleme", () => {
  it("satır sonu ve fazla boşluk temizlenir", () => {
    expect(metniTemizle("  Yayın\nbirazdan  başlıyor  ")).toBe("Yayın birazdan başlıyor");
    expect(metniTemizle("")).toBe("");
  });
});
