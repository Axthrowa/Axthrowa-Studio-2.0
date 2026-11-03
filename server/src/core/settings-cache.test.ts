import { describe, expect, it } from 'vitest';
import { kickSirriTohumu, tohumKimlikleri } from './settings-cache.js';

describe("Studio'dan gelen Kick sırrı", () => {
  it('yalnız boş ayara ve aynı uygulamaya yazılır', () => {
    expect(kickSirriTohumu('a', 's', 'a', '')).toEqual({ id: 'a', sir: 's' });
    expect(kickSirriTohumu('a', 's', undefined, undefined)).toEqual({ id: 'a', sir: 's' });
    expect(kickSirriTohumu('a', 's', 'b', '')).toBeNull();
    expect(kickSirriTohumu('a', 's', 'a', 'eski')).toBeNull();
    expect(kickSirriTohumu(undefined, undefined, 'a', '')).toBeNull();
  });
});

describe('pakete eklenen Client ID', () => {
  it('yalnız izinli anahtarlar ve geçerli biçim alınır: sır ya da başka ayar yazılamaz', () => {
    const s = tohumKimlikleri({
      kick_client_id: 'ornek_kick_istemci_1',
      spotify_client_id: 'bad value with spaces',
      kick_client_secret: 'gizli-deger-12345',
      admin: 'true'
    });
    expect(s).toEqual({ kick_client_id: 'ornek_kick_istemci_1' });
    expect(tohumKimlikleri({})).toEqual({});
  });
});
