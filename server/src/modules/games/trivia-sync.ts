/**
 * AxBoT Bil Bakalım question bank sync
 * Developed by AxthrowA
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { randomUUID as uuidv4 } from 'crypto';
import { TRIVIA_SEED_QUESTIONS } from './trivia-data.js';
import { TRIVIA_EXTRA_QUESTIONS } from './trivia-extra.js';
import { TRIVIA_ZOR_SORULAR } from './trivia-zor.js';
import { TRIVIA_HAVUZ_SORULARI } from './trivia-havuz.js';
import { bankayiDenetle, copSoruMu } from './soru-kalite.js';

/** Kalite kuralları değişince bu artar: banka bir kez daha denetlenir */
export const KALITE_SURUMU = '2';

export interface TriviaSyncResult {
  added: number;
  total: number;
  sources: Record<string, number>;
  categories: Array<{ category: string; count: number }>;
}

const LETTERS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

function insertIfNew(
  database: DatabaseSync,
  check: any,
  insert: any,
  item: {
    category: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    points?: number;
    explanation?: string;
    difficulty?: string;
  }
): boolean {
  if (!item.question || !item.optionA) return false;
  // Anlamsız şablon soruları ("… bilgisi #72" vb.) hiç içe aktarılmaz
  if (copSoruMu(item)) return false;
  const exists = check.get(item.question);
  if (exists) return false;
  insert.run(
    uuidv4(),
    item.category,
    item.question,
    item.optionA,
    item.optionB,
    item.optionC,
    item.optionD,
    item.correctOption,
    item.points || 100,
    item.explanation || '',
    item.difficulty || 'medium',
    Date.now()
  );
  return true;
}

/**
 * Ek soru paketlerinin klasörleri (`categories.json` + `questions/*.json` ya da `bilbakalim.db`).
 *
 * Asıl soru bankası uygulamanın içindedir (trivia-data/extra/zor/havuz); masaüstündeki ayrı
 * `Bil bakalım` deposuna artık bakılmaz. Ek paket isteyen uygulamanın `data/bilbakalim`
 * klasörüne koyar ya da `BILBAKALIM_DIR` ile yol verir.
 */
function bankCandidates(): string[] {
  const list: string[] = [];
  const env = (process.env.BILBAKALIM_DIR || '').trim();
  if (env) list.push(path.resolve(env));
  list.push(
    path.resolve(process.cwd(), 'data', 'bilbakalim'),
    path.resolve(process.cwd(), 'server', 'data', 'bilbakalim'),
  );
  return list;
}

