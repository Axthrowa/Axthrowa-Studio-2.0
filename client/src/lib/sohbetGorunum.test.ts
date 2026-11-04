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

import { emoteBoyu, komboBitisi, patlamaParcalari, toplanmaBaslangici, ucusSuresi } from '../widgets/EmoteComboWidget.js';

describe('emote kombo', () => {
  it('geldikçe büyür, kutuya sığacak kadarla sınırlı', () => {
    expect(emoteBoyu(100, 2, 2, 1000)).toBe(100);
    expect(emoteBoyu(100, 4, 2, 1000)).toBe(170);
    expect(emoteBoyu(100, 50, 2, 1000)).toBe(700);
    // Küçük kutuda da taban boyun altına inmez
    expect(emoteBoyu(100, 50, 2, 50)).toBe(100);
  });

  it('dağılan parçalar ekrandan çıkar ve her yöne gider', () => {
    const p = patlamaParcalari(10, 400, 200, 50);
    expect(p.length).toBe(28);
    // Her parça kutunun dışında biter (emote yarım boyuyla da taşmış olmalı)
    expect(p.every((x) => Math.abs(x.dx) > 200 + 25 * x.olcek || Math.abs(x.dy) > 100 + 25 * x.olcek)).toBe(true);
    expect(new Set(p.map((x) => `${Math.sign(x.dx)},${Math.sign(x.dy)}`)).size).toBe(4);
  });

  it('toplanan emote kutunun dışından başlar', () => {
    for (let i = 0; i < 50; i++) {
      const g = toplanmaBaslangici(i, 400, 200, 50);
      expect(Math.abs(g.dx) >= 200 || Math.abs(g.dy) >= 100).toBe(true);
    }
  });
});

import { bulunamadiDurumu, sozGizlensinMi } from '../widgets/LyricsWidget.js';

describe('söz bulunamayınca', () => {
  it('yazı süre boyunca kalır, sonra gizlenir; yeni şarkıda ve söz bulununca açılır', () => {
    const a = bulunamadiDurumu(null, 'A', true, 6, 1000);
    expect(a.gizle).toBe(false);
    expect(bulunamadiDurumu(a.iz, 'A', true, 6, 6999).gizle).toBe(false);
    const b = bulunamadiDurumu(a.iz, 'A', true, 6, 7000);
    expect(b.gizle).toBe(true);
    expect(bulunamadiDurumu(b.iz, 'B', true, 6, 8000).gizle).toBe(false);
    expect(bulunamadiDurumu(b.iz, 'B', false, 6, 8000)).toEqual({ iz: null, gizle: false });
  });

  it('süre 0 ise yazı hep kalır', () => {
    expect(bulunamadiDurumu({ sarki: 'A', an: 0 }, 'A', true, 0, 999999).gizle).toBe(false);
  });
});

describe('şarkı sözleri', () => {
  it('şarkı durunca ya da bitince gizlenir', () => {
    expect(sozGizlensinMi({ title: 'A', isPlaying: false })).toBe(true);
    expect(sozGizlensinMi({ title: '', isPlaying: true })).toBe(true);
    expect(sozGizlensinMi({ title: 'A', isPlaying: true, progressMs: 200_000, durationMs: 200_000 })).toBe(true);
    expect(sozGizlensinMi({ title: 'A', isPlaying: true, progressMs: 1000, durationMs: 200_000 })).toBe(false);
    // İstek kuyruğu: çalma bilgisi yok, karar verilmez
    expect(sozGizlensinMi({ title: 'A', isPlaying: null })).toBe(false);
  });
});

describe('emote kombo zamanlaması', () => {
  it('hız yalnız uçuşu değiştirir', () => {
    expect(ucusSuresi(1)).toBe(1500);
    expect(ucusSuresi(0.5)).toBe(3000);
    expect(ucusSuresi(3)).toBe(500);
  });
  it('kombo son emote merkeze vardıktan sonra biter: en yavaş hızda bile varmadan patlamaz', () => {
    for (const hiz of [0.1, 0.25, 0.45, 1, 3]) {
      expect(komboBitisi(hiz, 2500)).toBe(ucusSuresi(hiz) + 2500);
      expect(komboBitisi(hiz, 0)).toBeGreaterThan(ucusSuresi(hiz));
    }
  });
});
