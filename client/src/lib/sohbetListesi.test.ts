import { describe, expect, it } from 'vitest';
import { iletiCikar, iletiEkle } from './sohbetListesi';

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
