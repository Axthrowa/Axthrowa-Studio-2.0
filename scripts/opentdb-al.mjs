#!/usr/bin/env node
/**
 * OpenTDB'den soru çek, Türkçeye çevir, Bil Bakalım bankasına ekle.
 *
 * Mevcut bankadaki soruların çoğu şablonla üretilmişti ve çeldiricileri
 * konuyla alakasızdı ("Vermeer hangi sanat dalıyla özdeşleşir?" → Futbol).
 * OpenTDB soruları insan yazımı ve çeldiricileri konuyla ilgili.
 *
 * Çeviri: yerel bir OpenAI-uyumlu uca (varsayılan LM Studio / Ollama) istek
 * atar. Uç yoksa `--cevirmeden` ile İngilizce eklenebilir.
 *
 * Kullanım:
 *   node scripts/opentdb-al.mjs --adet 50                 # tüm kategoriler
 *   node scripts/opentdb-al.mjs --kategori bilim --adet 40
 *   node scripts/opentdb-al.mjs --adet 20 --cevirmeden    # çeviri yapmadan
 *   node scripts/opentdb-al.mjs --adet 20 --kuru          # yazmadan dene
 *   node scripts/opentdb-al.mjs --adet 100 --nvidia       # NVIDIA bulut cevirisi
 *
 * `--nvidia`: makinedeki NVIDIA anahtar dosyasini okuyup NVIDIA'nin
 * OpenAI-uyumlu ucunu kullanir. Anahtar senin, kullanim senin kotandan
 * duser; bu yuzden varsayilan degil.
 *
 * Ortam:
 *   TRANSLATE_URL   varsayılan http://127.0.0.1:1234/v1/chat/completions
 *   TRANSLATE_MODEL varsayılan local-model
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const qDir = path.resolve(here, "..", "server", "data", "bilbakalim", "questions");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};

const WANT = Math.max(1, Math.min(2000, Number(arg("adet", 50))));
const ONLY = arg("kategori", "");
const DRY = flag("kuru");
const NO_TR = flag("cevirmeden");
const USE_NVIDIA = flag("nvidia");

/** NVIDIA anahtari: ortam degiskeni ya da masaustundeki anahtar dosyasi. */
function nvidiaKey() {
  if (process.env.NVIDIA_API_KEY) return process.env.NVIDIA_API_KEY.trim();
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const candidates = [
    process.env.NVIDIA_API_KEY_FILE,
    path.join(home, "Desktop", "Nvidia APİ.txt"),
    path.join(home, "Desktop", "Nvidia API.txt"),
  ].filter(Boolean);
  for (const c of candidates) {
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
const TRANSLATE_URL =
  process.env.TRANSLATE_URL ||
  (USE_NVIDIA
    ? "https://integrate.api.nvidia.com/v1/chat/completions"
    : "http://127.0.0.1:1234/v1/chat/completions");
const TRANSLATE_MODEL =
  process.env.TRANSLATE_MODEL || (USE_NVIDIA ? "openai/gpt-oss-20b" : "local-model");

if (USE_NVIDIA && !NV_KEY) {
  console.error("[opentdb] NVIDIA anahtari bulunamadi (NVIDIA_API_KEY ya da masaustundeki anahtar dosyasi).");
  process.exit(1);
}

/** OpenTDB kategori kimliği → bankadaki dosya (slug). */
const CATEGORY_MAP = {
  9: "genel_kultur", // General Knowledge
  11: "sinema_tv", // Film
  12: "sanat", // Music → sanat (müzik sanat dalı)
  14: "sinema_tv", // Television
  15: "oyunlar", // Video Games
  17: "bilim", // Science & Nature
  18: "teknoloji", // Computers
  19: "bilim", // Mathematics
  20: "tarih", // Mythology → tarih
  21: "spor", // Sports
  22: "cografya", // Geography
  23: "tarih", // History
  24: "genel_kultur", // Politics
  25: "sanat", // Art
  27: "bilim", // Animals
  28: "teknoloji", // Vehicles
};

const DIFF = { easy: "easy", medium: "medium", hard: "hard" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** OpenTDB HTML varlıklarını çözer. */
function decode(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&eacute;/g, "é")
    .replace(/&uuml;/g, "ü")
    .replace(/&ouml;/g, "ö")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&shy;/g, "");
}

const norm = (s) =>
  String(s || "")
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** OpenTDB oturum jetonu: aynı soruyu iki kez vermemesi için. */
async function newToken() {
  try {
    const r = await fetch("https://opentdb.com/api_token.php?command=request");
    const j = await r.json();
    return j.token || "";
  } catch {
    return "";
  }
}

async function fetchBatch(token, amount, category) {
  const u = new URL("https://opentdb.com/api.php");
  u.searchParams.set("amount", String(Math.min(50, amount)));
  u.searchParams.set("type", "multiple");
  if (token) u.searchParams.set("token", token);
  if (category) u.searchParams.set("category", String(category));
  // 429'da bekleyip bir kez daha dene: OpenTDB kısa aralıklı isteği reddediyor.
  let r = await fetch(u);
  if (r.status === 429) {
    await sleep(6000);
    r = await fetch(u);
  }
  if (!r.ok) throw new Error(`OpenTDB HTTP ${r.status}`);
  const j = await r.json();
  // 1 = soru kalmadı, 4 = jeton tükendi
  if (j.response_code === 4 || j.response_code === 1) return [];
  if (j.response_code !== 0) throw new Error(`OpenTDB kodu ${j.response_code}`);
  return j.results || [];
}

/** Bir soruyu (metin + 4 şık) tek istekte Türkçeye çevirir. */
async function translate(item) {
  const payload = {
    soru: item.text,
    siklar: item.options,
  };
  const body = {
    model: TRANSLATE_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Bilgi yarışması sorularını Türkçeye çeviren bir çevirmensin. " +
          "SORUYU VE BÜTÜN ŞIKLARI Türkçeye çevir. Cins adlar (element, renk, " +
          "hayvan, meslek, madde, gündelik sözcükler) MUTLAKA çevrilir: " +
          "Nitrogen→Azot, Oxygen→Oksijen, Copper→Bakır, Blue→Mavi gibi. " +
          "Yalnız ÖZEL adlar (kişi, film, dizi, oyun, marka, şehir, ülke) " +
          "olduğu gibi kalır. " +
          "Şıkların sırasını DEĞİŞTİRME ve sayısını koru. " +
          'Yanıtı yalnız şu JSON biçiminde ver: {"soru":"...","siklar":["...","...","...","..."]}',
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
  };
  const headers = { "Content-Type": "application/json" };
  if (NV_KEY) headers.Authorization = `Bearer ${NV_KEY}`;
  // Zaman aşımı olmadan tek bir asılı istek bütün aktarımı dondurabiliyordu.
  const r = await fetch(TRANSLATE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`çeviri HTTP ${r.status}`);
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "";
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("çeviri JSON döndürmedi");
  const out = JSON.parse(m[0]);
  if (!out.soru || !Array.isArray(out.siklar) || out.siklar.length !== item.options.length) {
    throw new Error("çeviri biçimi hatalı");
  }
  return { text: String(out.soru), options: out.siklar.map(String) };
}

/** Bankaları diske yaz (ara kayıt). */
function saveBanks() {
  for (const [slug, b] of banks) {
    fs.writeFileSync(path.join(qDir, `${slug}.json`), `${JSON.stringify(b.items, null, 2)}\n`, "utf8");
  }
}

// ---- Mevcut banka -----------------------------------------------------------
const banks = new Map(); // slug -> {items, seen:Set}
function bank(slug) {
  if (!banks.has(slug)) {
    const p = path.join(qDir, `${slug}.json`);
    const items = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : [];
    banks.set(slug, { items, seen: new Set(items.map((q) => norm(q.text))) });
  }
  return banks.get(slug);
}

// ---- Ana akış ---------------------------------------------------------------
const token = await newToken();
const categoryIds = ONLY
  ? Object.entries(CATEGORY_MAP).filter(([, s]) => s === ONLY).map(([id]) => Number(id))
  : Object.keys(CATEGORY_MAP).map(Number);

if (!categoryIds.length) {
  console.error(`[opentdb] "${ONLY}" için eşleşen OpenTDB kategorisi yok.`);
  process.exit(1);
}

let added = 0;
let skipped = 0;
let failed = 0;
const perCat = Math.max(1, Math.ceil(WANT / categoryIds.length));

for (const cid of categoryIds) {
  const slug = CATEGORY_MAP[cid];
  if (added >= WANT) break;
  let results = [];
  try {
    results = await fetchBatch(token, perCat, cid);
  } catch (e) {
    console.warn(`[opentdb] kategori ${cid}: ${e.message}`);
    continue;
  }
  await sleep(5500); // OpenTDB hız sınırı: 5 sn'de 1 istek (aşılınca HTTP 429)

  for (const r of results) {
    if (added >= WANT) break;
    const b = bank(slug);
    const item = {
      text: decode(r.question),
      options: shuffle([decode(r.correct_answer), ...r.incorrect_answers.map(decode)]),
    };
    const correct = decode(r.correct_answer);

    let final = item;
    if (!NO_TR) {
      try {
        const tr = await translate(item);
        // Doğru cevabın yeni sıradaki yeri: çeviri sırayı korur.
        final = tr;
      } catch (e) {
        failed++;
        if (failed <= 3) console.warn(`[çeviri] ${e.message} — İngilizce eklenmiyor, atlanıyor`);
        continue;
      }
    }

    const key = norm(final.text);
    if (!key || b.seen.has(key)) {
      skipped++;
      continue;
    }
    const idx = item.options.indexOf(correct);
    if (idx < 0 || final.options.length !== 4) {
      skipped++;
      continue;
    }
    b.seen.add(key);
    b.items.push({
      text: final.text,
      difficulty: DIFF[r.difficulty] || "medium",
      options: final.options,
      correct_index: idx,
      source: "opentdb",
    });
    added++;
    // Ara kayıt + ilerleme: iş yarıda kalsa da o ana kadar çevrilenler kalsın.
    if (added % 10 === 0) {
      if (!DRY) saveBanks();
      console.log(`[opentdb] ${added}/${WANT} … (atlanan ${skipped}, çeviri hatası ${failed})`);
    }
  }
}

if (DRY) {
  console.log(`[kuru] eklenecek: ${added} | atlanan: ${skipped} | çeviri hatası: ${failed}`);
} else {
  saveBanks();
  console.log(`[opentdb] eklenen: ${added} | atlanan (yinelenen): ${skipped} | çeviri hatası: ${failed}`);
  console.log(`[opentdb] güncellenen dosya: ${[...banks.keys()].join(", ") || "yok"}`);
}
