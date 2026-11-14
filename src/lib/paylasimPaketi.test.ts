import { describe, expect, it } from "vitest";
import { degisiklikler, gizliAlanMi, paketOku, paketOlustur, widgetEslesmesi } from "./paylasimPaketi";

const ornek = () =>
  paketOlustur({
    ekranlar: { starting: { title: "Başlıyoruz", accent: "#ff0000", spotifyToken: "abc", obsPassword: "x", showSessionCount: true, obs: { host: "127.0.0.1", port: 4455 } }, panel: { gizli: 1 } } as never,
    widgetlar: [
      { kind: "chat", name: "Sohbet", enabled: 1, sort_order: 2, config_json: JSON.stringify({ posX: 10, apiKey: "k", url: "rtmp://a/live/ANAHTAR" }) },
      { kind: "goal", name: "Hedef", config: { hedef: 100, imza: "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7" } },
    ],
    deste: null,
  });

describe("paket paylaşımı (U14)", () => {
  it("alan adı kuralı destek paketiyle aynı", () => {
    expect(gizliAlanMi("kickStreamKey")).toBe(true);
    expect(gizliAlanMi("sahneHotkey")).toBe(false);
    expect(gizliAlanMi("title")).toBe(false);
  });

  it("dışa aktarılan dosyada sır kalmaz", () => {
    const { paket, atilan } = ornek();
    const metin = JSON.stringify(paket);
    for (const s of ["abc", "spotifyToken", "obsPassword", "apiKey", "rtmp://", "a1B2c3D4e5F6"]) expect(metin).not.toContain(s);
    expect(atilan).toEqual(expect.arrayContaining(["ekranlar.starting.spotifyToken", "widgetlar[0].config.apiKey"]));
    expect(paket.ekranlar.starting).toEqual({ title: "Başlıyoruz", accent: "#ff0000", showSessionCount: true });
    // Paket yalnız tanınan ekranları taşır
    expect(Object.keys(paket.ekranlar)).toEqual(["starting"]);
  });

  it("yabancı dosyayı reddeder, kendi dosyasını geri okur", () => {
    expect(() => paketOku("{}")).toThrow("paketi değil");
    expect(() => paketOku("yok")).toThrow("JSON");
    const { paket } = ornek();
    expect(paketOku(JSON.stringify(paket)).widgetlar.map((w) => w.name)).toEqual(["Sohbet", "Hedef"]);
  });

  it("neler değişecek listesi", () => {
    const { paket } = ornek();
    expect(widgetEslesmesi(paket.widgetlar, [{ id: "w1", kind: "chat", name: "Sohbet" }]).ekle.map((w) => w.name)).toEqual(["Hedef"]);
    const satirlar = degisiklikler(paket, { ekranlar: { starting: { title: "Başlıyoruz" } }, widgetlar: [{ id: "w1", kind: "chat", name: "Sohbet" }], deste: null });
    expect(satirlar).toEqual(["Giriş ekranı: 2 ayar değişecek", "1 widget güncellenecek (Sohbet)", "1 widget eklenecek (Hedef)"]);
    // Aynı ayardaki widget (mevcutta sır alanı olsa da) değişmiş sayılmaz
    expect(widgetEslesmesi(paket.widgetlar, [{ id: "w1", kind: "chat", name: "Sohbet", config: { posX: 10, apiKey: "k" } }]).guncelle).toEqual([]);
  });
});
