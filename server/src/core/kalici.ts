/** Bot yeniden başlayınca kaybolmaması gereken küçük durumlar (K1-K4): anahtar başına bir JSON satırı. */
import { db } from '../db/index.js';
import { seyrekUyar } from './logger.js';

export function kaliciOku<T>(anahtar: string, varsayilan: T): T {
  try {
    const r = db.prepare('SELECT deger FROM kalici_durum WHERE anahtar = ?').get(anahtar) as { deger: string } | undefined;
    return r ? (JSON.parse(r.deger) as T) : varsayilan;
  } catch {
    return varsayilan;
  }
}

export function kaliciYaz(anahtar: string, deger: unknown): void {
  try {
    db.prepare('INSERT INTO kalici_durum (anahtar, deger, guncellendi) VALUES (?, ?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger, guncellendi = excluded.guncellendi')
      .run(anahtar, JSON.stringify(deger), Date.now());
  } catch (e) {
    seyrekUyar(`kalici:${anahtar}`, '[Kalıcı] Durum yazılamadı', e);
  }
}

const bekleyen = new Map<string, { zaman: ReturnType<typeof setTimeout>; al: () => unknown }>();

/** Sık değişen durum: son hâli 1 sn sonra tek seferde yazılır; kapanışta bekleyen yazılır. */
export function kaliciYazGecikmeli(anahtar: string, al: () => unknown, ms = 1000): void {
  const eski = bekleyen.get(anahtar);
  if (eski) clearTimeout(eski.zaman);
  const zaman = setTimeout(() => {
    bekleyen.delete(anahtar);
    kaliciYaz(anahtar, al());
  }, ms);
  zaman.unref?.();
  bekleyen.set(anahtar, { zaman, al });
}

export function kaliciBekleyenleriYaz(): void {
  for (const [anahtar, b] of bekleyen) {
    clearTimeout(b.zaman);
    kaliciYaz(anahtar, b.al());
  }
  bekleyen.clear();
}

process.once('exit', kaliciBekleyenleriYaz);
