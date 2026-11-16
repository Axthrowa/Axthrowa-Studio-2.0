#!/usr/bin/env node
/**
 * F0-3: Arayüzlerin kullandığı yazı tiplerini Google Fonts'tan BİR KEZ indirip pakete koyar; çalışırken ağ gerekmez.
 * Yalnız woff2 ve latin + latin-ext alt kümeleri (Türkçe harfler latin-ext'te).
 *
 *   node scripts/yazi-tiplerini-indir.mjs          # eksikleri indirir, CSS'leri yeniden yazar
 *
 * Çıktı: <paket>/public/fonts/<aile>/*.woff2 ve <paket>/public/fonts/yazi-tipleri.css
 * Yeni yazı tipi: aşağıdaki listeye (ya da botun FONTS listesine) ekleyip betiği yeniden koşturun.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGIRLIKLAR = [300, 400, 500, 600, 700, 800];
const ALT_KUMELER = new Set(["latin", "latin-ext"]);
// woff2 dönmesi için güncel bir tarayıcı kimliği gerekir
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// Botun widget yazı tipi seçicisi: tek kaynak widget-defaults.ts
function botFontlari() {
  const s = readFileSync(join(KOK, "axbot/client/src/lib/widget-defaults.ts"), "utf8");
  const blok = s.slice(s.indexOf("export const FONTS"), s.indexOf("];", s.indexOf("export const FONTS")));
  return [...blok.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const PAKETLER = {
  "public/fonts": ["Inter", "JetBrains Mono", "Anton", "Bebas Neue", "Black Ops One", "Caveat", "Nunito", "Oxanium", "Oswald", "Outfit", "Playfair Display", "Plus Jakarta Sans", "Press Start 2P", "Space Grotesk", "VT323"],
  "resonance/public/fonts": ["DM Sans", "Inter", "JetBrains Mono", "Nunito", "Oswald", "Outfit", "Poppins", "Roboto Mono", "Space Grotesk", "Oxanium", "Tektur", "Josefin Sans", "Great Vibes", "Kaushan Script", "Luckiest Guy", "Lilita One", "Cinzel Decorative", "Metal Mania", "Courier Prime", "Rubik", "Manrope", "Sora", "Lexend", "Barlow Condensed", "Bebas Neue", "Anton", "Orbitron", "Exo 2", "Rajdhani", "Pixelify Sans", "Press Start 2P", "VT323", "Caveat", "Kalam", "Playfair Display", "Fredoka"],
  "axbot/client/public/fonts": [...new Set(["Plus Jakarta Sans", "JetBrains Mono", ...botFontlari()])],
};

const slug = (ad) => ad.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Bir ağırlığın @font-face blokları (yalnız istenen alt kümeler); ağırlık yoksa boş. */
async function agirlikBloklari(aile, w) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(aile).replace(/%20/g, "+")}:wght@${w}&display=swap`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (r.status === 400) return []; // bu ağırlık bu ailede yok
  if (!r.ok) throw new Error(`${aile} ${w}: HTTP ${r.status}`);
  const css = await r.text();
  const bloklar = [];
  for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)) {
    if (!ALT_KUMELER.has(m[1])) continue;
    const kaynak = m[2].match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (kaynak) bloklar.push({ altKume: m[1], kaynak, govde: m[2] });
  }
  return bloklar;
}

const indirilen = new Map(); // kaynak url → dosya adı (paketler arasında yeniden indirmez)

async function aileyiHazirla(aile, hedefKok) {
  const klasor = join(hedefKok, slug(aile));
  mkdirSync(klasor, { recursive: true });
  const kurallar = [];
  for (const w of AGIRLIKLAR) {
    for (const b of await agirlikBloklari(aile, w)) {
      const dosya = `${slug(aile)}-${b.altKume}-${b.kaynak.split("/").pop().replace(/\.woff2$/, "").slice(-10)}.woff2`;
      const yol = join(klasor, dosya);
      if (!existsSync(yol)) {
        let veri = indirilen.get(b.kaynak);
        if (!veri) {
          const r = await fetch(b.kaynak, { headers: { "User-Agent": UA } });
          if (!r.ok) throw new Error(`${aile}: dosya HTTP ${r.status}`);
          veri = Buffer.from(await r.arrayBuffer());
          indirilen.set(b.kaynak, veri);
        }
        writeFileSync(yol, veri);
      }
      kurallar.push(b.govde.replace(/url\([^)]+\)/, `url(./${slug(aile)}/${dosya})`));
    }
  }
  if (!kurallar.length) throw new Error(`${aile}: Google Fonts'ta bulunamadı`);
  return `/* ${aile} */\n${[...new Set(kurallar)].join("\n")}`;
}

for (const [hedef, aileler] of Object.entries(PAKETLER)) {
  const hedefKok = join(KOK, hedef);
  mkdirSync(hedefKok, { recursive: true });
  const parcalar = [];
  for (const aile of aileler) {
    parcalar.push(await aileyiHazirla(aile, hedefKok));
    process.stdout.write(".");
  }
  writeFileSync(join(hedefKok, "yazi-tipleri.css"), `/* Üretildi: scripts/yazi-tiplerini-indir.mjs — elle düzenlemeyin */\n${parcalar.join("\n")}\n`);
  console.log(`\n${hedef}: ${aileler.length} aile`);
}
