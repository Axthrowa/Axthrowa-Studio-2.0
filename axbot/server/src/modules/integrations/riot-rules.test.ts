/**
 * AxBoT — League of Legends kuralları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { lolSorgusuCoz, platformCoz, siralamaMetni } from './riot-rules.js';

describe('platformCoz', () => {
  it('kısa adlar ve kodlar', () => {
    expect(platformCoz('TR')).toBe('tr1');
    expect(platformCoz('euw')).toBe('euw1');
    expect(platformCoz('kr')).toBe('kr');
    expect(platformCoz('na1')).toBe('na1');
    expect(platformCoz('mars')).toBeNull();
  });
});

describe('lolSorgusuCoz', () => {
  it('Riot kimliği + bölge; bölgesel küme eşlemesi', () => {
    expect(lolSorgusuCoz('Oyuncu#TR1 tr')).toEqual({ ad: 'Oyuncu', etiket: 'TR1', platform: 'tr1', bolge: 'europe' });
    expect(lolSorgusuCoz('Faker#KR1 kr')?.bolge).toBe('asia');
    expect(lolSorgusuCoz('Kişi#BR1 br')?.bolge).toBe('americas');
  });

  it('oyun adı boşluk içerebilir', () => {
    expect(lolSorgusuCoz('Hide on bush#KR1 kr')).toMatchObject({ ad: 'Hide on bush', etiket: 'KR1', platform: 'kr' });
  });

  it('bölge yazılmazsa varsayılan platform', () => {
    expect(lolSorgusuCoz('Oyuncu#TR1', 'euw1')).toMatchObject({ platform: 'euw1', bolge: 'europe' });
  });

  it('bozuk girdiler reddedilir', () => {
    for (const h of ['', 'Oyuncu', 'Oyuncu# tr', '#TR1 tr', 'Oyuncu#T R1 tr', 'Oyuncu#TR1/../x tr']) {
      expect(lolSorgusuCoz(h)).toBeNull();
    }
  });
});

describe('siralamaMetni', () => {
  it('önce Tekli/Çiftli, galibiyet oranıyla', () => {
    const m = siralamaMetni('Oyuncu#TR1', [
      { queueType: 'RANKED_FLEX_SR', tier: 'SILVER', rank: 'I', leaguePoints: 10, wins: 1, losses: 1 },
      { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 45, wins: 34, losses: 28 }
    ]);
    expect(m).toBe('Oyuncu#TR1 (Tekli/Çiftli): Gold II, 45 LP · 34G 28M · %55');
  });

  it('yalnız Esnek varsa onu gösterir', () => {
    expect(siralamaMetni('A#B1', [{ queueType: 'RANKED_FLEX_SR', tier: 'IRON', rank: 'IV', leaguePoints: 0, wins: 0, losses: 0 }])).toBe(
      'A#B1 (Esnek): Iron IV, 0 LP · 0G 0M'
    );
  });

  it('Usta ve üstünde küme yazılmaz', () => {
    expect(siralamaMetni('A#B1', [{ queueType: 'RANKED_SOLO_5x5', tier: 'CHALLENGER', rank: 'I', leaguePoints: 1200, wins: 300, losses: 200 }])).toBe(
      'A#B1 (Tekli/Çiftli): Challenger, 1200 LP · 300G 200M · %60'
    );
  });

  it('dereceli yoksa söyler', () => {
    expect(siralamaMetni('A#B1', [])).toBe('A#B1: bu sezon dereceli oynamamış');
  });
});
