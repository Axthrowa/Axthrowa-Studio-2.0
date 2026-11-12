import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_SKIN, STUDIO_SKINS, parseSkin } from "../lib/theme/ThemeContext";

// Vitest CSS dosyalarını `?raw` ile bile boş döndürüyor; dosyayı doğrudan okuyoruz.
const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const tw = readFileSync(new URL("../../tailwind.config.js", import.meta.url), "utf8");

/**
 * Tema sözleşmesi.
 *
 * Eskiden Crimson ve Cyber skin'leri yalnızca `--accent` ve `--eyebrow-color`
 * tanımlıyordu; yazı rengi (450 yerde `text-white`) hiç değişmiyordu ve yeni
 * bir skin eklerken neyin tanımlanması gerektiğini bilmenin yolu yoktu.
 *
 * Bu test `index.css`'i okuyup her skin için:
 *  1. zorunlu değişkenlerin tanımlı olduğunu,
 *  2. yazı / soluk yazı / vurgu rengi kontrastlarının okunabilir olduğunu
 * doğrular. Yeni skin eklendiğinde blok bu kurallara uymazsa test kırılır.
 */

type Vars = Record<string, string>;

/** Bir seçicinin süslü parantez bloğundaki `--x: y;` çiftlerini okur. */
function readVars(selectorPattern: RegExp): Vars | null {
  const m = selectorPattern.exec(css);
  if (!m) return null;
  const start = css.indexOf("{", m.index);
  const end = css.indexOf("\n}", start);
  const body = css.slice(start + 1, end);
  const out: Vars = {};
  // Yorumları at: içlerinde `;` ve `--` geçebiliyor.
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const mm of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[mm[1]] = mm[2].trim();
  }
  return out;
}

