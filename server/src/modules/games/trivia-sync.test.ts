import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { syncTriviaBank } from './trivia-sync';

describe('syncTriviaBank', () => {
  it('eş kategorileri tek ada toplar', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE trivia_questions (id TEXT PRIMARY KEY, category TEXT NOT NULL, question TEXT NOT NULL,
      option_a TEXT NOT NULL, option_b TEXT NOT NULL, option_c TEXT NOT NULL, option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 100, explanation TEXT,
      difficulty TEXT NOT NULL DEFAULT 'medium', created_at INTEGER NOT NULL)`);
    const ekle = db.prepare(`INSERT INTO trivia_questions VALUES (?, ?, ?, 'a', 'b', 'c', 'd', 'A', 100, NULL, 'medium', 0)`);
    ekle.run('x1', 'Sinema TV', 'Eski sinema sorusu?');
    ekle.run('x2', 'Oyunlar', 'Eski oyun sorusu?');
    const r = syncTriviaBank(db);
    const adlar = r.categories.map((c) => c.category);
    expect(adlar).not.toContain('Sinema TV');
    expect(adlar).not.toContain('Oyunlar');
    expect(db.prepare("SELECT category FROM trivia_questions WHERE id = 'x1'").get()).toEqual({ category: 'Film ve Dizi' });
    expect(db.prepare("SELECT category FROM trivia_questions WHERE id = 'x2'").get()).toEqual({ category: 'Oyun' });
  });
});
