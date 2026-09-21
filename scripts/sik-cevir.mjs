#!/usr/bin/env node
/**
 * OpenTDB'den gelen soruların İNGİLİZCE kalmış şıklarını Türkçeye çevirir.
 *
 * İlk aktarımda çeviri istemi "özel adları çevirme" diyordu; model element,
 * renk, hayvan gibi cins adları da özel ad sayıp İngilizce bıraktı
 * ("Hangi gaz ... %78'ini oluşturur?" → Nitrogen / Oxygen / Argon).
 * Bu betik yalnız `source: "opentdb"` sorularını gezer, şıkları yeniden
 * çevirir ve sırayı (dolayısıyla `correct_index`) korur.
 *
 * Kullanım:
 *   node scripts/sik-cevir.mjs --nvidia            # hepsini gözden geçir
 *   node scripts/sik-cevir.mjs --nvidia --kuru     # yazmadan dene
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const qDir = path.resolve(here, "..", "server", "data", "bilbakalim", "questions");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const DRY = flag("kuru");
const USE_NVIDIA = flag("nvidia");

function nvidiaKey() {
  if (process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY.trim();
  const home = process.env.USERPROFILE || process.env.HOME || "";
  for (const c of [
    process.env.NVIDIA_API_KEY_FILE,
    path.join(home, "Desktop", "Nvidia AP\u0130.txt"),
    path.join(home, "Desktop", "Nvidia API.txt"),
  ].filter(Boolean)) {
    try {
      const v = fs.readFileSync(c, "utf8").trim().split(/\r?\n/)[0].trim();
      if (v) return v;
    } catch {
      /* yok */
    }
  }
  return "";
}

const NV_KEY = USE_NVIDIA ? nvidiaKey() : "";
const URL_ =
  process.env.TRANSLATE_URL ||
  (USE_NVIDIA
    ? "https://integrate.api.nvidia.com/v1/chat/completions"
    : "http://127.0.0.1:1234/v1/chat/completions");
const MODEL = process.env.TRANSLATE_MODEL || (USE_NVIDIA ? "openai/gpt-oss-20b" : "local-model");

if (USE_NVIDIA && !NV_KEY) {
  console.error("[sik-cevir] NVIDIA anahtari bulunamadi.");
  process.exit(1);
}

/** Şık İngilizce görünüyor mu? Türkçe'ye özgü harf yoksa ve ASCII sözcükse şüpheli. */
function suspicious(opt) {
  const s = String(opt).trim();
  if (!s) return false;
  if (/[çğıöşüÇĞİÖŞÜ]/.test(s)) return false; // Türkçe harf var → çevrilmiş
  if (/^[\d\s.,:%/-]+$/.test(s)) return false; // sayı/tarih → çeviri gerekmez
  return /^[A-Za-z][A-Za-z\s'’.-]*$/.test(s); // düz ASCII sözcük(ler)
}

async function translateOptions(text, options) {
  const body = {
    model: MODEL,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Bilgi yarışması şıklarını Türkçeye çeviren bir çevirmensin. " +
          "Cins adlar (element, renk, hayvan, meslek, madde, gündelik sözcükler) " +
          "MUTLAKA çevrilir: Nitrogen→Azot, Oxygen→Oksijen, Copper→Bakır. " +
          "ÖZEL adlar (kişi, film, dizi, oyun, marka, şehir, ülke) AYNEN kalır. " +
          "Sırayı ve sayıyı koru. " +
          'Yanıt yalnız JSON: {"siklar":["...","...","...","..."]}',
      },
      { role: "user", content: JSON.stringify({ soru: text, siklar: options }) },
    ],
  };
  const headers = { "Content-Type": "application/json" };
  if (NV_KEY) headers.Authorization = `Bearer ${NV_KEY}`;
  const r = await fetch(URL_, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("JSON yok");
  const out = JSON.parse(m[0]);
  if (!Array.isArray(out.siklar) || out.siklar.length !== options.length) throw new Error("biçim");
  return out.siklar.map(String);
}

let checked = 0;
let fixed = 0;
let failed = 0;

for (const f of fs.readdirSync(qDir).filter((x) => x.endsWith(".json"))) {
  const p = path.join(qDir, f);
  const items = JSON.parse(fs.readFileSync(p, "utf8"));
  let dirty = false;
  for (const q of items) {
    if (q.source !== "opentdb") continue;
    checked++;
    const bad = (q.options || []).filter(suspicious).length;
    if (bad < 2) continue; // 1 tanesi özel ad olabilir; 2+ ise çevrilmemiş demek
    try {
      const tr = await translateOptions(q.text, q.options);
      if (tr.some((o, i) => o !== q.options[i])) {
        q.options = tr;
        dirty = true;
        fixed++;
      }
    } catch (e) {
      failed++;
      if (failed <= 3) console.warn(`[sik-cevir] ${e.message}`);
    }
  }
  if (dirty && !DRY) fs.writeFileSync(p, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  if (dirty) console.log(`[sik-cevir] ${f}: güncellendi`);
}

console.log(`[sik-cevir] bakılan: ${checked} | düzeltilen: ${fixed} | hata: ${failed}${DRY ? " (kuru)" : ""}`);
