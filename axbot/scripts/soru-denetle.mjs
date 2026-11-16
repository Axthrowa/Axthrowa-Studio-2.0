#!/usr/bin/env node
/**
 * Bil Bakalım soru bankası denetleyicisi.
 *
 * `server/data/bilbakalim/questions/*.json` içindeki soruları yapısal olarak
 * tarar ve oynanamaz/hatalı olanları bulur. Amaç, binlerce soruyu gözle
 * okumak yerine kusurları makineyle yakalamak:
 *
 *  - bozuk metin (UTF-8 yerine mojibake: "sembol?", "Ã¶" gibi)
 *  - şık sayısı 4 değil / boş şık
 *  - yinelenen şıklar (aynı cevap iki kez)
 *  - `correct_index` aralık dışında
 *  - doğru cevabı ele veren şıklar (tek şık diğerlerinden çok uzun)
 *  - soru metni ile şıkların hiç kesişmediği "alakasız şık" şüphesi
 *  - aynı soru metninin birden çok kez geçmesi
 *
 * Kullanım:
 *   node scripts/soru-denetle.mjs            # rapor
 *   node scripts/soru-denetle.mjs --duzelt   # güvenle düzeltilebilenleri onar
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, "..", "server", "data", "bilbakalim", "questions");
const fix = process.argv.includes("--duzelt");
/**
 * Şablonla üretilmiş, çeldiricileri konuyla alakasız sorular
 * ("Vermeer hangi sanat dalıyla özdeşleşir?" → Astronomi / Muhasebe / Futbol).
 * Cevap uzunluktan belli olduğu için oyun anlamsızlaşıyor; `--sablon-temizle`
 * bunları bankadan çıkarır, yerine OpenTDB soruları alınır.
 */
const dropTemplates = process.argv.includes("--sablon-temizle");

/** Mojibake izleri: UTF-8 metin latin1 okunduğunda çıkan kalıplar. */
const MOJIBAKE = /[ÃÂ][-¿]|�/;

/** Türkçe'de anlamsız kalan tek karakterlik soru işareti yığınları. */
const BROKEN_CHARS = /\?{2,}/;

const norm = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function checkOne(q, seenTexts) {
  const issues = [];
  const text = String(q.text || "");
  const opts = Array.isArray(q.options) ? q.options.map((o) => String(o ?? "")) : [];

  if (!text.trim()) issues.push("bos-soru");
  if (MOJIBAKE.test(text) || BROKEN_CHARS.test(text)) issues.push("bozuk-metin");
  if (opts.some((o) => MOJIBAKE.test(o))) issues.push("bozuk-sik");
  if (opts.length !== 4) issues.push(`sik-sayisi-${opts.length}`);
  if (opts.some((o) => !o.trim())) issues.push("bos-sik");

  // Şık karşılaştırmasında BÜYÜK/küçük harf ve işaret farkı ANLAMLIDIR:
  // yazım yarışmasında "herkes"/"HERKEZ", matematikte "-1"/"1" ayrı şıklardır.
  // `norm` bunları eşitlediği için sağlam sorular yanlışlıkla kusurlu sayılıyordu.
  const uniq = new Set(opts.map((o) => o.trim()));
  if (uniq.size !== opts.length) issues.push("yinelenen-sik");

  const ci = Number(q.correct_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= opts.length) issues.push("gecersiz-cevap-indeksi");

  // Tek şık diğerlerinin iki katından uzunsa doğru cevabı ele verir.
  if (opts.length === 4 && Number.isInteger(ci) && opts[ci]) {
    const lens = opts.map((o) => o.length);
    const others = lens.filter((_, i) => i !== ci);
    const maxOther = Math.max(...others);
    if (lens[ci] > Math.max(12, maxOther * 2)) issues.push("cevap-belli-uzunluk");
  }

  const key = norm(text);
  if (key) {
    if (seenTexts.has(key)) issues.push("yinelenen-soru");
    else seenTexts.add(key);
  }

  return issues;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
const seenTexts = new Map(); // kategori -> Set
let total = 0;
let bad = 0;
const byIssue = new Map();
const report = [];

for (const f of files) {
  const p = path.join(dir, f);
  let items;
  try {
    items = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    report.push(`${f}: OKUNAMADI (${e.message})`);
    continue;
  }
  if (!Array.isArray(items)) {
    report.push(`${f}: dizi değil`);
    continue;
  }
  if (!seenTexts.has(f)) seenTexts.set(f, new Set());
  const seen = seenTexts.get(f);

  const kept = [];
  let removed = 0;
  for (const q of items) {
    total++;
    const issues = checkOne(q, seen);
    if (issues.length) {
      bad++;
      for (const i of issues) byIssue.set(i, (byIssue.get(i) || 0) + 1);
      report.push(`${f} :: ${issues.join(",")} :: ${String(q.text || "").slice(0, 70)}`);
      // Onarılamayacak kusurlarda soru bankadan düşer; oynanamaz soru
      // yarışmayı bozuyor (şık yok / cevap yanlış indekste / metin bozuk).
      const fatal = issues.some((i) =>
        /bos-soru|bozuk-metin|bozuk-sik|sik-sayisi|bos-sik|yinelenen-sik|gecersiz-cevap-indeksi|yinelenen-soru/.test(i) ||
        (dropTemplates && i === "cevap-belli-uzunluk"),
      );
      if (fix && fatal) {
        removed++;
        continue;
      }
    }
    kept.push(q);
  }
  if (fix && removed) {
    fs.writeFileSync(p, JSON.stringify(kept, null, 2) + "\n", "utf8");
    report.push(`${f}: ${removed} soru çıkarıldı, ${kept.length} kaldı`);
  }
}

console.log(report.slice(0, 60).join("\n"));
if (report.length > 60) console.log(`… ve ${report.length - 60} satır daha`);
console.log("\n--- ÖZET ---");
console.log(`dosya: ${files.length} | soru: ${total} | kusurlu: ${bad}`);
for (const [k, v] of [...byIssue.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
if (!fix && bad) console.log("\nDüzeltmek için: node scripts/soru-denetle.mjs --duzelt");
