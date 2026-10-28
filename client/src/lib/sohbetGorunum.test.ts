import { describe, expect, it } from 'vitest';
import { twitchEmoteHaritasi } from '../components/ChatMessageContent.js';
import { kapsa } from '../components/WidgetOnizleme.js';
import { bttvAyikla, ffzAyikla } from './yediTv.js';
import { yaziAilesi, yaziOlcegi } from './widget-style.js';

describe('sohbet emote kaynakları', () => {
  it('Twitch konumları kod noktası sayar (emoji UTF-16 kaydırmaz)', () => {
    const h = twitchEmoteHaritasi('🔥 Kappa selam', { '25': ['2-6'] });
    expect(h.get('Kappa')).toBe('https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0');
  });
  it('BTTV ve FFZ yalnız kendi CDN adreslerini kabul eder', () => {
    expect(bttvAyikla([{ id: '54fa8f1401e468494b85b537', code: ':tf:' }, { id: '../x', code: 'kotu' }])).toEqual([[':tf:', 'https://cdn.betterttv.net/emote/54fa8f1401e468494b85b537/2x']]);
    const ffz = { sets: { '3': { emoticons: [{ name: 'ZrehplaR', urls: { '2': 'https://cdn.frankerfacez.com/emote/9/2' } }, { name: 'kotu', urls: { '2': 'https://kotu.example/x' } }] } } };
    expect(ffzAyikla(ffz)).toEqual([['ZrehplaR', 'https://cdn.frankerfacez.com/emote/9/2']]);
  });
});

describe('sohbet yazı tipi', () => {
  it('rakamlı ad tırnaklanır, yedek eklenir; boyut oranı tırnaklı değerden de okunur', () => {
    expect(yaziAilesi('Press Start 2P')).toBe('"Press Start 2P", system-ui, sans-serif');
    expect(yaziOlcegi(yaziAilesi('Teko'))).toBe(1.3);
    expect(yaziOlcegi('Inter')).toBe(1);
  });
});

describe('önizleme odağı', () => {
  it('yalnız büyür; değişmezse aynı nesne döner', () => {
    const a = { x: 10, y: 10, w: 100, h: 50 };
    expect(kapsa(a, { x: 20, y: 20, w: 10, h: 10 })).toBe(a);
    expect(kapsa(a, { x: 0, y: 30, w: 50, h: 100 })).toEqual({ x: 0, y: 10, w: 110, h: 120 });
  });
});