/** Bankadaki SQLite dosyası (JSON ile aynı klasörde aranır). */
function findBilBakalimDb(): string | null {
  for (const d of bankCandidates()) {
    const p = path.join(d, 'bilbakalim.db');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function importJsonBank(database: DatabaseSync, check: any, insert: any): number {
  // Bulunan BÜTÜN bankalardan aktar: ayrı depo + projeye eklenen sorular
  // (ör. OpenTDB) birlikte gelsin. Yinelenenleri `insertIfNew` eler.
  let toplam = 0;
  for (const d of bankCandidates()) {
    if (fs.existsSync(path.join(d, 'categories.json')) && fs.existsSync(path.join(d, 'questions'))) {
      toplam += importJsonBankFrom(database, check, insert, d);
    }
  }
  return toplam;
}

function importJsonBankFrom(database: DatabaseSync, check: any, insert: any, dir: string): number {
  const categoriesFile = path.join(dir, 'categories.json');
  const questionsDir = path.join(dir, 'questions');
  if (!fs.existsSync(categoriesFile) || !fs.existsSync(questionsDir)) return 0;

  let added = 0;
  const categoriesList: Array<{ slug: string; name: string }> = JSON.parse(fs.readFileSync(categoriesFile, 'utf-8'));
  for (const cat of categoriesList) {
    const qFile = path.join(questionsDir, `${cat.slug}.json`);
    if (!fs.existsSync(qFile)) continue;
    const rawItems: Array<{
      text: string;
      difficulty?: 'easy' | 'medium' | 'hard';
      options: string[];
      correct_index: number;
      explanation?: string;
    }> = JSON.parse(fs.readFileSync(qFile, 'utf-8'));
    for (const item of rawItems) {
      if (!item.text || !item.options || item.options.length < 4) continue;
      const diff = item.difficulty || 'medium';
      const pts = diff === 'easy' ? 100 : diff === 'medium' ? 120 : 140;
      if (insertIfNew(database, check, insert, {
        category: cat.name,
        question: item.text,
        optionA: item.options[0],
        optionB: item.options[1],
        optionC: item.options[2],
        optionD: item.options[3],
        correctOption: LETTERS[item.correct_index] || 'A',
        points: pts,
        explanation: item.explanation || '',
        difficulty: diff
      })) added++;
    }
  }
  return added;
}

function importSqliteBank(database: DatabaseSync, check: any, insert: any): number {
  const sqlitePath = findBilBakalimDb();
  if (!sqlitePath) return 0;
  let added = 0;
  try {
    const src = new DatabaseSync(sqlitePath, { readOnly: true });
    const rows = src.prepare(`
      SELECT q.text AS question, q.difficulty AS difficulty, c.name AS category,
             a.text AS answer, a.is_correct AS is_correct, a.sort_order AS sort_order
      FROM questions q
      JOIN categories c ON c.id = q.category_id
      JOIN answers a ON a.question_id = q.id
      WHERE q.active = 1
      ORDER BY q.id, a.sort_order
    `).all() as any[];

    const grouped = new Map<string, { category: string; difficulty: string; answers: Array<{ text: string; correct: boolean }> }>();
    for (const row of rows) {
      if (!grouped.has(row.question)) {
        grouped.set(row.question, { category: row.category, difficulty: row.difficulty || 'medium', answers: [] });
      }
      grouped.get(row.question)!.answers.push({ text: row.answer, correct: !!row.is_correct });
    }

    for (const [question, pack] of grouped) {
      if (pack.answers.length < 4) continue;
      const correctIndex = pack.answers.findIndex(a => a.correct);
      const diff = pack.difficulty || 'medium';
      if (insertIfNew(database, check, insert, {
        category: pack.category,
        question,
        optionA: pack.answers[0].text,
        optionB: pack.answers[1].text,
        optionC: pack.answers[2].text,
        optionD: pack.answers[3].text,
        correctOption: LETTERS[correctIndex >= 0 ? correctIndex : 0],
        points: diff === 'easy' ? 100 : diff === 'hard' ? 140 : 120,
        explanation: '',
        difficulty: diff
      })) added++;
    }
    src.close();
  } catch (err) {
    console.warn('[TriviaSync] SQLite import skipped:', err);
  }
  return added;
}

/**
 * Soru bankasını denetler ve onarır (bkz. soru-kalite.ts): yer tutucu
 * çeldiriciler değiştirilir, onarılamayan anlamsız sorular atılır, dört işlem
 * soruları düzeltilir. Yalnız yeni soru eklendiğinde ya da kural sürümü
 * değiştiğinde çalışır.
 */
export function triviaBankasiniOnar(database: DatabaseSync, zorla = false): { onarildi: number; atildi: number } {
  const surum = (database.prepare("SELECT value FROM bot_settings WHERE key = 'trivia_kalite_surum'").get() as { value?: string } | undefined)?.value;
  if (!zorla && surum === KALITE_SURUMU) return { onarildi: 0, atildi: 0 };
  const banka = database
    .prepare('SELECT id, category, question, option_a AS optionA, option_b AS optionB, option_c AS optionC, option_d AS optionD, correct_option AS correctOption FROM trivia_questions')
    .all() as any[];
  const sonuc = bankayiDenetle(banka);
  const guncelle = database.prepare('UPDATE trivia_questions SET option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ? WHERE id = ?');
  const sil = database.prepare('DELETE FROM trivia_questions WHERE id = ?');
  database.exec('BEGIN');
  try {
    for (const q of sonuc.onarilan) guncelle.run(q.optionA, q.optionB, q.optionC, q.optionD, q.correctOption, String(q.id));
    for (const q of sonuc.atilacak) sil.run(String(q.id));
    database
      .prepare("INSERT INTO bot_settings (key, value) VALUES ('trivia_kalite_surum', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(KALITE_SURUMU);
    database.exec('COMMIT');
  } catch (e) {
    try { database.exec('ROLLBACK'); } catch {}
    throw e;
  }
  return { onarildi: sonuc.onarilan.length, atildi: sonuc.atilacak.length };
}

export function syncTriviaBank(database: DatabaseSync): TriviaSyncResult {
  const check = database.prepare('SELECT id FROM trivia_questions WHERE question = ?');
  const insert = database.prepare(`
    INSERT INTO trivia_questions (id, category, question, option_a, option_b, option_c, option_d, correct_option, points, explanation, difficulty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sources: Record<string, number> = { core: 0, extra: 0, json: 0, sqlite: 0 };
  database.exec('BEGIN');
  try {
    for (const q of TRIVIA_SEED_QUESTIONS) {
      if (insertIfNew(database, check, insert, q)) sources.core++;
    }
    for (const q of [...TRIVIA_EXTRA_QUESTIONS, ...TRIVIA_ZOR_SORULAR, ...TRIVIA_HAVUZ_SORULARI]) {
      if (insertIfNew(database, check, insert, q)) sources.extra++;
    }
    sources.json = importJsonBank(database, check, insert);
    sources.sqlite = importSqliteBank(database, check, insert);
    database.exec('COMMIT');
  } catch (err) {
    try { database.exec('ROLLBACK'); } catch {}
    throw err;
  }

  const added = sources.core + sources.extra + sources.json + sources.sqlite;
  const totalRow = database.prepare('SELECT COUNT(*) as cnt FROM trivia_questions').get() as { cnt: number };
  const categories = database.prepare('SELECT category, COUNT(*) as count FROM trivia_questions GROUP BY category ORDER BY category').all() as Array<{ category: string; count: number }>;
  return { added, total: totalRow.cnt, sources, categories };
}
