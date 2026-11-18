/**
 * AxBoT — emote ayıklama ve 7TV testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { emoteleriAyikla } from './ayikla.js';
import { bttvAyikla, bttvKanalAyikla, ffzAyikla, TWITCH_ADI, yediTvAyikla } from './yedi-tv.js';
import { boyaCss, renk } from './yedi-tv-boya.js';

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
    expect(r).toEqual([{ ad: 'catJAM', url: 'https://cdn.7tv.app/emote/01ABCDEFGHJK/2x.webp', animasyonlu: true, statik: 'https://cdn.7tv.app/emote/01ABCDEFGHJK/2x_static.webp' }]);
  });

  it('beklenmedik yanıtta boş liste', () => {
    expect(yediTvAyikla(null)).toEqual([]);
    expect(yediTvAyikla({ emotes: 'x' })).toEqual([]);
  });
});

describe('BTTV ve FFZ (sunucu önbelleği)', () => {
  it('yalnız kendi CDN adreslerini kabul eder', () => {
    expect(bttvAyikla([{ id: '54fa8f1401e468494b85b537', code: ':tf:' }, { id: '../x', code: 'kotu' }])).toEqual([
      { ad: ':tf:', url: 'https://cdn.betterttv.net/emote/54fa8f1401e468494b85b537/2x', animasyonlu: false }
    ]);
    const ffz = { sets: { '3': { emoticons: [{ name: 'ZrehplaR', urls: { '2': 'https://cdn.frankerfacez.com/emote/9/2' } }, { name: 'kotu', urls: { '2': 'https://kotu.example/x' } }] } } };
    expect(ffzAyikla(ffz)).toEqual([{ ad: 'ZrehplaR', url: 'https://cdn.frankerfacez.com/emote/9/2', animasyonlu: false }]);
  });
});

describe('WID-4: kanal setleri, durağan kare ve 7TV boyaları', () => {
  it('hareketli 7TV ve BTTV emote durağan adres taşır, durağan olan taşımaz', () => {
    const y = yediTvAyikla({ emotes: [
      { name: 'Hareketli', data: { animated: true, host: { url: '//cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6' } } },
      { name: 'Duragan', data: { animated: false, host: { url: '//cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN7' } } }
    ] });
    expect(y[0].statik).toBe('https://cdn.7tv.app/emote/01FCY771D800007PQ2DF3GDTN6/2x_static.webp');
    expect(y[1].statik).toBeUndefined();
    const b = bttvKanalAyikla({
      channelEmotes: [{ id: '5f3eb452b2efd65d77e867ed', code: 'forsenBlunder', imageType: 'png' }],
      sharedEmotes: [{ id: '55a24e1294dd94001ee86b39', code: 'RareParrot', imageType: 'gif', animated: true }]
    });
    expect(b.map((e) => e.ad)).toEqual(['forsenBlunder', 'RareParrot']);
    expect(b[0].statik).toBeUndefined();
    expect(b[1].statik).toBe('https://cdn.betterttv.net/emote/55a24e1294dd94001ee86b39/static/2x.webp');
  });

  it('Twitch adı adrese yazılmadan önce süzülür', () => {
    expect(TWITCH_ADI.test('xqc')).toBe(true);
    expect(TWITCH_ADI.test('../x')).toBe(false);
    expect(TWITCH_ADI.test('a b')).toBe(false);
  });

  it('7TV rengi RGBA tamsayısından', () => {
    expect(renk(-1857617921)).toBe('rgba(145, 70, 255, 1)');
    expect(renk(970071807)).toBe('rgba(57, 210, 30, 1)');
  });

  it('boya tanımı CSS olur; yabancı görsel adresi kabul edilmez', () => {
    expect(boyaCss({ function: 'LINEAR_GRADIENT', angle: 90, repeat: false, stops: [{ at: 0, color: -16776961 }, { at: 1, color: 65535 }], shadows: [] })).toEqual({
      arkaPlan: 'linear-gradient(90deg, rgba(255, 0, 0, 1) 0%, rgba(0, 0, 255, 1) 100%)'
    });
    const url = boyaCss({ function: 'URL', image_url: 'https://cdn.7tv.app/paint/01JHX/layer/01JMM/1x.webp', shadows: [{ x_offset: 1, y_offset: 1, radius: 0.1, color: 5593087 }] });
    expect(url?.arkaPlan).toBe('url("https://cdn.7tv.app/paint/01JHX/layer/01JMM/1x.webp")');
    expect(url?.golge).toBe('drop-shadow(1px 1px 0.1px rgba(0, 85, 87, 1))');
    expect(boyaCss({ function: 'URL', image_url: 'https://kotu.example/x.png' })).toBeNull();
    expect(boyaCss({ function: 'RADIAL_GRADIENT', shape: 'ellipse', repeat: true, stops: [{ at: 0.5, color: 255 }] })?.arkaPlan).toBe('repeating-radial-gradient(ellipse, rgba(0, 0, 0, 1) 50%)');
  });
});
