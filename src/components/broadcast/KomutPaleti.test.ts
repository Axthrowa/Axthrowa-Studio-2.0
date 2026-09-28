import { describe, expect, it } from "vitest";
import { komutlar, suz } from "./KomutPaleti";

describe("komut paleti", () => {
  const menuler = [
    { ad: "Görünüm", ogeler: () => [{ etiket: "☑ Studio Mode", eylem: () => undefined }, "ayirici" as const, { etiket: "Tuval: Dikey", eylem: () => undefined }] },
    { ad: "Yayın", ogeler: () => [{ etiket: "Kaydı başlat", eylem: () => undefined }, { etiket: "Tekrarı kaydet", devreDisi: true, eylem: () => undefined }] },
  ];

  it("menülerden komutlar: ayırıcı ve devre dışı düşer, işaretler temizlenir", () => {
    const k = komutlar(menuler, [{ etiket: "Sahneye geç: Oyun", grup: "Sahne", eylem: () => undefined }]);
    expect(k.map((x) => x.etiket)).toEqual(["Sahneye geç: Oyun", "Studio Mode", "Tuval: Dikey", "Kaydı başlat"]);
  });

  it("süzgeç sözcük sırasından bağımsız ve Türkçe duyarlı", () => {
    const k = komutlar(menuler, [{ etiket: "Sahneye geç: OYUN İÇİ", grup: "Sahne", eylem: () => undefined }]);
    expect(suz(k, "KAYDI").map((x) => x.etiket)).toEqual(["Kaydı başlat"]);
    expect(suz(k, "içi sahne").map((x) => x.etiket)).toEqual(["Sahneye geç: OYUN İÇİ"]);
    expect(suz(k, "   ")).toHaveLength(k.length);
  });
});
