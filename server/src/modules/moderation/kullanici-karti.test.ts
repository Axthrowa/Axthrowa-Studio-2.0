import { describe, expect, it } from 'vitest';
import { kullaniciKarti } from './kullanici-karti';

describe('kullanıcı kartı', () => {
  it('son 20 mesajı eskiden yeniye, cezayı ada göre süzer', () => {
    const mesajlar = Array.from({ length: 25 }, (_, i) => ({ message: `m${i}`, timestamp: i }));
    const kart = kullaniciKarti('Ali', mesajlar, [
      { action: 'VIEWER_NOTE_SAVED', timestamp: 3, details: 'not', target: 'Ali' },
      { action: 'MANUAL_TIMEOUT', timestamp: 2, details: '5 dk', target: '@ali' },
      { action: 'automod:caps', timestamp: 1, details: 'uyari', target: 'ali' },
      { action: 'MANUAL_BAN', timestamp: 4, details: 'ban', target: 'baska' }
    ]);
    expect(kart.mesajlar).toHaveLength(20);
    expect(kart.mesajlar[0].message).toBe('m5');
    expect(kart.mesajlar.at(-1)!.message).toBe('m24');
    expect(kart.cezalar.map((c) => c.action)).toEqual(['MANUAL_TIMEOUT', 'automod:caps']);
  });
});
