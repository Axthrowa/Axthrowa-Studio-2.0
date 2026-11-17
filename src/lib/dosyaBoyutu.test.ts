// TEK-4: hiçbir arayüz bileşeni dosyası (Studio, bot paneli, Resonance) 800 satırı geçmez
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const kok = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SINIR = 800;

function bilesenler(d: string): string[] {
  return readdirSync(d).flatMap((ad) => {
    const p = join(d, ad);
    if (statSync(p).isDirectory()) return ad === "node_modules" ? [] : bilesenler(p);
    return /\.(tsx|jsx)$/.test(ad) && !/\.test\.(tsx|jsx)$/.test(ad) ? [p] : [];
  });
}

describe("arayüz dosyası boyutu", () => {
  for (const kaynak of ["src", "axbot/client/src", "resonance/src"]) {
    it(`${kaynak}: ${SINIR} satırı geçen bileşen yok`, () => {
      const dosyalar = bilesenler(join(kok, kaynak));
      expect(dosyalar.length).toBeGreaterThan(10);
      const buyuk = dosyalar
        .map((p) => [p.slice(kok.length), readFileSync(p, "utf8").split("\n").length] as const)
        .filter(([, n]) => n > SINIR);
      expect(buyuk).toEqual([]);
    });
  }
});
