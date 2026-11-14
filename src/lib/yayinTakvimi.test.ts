import { describe, expect, it } from "vitest";
import { hatirlatilacaklar, siradakiMetni, siradakiYayin, takvimAyari } from "./yayinTakvimi";

const simdi = new Date(2026, 10, 14, 18, 0).getTime(); // 14 Kasım 2026 Cumartesi 18:00 (yerel)
const yerel = (g: number, s: number, d = 0) => new Date(2026, 10, g, s, d).toISOString();

describe("yayın takvimi (Y11)", () => {
  it("ayarı düzeltir: bozuk tarih atılır, zamana göre sıralanır, süre sınırlanır", () => {
    const a = takvimAyari({ liste: [{ id: "b", zaman: yerel(16, 20), baslik: "B", sureDk: 5 }, { id: "x", zaman: "dün" }, { id: "a", zaman: yerel(15, 20), baslik: "A" }] });
    expect(a.goster).toBe(true);
    expect(a.liste.map((y) => [y.id, y.sureDk])).toEqual([["a", 120], ["b", 30]]);
    expect(takvimAyari(null)).toEqual({ goster: true, liste: [] });
  });

  it("sıradaki yayın: süresi dolmamış ilk yayın, metin bugün/yarın/gün adı", () => {
    const l = takvimAyari({ liste: [{ id: "eski", zaman: yerel(14, 15), sureDk: 120 }, { id: "suruyor", zaman: yerel(14, 17), sureDk: 120, baslik: "Canlı" }, { id: "yarin", zaman: yerel(15, 20) }] }).liste;
    expect(siradakiYayin(l, simdi)?.id).toBe("suruyor");
    expect(siradakiMetni(l[1], simdi)).toBe("Sıradaki yayın: Bugün 17:00 · Canlı");
    expect(siradakiMetni(l[2], simdi)).toBe("Sıradaki yayın: Yarın 20:00");
    expect(siradakiMetni({ ...l[2], zaman: yerel(17, 21) }, simdi)).toBe("Sıradaki yayın: Salı 21:00");
    expect(siradakiYayin(l, new Date(2026, 11, 1).getTime())).toBeNull();
  });

  it("hatırlatma 5 dk kala bir kez", () => {
    const l = takvimAyari({ liste: [{ id: "y", zaman: yerel(14, 18, 4) }] }).liste;
    expect(hatirlatilacaklar(l, simdi - 120_000, new Set())).toEqual([]);
    expect(hatirlatilacaklar(l, simdi, new Set()).map((y) => y.id)).toEqual(["y"]);
    expect(hatirlatilacaklar(l, simdi, new Set(["y"]))).toEqual([]);
  });
});
