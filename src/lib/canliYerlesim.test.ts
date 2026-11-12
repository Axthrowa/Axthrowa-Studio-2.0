import { describe, expect, it } from "vitest";
import { KIPLER, SABLONLAR, SUTUN, VARSAYILAN_YERLESIM, eklerleBirlestir, kipKutulari, otomatikKip, panelEkle, panelKaldir, yerlesimOku, yerlestir, type Kutu } from "./canliYerlesim";

const bul = (l: Kutu[], id: Kutu["id"]) => l.find((k) => k.id === id)!;
const cakismaVar = (l: Kutu[]) =>
  l.some((a, i) => l.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));

describe("yerlestir", () => {
  it("varsayılan yerleşimde çakışma yok", () => {
    expect(cakismaVar(VARSAYILAN_YERLESIM)).toBe(false);
  });

  it("üstüne gelinen paneli aşağı iter, kimse üst üste binmez", () => {
    const s = yerlestir(VARSAYILAN_YERLESIM, "hizli", { x: 0, y: 0, w: 6, h: 5 });
    expect(bul(s, "hizli")).toMatchObject({ x: 0, y: 0, w: 6, h: 5 });
    expect(bul(s, "onizleme").y).toBe(5);
    expect(cakismaVar(s)).toBe(false);
  });

  it("taşma ve en küçük boy sınırlanır", () => {
    const s = yerlestir(VARSAYILAN_YERLESIM, "ses", { x: 40, y: -3, w: 1, h: 1 });
    const k = bul(s, "ses");
    expect(k.w).toBe(3);
    expect(k.h).toBe(6);
    expect(k.x + k.w).toBe(SUTUN);
    expect(k.y).toBe(0);
  });

  it("aynı başlangıçtan her hareket hesaplanınca geri çekmek ötekileri eski yerine koyar", () => {
    const gecici = yerlestir(VARSAYILAN_YERLESIM, "hizli", { x: 0, y: 0, w: 5, h: 5 });
    expect(bul(gecici, "onizleme").y).toBe(5);
    const geri = yerlestir(VARSAYILAN_YERLESIM, "hizli", bul(VARSAYILAN_YERLESIM, "hizli"));
    expect(geri).toEqual(VARSAYILAN_YERLESIM);
  });
});

describe("hazır çalışma alanları", () => {
  it.each(SABLONLAR)("$ad çakışmaz, taşmaz ve kayıttan aynen döner", ({ kutular }) => {
    expect(cakismaVar(kutular)).toBe(false);
    expect(kutular.every((k) => k.x + k.w <= SUTUN)).toBe(true);
    expect(yerlesimOku(JSON.stringify(kutular))).toEqual(kutular);
  });
});

describe("eklenen paneller", () => {
  it("en alta çakışmadan eklenir, ikinci kez eklenmez, kayıttan döner, kaldırılır", () => {
    const l = panelEkle(VARSAYILAN_YERLESIM, "ek:bot:overlays");
    expect(cakismaVar(l)).toBe(false);
    expect(panelEkle(l, "ek:bot:overlays")).toBe(l);
    expect(yerlesimOku(JSON.stringify(l)).some((k) => k.id === "ek:bot:overlays")).toBe(true);
    expect(panelKaldir(l, "ek:bot:overlays")).toEqual(VARSAYILAN_YERLESIM);
  });

  it("şablona geçince eklenen panel kalır, bilinmeyen kimlik düşer", () => {
    const l = panelEkle(VARSAYILAN_YERLESIM, "ek:muzik");
    const s = eklerleBirlestir(SABLONLAR[0].kutular, l);
    expect(s.some((k) => k.id === "ek:muzik")).toBe(true);
    expect(cakismaVar(s)).toBe(false);
    const bozuk = JSON.stringify([...VARSAYILAN_YERLESIM, { id: "zararli", x: 0, y: 40, w: 3, h: 6 }]);
    expect(yerlesimOku(bozuk).some((k) => (k.id as string) === "zararli")).toBe(false);
  });
});

describe("yerlesimOku", () => {
  it("kaydedilen yerleşimi geri okur", () => {
    const s = yerlestir(VARSAYILAN_YERLESIM, "onizleme", { x: 2, y: 0, w: 8, h: 14 });
    expect(yerlesimOku(JSON.stringify(s))).toEqual(s);
  });

  it("bozuk ya da eksik kayıtta varsayılana döner", () => {
    expect(yerlesimOku(null)).toEqual(VARSAYILAN_YERLESIM);
    expect(yerlesimOku("{bozuk")).toEqual(VARSAYILAN_YERLESIM);
    expect(yerlesimOku('[{"id":"ses","x":0,"y":0,"w":3,"h":6}]')).toEqual(VARSAYILAN_YERLESIM);
  });

  it("elle bozulmuş kayıtta çakışma bırakmaz", () => {
    const bozuk = VARSAYILAN_YERLESIM.map((k) => ({ ...k, x: 0, y: 0 }));
    expect(cakismaVar(yerlesimOku(JSON.stringify(bozuk)))).toBe(false);
  });
});

describe("Canlı kipleri", () => {
  it.each(KIPLER)("$ad çakışmaz, taşmaz ve kayıttan aynen döner", ({ id, kutular }) => {
    expect(cakismaVar(kutular)).toBe(false);
    expect(kutular.every((k) => k.x >= 0 && k.x + k.w <= SUTUN)).toBe(true);
    expect(yerlesimOku(JSON.stringify(kutular), kipKutulari(id))).toEqual(kutular);
  });

  it("kayıt yoksa ya da bozuksa o kipin kendi yerleşimi döner, ortak varsayılan değil", () => {
    expect(yerlesimOku(null, kipKutulari("sonrasi"))).toEqual(kipKutulari("sonrasi"));
    expect(yerlesimOku("{bozuk", kipKutulari("oncesi"))).toEqual(kipKutulari("oncesi"));
    expect(yerlesimOku("[]", kipKutulari("oncesi"))).toEqual(kipKutulari("oncesi"));
  });

  it("yayın açıkken Canlı, kapalıyken Yayın öncesi seçilir", () => {
    expect(otomatikKip(true)).toBe("canli");
    expect(otomatikKip(false)).toBe("oncesi");
  });
});

describe("sonradan eklenen temel panel (U3)", () => {
  it("eski Canlı kaydında uyarı kuyruğu yoksa kendi boyuyla alta eklenir, çakışma olmaz", () => {
    const eski = kipKutulari("canli").filter((k) => k.id !== "uyarilar");
    const okunan = yerlesimOku(JSON.stringify(eski), kipKutulari("canli"));
    const u = bul(okunan, "uyarilar");
    expect(u).toMatchObject({ w: 5, h: 10 });
    expect(u.y).toBe(Math.max(...eski.map((k) => k.y + k.h)));
    expect(cakismaVar(okunan)).toBe(false);
  });
});
