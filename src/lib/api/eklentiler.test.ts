import { describe, expect, it } from "vitest";
import { acikOnayGerekli, boyutMetni, cokmeMetni, DURUM_BILGISI, durumSayilari, etkinlestirilebilir, kodMetni, type Cokme } from "./eklentiler";
import { eklentiKaynakTurleri } from "./motor";

describe("eklenti yardımcıları", () => {
  it("çıkış kodu NTSTATUS olarak işaretsiz onaltılık", () => {
    expect(kodMetni(0xc0000005)).toBe("0xC0000005");
    expect(kodMetni(-1073741819)).toBe("0xC0000005");
    expect(kodMetni(null)).toBe("");
  });

  it("çökme istemi şüpheliyi adıyla söyler", () => {
    const c: Cokme = { zaman: 1, supheli: "benim-eklentim", asama: "yukleme", cikisKodu: 0xc0000005, yuklu: [], gozlendi: true, cozuldu: false };
    expect(cokmeMetni(c)).toBe("Önceki oturum şu eklentiyi yüklerken çökmüş olabilir: benim-eklentim (0xC0000005)");
    expect(cokmeMetni({ ...c, supheli: null, cikisKodu: null })).toContain("beklenmedik");
  });

  it("etkinleştirme kuralları: karantina, motor yönetimi, uyumsuz durumlar", () => {
    const e = (arayuz: keyof typeof DURUM_BILGISI, ek: { karantina?: string; motorNotu?: string } = {}) => ({
      arayuz,
      karantina: ek.karantina ?? null,
      motorNotu: ek.motorNotu ?? null,
      acikOnay: false,
    });
    expect(etkinlestirilebilir(e("COMPATIBLE")).olur).toBe(true);
    expect(etkinlestirilebilir(e("LIKELY_COMPATIBLE")).olur).toBe(true);
    expect(etkinlestirilebilir(e("TEST_REQUIRED")).olur).toBe(true);
    expect(acikOnayGerekli(e("TEST_REQUIRED"))).toBe(true);
    expect(acikOnayGerekli({ ...e("TEST_REQUIRED"), acikOnay: true })).toBe(false);
    for (const d of ["MISSING_DEPENDENCY", "OBS_VERSION_MISMATCH", "ARCHITECTURE_MISMATCH", "UNSUPPORTED", "BLOCKED"] as const) {
      expect(etkinlestirilebilir(e(d)).olur, d).toBe(false);
    }
    expect(etkinlestirilebilir(e("COMPATIBLE", { karantina: "çöktü" })).neden).toContain("Karantinada");
    expect(etkinlestirilebilir(e("COMPATIBLE", { motorNotu: "Motor bu modülü kendisi yükler" })).olur).toBe(false);
  });

  it("durum sayıları ve boyut metni", () => {
    const s = durumSayilari([{ arayuz: "COMPATIBLE" }, { arayuz: "COMPATIBLE" }, { arayuz: "QUARANTINED" }]);
    expect(s.COMPATIBLE).toBe(2);
    expect(s.QUARANTINED).toBe(1);
    expect(s.UNSUPPORTED).toBe(0);
    expect(boyutMetni(2048)).toBe("2 KB");
    expect(boyutMetni(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("her durumun etiketi, tonu ve açıklaması var", () => {
    for (const [k, v] of Object.entries(DURUM_BILGISI)) {
      expect(v.etiket.length, k).toBeGreaterThan(2);
      expect(v.aciklama.length, k).toBeGreaterThan(10);
    }
  });

  it("yalnız yüklenmiş eklentilerin KAYNAK türleri menüye girer", () => {
    const t = eklentiKaynakTurleri([
      { id: "a", ad: "A", sonuc: "yuklendi", kod: 0, apiSurumu: 0, turler: [{ id: "a_src", tur: "kaynak", ad: "A kaynağı" }, { id: "a_flt", tur: "filtre", ad: "F" }] },
      { id: "b", ad: "B", sonuc: "acilamadi", kod: -2, apiSurumu: 0, turler: [{ id: "b_src", tur: "kaynak", ad: "B" }] },
    ]);
    expect(t).toEqual([{ id: "a_src", ad: "A kaynağı", eklenti: "A" }]);
    expect(eklentiKaynakTurleri(undefined)).toEqual([]);
  });
});
