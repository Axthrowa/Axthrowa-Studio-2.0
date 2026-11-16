import { describe, expect, it } from 'vitest';
import { BOS_DURUM, simdiOynat, sirdanCikar, sonaAl, type KuyrukDurumu, type UyariOgesi } from './alertQueue.js';

const oge = (id: string): UyariOgesi => ({ id, tur: 'follow', veri: {}, sureMs: 5000, animMs: 500 });
const durum = (): KuyrukDurumu => ({ ...BOS_DURUM, aktif: oge('a'), asama: 'visible', asamaBitis: 9_000, aktifBaslangic: 1_000, bekleyen: [oge('b'), oge('c'), oge('d')] });
const sira = (d: KuyrukDurumu) => d.bekleyen.map((o) => o.id);

describe('kuyruktaki tek uyarı (sağ tık)', () => {
  it('Şimdi oynat: uyarı başa alınır, ekrandaki kapanmaya başlar', () => {
    const d = simdiOynat(durum(), 'c', 5_000);
    expect(sira(d)).toEqual(['c', 'b', 'd']);
    expect(d.asama).toBe('exiting');
    expect(d.asamaBitis).toBe(5_000);
  });

  it('Sona al ve Sil yalnız o uyarıyı etkiler; ekrandakine dokunmaz', () => {
    expect(sira(sonaAl(durum(), 'b'))).toEqual(['c', 'd', 'b']);
    const s = sirdanCikar(durum(), 'c');
    expect(sira(s)).toEqual(['b', 'd']);
    expect(s.aktif?.id).toBe('a');
    expect(s.asama).toBe('visible');
  });

  it('kuyrukta olmayan kimlik (ekrandaki ya da çoktan oynamış) durumu değiştirmez', () => {
    const d = durum();
    expect(simdiOynat(d, 'a')).toBe(d);
    expect(sonaAl(d, 'yok')).toBe(d);
    expect(sonaAl(d, 'd')).toBe(d);
    expect(sirdanCikar(d, 'yok')).toBe(d);
  });
});
