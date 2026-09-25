/**
 * StreamAxT — ortak kara liste kuralları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import {
  denemeZamaniGeldi,
  eylemPlani,
  karaListeAdi,
  karaListeEslesir,
  karaListeEylemi,
  karaListePlatformu
} from './blacklist-rules.js';

describe('karaListePlatformu', () => {
  it('bilinen platformları kabul eder, küçük harfe çevirir', () => {
    expect(karaListePlatformu('Twitch')).toBe('twitch');
    expect(karaListePlatformu('trovo')).toBe('trovo');
  });
  it('tümü eş anlamlıları', () => {
    for (const s of ['tum', 'all', '*', 'tümü']) expect(karaListePlatformu(s)).toBe('tum');
  });
  it('bilinmeyen/boş değer eski davranışa (Kick) düşer', () => {
    expect(karaListePlatformu(undefined)).toBe('kick');
    expect(karaListePlatformu('discord')).toBe('kick');
  });
});

describe('karaListeEylemi', () => {
  it('bilinmeyen eylem yok saymaya düşer (geriye uyum)', () => {
    expect(karaListeEylemi(undefined)).toBe('yoksay');
    expect(karaListeEylemi('sil-ve-banla')).toBe('yoksay');
    expect(karaListeEylemi('BAN')).toBe('ban');
  });
});

describe('karaListeAdi', () => {
  it('@ ve boşlukları atar, küçük harfe çevirir', () => {
    expect(karaListeAdi('  @@Spamci_42 ')).toBe('spamci_42');
    expect(karaListeAdi(null)).toBe('');
  });
});

describe('karaListeEslesir', () => {
  it('platforma özgü kayıt yalnız o platformda eşleşir', () => {
    expect(karaListeEslesir('kick', 'kick')).toBe(true);
    expect(karaListeEslesir('kick', 'youtube')).toBe(false);
  });
  it('tüm platformlar kaydı her yerde eşleşir', () => {
    expect(karaListeEslesir('tum', 'youtube')).toBe(true);
  });
  it('platformu yazılmamış eski kayıt Kick sayılır', () => {
    expect(karaListeEslesir(null, 'kick')).toBe(true);
    expect(karaListeEslesir(null, 'twitch')).toBe(false);
  });
});

describe('eylemPlani', () => {
  const hepsi = { ban: true, mesajSil: true };
  it('ban destekleniyorsa banlar (silmeye gerek yok: ban mesajları da kaldırır)', () => {
    expect(eylemPlani('ban', hepsi, 'kick')).toEqual({ sil: false, ban: true });
  });
  it('ban yoksa silmeye, o da yoksa yalnız yok saymaya düşer — notla', () => {
    const silme = eylemPlani('ban', { ban: false, mesajSil: true }, 'discord');
    expect(silme.sil).toBe(true);
    expect(silme.not).toContain('kalıcı ban desteklemiyor');
    const hic = eylemPlani('ban', { ban: false, mesajSil: false }, 'tiktok');
    expect(hic).toMatchObject({ sil: false, ban: false });
    expect(hic.not).toContain('yalnız yok sayıldı');
  });
  it('sil ve yoksay', () => {
    expect(eylemPlani('sil', hepsi, 'twitch')).toEqual({ sil: true, ban: false });
    expect(eylemPlani('sil', { ban: false, mesajSil: false }, 'tiktok').not).toBeTruthy();
    expect(eylemPlani('yoksay', hepsi, 'kick')).toEqual({ sil: false, ban: false });
  });
});

describe('denemeZamaniGeldi', () => {
  it('ilk deneme ve süre dolunca true', () => {
    expect(denemeZamaniGeldi(undefined, 1000, 60_000)).toBe(true);
    expect(denemeZamaniGeldi(1000, 30_000, 60_000)).toBe(false);
    expect(denemeZamaniGeldi(1000, 61_000, 60_000)).toBe(true);
  });
});
