import { settingsCache } from '../../core/settings-cache.js';

/** B9: yapay zekâ isteklerinin günlük tavanı (ayar `ai_gunluk_sinir`, 0 = sınırsız); sayaç yeniden başlatmada sıfırlanmasın diye ayarlarda. */
export interface Sayac {
  gun: string;
  sayi: number;
}

/** Saf adım: gün değiştiyse sıfırla; sınır doluysa izin verme. */
export function sayacIlerlet(sayac: Sayac | null, sinir: number, bugun: string): { sayac: Sayac; izin: boolean } {
  const s = sayac && sayac.gun === bugun ? sayac : { gun: bugun, sayi: 0 };
  if (sinir > 0 && s.sayi >= sinir) return { sayac: s, izin: false };
  return { sayac: { gun: bugun, sayi: s.sayi + 1 }, izin: true };
}

const bugun = () => new Date().toLocaleDateString('sv'); // yerel YYYY-MM-DD

function oku(): { sayac: Sayac | null; sinir: number } {
  let sayac: Sayac | null = null;
  try {
    sayac = JSON.parse(settingsCache.get('ai_gunluk_sayac', 'null'));
  } catch {}
  const sinir = Math.max(0, Math.floor(Number(settingsCache.get('ai_gunluk_sinir', '0')) || 0));
  return { sayac, sinir };
}

/** Bir istek hakkı al; sınır doluysa false. */
export function istekHakkiAl(): boolean {
  const { sayac, sinir } = oku();
  const r = sayacIlerlet(sayac, sinir, bugun());
  if (r.izin) settingsCache.set('ai_gunluk_sayac', JSON.stringify(r.sayac));
  return r.izin;
}

export function gunlukDurum(): { kullanilan: number; sinir: number; doldu: boolean } {
  const { sayac, sinir } = oku();
  const kullanilan = sayac?.gun === bugun() ? sayac.sayi : 0;
  return { kullanilan, sinir, doldu: sinir > 0 && kullanilan >= sinir };
}
