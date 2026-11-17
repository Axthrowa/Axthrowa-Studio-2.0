import { describe, expect, it } from "vitest";
import { cevir } from "./domCeviri";

describe("İngilizce arayüz sözlüğü (Y15)", () => {
  it("tam metni çevirir, boşluğu korur, bilinmeyeni bırakır", () => {
    expect(cevir("Yayını bitir")).toBe("End stream");
    expect(cevir("  Yayını bitir ")).toBe("  End stream ");
    expect(cevir("Rastgele sohbet iletisi")).toBeNull();
    expect(cevir("   ")).toBeNull();
  });
  it("şablon dizgilerde değişkeni taşır", () => {
    expect(cevir("Sahne değiştirilemedi: zaman aşımı")).toBe("Could not switch scene: zaman aşımı");
    expect(cevir("{0} kanalına baskın başladı (Twitch geri sayımı ~90 sn)".replace("{0}", "Ali"))).toBe("Raid on Ali started (Twitch countdown ~90 s)");
  });
  it("şablona gömülü sunucu (Rust) hatasını da çevirir", () => {
    expect(cevir("Eklenemedi: Discord geçmiş zamanlı etkinlik kabul etmez")).toBe("Could not add: Discord does not accept events in the past");
    expect(cevir("Eklenemedi: OBS sahnesi değiştirilemedi: timeout")).toBe("Could not add: Could not switch OBS scene: timeout");
  });
  it("uzun kalıp kısa kalıptan önce eşleşir (bot yayın süresi)", () => {
    expect(cevir("1 saat 2 dakika 5 saniye")).toBe("1 h 2 min 5 s");
    expect(cevir("54 dakika 31 saniye")).toBe("54 min 31 s");
    expect(cevir("CANLI · 1.234 izleyici")).toBe("LIVE · 1.234 viewers");
  });
});
