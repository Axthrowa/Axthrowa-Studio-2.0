import { describe, expect, it } from 'vitest';
import { arkasiniGizlerMi, cakisincaGizlenirMi, gizlenecekKatmanlar, kutularCakisiyor } from './katmanCakisma.js';

const kutu = (x: number, y: number, width = 100, height = 100, scale = 1) => ({ x, y, width, height, scale });

describe('kutularCakisiyor', () => {
  it('kesişeni bulur, kenarı değeni saymaz', () => {
    expect(kutularCakisiyor(kutu(0, 0), kutu(50, 50))).toBe(true);
    expect(kutularCakisiyor(kutu(0, 0), kutu(100, 0))).toBe(false);
    expect(kutularCakisiyor(kutu(0, 0), kutu(0, 200))).toBe(false);
  });
  it('widget ölçeğini hesaba katar', () => {
    expect(kutularCakisiyor(kutu(0, 0, 100, 100, 2), kutu(150, 0))).toBe(true);
    expect(kutularCakisiyor(kutu(0, 0, 100, 100, 0.5), kutu(60, 0))).toBe(false);
  });
});

describe('gizlenecekKatmanlar', () => {
  const kutular = [
    { anahtar: 'polls', kutu: kutu(0, 0), gizlenmez: true },
    { anahtar: 'trivia', kutu: kutu(50, 0), gizlenmez: true },
    { anahtar: 'chat', kutu: kutu(50, 50) },
    { anahtar: 'goals', kutu: kutu(500, 500) },
    { anahtar: 'alerts', kutu: kutu(0, 0), gizlenmez: true },
    { anahtar: 'kappagen', kutu: kutu(0, 0, 1920, 1080), tamEkran: true },
  ];
  it('etkin katman yoksa hiçbir şey gizlenmez', () => {
    expect(gizlenecekKatmanlar(kutular, []).size).toBe(0);
  });
  it('yalnız bölgedekini gizler; bildirim, tam ekran ve öncelikliler kalır', () => {
    expect([...gizlenecekKatmanlar(kutular, ['polls'])]).toEqual(['chat']);
  });
  it('bildirim de arkasındakini gizler; ayarı kapatılan widget gizlenmez', () => {
    expect([...gizlenecekKatmanlar(kutular, ['alerts'])]).toEqual(['chat']);
    const ayarli = kutular.map((k) => (k.anahtar === 'chat' ? { ...k, gizlenmez: true } : k));
    expect(gizlenecekKatmanlar(ayarli, ['alerts']).size).toBe(0);
  });
  it('widget kendini gizlemez, ayar verilmezse varsayılan geçerlidir', () => {
    expect(gizlenecekKatmanlar([{ anahtar: 'chat', kutu: kutu(0, 0) }], ['chat']).size).toBe(0);
    expect(arkasiniGizlerMi('alerts')).toBe(true);
    expect(arkasiniGizlerMi('alerts', { arkasiniGizle: false })).toBe(false);
    expect(arkasiniGizlerMi('wheel', { arkasiniGizle: true })).toBe(true);
    expect(cakisincaGizlenirMi('chat')).toBe(true);
    expect(cakisincaGizlenirMi('chat', { cakisincaGizle: false })).toBe(false);
    expect(cakisincaGizlenirMi('alerts')).toBe(false);
  });
  it('kapalı öncelikli katman (listede yok) kimseyi gizlemez', () => {
    expect(gizlenecekKatmanlar(kutular.slice(2), ['polls']).size).toBe(0);
  });
});
