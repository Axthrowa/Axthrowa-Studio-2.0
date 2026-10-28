import { describe, expect, it } from "vitest";
import { saglikDegerlendir, type SaglikDurumu } from "./yayinSagligi";

const h = (o: Partial<{ active: boolean; reconnecting: boolean; congestion: number; skippedFrames: number; totalFrames: number }>) => ({
  active: true, reconnecting: false, durationMs: 0, congestion: 0, skippedFrames: 0, totalFrames: 0, dropPct: 0, ...o,
});
const bas: SaglikDurumu = { onceki: null, yogunBas: null };
const idler = (u: Array<{ id: string } & object>) => u.filter((x) => !("temizle" in x)).map((x) => x.id);

describe("yayın sağlığı", () => {
  it("son aralıktaki kare düşüşü eşiği geçince uyarır (toplam ortalama değil)", () => {
    let r = saglikDegerlendir(bas, h({ totalFrames: 1000, skippedFrames: 0 }), 0);
    r = saglikDegerlendir(r.durum, h({ totalFrames: 1180, skippedFrames: 5 }), 3000);
    expect(idler(r.uyarilar)).toContain("saglik-kare");
    r = saglikDegerlendir(r.durum, h({ totalFrames: 1360, skippedFrames: 5 }), 6000);
    expect(idler(r.uyarilar)).not.toContain("saglik-kare");
  });
  it("ağ yoğunluğu ancak 10 sn sürerse, kopma hemen, yayın durması bir kez", () => {
    let r = saglikDegerlendir(bas, h({ congestion: 0.8 }), 0);
    expect(idler(r.uyarilar)).not.toContain("saglik-ag");
    r = saglikDegerlendir(r.durum, h({ congestion: 0.8 }), 11_000);
    expect(idler(r.uyarilar)).toContain("saglik-ag");
    r = saglikDegerlendir(r.durum, h({ reconnecting: true }), 12_000);
    expect(idler(r.uyarilar)).toContain("saglik-baglanti");
    r = saglikDegerlendir({ onceki: h({}), yogunBas: null }, h({ active: false }), 13_000);
    expect(idler(r.uyarilar)).toContain("saglik-durdu");
  });
  it("yayın bitince kare uyarısı temizlenir; YYA'nın kendi durdurması uyarı vermez", () => {
    let r = saglikDegerlendir(bas, h({ totalFrames: 1000 }), 0);
    r = saglikDegerlendir(r.durum, h({ totalFrames: 1100, skippedFrames: 10 }), 3000);
    expect(idler(r.uyarilar)).toContain("saglik-kare");
    const bitis = saglikDegerlendir(r.durum, h({ active: false }), 6000, true);
    expect(bitis.uyarilar).toContainEqual({ id: "saglik-kare", temizle: true });
    expect(idler(bitis.uyarilar)).not.toContain("saglik-durdu");
  });
});
