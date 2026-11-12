import { describe, expect, it } from 'vitest';
import { iletiCikar, iletiEkle, iletiVurgula } from './sohbetListesi';

describe('sohbet listesi', () => {
  it('sınırı aşınca en ESKİ iletiyi atar (en yeni hep kalır)', () => {
    let l: number[] = [];
    for (let i = 1; i <= 6; i++) l = iletiEkle(l, i, 5);
    expect(l).toEqual([2, 3, 4, 5, 6]);
  });

  it('moderatörün sildiği ileti ve yasaklanan kullanıcının iletileri çıkar', () => {
    const l = [
      { kaynakId: 'a', platform: 'kick', kullanici: 'ali' },
      { kaynakId: 'b', platform: 'kick', kullanici: 'veli' },
      { kaynakId: 'a', platform: 'twitch', kullanici: 'ali' },
      { kaynakId: 'c', platform: 'kick', kullanici: 'ali' }
    ];
    expect(iletiCikar(l, { platform: 'kick', id: 'a' }).map((m) => m.kaynakId + m.platform)).toEqual(['bkick', 'atwitch', 'ckick']);
    expect(iletiCikar(l, { platform: 'kick', kullanici: 'ALI' }).map((m) => m.kaynakId + m.platform)).toEqual(['bkick', 'atwitch']);
    expect(iletiCikar(l, {})).toBe(l);
  });
});

describe('iletiVurgula', () => {
  type O = { kaynakId?: string; platform: string; metin: string; vurguBitis?: number };
  const liste: O[] = [
    { kaynakId: 'a', platform: 'twitch', metin: 'bir' },
    { kaynakId: 'b', platform: 'kick', metin: 'iki' },
  ];

  it('listedeki iletiyi yerinde işaretler', () => {
    const s = iletiVurgula<O>(liste, { platform: 'kick', id: 'b' }, 99, () => ({ platform: 'kick', metin: 'yeni' }), 10);
    expect(s).toHaveLength(2);
    expect(s[1].vurguBitis).toBe(99);
    expect(s[0].vurguBitis).toBeUndefined();
  });

  it('listede yoksa (başka platformda aynı kimlik dahil) vurgulu ekler', () => {
    const s = iletiVurgula<O>(liste, { platform: 'twitch', id: 'b' }, 5, () => ({ platform: 'twitch', kaynakId: 'b', metin: 'yeni' }), 2);
    expect(s).toHaveLength(2);
    expect(s[1]).toMatchObject({ metin: 'yeni', vurguBitis: 5 });
  });
});
