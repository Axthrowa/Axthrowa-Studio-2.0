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
      ekle(metinMi(s, false), rel);
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

const sozlukYolu = path.join(kok, "src", "i18n", "sozluk.en.json");
const sozluk = fs.existsSync(sozlukYolu) ? JSON.parse(fs.readFileSync(sozlukYolu, "utf8")) : {};
const eksik = [...bulunan.keys()].filter((t) => !(t in sozluk));
if (process.argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(eksik.map((t) => [t, ""])), null, 1));
else {
  for (const t of eksik) console.log(`${bulunan.get(t)}\t${t}`);
  console.error(`Toplam ${bulunan.size} metin, sözlükte ${bulunan.size - eksik.length}, eksik ${eksik.length}`);
}
