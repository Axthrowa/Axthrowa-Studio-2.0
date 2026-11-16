/**
 * AxBoT — Host / WebSocket köken ve hız sınırı testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { ayniKokenMi, ekHostlariCoz, hostAdi, izinliHostMu, kokenKabulEdilir } from './origin-guard.js';
import { HizSiniri, kuralBul, type HizKurali } from './rate-limit.js';

describe('hostAdi', () => {
  it('portu ve köşeli parantezi atar', () => {
    expect(hostAdi('127.0.0.1:3001')).toBe('127.0.0.1');
    expect(hostAdi('[::1]:3001')).toBe('::1');
    expect(hostAdi('LocalHost:80')).toBe('localhost');
    expect(hostAdi('')).toBe('');
    expect(hostAdi(undefined)).toBe('');
  });
});

describe('izinliHostMu — DNS rebinding koruması', () => {
  it('döngü adresleri kabul', () => {
    expect(izinliHostMu('localhost:3001')).toBe(true);
    expect(izinliHostMu('127.0.0.1:3001')).toBe(true);
    expect(izinliHostMu('[::1]:3001')).toBe(true);
  });

  it('SALDIRGANIN alan adı reddedilir (127.0.0.1ʼe çözdürse bile)', () => {
    expect(izinliHostMu('kotu-site.com:3001')).toBe(false);
    expect(izinliHostMu('127.0.0.1.kotu.com')).toBe(false);
  });

  it('bu makinenin LAN IPʼsi (LAN kipinde OBS) kabul', () => {
    expect(izinliHostMu('192.168.1.5:3001', new Set(['192.168.1.5']))).toBe(true);
    expect(izinliHostMu('192.168.1.6:3001', new Set(['192.168.1.5']))).toBe(false);
  });

  it('kullanıcının eklediği adlar kabul', () => {
    expect(izinliHostMu('yayin.local:3001', new Set(), ekHostlariCoz('yayin.local, ev-pc'))).toBe(true);
    expect(izinliHostMu('ev-pc', new Set(), ekHostlariCoz('yayin.local, ev-pc'))).toBe(true);
  });

  it('Host başlığı yoksa (HTTP/1.0 istemci) engellenmez', () => {
    expect(izinliHostMu(undefined)).toBe(true);
  });
});

describe('kokenKabulEdilir — WebSocket ele geçirme (CSWSH) koruması', () => {
  it('yabancı web sitesi reddedilir', () => {
    expect(kokenKabulEdilir('https://kotu-site.com', '127.0.0.1:3001')).toBe(false);
    expect(kokenKabulEdilir('http://evil.example', 'localhost:3001')).toBe(false);
  });

  it('yerel panel ve OBS kaynağı kabul', () => {
    expect(kokenKabulEdilir('http://127.0.0.1:3001', '127.0.0.1:3001')).toBe(true);
    expect(kokenKabulEdilir('http://localhost:5173', 'localhost:3001')).toBe(true);
  });

  it('LAN kipinde sunucunun KENDİ kökeni kabul (aynı köken)', () => {
    expect(kokenKabulEdilir('http://192.168.1.5:3001', '192.168.1.5:3001')).toBe(true);
  });

  it('aynı ad ama FARKLI port aynı köken değildir', () => {
    expect(ayniKokenMi('http://192.168.1.5:8080', '192.168.1.5:3001')).toBe(false);
  });

  it('köken yoksa (tarayıcı dışı istemci) kabul; "null" köken reddedilir', () => {
    expect(kokenKabulEdilir(undefined, '127.0.0.1:3001')).toBe(true);
    expect(kokenKabulEdilir('null', '127.0.0.1:3001')).toBe(false);
  });
});

describe('hız sınırı (S7)', () => {
  const kural: HizKurali = { ad: 't', desen: /.*/, pencereMs: 1000, sinir: 3 };

  it('sınıra kadar izin verir, sonra bekleme süresiyle reddeder', () => {
    const h = new HizSiniri();
    expect(h.izinVer('a', kural, 0).ok).toBe(true);
    expect(h.izinVer('a', kural, 10).ok).toBe(true);
    expect(h.izinVer('a', kural, 20).ok).toBe(true);
    const r = h.izinVer('a', kural, 30);
    expect(r.ok).toBe(false);
    expect(r.bekleMs).toBe(970);
  });

  it('pencere kayınca yeniden izin verir', () => {
    const h = new HizSiniri();
    for (let i = 0; i < 3; i++) h.izinVer('a', kural, i);
    expect(h.izinVer('a', kural, 500).ok).toBe(false);
    expect(h.izinVer('a', kural, 1001).ok).toBe(true);
  });

  it('reddedilen istek sayılmaz — döngü pencereyi uzatmaz', () => {
    const h = new HizSiniri();
    for (let i = 0; i < 3; i++) h.izinVer('a', kural, 0);
    for (let i = 0; i < 50; i++) h.izinVer('a', kural, 100);
    expect(h.izinVer('a', kural, 1001).ok).toBe(true);
  });

  it('anahtarlar birbirinden bağımsız', () => {
    const h = new HizSiniri();
    for (let i = 0; i < 3; i++) h.izinVer('a', kural, 0);
    expect(h.izinVer('b', kural, 0).ok).toBe(true);
  });

  it('temizle süresi dolmuş kovaları atar', () => {
    const h = new HizSiniri();
    h.izinVer('a', kural, 0);
    h.temizle(120_000, 60_000);
    expect(h.boyut).toBe(0);
  });

  it('özel kural genelden önce eşleşir', () => {
    expect(kuralBul('POST', '/media')?.ad).toBe('medya-yukleme');
    expect(kuralBul('POST', '/integrations/discord/test')?.ad).toBe('discord-test');
    expect(kuralBul('POST', '/alerts/backup/import')?.ad).toBe('ice-aktarma');
    expect(kuralBul('POST', '/commands')?.ad).toBe('yazma');
    expect(kuralBul('DELETE', '/media/abc')?.ad).toBe('yazma');
    expect(kuralBul('GET', '/media')?.ad).toBe('okuma');
  });
});
