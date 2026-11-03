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

describe('subathon olay kuralları', () => {
  it('abone, hediye, bağış, KICKs süre ekler; kaynak kapatılınca eklemez', async () => {
    const { eventBus } = await import('../../core/event-bus.js');
    const { subathon } = await import('./subathon.js');
    subathon.baglaOlaylar();
    subathon.durdurTik();
    subathon.ayarYaz({ aboneDakika: 5, hediyeAboneDakika: 2, bagisDakika: 10, bagisBirimi: 50, kicksDakika: 1, kicksBirimi: 100 });
    subathon.baslat(60);
    const eklenen = () => subathon.durumAl().eklenenSaniye;
    eventBus.emit('sub', { username: 'a', isGift: false });
    expect(eklenen()).toBe(300);
    eventBus.emit('sub', { username: 'a', isGift: true, count: 3 });
    expect(eklenen()).toBe(300 + 360);
    eventBus.emit('tip', { username: 'a', amount: 100 });
    expect(eklenen()).toBe(660 + 1200);
    eventBus.emit('kicks', { username: 'a', amount: 250 });
    expect(eklenen()).toBe(1860 + 120);
    eventBus.emit('sub', { username: 'a', isGift: false, isTest: true });
    expect(eklenen()).toBe(1980);

    subathon.ayarYaz({ aboneAcik: false, hediyeAcik: false, bagisAcik: false, kicksAcik: false, takipAcik: false });
    eventBus.emit('sub', { username: 'a', isGift: false });
    eventBus.emit('sub', { username: 'a', isGift: true, count: 3 });
    eventBus.emit('tip', { username: 'a', amount: 100 });
    eventBus.emit('kicks', { username: 'a', amount: 250 });
    eventBus.emit('follow', { username: 'a' });
    expect(eklenen()).toBe(1980);
    subathon.ayarYaz({ aboneAcik: true, hediyeAcik: true, bagisAcik: true, kicksAcik: true, takipAcik: true });
    subathon.sifirla();
    eventBus.removeAllListeners('sub');
    eventBus.removeAllListeners('tip');
    eventBus.removeAllListeners('kicks');
    eventBus.removeAllListeners('follow');
  });
});

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

    // Duraklıyken elle ekleme/çıkarma saklı süreyi değiştirir; otomatik olay değiştirmez
    expect(subathon.sureEkle(300, 'elle', true).kalanSaniye).toBe(835);
    expect(subathon.sureEkle(-900, 'elle', true)).toMatchObject({ kalanSaniye: 0, duraklatildi: false });
    expect(subathon.sureEkle(600, 'abone').kalanSaniye).toBe(0);
    vi.useRealTimers();
  });
});
