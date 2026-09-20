import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, builtinFor } from "./builtin";
import {
  PORTABLE_BG,
  captureTemplate,
  forbiddenKeys,
  mergeTemplate,
  parseStoredTemplates,
  pickTemplateFields,
} from "./fields";
import { ANIM_OPTIONS, EFFECT_OPTIONS, FONT_OPTIONS, TEXT_STYLE_KEYS } from "../textStyles";
import { mergeTemplateLists } from "./store";

/** Gerçek bir ekran ayarına benzer, içinde hassas veri olan örnek. */
const GERCEK = {
  title: "Benim yayınım",
  accent: "#7c5cff",
  font: "bold",
  bgStyle: "video",
  bgVideoPath: "C:/Users/x/video.mp4",
  bgImage: "arka.png",
  logo: "logo.png",
  logoFile: "logo.png",
  logoPath: "C:/x/logo.png",
  logoZoom: 120,
  targetDate: "2026-12-01T20:00",
  socials: { kick: "axthrowa", twitch: "axt" },
  youtubeUrl: "https://youtu.be/xyz",
  obs: { host: "127.0.0.1", password: "cok-gizli", startingScene: "Giriş" },
  positions: { title: { x: 50, y: 40 } },
  textStyles: { title: { font: "bold", size: 100, color: "#fff" } },
};

describe("pickTemplateFields", () => {
  it("OBS şifresini, sosyal hesapları, medya yollarını ve hedef tarihi asla almaz", () => {
    const p = pickTemplateFields(GERCEK);
    const json = JSON.stringify(p);
    expect(json).not.toContain("cok-gizli");
    expect(json).not.toContain("axthrowa");
    expect(json).not.toContain("video.mp4");
    expect(json).not.toContain("youtu.be");
    for (const k of ["obs", "socials", "bgVideoPath", "bgImage", "logo", "logoFile", "logoPath", "targetDate", "youtubeUrl"]) {
      expect(p, k).not.toHaveProperty(k);
    }
  });

  it("görünüm alanlarını alır", () => {
    const p = pickTemplateFields(GERCEK);
    expect(p.accent).toBe("#7c5cff");
    expect(p.font).toBe("bold");
    expect(p.logoZoom).toBe(120);
    expect(p.positions.title).toEqual({ x: 50, y: 40 });
  });

  it("taşınamayan arka plan (video) mix'e iner", () => {
    expect(pickTemplateFields(GERCEK).bgStyle).toBe("mix");
    expect(pickTemplateFields({ bgStyle: "dark" }).bgStyle).toBe("dark");
    expect(pickTemplateFields({ bgStyle: "youtube" }).bgStyle).toBe("mix");
  });

  it("metinler istenmezse dışarıda kalır", () => {
    const p = pickTemplateFields(GERCEK, false);
    expect(p).not.toHaveProperty("title");
    expect(pickTemplateFields(GERCEK, true).title).toBe("Benim yayınım");
  });

  it("derin kopya alır: kaynağı sonradan değişse şablon etkilenmez", () => {
    const src = { positions: { title: { x: 1, y: 2 } } };
    const p = pickTemplateFields(src);
    src.positions.title.x = 99;
    expect(p.positions.title.x).toBe(1);
  });

  it("iç içe gizli görünen anahtarı da düşürür (savunma katmanı)", () => {
    const p = pickTemplateFields({ textStyles: { title: { color: "#fff", apiToken: "x" } } });
    expect(JSON.stringify(p)).not.toContain("apiToken");
  });

  it("null/boş girdi patlatmaz", () => {
    expect(pickTemplateFields(null)).toEqual({});
    expect(pickTemplateFields(undefined)).toEqual({});
  });
});

describe("mergeTemplate", () => {
  it("elle bozulmuş şablon bile obs/socials yazamaz", () => {
    const zehirli = { accent: "#fff", obs: { password: "x" }, socials: { kick: "hacker" } };
    const r = mergeTemplate({ accent: "#000" }, zehirli, true);
    expect(r.next).toEqual({ accent: "#fff" });
    expect(forbiddenKeys(zehirli)).toEqual(["obs", "socials"]);
  });

  it("yalnız değişen alanları döner ve eski değeri saklar", () => {
    const r = mergeTemplate({ accent: "#000", font: "bold" }, { accent: "#111", font: "bold" });
    expect(r.changed).toEqual(["accent"]);
    expect(r.before).toEqual({ accent: "#000" });
  });

  it("konumları alt anahtar bazında birleştirir, olmayanı bozmaz", () => {
    const cur = { positions: { title: { x: 10, y: 10 }, logo: { x: 5, y: 5 } } };
    const r = mergeTemplate(cur, { positions: { title: { x: 50, y: 45 } } });
    expect(r.next.positions).toEqual({ title: { x: 50, y: 45 }, logo: { x: 5, y: 5 } });
  });

  it("textStyles'ta şablonun vermediği alt alan korunur", () => {
    const cur = { textStyles: { title: { font: "bold", size: 100, color: "#123456" }, sub: { size: 90 } } };
    const r = mergeTemplate(cur, { textStyles: { title: { effect: "neon" } } });
    expect(r.next.textStyles.title).toEqual({ font: "bold", size: 100, color: "#123456", effect: "neon" });
    expect(r.next.textStyles.sub).toEqual({ size: 90 });
  });

  it("geri alma: before'daki değerler mevcut ayara yazılınca eski hâl döner", () => {
    const cur = { accent: "#000", positions: { title: { x: 10, y: 10 } } };
    const r = mergeTemplate(cur, { accent: "#fff", positions: { title: { x: 50, y: 50 } } });
    const geri = { ...cur, ...r.next, ...r.before };
    expect(geri).toEqual(cur);
  });

  it("mevcut ayarda olmayan alan geri almada undefined olarak işaretlenir", () => {
    const r = mergeTemplate({}, { accent: "#fff" });
    expect("accent" in r.before).toBe(true);
    expect(r.before.accent).toBeUndefined();
  });

  it("metinler varsayılan olarak korunur", () => {
    const r = mergeTemplate({ title: "Benimki" }, { title: "Şablon", accent: "#fff" });
    expect(r.next).not.toHaveProperty("title");
    expect(mergeTemplate({ title: "Benimki" }, { title: "Şablon" }, true).next.title).toBe("Şablon");
  });
});

