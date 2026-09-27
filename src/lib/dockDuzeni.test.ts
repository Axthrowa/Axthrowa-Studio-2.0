import { describe, expect, it } from "vitest";
import { ayiriciKaydir, dockDegistir, duzenOku, siraliGorunur, varsayilanDuzen } from "./dockDuzeni";

describe("dock düzeni", () => {
  it("varsayılan OBS alt sırası; ek docklar kapalı", () => {
    expect(siraliGorunur(varsayilanDuzen())).toEqual(["sahneler", "kaynaklar", "mikser", "gecisler", "denetimler"]);
  });

  it("kayıt doğrulama: bilinmeyen dock, bozuk oran, yükseklik sınırı", () => {
    const d = duzenOku(JSON.stringify({ gorunur: ["mikser", "yok", "mikser", "hedefler"], oranlar: { mikser: 3, sahneler: -1, x: 2 }, yukseklik: 9999, kilitli: true }));
    expect(siraliGorunur(d)).toEqual(["mikser", "hedefler"]);
    expect(d.oranlar.mikser).toBe(3);
    expect(d.oranlar.sahneler).toBe(1);
    expect(d.yukseklik).toBe(640);
    expect(d.kilitli).toBe(true);
    expect(duzenOku("{bozuk")).toEqual(varsayilanDuzen());
    expect(duzenOku(null)).toEqual(varsayilanDuzen());
  });

  it("göster/gizle ve ayırıcı kaydırma toplamı korur", () => {
    const d = dockDegistir(varsayilanDuzen(), "gecisler");
    expect(siraliGorunur(d)).not.toContain("gecisler");
    expect(siraliGorunur(dockDegistir(d, "gecisler"))).toContain("gecisler");
    const v = varsayilanDuzen();
    const k = ayiriciKaydir(v, "sahneler", "kaynaklar", 100, 1000);
    expect((k.oranlar.sahneler ?? 0) + (k.oranlar.kaynaklar ?? 0)).toBeCloseTo(2.25);
    expect(k.oranlar.sahneler).toBeGreaterThan(1);
    // Aşırı kaydırma: komşu en az payda kalır
    const a = ayiriciKaydir(v, "sahneler", "kaynaklar", 100000, 1000);
    expect(a.oranlar.kaynaklar).toBeGreaterThan(0.2);
  });
});
