import { describe, expect, it } from 'vitest';
import { kickTakipciSayisi, twitchTakipciSayisi } from './takipci.js';

describe('takipçi sayısı', () => {
  it('Kick ve Twitch yanıtından sayıyı okur', () => {
    expect(kickTakipciSayisi({ followers_count: 1250 })).toBe(1250);
    expect(kickTakipciSayisi({ followersCount: '40' })).toBe(40);
    expect(kickTakipciSayisi({})).toBeNull();
    expect(twitchTakipciSayisi({ total: 88 })).toBe(88);
    expect(twitchTakipciSayisi({})).toBeNull();
  });
});
