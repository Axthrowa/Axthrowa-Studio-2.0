import { describe, expect, it } from 'vitest';
import { takipciSayisiniYaz, hedefArtisi, hedefleriIlerlet, sonrakiBasamak, hedefToplamlari } from './hedefler.js';

describe('hedef ilerlemesi (sunucuda kalıcı)', () => {
  it('gerçek olay ilgili hedefi artırır; test ve yeniden oynatma saymaz; panelde değiştirilen tür geçerli', () => {
    const ayarlar: Record<string, Record<string, unknown>> = { 'donation-goal': { current: 100 }, 'follower-goal': { type: 'tip', current: 5 } };
    const yazilan: Array<[string, unknown]> = [];
    const oku = (id: string) => ayarlar[id] || {};
    const yaz = (id: string, g: Record<string, unknown>) => yazilan.push([id, g.current]);
    hedefleriIlerlet('tip', { amount: 25.5 }, oku, yaz);
    expect(yazilan).toEqual([['donation-goal', 125.5], ['follower-goal', 30.5]]);
    yazilan.length = 0;
    hedefleriIlerlet('tip', { amount: 50, isTest: true }, oku, yaz);
    hedefleriIlerlet('tip', { amount: 50, isReplay: true }, oku, yaz);
    expect(yazilan).toEqual([]);
    expect(hedefArtisi('sub', 'sub', { isGift: true, count: 5 })).toBe(5);
    expect(hedefArtisi('follower', 'follow', {})).toBe(1);
    expect(hedefArtisi('kicks', 'tip', { amount: 5 })).toBe(0);
  });

  it('takipçi hedefi gerçek sayıyı izler, ayrıca artmaz; kapatılınca olay başına artar', () => {
    const ayarlar: Record<string, Record<string, unknown>> = { 'follower-goal': { current: 10 } };
    const yazilan: unknown[] = [];
    const yaz = (id: string, g: Record<string, unknown>) => yazilan.push([id, g.current]);
    takipciSayisiniYaz(21, (id) => ayarlar[id] || {}, yaz);
    expect(yazilan).toEqual([['follower-goal', 21]]);
    yazilan.length = 0;
    hedefleriIlerlet('follow', {}, (id) => ayarlar[id] || {}, yaz);
    expect(yazilan).toEqual([]);
    ayarlar['follower-goal'] = { current: 10, gercekSayi: false };
    takipciSayisiniYaz(21, (id) => ayarlar[id] || {}, yaz);
    expect(yazilan).toEqual([]);
    hedefleriIlerlet('follow', {}, (id) => ayarlar[id] || {}, yaz);
    expect(yazilan).toEqual([['follower-goal', 11]]);
  });

  it('dolunca sonraki basamağa geçer: 100 → 250, aşarsa bir sonrakine', () => {
    expect(sonrakiBasamak(40, 100)).toBeNull();
    expect(sonrakiBasamak(100, 100)).toBe(250);
    expect(sonrakiBasamak(300, 100)).toBe(500);
    const ayarlar: Record<string, Record<string, unknown>> = { 'donation-goal': { current: 90, target: 100, type: 'tip' } };
    const yazilan: Record<string, unknown>[] = [];
    hedefleriIlerlet('tip', { amount: 20 }, (id) => ayarlar[id] || {}, (_id, g) => yazilan.push(g));
    expect(yazilan).toEqual([{ current: 110, target: 250 }]);
  });

  it('Kick takipçisi ve kayıtlı olaylar hedef toplamını yazar, test olayını saymaz', () => {
    const toplam = hedefToplamlari(
      [
        { event_type: 'sub', amount: null, metadata: null },
        { event_type: 'gift_sub', amount: null, metadata: JSON.stringify({ count: 3 }) },
        { event_type: 'tip', amount: 40, metadata: null },
        { event_type: 'tip', amount: 10, metadata: JSON.stringify({ isTest: true }) },
        { event_type: 'kicks', amount: 25, metadata: null }
      ],
      480
    );
    expect(toplam).toEqual({ follower: 480, sub: 4, tip: 40, kicks: 25 });
  });
});
