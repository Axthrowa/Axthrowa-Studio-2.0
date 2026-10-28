import { describe, it, expect, vi } from 'vitest';

const ayarlar = new Map<string, string>();
vi.mock('../../db/index.js', () => ({
  db: {
    prepare: (sql: string) => ({
      get: (k: string) => (ayarlar.has(k) ? { value: ayarlar.get(k) } : undefined),
      run: (k: string, v: string) => {
        if (sql.startsWith('INSERT')) ayarlar.set(k, v);
        return {};
      },
      all: () => []
    })
  }
}));

describe('subathon kalan süre', () => {
  it('duraklatınca süre saklanır, devamda kaldığı yerden sürer; bot kapanıp açılınca süre akmamış olur', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { subathon } = await import('./subathon.js');
    subathon.baslat(10);
    vi.advanceTimersByTime(60_000);
    const d = subathon.durdur();
    expect(d.duraklatildi).toBe(true);
    expect(d.kalanSaniye).toBe(540);
    // Duraklatılmışken saat ilerlese de süre azalmaz
    vi.advanceTimersByTime(3600_000);
    expect(subathon.durumAl().kalanSaniye).toBe(540);
    const sur = subathon.devam();
    expect(sur.aktif).toBe(true);
    expect(sur.kalanSaniye).toBe(540);

    // Çalışırken bot kapandı (son 5 sn'lik kayıt), saatler sonra açıldı: duraklatılmış ve kalan süre aynı
    subathon.baglaOlaylar();
    vi.advanceTimersByTime(5000);
    const kayit = JSON.parse(ayarlar.get('subathon_state')!);
    expect(kayit.kalanSn).toBe(535);
    subathon.durdurTik();
    vi.advanceTimersByTime(10 * 3600_000);
    (subathon as any).durumuYukle();
    expect(subathon.durumAl()).toMatchObject({ aktif: false, duraklatildi: true, kalanSaniye: 535 });
    vi.useRealTimers();
  });
});
