/**
 * AxBoT — !nuke / !vanish hedef seçimi testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { SonMesajlar, kendiMesajlari, nukeArgumanlari, nukeHedefleri, TAMPON_BOYUTU, type KayitliMesaj } from './son-mesajlar.js';

const m = (id: string, kullanici: string, metin: string, zaman: number, muaf = false, platform = 'kick'): KayitliMesaj => ({
  id,
  platform,
  kullanici,
  gorunenAd: kullanici,
  metin,
  zaman,
  muaf
});

describe('!nuke', () => {
  const liste = [
    m('1', 'eski', 'spam linki', 0),
    m('2', 'ali', 'bedava SPAM burada', 200_000),
    m('3', 'mod1', 'spam yazmayın', 210_000, true),
    m('4', 'veli', 'merhaba', 220_000),
    m('5', 'ayse', 'spammer geldi', 230_000, false, 'twitch')
  ];
  it('pencere içinde, muaf olmayan, kalıba uyanları seçer (yeniden eskiye)', () => {
    const { hedefler } = nukeHedefleri(liste, 'spam*', 240_000);
    expect(hedefler.map((h) => h.id)).toEqual(['5', '2']);
  });
  it('platform süzgeci', () => {
    expect(nukeHedefleri(liste, 'spam*', 240_000, undefined, 'kick').hedefler.map((h) => h.id)).toEqual(['2']);
  });
  it('regex kalıbı ve geçersiz kalıp', () => {
    expect(nukeHedefleri(liste, '~/^bedava/i', 240_000).hedefler.map((h) => h.id)).toEqual(['2']);
    expect(nukeHedefleri(liste, '~/(a+)+/', 240_000).gecersiz).toBe(true);
  });
  it('argümanlar: son sayı süre', () => {
    expect(nukeArgumanlari(['bedava', 'link', '600'])).toEqual({ kalip: 'bedava link', sureSn: 600 });
    expect(nukeArgumanlari(['600'])).toEqual({ kalip: '600', sureSn: 0 });
    expect(nukeArgumanlari(['~/x+/'])).toEqual({ kalip: '~/x+/', sureSn: 0 });
  });
});

describe('!vanish ve tampon', () => {
  it('kişinin kendi son mesajları', () => {
    const l = [m('1', 'Ali', 'a', 100), m('2', 'ali', 'b', 150), m('3', 'veli', 'c', 160), m('4', 'ali', 'd', 170, false, 'twitch')];
    expect(kendiMesajlari(l, 'ALI', 'kick', 200).map((x) => x.id)).toEqual(['1', '2']);
  });
  it('tampon sınırlı ve çıkarılan mesajlar yeniden hedeflenmez', () => {
    const t = new SonMesajlar();
    for (let i = 0; i < TAMPON_BOYUTU + 20; i++) t.ekle(m(String(i), 'u', 'x', i));
    expect(t.tumu()).toHaveLength(TAMPON_BOYUTU);
    t.cikar(new Set([String(TAMPON_BOYUTU + 19)]));
    expect(t.tumu().some((x) => x.id === String(TAMPON_BOYUTU + 19))).toBe(false);
  });
});
