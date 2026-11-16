import { describe, it, expect } from 'vitest';
import { db } from './index.js';

describe('db.prepare ifade önbelleği', () => {
  it('aynı SQL için aynı ifadeyi döndürür ve sonuçlar doğru kalır', () => {
    db.exec('CREATE TABLE IF NOT EXISTS t_onbellek (k TEXT PRIMARY KEY, v TEXT)');
    const sql = 'SELECT v FROM t_onbellek WHERE k = ?';
    expect(db.prepare(sql)).toBe(db.prepare(sql));
    db.prepare('INSERT OR REPLACE INTO t_onbellek (k, v) VALUES (?, ?)').run('a', '1');
    db.prepare('INSERT OR REPLACE INTO t_onbellek (k, v) VALUES (?, ?)').run('b', '2');
    expect(db.prepare(sql).get('a')).toEqual({ v: '1' });
    expect(db.prepare(sql).get('b')).toEqual({ v: '2' });
  });

  it('şema değişince önbellekteki ifade yine çalışır', () => {
    db.exec('CREATE TABLE IF NOT EXISTS t_sema (a INTEGER)');
    const sql = 'SELECT * FROM t_sema';
    db.prepare('INSERT INTO t_sema (a) VALUES (1)').run();
    expect(db.prepare(sql).all()).toEqual([{ a: 1 }]);
    db.exec('ALTER TABLE t_sema ADD COLUMN b INTEGER DEFAULT 7');
    expect(db.prepare(sql).all()).toEqual([{ a: 1, b: 7 }]);
  });
});