describe("hazır şablonlar", () => {
  it("her ekran için en az iki şablon var, kimlikler benzersiz", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of ["starting", "ending", "brb"] as const) {
      expect(builtinFor(s).length, s).toBeGreaterThanOrEqual(2);
    }
  });

  it("hiçbiri kişisel veri ya da medya yolu taşımaz", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(forbiddenKeys(t.settings), t.id).toEqual([]);
      expect(PORTABLE_BG.has(t.settings.bgStyle), t.id).toBe(true);
    }
  });

  it("yalnızca tanımlı yazı tipi, efekt, animasyon ve metin anahtarları kullanır", () => {
    const fonts = new Set(FONT_OPTIONS.map((f) => f.id));
    const efekt = new Set(EFFECT_OPTIONS.map((f) => f.id));
    const anim = new Set(ANIM_OPTIONS.map((f) => f.id));
    const anahtar = new Set<string>(TEXT_STYLE_KEYS);
    for (const t of BUILTIN_TEMPLATES) {
      expect(fonts.has(t.settings.font), `${t.id} font`).toBe(true);
      for (const [k, s] of Object.entries<any>(t.settings.textStyles || {})) {
        expect(anahtar.has(k), `${t.id} ${k}`).toBe(true);
        if (s.font) expect(fonts.has(s.font), `${t.id} ${k}.font`).toBe(true);
        if (s.effect) expect(efekt.has(s.effect), `${t.id} ${k}.effect`).toBe(true);
        if (s.anim) expect(anim.has(s.anim), `${t.id} ${k}.anim`).toBe(true);
      }
    }
  });

  it("renkler geçerli hex, konumlar 0-100 aralığında", () => {
    const hex = /^#[0-9a-f]{6}$/i;
    for (const t of BUILTIN_TEMPLATES) {
      for (const k of ["accent", "textColor", "eyebrowColor", "subColor", "countdownColor"]) {
        expect(t.settings[k], `${t.id} ${k}`).toMatch(hex);
      }
      for (const [k, p] of Object.entries<any>(t.settings.positions || {})) {
        expect(p.x, `${t.id} ${k}.x`).toBeGreaterThanOrEqual(0);
        expect(p.x, `${t.id} ${k}.x`).toBeLessThanOrEqual(100);
        expect(p.y, `${t.id} ${k}.y`).toBeGreaterThanOrEqual(0);
        expect(p.y, `${t.id} ${k}.y`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("pickTemplateFields'ten geçince değişmez (hepsi izin listesinde)", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(pickTemplateFields(t.settings, true), t.id).toEqual(t.settings);
    }
  });
});

describe("kullanıcı şablonları", () => {
  it("captureTemplate ismi kırpar, boşsa varsayılan verir ve sızıntı yapmaz", () => {
    const t = captureTemplate("starting", "   ", "", GERCEK);
    expect(t.name).toBe("Adsız şablon");
    expect(t.builtin).toBe(false);
    expect(JSON.stringify(t)).not.toContain("cok-gizli");
    expect(captureTemplate("brb", "x".repeat(100), "", {}).name).toHaveLength(40);
  });

  it("parseStoredTemplates bozuk kayıtları eler, izinsiz alanı temizler", () => {
    const list = parseStoredTemplates([
      { id: "a", name: "İyi", screen: "brb", settings: { accent: "#fff", obs: { password: "x" } } },
      { id: "b", name: "Ekransız", screen: "chat", settings: {} },
      { name: "İdsiz", screen: "brb", settings: {} },
      null,
      "çöp",
    ]);
    expect(list.map((t) => t.id)).toEqual(["a"]);
    expect(list[0].settings).toEqual({ accent: "#fff" });
    expect(parseStoredTemplates("dizi değil")).toEqual([]);
  });

  it("mergeTemplateLists aynı kimlikte sunucuyu tutar, eskiden yeniye sıralar", () => {
    const mk = (id: string, name: string, createdAt: number) => ({
      id, name, description: "", screen: "brb" as const, settings: {}, createdAt,
    });
    const r = mergeTemplateLists([mk("a", "sunucu", 5)], [mk("a", "yerel", 5), mk("b", "yerelB", 1)]);
    expect(r.map((t) => t.id)).toEqual(["b", "a"]);
    expect(r.find((t) => t.id === "a")?.name).toBe("sunucu");
  });
});
