/**
 * StreamAxT — Gemini hata açıklaması testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { anahtarSorunu, hataNedeni } from './gemini-hata.js';

const govde = (neden: string) =>
  JSON.stringify({ error: { code: 401, status: 'UNAUTHENTICATED', details: [{ '@type': 'x', reason: neden }] } });

describe('Gemini anahtar hataları', () => {
  it('servise kapalı anahtar (gerçek gözlem: AQ. biçimli anahtar)', () => {
    expect(hataNedeni(govde('API_KEY_SERVICE_BLOCKED'))).toBe('API_KEY_SERVICE_BLOCKED');
    const m = anahtarSorunu(govde('ACCESS_TOKEN_TYPE_UNSUPPORTED'), 'AQ.ornek');
    expect(m).toContain('Gemini API');
    expect(m).toContain("'AIza'");
    expect(m).toContain('aistudio.google.com/apikey');
  });
  it('geçersiz anahtar ve kapalı servis', () => {
    expect(anahtarSorunu('API key not valid. Please pass a valid API key.', 'AIzaX')).toMatch(/geçersiz/);
    expect(anahtarSorunu(govde('SERVICE_DISABLED'), 'AIzaX')).toMatch(/etkinleştir/);
  });
  it('anahtarla ilgisiz hata null', () => {
    expect(anahtarSorunu('429 quota exceeded', 'AIzaX')).toBeNull();
    expect(anahtarSorunu('fetch failed', '')).toBeNull();
  });
});