/** Sözleşmeye tabi tüm temalar. Yeni skin eklenince buraya da eklenir. */
const THEMES: { id: string; pattern: RegExp; base?: string }[] = [
  { id: "night-signal", pattern: /:root,\s*\n:root\[data-skin="night-signal"\]\s*\{/ },
  { id: "crimson-dragon", pattern: /:root\[data-skin="crimson-dragon"\]\s*\{/, base: "night-signal" },
  { id: "cyber-neon", pattern: /:root\[data-skin="cyber-neon"\]\s*\{/, base: "night-signal" },
  { id: "aurora", pattern: /:root\[data-skin="aurora"\]\s*\{/, base: "night-signal" },
  { id: "warm-sepia", pattern: /:root\[data-skin="warm-sepia"\]\s*\{/, base: "night-signal" },
  { id: "mono-contrast", pattern: /:root\[data-skin="mono-contrast"\]\s*\{/, base: "night-signal" },
  { id: "light", pattern: /:root\.theme-light\s*\{/, base: "night-signal" },
  // AxBoT panel temalarıyla eşleşenler
  { id: "gece-mavisi", pattern: /:root\[data-skin="gece-mavisi"\]\s*\{/, base: "night-signal" },
  { id: "neon-arcade", pattern: /:root\[data-skin="neon-arcade"\]\s*\{/, base: "night-signal" },
  { id: "murekkep", pattern: /:root\[data-skin="murekkep"\]\s*\{/, base: "night-signal" },
  { id: "gun-batimi", pattern: /:root\[data-skin="gun-batimi"\]\s*\{/, base: "night-signal" },
  { id: "orman", pattern: /:root\[data-skin="orman"\]\s*\{/, base: "night-signal" },
  { id: "seker", pattern: /:root\[data-skin="seker"\]\s*\{/, base: "night-signal" },
  { id: "gokkusagi", pattern: /:root\[data-skin="gokkusagi"\]\s*\{/, base: "night-signal" },
  { id: "tropik", pattern: /:root\[data-skin="tropik"\]\s*\{/, base: "night-signal" },
  { id: "gun-isigi", pattern: /:root\.theme-light\[data-skin="gun-isigi"\]\s*\{/, base: "light" },
];

/** Skin'in etkin değişkenleri: taban tema + kendi geçersiz kılmaları. */
function effective(id: string): Vars {
  const t = THEMES.find((x) => x.id === id)!;
  const own = readVars(t.pattern);
  if (!own) throw new Error(`${id} bloğu index.css'te bulunamadı`);
  return t.base ? { ...effective(t.base), ...own } : own;
}

/* ------------------------------------------------------------ renk okuma */

type RGB = [number, number, number];

function parseColor(raw: string, over?: RGB): RGB {
  const v = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgba = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/i.exec(v);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
    if (a < 1 && over) {
      // Yarı saydam renk zeminin üzerinde nasıl görünüyorsa öyle ölç.
      return [r * a + over[0] * (1 - a), g * a + over[1] * (1 - a), b * a + over[2] * (1 - a)];
    }
    return [r, g, b];
  }
  const triple = /^(\d+)\s+(\d+)\s+(\d+)$/.exec(v);
  if (triple) return [Number(triple[1]), Number(triple[2]), Number(triple[3])];
  throw new Error(`Renk çözümlenemedi: "${raw}"`);
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------------------------------------------------------------- testler */

const REQUIRED = ["--panel-bg", "--panel-muted", "--panel-accent", "--fg-rgb", "--accent-rgb", "--accent-text-rgb"];

describe.each(THEMES)("tema sözleşmesi — $id", ({ id }) => {
  const v = effective(id);

  it("zorunlu değişkenlerin hepsi tanımlı", () => {
    for (const key of REQUIRED) {
      expect(v[key], `${id}: ${key} tanımlı değil`).toBeTruthy();
    }
  });

  it("yazı rengi zeminde rahat okunur (≥ 7:1)", () => {
    const bg = parseColor(v["--panel-bg"]);
    expect(contrast(parseColor(v["--fg-rgb"]), bg)).toBeGreaterThanOrEqual(7);
  });

  it("soluk yazı (etiketler) WCAG AA eşiğini geçer (≥ 4.5:1)", () => {
    // 10-11px etiketler bu renkle yazılıyor: eşik altında kalan tema okunmaz.
    const bg = parseColor(v["--panel-bg"]);
    const muted = parseColor(v["--panel-muted"], bg);
    expect(contrast(muted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("metin vurgusu zeminde okunur (≥ 4.5:1)", () => {
    // `text-teal-400` bunu kullanıyor. Açık temada parlak turkuaz beyaz
    // zeminde 1.3:1 veriyordu — ayrı `--accent-text-rgb` bu yüzden var.
    const bg = parseColor(v["--panel-bg"]);
    expect(contrast(parseColor(v["--accent-text-rgb"]), bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("tema sözleşmesi — bağlantılar", () => {
  it("Tailwind `white` rengi temaya bağlı", () => {
    expect(tw).toMatch(/white:\s*"rgb\(var\(--fg-rgb/);
  });

  it("temadan bağımsız sabit beyaz için `pure-white` var", () => {
    expect(tw).toMatch(/"pure-white":\s*"#ffffff"/);
  });

  it("metin vurgusu ile dolgu vurgusu ayrı değişkenlerden besleniyor", () => {
    expect(tw).toMatch(/400:\s*"rgb\(var\(--accent-text-rgb/);
    expect(tw).toMatch(/500:\s*"rgb\(var\(--accent-rgb/);
  });

  it("açık tema skin bloklarını ezecek özgüllükte ve sırada", () => {
    // Regresyon: `html.theme-light` (0,1,1), `:root[data-skin=…]` (0,2,0)
    // karşısında kaybediyordu; uygulama data-skin'i hep yazdığı için açık tema
    // gerçekte hiç uygulanmıyordu.
    expect(css).toMatch(/:root\.theme-light\s*\{/);
    expect(css).not.toMatch(/^html\.theme-light\s*\{/m);
    const acik = css.search(/:root\.theme-light\s*\{/);
    for (const skin of ["night-signal", "crimson-dragon", "cyber-neon", "aurora", "warm-sepia", "mono-contrast"]) {
      const i = css.indexOf(`:root[data-skin="${skin}"]`);
      expect(i, skin).toBeGreaterThanOrEqual(0);
      // Eşit özgüllükte sonraki kural kazanır: açık blok skinlerden sonra gelmeli.
      expect(acik, skin).toBeGreaterThan(i);
    }
  });

  it("açık temanın eski `.text-white` telafisi geri gelmemiş", () => {
    // Bu kural `!important` ile yazıyı zorla koyu yapıyordu; artık gereksiz
    // ve skin değişimini eziyor.
    expect(css).not.toMatch(/html\.theme-light\s+\.text-white\s*\{/);
  });
});

describe("skin listesi", () => {
  it("listedeki her skinin CSS bloğu var ve sözleşme testine tabi", () => {
    // Listeye skin eklenip CSS'i unutulursa seçici boş bir tema gösterirdi;
    // CSS'e blok eklenip THEMES'e yazılmazsa kontrast denetimi atlanırdı.
    for (const s of STUDIO_SKINS) {
      expect(css, s.id).toContain(`[data-skin="${s.id}"]`);
      expect(
        THEMES.some((t) => t.id === s.id),
        `${s.id} THEMES listesinde yok`
      ).toBe(true);
    }
  });

  it("skin kimlikleri benzersiz ve önizleme renkleri geçerli", () => {
    const ids = STUDIO_SKINS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STUDIO_SKINS) {
      for (const c of s.swatch) expect(c, s.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("parseSkin: bilinen kimliği korur, bilinmeyeni varsayılana düşürür", () => {
    for (const s of STUDIO_SKINS) expect(parseSkin(s.id)).toBe(s.id);
    expect(parseSkin("aurora")).toBe("aurora");
    expect(parseSkin("yok-boyle-skin")).toBe(DEFAULT_SKIN);
    expect(parseSkin(null)).toBe(DEFAULT_SKIN);
    expect(parseSkin(42)).toBe(DEFAULT_SKIN);
  });
});

describe("okunabilirlik", () => {
  it("koyu temalarda %50 beyaz yazı bile AA eşiğini geçer", () => {
    // Bu yüzden kaynakta %50'nin altında `text-white/N` yasak (aşağıdaki test).
    for (const id of ["night-signal", "crimson-dragon", "cyber-neon", "aurora", "warm-sepia", "mono-contrast", "gece-mavisi", "neon-arcade", "murekkep", "gun-batimi", "orman"]) {
      const v = effective(id);
      const bg = parseColor(v["--panel-bg"]);
      const fg = parseColor(v["--fg-rgb"]);
      const yariSaydam: RGB = [fg[0] * 0.5 + bg[0] * 0.5, fg[1] * 0.5 + bg[1] * 0.5, fg[2] * 0.5 + bg[2] * 0.5];
      expect(contrast(yariSaydam, bg), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("açık temada yükseltilmiş ikincil yazı (%72) beyaz kartta AA'yı geçer", () => {
    const v = effective("light");
    const bg = parseColor(v["--panel-card"]);
    const fg = parseColor(v["--fg-rgb"]);
    const a = 0.72;
    const karisim: RGB = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    expect(contrast(karisim, bg)).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain(":root.theme-light .text-white\\/50");
  });

  it("Gün Işığı: %72 ikincil yazı beyaz kartta, koyu yazı dolgu vurgusunda AA'yı geçer", () => {
    const v = effective("gun-isigi");
    const kart = parseColor(v["--panel-card"]);
    const fg = parseColor(v["--fg-rgb"]);
    const a = 0.72;
    const karisim: RGB = [fg[0] * a + kart[0] * (1 - a), fg[1] * a + kart[1] * (1 - a), fg[2] * a + kart[2] * (1 - a)];
    expect(contrast(karisim, kart)).toBeGreaterThanOrEqual(4.5);
    // Etkin sekme / birincil düğme: dolgu vurgusu üstünde #08131c yazı
    expect(contrast(parseColor("#08131c"), parseColor(v["--accent-rgb"]))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor(v["--panel-cta-ink"]), parseColor(v["--panel-cta"]))).toBeGreaterThanOrEqual(4.5);
  });

  it("koyu skinlerde vurgu yazı olarak ve dolgu üstündeki koyu yazı okunur", () => {
    // `text-panel-accent` koyu temada --accent-rgb'yi yazı rengi olarak kullanıyor
    for (const id of ["gece-mavisi", "neon-arcade", "murekkep", "gun-batimi", "orman"]) {
      const v = effective(id);
      const bg = parseColor(v["--panel-bg"]);
      const vurgu = parseColor(v["--accent-rgb"]);
      expect(contrast(vurgu, bg), id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parseColor(v["--panel-cta-ink"]), parseColor(v["--panel-cta"])), id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parseColor("#08131c"), vurgu), id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("kaynakta %50'nin altında düz `text-white/N` kalmamış", () => {
    // Regresyon kilidi: `text-white/40` koyu zeminde 3.8:1 veriyordu.
    // Varyantlı olanlar (placeholder:, disabled:) bilinçli soluk kalabilir.
    const kok = new URL("../", import.meta.url);
    const sorunlar: string[] = [];
    for (const rel of readdirSync(kok, { recursive: true })) {
      if (!/\.(tsx|ts|css)$/.test(rel) || /\.test\.ts$/.test(rel)) continue;
      const metin = readFileSync(new URL(rel, kok), "utf8");
      for (const m of metin.matchAll(/(?<![:\w-])text-white\/(\d+)(?![\d.\]])/g)) {
        if (Number(m[1]) < 50) sorunlar.push(`${rel}: ${m[0]}`);
      }
    }
    expect(sorunlar).toEqual([]);
  });
});

describe("performans", () => {
  it("panel kartları (studio-card/stat/settings-panel) backdrop-blur kullanmıyor", () => {
    // Şeffaf kartların arkasını her karede bulanıklaştırmak WebView2'de kaydırmayı
    // ve canlı önizleme üzerindeki çizimi yavaşlatıyordu; görsel katkısı yoktu.
    for (const cls of ["studio-card", "studio-stat", "studio-settings-panel"]) {
      const m = new RegExp("\\." + cls + "\\s*\\{[^}]*\\}").exec(css);
      expect(m, cls).not.toBeNull();
      expect(m![0], cls).not.toMatch(/backdrop-blur/);
    }
  });
});
