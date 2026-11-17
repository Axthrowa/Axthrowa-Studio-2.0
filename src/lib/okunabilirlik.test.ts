// UI-9: üç arayüzde en küçük yazı 12 px, mikro etiket büyük harf değil, odak halkası 3 px
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kok = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const oku = (p: string) => readFileSync(join(kok, p), "utf8");

function dosyalar(yol: string): string[] {
  const p = join(kok, yol);
  if (!statSync(p).isDirectory()) return [yol];
  return readdirSync(p).flatMap((ad) => dosyalar(`${yol}/${ad}`)).filter((f) => /\.(tsx|jsx)$/.test(f) && !/\.test\./.test(f));
}

// Yayın çıktısı (OBS katmanları, widget'lar) bilinçli olarak dışarıda: orada boyutu yayıncı seçer
const ARAYUZ = [
  "src/components/axthrowa", "src/components/control", "src/components/panel", "src/components/studio", "src/components/ui",
  "src/routes/panel", "src/routes/remote",
  "axbot/client/src/pages", "axbot/client/src/components", "axbot/client/src/ui",
  "resonance/src/components/layout", "resonance/src/components/ui", "resonance/src/pages/connections", "resonance/src/pages/widgets",
];

describe("okunabilirlik", () => {
  it("arayüzde 8–11 px yazı sınıfı yok", () => {
    const sorun = ARAYUZ.flatMap(dosyalar).flatMap((f) =>
      [...oku(f).matchAll(/(?<![\w-])(text-\[(?:8|9|10|11)px\]|text-ui-1)(?![\w-])/g)].map((m) => `${f}: ${m[1]}`),
    );
    expect(sorun).toEqual([]);
  });

  it("arayüz etiketleri büyük harfle yazılmaz (komut paleti 'axt-etiket' işaretini arar)", () => {
    // Tek başına 'uppercase' dizesi (seçenek değeri) ve `uppercase:` anahtarı sınıf değil
    const sorun = ARAYUZ.flatMap(dosyalar).filter((f) => /(?<![\w:'"-])uppercase(?![\w:'"-])/.test(oku(f)));
    expect(sorun).toEqual([]);
  });

  it("odak halkası üç arayüzde 3 px", () => {
    expect(oku("src/styles/index.css")).toMatch(/:root :focus-visible \{\s*outline: 3px/);
    expect(oku("axbot/client/src/index.css")).toMatch(/\.axt-panel :focus-visible[^{]*\{ outline: 3px/);
    expect(oku("resonance/src/index.css")).toMatch(/:focus-visible \{ outline: 3px/);
  });

  it("sayısal alanlar eşit genişlikte rakam kullanır", () => {
    expect(oku("ortak/tasarim.css")).toMatch(/input\[type="number"\] \{ font-variant-numeric: tabular-nums; \}/);
  });
});
