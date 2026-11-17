// UI-1: tasarım sistemi tek kaynak (ortak/tasarim.css) ve Studio panelinde sabit renk sınırı
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kok = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const oku = (p: string) => readFileSync(join(kok, p), "utf8");

function tsxDosyalari(d: string): string[] {
  return readdirSync(d).flatMap((ad) => {
    const p = join(d, ad);
    if (statSync(p).isDirectory()) return tsxDosyalari(p);
    return /\.tsx$/.test(ad) && !/\.test\./.test(ad) ? [p] : [];
  });
}

describe("ortak tasarım belirteçleri", () => {
  it("4 düğme türü, 3 başlık düzeyi, renk rolleri ve ölçekler tek dosyada", () => {
    const css = oku("ortak/tasarim.css");
    for (const s of [".axt-dugme-birincil", ".axt-dugme-ikincil", ".axt-dugme-sessiz", ".axt-dugme-tehlike", ".axt-baslik-1", ".axt-baslik-2", ".axt-baslik-3"])
      expect(css).toContain(s);
    for (const d of ["--axt-vurgu:", "--axt-vurgu-metin:", "--axt-tehlike:", "--axt-yuzey-2:", "--axt-bosluk-4:", "--axt-dugme-y:", "--axt-dugme-yaricap:"])
      expect(css).toContain(d);
  });

  it("Studio, AxBoT ve Resonance düğmeleri aynı sınıfları kullanır", () => {
    expect(oku("src/styles/ust-serit.css")).toMatch(/--axt-dugme-y: var\(--ctl\)/);
    expect(oku("axbot/client/src/ui/index.tsx")).toContain("axt-dugme ${TON[ton]}");
    expect(oku("resonance/src/components/ui/Button.jsx")).toContain("axt-dugme axt-dugme-buyuk");
  });

  // Yayına çizilen widget ve katmanlar (components/widgets, components/overlay, önizleme içeriği) ve görünüm
  // paletleri (lib/theme) kullanıcı içeriğidir; sayılmaz. Kalanlar marka rengi (Discord) ve kullanıcı ayarı varsayılanları.
  it("Studio panelinde sabit renk sayısı 40'ın altında", () => {
    const disarida = /(components[\\/](widgets|overlay)|lib[\\/]theme)[\\/]|previewContent/;
    const renk = /#[0-9a-fA-F]{3,8}\b|rgba?\((?!var)[^)]*\)/g;
    const sayim = tsxDosyalari(join(kok, "src"))
      .filter((p) => !disarida.test(p))
      .reduce((n, p) => n + (readFileSync(p, "utf8").match(renk)?.length ?? 0), 0);
    expect(sayim).toBeLessThan(40);
  });
});
