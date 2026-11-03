import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE channels (platform TEXT, channel_name TEXT, is_active INTEGER);
  `);
  return { db };
});

const sesli = vi.hoisted(() => ({ calistir: vi.fn(async () => 'tamam') }));
vi.mock('../sesli/sesli.js', () => ({ sesliKomutlar: sesli }));
vi.mock('../muzik/index.js', () => ({ muzikHost: { hariciAdres: () => '' } }));

import { eventBus } from '../../core/event-bus.js';
import { Otomasyon } from './otomasyon.js';
import { kickKanalBilgisi } from './shoutout.js';

const kural = (ek: any = {}) => ({ id: 'k1', ad: 'Hype', tetik: { tur: 'komut', komut: 'hype' }, kosullar: [], eylemler: [{ tur: 'sohbet', metin: 'Selam {kullanici}' }], ...ek });
const mesajlar: any[] = [];
eventBus.on('bot_message', (p: any) => mesajlar.push(p));
let m: Otomasyon;
beforeEach(() => {
  m = new Otomasyon();
  mesajlar.length = 0;
  sesli.calistir.mockClear();
});

describe('otomasyon motoru', () => {
  it('bozuk kural varsa liste hiç yazılmaz', () => {
    expect(m.kaydet([kural()]).ok).toBe(true);
    expect(m.kaydet([kural({ id: 'x' }), { ad: 'bozuk' }]).ok).toBe(false);
    expect(m.kurallar().map((k) => k.id)).toEqual(['k1']);
  });

  it('komut gelince eylem çalışır, bekleme süresince tekrarlanmaz', async () => {
    m.kaydet([kural({ beklemeSn: 10 })]);
    await m.olay({ tur: 'komut', mesaj: '!hype', kullanici: 'ali', platform: 'kick' }, 1000);
    await m.olay({ tur: 'komut', mesaj: '!hype', kullanici: 'veli', platform: 'kick' }, 2000);
    expect(mesajlar.map((p) => p.message)).toEqual(['Selam ali']);
    await m.olay({ tur: 'komut', mesaj: '!hype', kullanici: 'veli', platform: 'kick' }, 12_000);
    expect(mesajlar).toHaveLength(2);
  });

  it('koşulu tutmayan olay beklemeyi harcamaz', async () => {
    m.kaydet([kural({ beklemeSn: 60, kosullar: [{ tur: 'mod' }] })]);
    await m.olay({ tur: 'komut', mesaj: '!hype', mod: false }, 1000);
    expect(mesajlar).toHaveLength(0);
    await m.olay({ tur: 'komut', mesaj: '!hype', mod: true }, 1500);
    expect(mesajlar).toHaveLength(1);
  });

  it('kapalı kural çalışmaz, botun kendi mesajı tetiklemez', async () => {
    m.kaydet([kural({ etkin: false })]);
    await m.olay({ tur: 'komut', mesaj: '!hype' }, 1000);
    m.kaydet([kural()]);
    m.sohbet({ message: '!hype', platform: 'kick', user: { username: 'bot', isSelf: true } } as any);
    await new Promise((r) => setTimeout(r, 10));
    expect(mesajlar).toHaveLength(0);
  });

  it('hata kalan adımları durdurur ve günlüğe düşer', async () => {
    m.kaydet([kural({ eylemler: [{ tur: 'replay' }, { tur: 'sohbet', metin: 'olmamalı' }] })]);
    await m.olay({ tur: 'komut', mesaj: '!hype' }, 1000);
    expect(mesajlar).toHaveLength(0);
    expect(m.gunlukOku()[0]).toMatchObject({ kural: 'Hype', ok: false });
    expect(m.gunlukOku()[0].mesaj).toContain('AxthrowA Studio');
  });

  it('komut eylemi izleyici metniyle doldurulmaz', async () => {
    m.kaydet([kural({ eylemler: [{ tur: 'komut', metin: '!so {mesaj}' }] })]);
    await m.olay({ tur: 'komut', mesaj: '!hype ban', kullanici: 'ali' }, 1000);
    expect(sesli.calistir).toHaveBeenCalledWith({ tur: 'komut', metin: '!so {mesaj}' });
  });

  it('sohbet patlaması eşik dolunca bir kez tetikler', async () => {
    m.kaydet([kural({ tetik: { tur: 'patlama', mesaj: 5, saniye: 10 } })]);
    for (let i = 0; i < 12; i++) await m.olay({ tur: 'patlama' }, 1000 + i);
    expect(mesajlar).toHaveLength(1);
  });

  it('dene hiçbir eylemi çalıştırmaz', async () => {
    const r = await m.dene(kural({ kosullar: [{ tur: 'abone' }], eylemler: [{ tur: 'sohbet', metin: 'x' }, { tur: 'kalkan', durum: 'ac' }] }));
    expect(r).toMatchObject({ ok: true, uyar: true, engel: 'Kullanıcı abone değil', adimlar: ['Sohbete yaz: x', 'Kalkan modunu aç'] });
    expect(mesajlar).toHaveLength(0);
    expect(sesli.calistir).not.toHaveBeenCalled();
  });
});

describe('kickKanalBilgisi', () => {
  it('fotoğraf ve canlı oyunu okur', () => {
    expect(kickKanalBilgisi({ user: { profile_pic: 'https://x/y.png' }, livestream: { categories: [{ name: 'Valorant' }] } })).toEqual({ avatarUrl: 'https://x/y.png', oyun: 'Valorant' });
  });
  it('yayında değilse son yayının oyununa bakar, güvensiz adresi almaz', () => {
    expect(kickKanalBilgisi({ user: { profile_pic: 'javascript:1' }, previous_livestreams: [{ categories: [{ name: 'Sohbet' }] }] })).toEqual({ oyun: 'Sohbet' });
    expect(kickKanalBilgisi(null)).toEqual({});
  });
});
