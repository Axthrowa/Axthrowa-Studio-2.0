/**
 * AxBoT — kalıcı değişken ve sayaç deposu
 * Developed by AxthrowA
 *
 * Üç kapsam:
 *   local    — yalnız çalıştırma süresince, bellekte (diske yazılmaz)
 *   user     — izleyici başına kalıcı
 *   global   — kanal geneli kalıcı
 *
 * Sayaçlar ayrı `counters` tablosunda tutulur çünkü komutlara bağlıdır ve
 * ondalık değer alabilir (`!editcounter dollars 10.5`).
 */
import { db } from '../../db/index.js';

export { sayacIfadesi } from './pure.js';

type Kapsam = 'user' | 'global';

const oku = db.prepare('SELECT value FROM kv_store WHERE scope = ? AND owner = ? AND key = ?');
const yaz = db.prepare(`
  INSERT INTO kv_store (scope, owner, key, value, updated_at) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(scope, owner, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const listele = db.prepare('SELECT key FROM kv_store WHERE scope = ? AND owner = ? ORDER BY key');

/** Kullanıcı adını normalize eder: `@Ad` → `ad`. */
export function sahipAnahtari(kullanici: string): string {
  return String(kullanici || '').replace(/^@/, '').toLowerCase();
}

export function kvOku(kapsam: Kapsam, sahip: string, anahtar: string): string | null {
  const r = oku.get(kapsam, kapsam === 'global' ? '' : sahipAnahtari(sahip), anahtar) as
    | { value?: string }
    | undefined;
  return r?.value ?? null;
}

export function kvYaz(kapsam: Kapsam, sahip: string, anahtar: string, deger: string): void {
  yaz.run(kapsam, kapsam === 'global' ? '' : sahipAnahtari(sahip), anahtar, String(deger), Date.now());
}

export function kvListele(kapsam: Kapsam, sahip: string): string[] {
  const r = listele.all(kapsam, kapsam === 'global' ? '' : sahipAnahtari(sahip)) as Array<{ key: string }>;
  return r.map((x) => x.key);
}

// ---- Sayaçlar ---------------------------------------------------------------

const sayacOku = db.prepare('SELECT count FROM counters WHERE name = ?');
const sayacYaz = db.prepare(`
  INSERT INTO counters (name, count, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(name) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at
`);

export function sayacAl(ad: string): number {
  const r = sayacOku.get(String(ad).toLowerCase()) as { count?: number } | undefined;
  return Number(r?.count ?? 0);
}

export function sayacAyarla(ad: string, deger: number): number {
  const d = Number.isFinite(deger) ? deger : 0;
  sayacYaz.run(String(ad).toLowerCase(), d, Date.now());
  return d;
}

/** `$(count +1)` / `$(count -10)` — mevcut değere ekler, yeni değeri döner. */
export function sayacDegistir(ad: string, fark: number): number {
  return sayacAyarla(ad, sayacAl(ad) + (Number.isFinite(fark) ? fark : 0));
}
