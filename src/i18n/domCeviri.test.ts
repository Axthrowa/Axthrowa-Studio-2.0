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
});
