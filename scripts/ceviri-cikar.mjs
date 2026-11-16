/**
 * Y15: arayüzdeki Türkçe metinleri çıkarır ve `src/i18n/sozluk.en.json` içinde karşılığı olmayanları listeler.
 *
 *   node scripts/ceviri-cikar.mjs            eksikleri yazar (çıkış kodu 0)
 *   node scripts/ceviri-cikar.mjs --json     eksikleri JSON nesnesi olarak basar ({"metin": ""})
 *
 * Toplanan: JSX metni, JSX nitelik değerleri ve Türkçe harf içeren dizgiler; şablon dizgilerde `${...}` yerine {0}, {1}…
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const TR = /[çğıöşüÇĞİÖŞÜ]/;
const KOD = /^[\w.-]+$|^[a-z0-9-]+(\s+[a-z0-9:/[\]#.%()-]+)+$|^(https?:|\/|\.\/|#)|\{\{|=>|^\s*$/;

function metinMi(s, jsx) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 2 || !/\p{L}/u.test(t)) return null;
  if (TR.test(t)) return t;
  // Türkçe harfsiz kısa kelimeler (Ekle, Sil, Kapat): yalnız JSX'te ve büyük harfle başlıyorsa
  if (jsx && /^\p{Lu}/u.test(t) && (!KOD.test(t) || /^\p{Lu}\p{Ll}+$/u.test(t))) return t;
  return null;
}

const bulunan = new Map();
function ekle(t, dosya) {
  if (t && !bulunan.has(t)) bulunan.set(t, dosya);
}

const KOD_SABLON = /^(Bearer|Key|Digit|F|PASS oauth:|NICK|PRIVMSG|JOIN|PONG|HTTP|OAuth|Ctrl\+|Control\+|M) ?[{#]/;
const NITELIK = new Set(["title", "aria-label", "placeholder", "alt", "label", "description", "confirmLabel", "cancelLabel", "etiket", "ad", "baslik", "aciklama"]);

function gez(dosya) {
  const kaynak = fs.readFileSync(dosya, "utf8");
  const sf = ts.createSourceFile(dosya, kaynak, ts.ScriptTarget.Latest, true, dosya.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(kok, dosya);
  const ziyaret = (n) => {
    if (ts.isJsxText(n)) ekle(metinMi(n.text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"), true), rel);
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const p = n.parent;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return;
      // gunluk/console/hata kayıtları arayüz değil
      const cagri = p && ts.isCallExpression(p) ? p.expression.getText(sf) : "";
      if (/^(console|gunluk)\./.test(cagri)) return;
      const jsx = (p && ts.isJsxAttribute(p) && NITELIK.has(p.name.getText(sf))) || (p && ts.isPropertyAssignment(p) && NITELIK.has(p.name.getText(sf)));
      ekle(metinMi(n.text, jsx), rel);
    } else if (ts.isTemplateExpression(n)) {
      let s = n.head.text;
      n.templateSpans.forEach((sp, i) => (s += `{${i}}` + sp.literal.text));
      // Türkçe harfsiz şablonlar da ("Eklenemedi: {0}") büyük harfle başlıyorsa alınır; protokol/tuş/başlık kalıpları hariç
      if (!KOD_SABLON.test(s)) ekle(metinMi(s, true), rel);
    }
    ts.forEachChild(n, ziyaret);
  };
  ziyaret(sf);
}

function dolas(d) {
  for (const g of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, g.name);
    if (g.isDirectory()) dolas(p);
    else if (/\.(ts|tsx)$/.test(g.name) && !/\.test\.|\.d\.ts$/.test(g.name)) gez(p);
  }
}
dolas(path.join(kok, "src"));
for (const [t, d] of bulunan) if (d.includes(`i18n${path.sep}`)) bulunan.delete(t);

// Rust: arayüze hata/durum olarak dönen dizgiler (format yer tutucuları {0}, {1}…). Günlük satırları ve test modülleri hariç.
// Yerel pencere metinleri (tepsi menüsü, kapatma sorusu) DOM'da değil, çevrilmez: RUST_HARIC.
const RUST_HARIC = new Set(["lib.rs", "close_prompt.rs", "single_instance.rs"]);
const GUNLUK = /studio_(warn|info|error|debug)!|log::|tracing::|e?println!|debug!|warn!|info!|panic!|expect\(|assert/;
function rustGez(d) {
  for (const g of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, g.name);
    if (g.isDirectory()) rustGez(p);
    else if (g.name.endsWith(".rs") && !RUST_HARIC.has(g.name)) {
      const govde = fs.readFileSync(p, "utf8").split("#[cfg(test)]")[0];
      for (const sat of govde.split("\n")) {
        const s = sat.trim();
        if (s.startsWith("//") || GUNLUK.test(s)) continue;
        for (const m of s.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
          // "[kick] …" gibi etiketli dizgiler günlük satırıdır
          if (!TR.test(m[1]) || m[1].length < 3 || /^\[[\w-]+\]/u.test(m[1]) || /^\[\p{L}+\]/u.test(m[1])) continue;
          let i = 0;
          ekle(m[1].replace(/\{[\w.:?#]*\}/g, () => `{${i++}}`).replace(/\\"/g, '"').replace(/\\n/g, "\n"), path.relative(kok, p));
        }
      }
    }
  }
}
rustGez(path.join(kok, "src-tauri", "src"));

const sozlukYolu = path.join(kok, "src", "i18n", "sozluk.en.json");
const sozluk = fs.existsSync(sozlukYolu) ? JSON.parse(fs.readFileSync(sozlukYolu, "utf8")) : {};
const eksik = [...bulunan.keys()].filter((t) => !(t in sozluk));
if (process.argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(eksik.map((t) => [t, ""])), null, 1));
else {
  for (const t of eksik) console.log(`${bulunan.get(t)}\t${t}`);
  console.error(`Toplam ${bulunan.size} metin, sözlükte ${bulunan.size - eksik.length}, eksik ${eksik.length}`);
}
