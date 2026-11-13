import { afterAll, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

const bellek = new DatabaseSync(':memory:');
vi.mock('../../db/index.js', () => ({ db: bellek }));
vi.mock('../../ws/server.js', () => ({ wsHub: { broadcastTo: vi.fn(), broadcast: vi.fn() } }));
vi.mock('../economy/economy.js', () => ({ economy: {}, cuzdanAdi: () => 'Puan' }));

import { TRIVIA_SEED_QUESTIONS } from './trivia-data.js';
import { TRIVIA_EXTRA_QUESTIONS } from './trivia-extra.js';
import { TRIVIA_ZOR_SORULAR } from './trivia-zor.js';
import { TRIVIA_HAVUZ_SORULARI } from './trivia-havuz.js';
import { bankayiDenetle, copSoruMu } from './soru-kalite.js';

const ANA = ['Tarih', 'Coğrafya', 'Bilim', 'Spor', 'Oyun', 'Müzik', 'Film ve Dizi'];
const hepsi = [...TRIVIA_SEED_QUESTIONS, ...TRIVIA_EXTRA_QUESTIONS, ...TRIVIA_ZOR_SORULAR, ...TRIVIA_HAVUZ_SORULARI];

describe('Bil Bakalım yerleşik havuzu', () => {
  it('ana kategorilerin her biri en az 60 soru', () => {
    for (const k of ANA) expect(hepsi.filter((q) => q.category === k).length, k).toBeGreaterThanOrEqual(60);
  });

  it('kalite süzgeci tüm havuzdan geçer: atılan ya da onarılan soru yok', () => {
    const r = bankayiDenetle(hepsi.map((q, i) => ({ ...q, id: String(i) })));
    expect(r.atilacak.map((q) => q.question)).toEqual([]);
    expect(r.onarilan.map((q) => q.question)).toEqual([]);
  });

  it('yeni sorular: metni yinelenmez, dört ayrı şık, zorluk etiketli, doğru şık harflere dağılır', () => {
    const eski = new Set([...TRIVIA_SEED_QUESTIONS, ...TRIVIA_EXTRA_QUESTIONS, ...TRIVIA_ZOR_SORULAR].map((q) => q.question.trim()));
    expect(TRIVIA_HAVUZ_SORULARI.filter((q) => eski.has(q.question.trim())).map((q) => q.question)).toEqual([]);
    expect(new Set(TRIVIA_HAVUZ_SORULARI.map((q) => q.question.trim())).size).toBe(TRIVIA_HAVUZ_SORULARI.length);
    for (const q of TRIVIA_HAVUZ_SORULARI) {
      const siklar = [q.optionA, q.optionB, q.optionC, q.optionD];
      expect(new Set(siklar.map((s) => s.toLocaleLowerCase('tr-TR'))).size, q.question).toBe(4);
      expect(copSoruMu(q), q.question).toBe(false);
      expect(['easy', 'medium', 'hard']).toContain(q.difficulty);
    }
    expect(new Set(TRIVIA_HAVUZ_SORULARI.map((q) => q.correctOption)).size).toBe(4);
  });
});

describe('aynı oturumda soru tekrarı', () => {
  vi.useFakeTimers();
  bellek.exec(`CREATE TABLE trivia_questions (id TEXT PRIMARY KEY, category TEXT, question TEXT, option_a TEXT, option_b TEXT, option_c TEXT, option_d TEXT,
    correct_option TEXT, points INTEGER, explanation TEXT, difficulty TEXT, created_at INTEGER)`);
  const ekle = bellek.prepare('INSERT INTO trivia_questions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < 250; i++) ekle.run(`b${i}`, 'Bilim', `Soru ${i}`, 'a', 'b', 'c', 'd', 'A', 100, '', 'medium', 0);
  for (let i = 0; i < 3; i++) ekle.run(`m${i}`, 'Müzik', `Müzik ${i}`, 'a', 'b', 'c', 'd', 'A', 100, '', 'medium', 0);
  afterAll(() => vi.useRealTimers());

  it('son 200 soruda aynı soru yeniden gelmez', async () => {
    const { TriviaEngine } = await import('./trivia-engine.js');
    const motor = new TriviaEngine();
    const sorulan = Array.from({ length: 200 }, () => motor.startQuestion({ category: 'Bilim' })!.id);
    expect(new Set(sorulan).size).toBe(200);
  });

  it('küçük kategori tükenince sorular yeniden gelir ama art arda aynı soru gelmez', async () => {
    const { TriviaEngine } = await import('./trivia-engine.js');
    const motor = new TriviaEngine();
    const sorulan = Array.from({ length: 12 }, () => motor.startQuestion({ category: 'Müzik' })!.id);
    expect(new Set(sorulan.slice(0, 3)).size).toBe(3);
    for (let i = 1; i < sorulan.length; i++) expect(sorulan[i]).not.toBe(sorulan[i - 1]);
  });
});
