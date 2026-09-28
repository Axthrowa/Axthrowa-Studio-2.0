/**
 * Bağımlılık lisans bekçisi (panel + Resonance npm ağaçları). Ürün GPL-2.0-or-later (ADR-005): bağımlılık bununla
 * uyumlu olmalı. AGPL, SSPL, GPL-2.0-only (Apache-2.0 ile birleşemez) ve tescilli lisans getiren bir güncelleme testi
 * kırar; karar ürün sahibinindir (docs/LICENSE_AND_DEPENDENCY_REVIEW.md).
 * Rust crate'leri için: `node scripts/lisans-denetimi.mjs` (cargo metadata, çevrimdışı; panel + motor).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const IZINLI = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0", // yalnız veri paketi (caniuse-lite) — atıf
  "MPL-2.0", // dosya düzeyinde zayıf copyleft; değiştirilmeden kullanılıyor
  "BlueOak-1.0.0",
  // GPL-2.0-or-later ürünle uyumlu copyleft lisanslar (ADR-005 §3)
  "LGPL-2.1-or-later",
  "LGPL-3.0-or-later",
  "GPL-2.0-or-later",
  "GPL-3.0-or-later",
]);

/** Kilit dosyasında `license` alanı olmayan (eski `licenses` dizisi) ve LICENSE metni elle doğrulanmış paketler. */
const ELLE_DOGRULANDI: Record<string, string> = {
  "xmlhttprequest-ssl": "MIT", // package.json "licenses" dizisi + LICENSE metni MIT (2026-09-26)
};

function lisansUygun(ifade: string): boolean {
  const parca = ifade.replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/);
  let i = 0;
  const birim = (): boolean => {
    const t = parca[i++];
    if (t === "(") {
      const v = veya();
      i++;
      return v;
    }
    return IZINLI.has(t ?? "");
  };
  const ve = (): boolean => {
    let v = birim();
    while (parca[i] === "AND") {
      i++;
      v = birim() && v;
    }
    return v;
  };
  const veya = (): boolean => {
    let v = ve();
    while (parca[i] === "OR") {
      i++;
      v = ve() || v;
    }
    return v;
  };
  return veya() && i === parca.length;
}

function sorunlular(kilit: URL): string[] {
  const paketler = JSON.parse(readFileSync(kilit, "utf8")).packages as Record<string, { version?: string; license?: unknown; link?: boolean }>;
  const out: string[] = [];
  for (const [yol, p] of Object.entries(paketler)) {
    if (!yol.includes("node_modules/") || p.link) continue;
    const ad = yol.slice(yol.lastIndexOf("node_modules/") + "node_modules/".length);
    const lisans = typeof p.license === "string" ? p.license : ELLE_DOGRULANDI[ad] || "";
    if (!lisansUygun(lisans)) out.push(`${ad}@${p.version} → ${lisans || "lisans yok"}`);
  }
  return out;
}

describe("lisansUygun", () => {
  it("SPDX ifadeleri", () => {
    expect(lisansUygun("MIT")).toBe(true);
    expect(lisansUygun("Apache-2.0 OR MIT")).toBe(true);
    expect(lisansUygun("MIT AND ISC")).toBe(true);
    expect(lisansUygun("(MIT OR CC0-1.0)")).toBe(true);
    expect(lisansUygun("AGPL-3.0-only")).toBe(false);
    expect(lisansUygun("MIT AND GPL-2.0-only")).toBe(false);
    expect(lisansUygun("GPL-3.0-or-later")).toBe(true);
    expect(lisansUygun("SSPL-1.0")).toBe(false);
    expect(lisansUygun("")).toBe(false);
  });
});

describe("npm bağımlılık lisansları", () => {
  it.each([
    ["panel", "../../package-lock.json"],
    ["resonance", "../../resonance/package-lock.json"],
  ])("%s: izin listesi dışı lisans yok", (_, yol) => {
    expect(sorunlular(new URL(yol, import.meta.url))).toEqual([]);
  });
});
