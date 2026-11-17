import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GECMIS_SINIRI, bildir, bildirimleriAl, gecmisiTemizle, hepsiniOku, kapat } from "./bildirimler";
import { pushAppAlert } from "./appAlert";

describe("bildirim standardı (A5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    gecmisiTemizle();
  });
  afterEach(() => vi.useRealTimers());

  const acik = () => bildirimleriAl().filter((b) => b.acik);

  it("bilgi 4 sn, uyarı 8 sn sonra köşeden kalkar; hata kapatılana kadar durur", () => {
    bildir("Sahne değişti", "bilgi");
    bildir("Mikrofon kısık", "uyari");
    bildir("OBS bağlanamadı", "hata");
    vi.advanceTimersByTime(4000);
    expect(acik().map((b) => b.tur)).toEqual(["uyari", "hata"]);
    vi.advanceTimersByTime(4000);
    expect(acik().map((b) => b.tur)).toEqual(["hata"]);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(acik()).toHaveLength(1);
    kapat(acik()[0].id);
    expect(acik()).toHaveLength(0);
    // Kapananlar oturum geçmişinde kalır
    expect(bildirimleriAl()).toHaveLength(3);
  });

  it("türü verilmeyen eski çağrıda hata metinden anlaşılır ve biçimlenir", () => {
    bildir("Kaydedildi");
    bildir("Failed to fetch");
    const [a, b] = bildirimleriAl();
    expect(a.tur).toBe("bilgi");
    expect(b.tur).toBe("hata");
    expect(b.metin).toContain("Yerel uygulamaya ulaşılamadı");
  });

  it("aynı açık bildirim çoğalmaz, süresi yenilenir", () => {
    bildir("Kopyalandı", "bilgi");
    vi.advanceTimersByTime(3000);
    bildir("Kopyalandı", "bilgi");
    vi.advanceTimersByTime(3000);
    expect(acik()).toHaveLength(1);
    expect(bildirimleriAl()).toHaveLength(1);
  });

  it("okunmamış sayısı merkez açılınca sıfırlanır, geçmiş sınırlıdır", () => {
    for (let i = 0; i < GECMIS_SINIRI + 10; i++) bildir(`bilgi ${i}`, "bilgi");
    expect(bildirimleriAl()).toHaveLength(GECMIS_SINIRI);
    expect(bildirimleriAl()[0].metin).toBe("bilgi 10");
    hepsiniOku();
    expect(bildirimleriAl().some((b) => !b.okundu)).toBe(false);
  });

  it("eski hata kutusu çağrısı bildirim merkezine düşer, pencere açılmaz", () => {
    pushAppAlert({ title: "Sohbet", message: "Mesaj gönderilemedi", hint: "Bot hesabına /mod verin" });
    expect(acik()).toEqual([expect.objectContaining({ tur: "hata", baslik: "Sohbet", ipucu: "Bot hesabına /mod verin" })]);
  });

  it("sunucu kapalıyken farklı sözlerle gelen aynı sorun tek bildirim (UI-5, H8)", () => {
    bildir("Failed to fetch", "hata");
    bildir("Kaydedilemedi — sunucu kapalı olabilir", "hata");
    bildir("Yayına uygulanamadı — sunucu kapalı olabilir", "hata");
    expect(acik()).toHaveLength(1);
    expect(acik()[0].metin).toContain("Yerel uygulamaya ulaşılamadı");
  });

  it("önce yumuşak söz gelirse kayıt hataya yükselir ve açık kalır", () => {
    bildir("Kaydedilemedi — sunucu kapalı olabilir", "bilgi");
    bildir("Failed to fetch", "hata");
    vi.advanceTimersByTime(10_000);
    expect(acik()).toEqual([expect.objectContaining({ tur: "hata" })]);
  });
});
