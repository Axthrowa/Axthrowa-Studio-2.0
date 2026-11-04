/**
 * AxBoT — kopunca yeniden bağlanan soket testleri
 * Developed by AxthrowA
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KaliciSoket } from './kaliciSoket.js';

class SahteWs {
  static tumu: SahteWs[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  kapatildi = false;
  constructor(public url: string) {
    SahteWs.tumu.push(this);
  }
  close() {
    this.kapatildi = true;
  }
}

describe('KaliciSoket', () => {
  beforeEach(() => {
    SahteWs.tumu = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', SahteWs);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('kopunca yeniden bağlanır, iletiler yeni soketten de gelir', () => {
    const s = new KaliciSoket('ws://x/ws');
    const gelen: string[] = [];
    s.onmessage = (e) => gelen.push(String(e.data));
    let yeniden = 0;
    s.onyenidenbaglandi = () => yeniden++;

    SahteWs.tumu[0].onopen?.();
    SahteWs.tumu[0].onmessage?.({ data: 'bir' });
    SahteWs.tumu[0].onclose?.();
    expect(SahteWs.tumu).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(SahteWs.tumu).toHaveLength(2);
    SahteWs.tumu[1].onopen?.();
    SahteWs.tumu[1].onmessage?.({ data: 'iki' });
    expect(gelen).toEqual(['bir', 'iki']);
    expect(yeniden).toBe(1); // ilk açılış sayılmaz
    s.close();
  });

  it('aynı adres tek bağlantıyı paylaşır, son üye çıkınca kapanır', async () => {
    const a = new KaliciSoket('ws://x/ws');
    const gelenA: string[] = [];
    a.onmessage = (e) => {
      gelenA.push(String(e.data));
      throw new Error('widget hatası');
    };
    const hata = vi.spyOn(console, 'error').mockImplementation(() => {});
    SahteWs.tumu[0].onopen?.();
    SahteWs.tumu[0].onmessage?.({ data: '{"type":"init","data":1}' });

    const b = new KaliciSoket('ws://x/ws');
    const gelenB: string[] = [];
    let acildi = 0;
    b.onmessage = (e) => gelenB.push(String(e.data));
    b.onacildi = () => acildi++;
    await Promise.resolve();
    expect(SahteWs.tumu).toHaveLength(1);
    expect(acildi).toBe(1);
    expect(gelenB).toEqual(['{"type":"init","data":1}']); // sonradan katılan init'i kaçırmaz

    SahteWs.tumu[0].onmessage?.({ data: 'iki' });
    hata.mockRestore();
    expect(gelenA).toHaveLength(2);
    expect(gelenB).toHaveLength(2); // A'nın hatası B'yi kesmedi

    a.close();
    expect(SahteWs.tumu[0].kapatildi).toBe(false);
    b.close();
    expect(SahteWs.tumu[0].kapatildi).toBe(true);
  });

  it('kapatılınca bir daha bağlanmaz', () => {
    const s = new KaliciSoket('ws://x/ws');
    s.close();
    expect(SahteWs.tumu[0].kapatildi).toBe(true);
    SahteWs.tumu[0].onclose?.();
    vi.advanceTimersByTime(20_000);
    expect(SahteWs.tumu).toHaveLength(1);
  });
});
