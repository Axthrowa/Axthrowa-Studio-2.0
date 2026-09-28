import { describe, expect, it } from "vitest";
import { ayiriciKaydir, dockDegistir, duzenOku, oneCikan, sekmeGrubu, sekmeSec, sekmeyeEkle, sekmeyiAyir, siraliGorunur, varsayilanDuzen } from "./dockDuzeni";

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

describe("dock sekme grupları", () => {
  it("sekmeye ekle: çocuk yuvasını kaybeder, evin sekmesi olur ve öne çıkar; ayır geri getirir", () => {
    const d = sekmeyeEkle(varsayilanDuzen(), "gecisler", "denetimler");
    expect(siraliGorunur(d)).toEqual(["sahneler", "kaynaklar", "mikser", "denetimler"]);
    expect(sekmeGrubu(d, "denetimler")).toEqual(["denetimler", "gecisler"]);
    expect(oneCikan(d, "denetimler")).toBe("gecisler");
    expect(oneCikan(sekmeSec(d, "denetimler", "denetimler"), "denetimler")).toBe("denetimler");
    const a = sekmeyiAyir(d, "gecisler");
    expect(siraliGorunur(a)).toEqual(siraliGorunur(varsayilanDuzen()));
    expect(oneCikan(a, "denetimler")).toBe("denetimler");
  });

  it("gizli dock sekmeye alınınca görünür olur; ev gizlenince çocuk kendi yuvasına döner", () => {
    const d = sekmeyeEkle(varsayilanDuzen(), "sohbet", "mikser");
    expect(d.gorunur).toContain("sohbet");
    expect(sekmeGrubu(d, "mikser")).toEqual(["mikser", "sohbet"]);
    const g = dockDegistir(d, "mikser");
    expect(siraliGorunur(g)).toContain("sohbet");
  });

  it("zincir oluşmaz: sekmeye sekme eklemek ortak eve ekler; çocuğun sekmeleri taşınır", () => {
    let d = sekmeyeEkle(varsayilanDuzen(), "gecisler", "denetimler");
    d = sekmeyeEkle(d, "hedefler", "gecisler");
    expect(d.sekme.hedefler).toBe("denetimler");
    d = sekmeyeEkle(d, "denetimler", "sahneler");
    expect([d.sekme.denetimler, d.sekme.gecisler, d.sekme.hedefler]).toEqual(["sahneler", "sahneler", "sahneler"]);
    expect(sekmeGrubu(d, "sahneler")).toEqual(["sahneler", "gecisler", "denetimler", "hedefler"]);
    expect(sekmeyeEkle(d, "sahneler", "gecisler")).toBe(d);
  });

  it("kayıt doğrulama: bilinmeyen, kendine ve zincirli sekme bağları düşer", () => {
    const d = duzenOku(JSON.stringify({ gorunur: ["sahneler", "mikser", "gecisler"], sekme: { gecisler: "mikser", mikser: "sahneler", x: "mikser", sahneler: "sahneler" }, etkinSekme: { sahneler: "yok", mikser: "gecisler" } }));
    expect(d.sekme).toEqual({ mikser: "sahneler" });
    expect(d.etkinSekme).toEqual({});
    expect(siraliGorunur(d)).toEqual(["sahneler", "gecisler"]);
  });
});
