import { describe, expect, it } from 'vitest';
import { MuzikHost } from './muzik.js';

const depo = { oku: () => '', yaz: () => {} };

describe('Spotify dönüşü: state zorunlu', () => {
  it('boş ya da yanlış state bekleyen yetkiyle eşleşmez (ağa çıkmadan reddedilir)', async () => {
    const h = new MuzikHost(depo, () => {});
    h.yetkiBaslat('0123456789abcdef0123456789abcdef', 'http://127.0.0.1:3012/callback');
    await expect(h.koduTakasEt('saldirgan-kodu-AQBxxxxxxxxxxxxxxxx', '')).rejects.toThrow(/Bekleyen/);
    await expect(h.koduTakasEt('saldirgan-kodu-AQBxxxxxxxxxxxxxxxx', 'yanlis')).rejects.toThrow(/Bekleyen/);
  });
});
