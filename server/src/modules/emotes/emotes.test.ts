/**
 * AxBoT — emote ayıklama ve 7TV testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { emoteleriAyikla } from './ayikla.js';
import { yediTvAyikla } from './yedi-tv.js';

describe('emoteleriAyikla', () => {
  const harita = new Map([['catJAM', 'https://cdn.7tv.app/emote/01ABCDEFGHJK/2x.webp']]);

  it('Kick, 7TV ve emoji', () => {
    const r = emoteleriAyikla('selam [emote:37226:KEKW] catJAM 🔥 👍🏽', harita);
    expect(r).toEqual([
      { ad: 'KEKW', url: 'https://files.kick.com/emotes/37226/fullsize' },
      { ad: 'catJAM', url: 'https://cdn.7tv.app/emote/01ABCDEFGHJK/2x.webp' },
      { ad: '🔥' },
      { ad: '👍🏽' }
    ]);
  });

  it('metindeki sırayı korur (bitişik Kick emote dahil)', () => {
    expect(emoteleriAyikla('🔥 a[emote:1:A]b catJAM', harita).map((e) => e.ad)).toEqual(['🔥', 'A', 'catJAM']);
  });

  it('sınır uygulanır, düz metin boş döner', () => {
    expect(emoteleriAyikla('🔥🔥🔥🔥🔥', harita, 3)).toHaveLength(3);
    expect(emoteleriAyikla('merhaba dünya', harita)).toEqual([]);
    expect(emoteleriAyikla('', harita)).toEqual([]);
  });

  it('bozuk Kick işaretlemesi görsel üretmez', () => {
    expect(emoteleriAyikla('[emote:abc:x] [emote:1:<img src=x>]', harita).filter((e) => e.url)).toEqual([]);
  });
});

describe('yediTvAyikla', () => {
  it('yalnız cdn.7tv.app adreslerini kabul eder', () => {
    const r = yediTvAyikla({
      emotes: [
        { name: 'catJAM', data: { animated: true, host: { url: '//cdn.7tv.app/emote/01ABCDEFGHJK' } } },
        { name: 'kotu', data: { host: { url: '//evil.example/emote/01ABCDEFGHJK' } } },
        { name: 'bo sluk', data: { host: { url: '//cdn.7tv.app/emote/01ABCDEFGHJK' } } },
        { name: 'catJAM', data: { host: { url: '//cdn.7tv.app/emote/01ZZZZZZZZZZ' } } }
      ]
    });
    expect(r).toEqual([{ ad: 'catJAM', url: 'https://cdn.7tv.app/emote/01ABCDEFGHJK/2x.webp', animasyonlu: true }]);
  });

  it('beklenmedik yanıtta boş liste', () => {
    expect(yediTvAyikla(null)).toEqual([]);
    expect(yediTvAyikla({ emotes: 'x' })).toEqual([]);
  });
});
