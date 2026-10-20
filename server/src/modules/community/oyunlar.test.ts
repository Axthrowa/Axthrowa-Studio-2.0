/**
 * StreamAxT — topluluk oyunları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { Bingo, PiramitIzci, Votekick, emoteAdlari } from './oyunlar.js';
import { duzenliAdi } from './regulars.js';

describe('Votekick', () => {
  const ayar = () => ({ esik: 3, pencereMs: 60_000, hedefBeklemeMs: 300_000 });

  it('eşiğe ulaşınca tamamlanır, aynı kişi iki kez oy veremez', () => {
    const v = new Votekick(ayar);
    expect(v.oyVer('kick', 'a', '@Troll', 0)).toEqual({ tur: 'basladi', hedef: 'troll', oy: 1, esik: 3 });
    expect(v.oyVer('kick', 'A', undefined, 1000).tur).toBe('zaten-oy');
    expect(v.oyVer('kick', 'b', 'troll', 2000)).toEqual({ tur: 'oy', hedef: 'troll', oy: 2, esik: 3 });
    expect(v.oyVer('kick', 'c', '', 3000)).toEqual({ tur: 'tamam', hedef: 'troll', oy: 3 });
    expect(v.durum()).toBeNull();
  });

  it('süre dolunca kapanır; hedef bekleme süresi uygulanır', () => {
    const v = new Votekick(ayar);
    v.oyVer('kick', 'a', 'x', 0);
    expect(v.zamanAsimi(60_000)).toBe('x');
    expect(v.oyVer('kick', 'a', 'x', 61_000).tur).toBe('basladi');
    v.oyVer('kick', 'b', 'x', 61_500);
    v.oyVer('kick', 'c', 'x', 62_000);
    const r = v.oyVer('kick', 'd', 'x', 100_000);
    expect(r.tur).toBe('bekleme');
  });

  it('kendine ve geçersiz ada oylama açılmaz; ikinci hedef reddedilir', () => {
    const v = new Votekick(ayar);
    expect(v.oyVer('kick', 'a', 'a', 0).tur).toBe('gecersiz');
    expect(v.oyVer('kick', 'a', '<script>', 0).tur).toBe('gecersiz');
    expect(v.oyVer('kick', 'a', '', 0).tur).toBe('gecersiz');
    v.oyVer('kick', 'a', 'x', 0);
    expect(v.oyVer('kick', 'b', 'y', 1).tur).toBe('baska-oylama');
  });
});

describe('PiramitIzci', () => {
  it('3 yükseklikte piramidi tanır', () => {
    const p = new PiramitIzci();
    const dizi = ['KEKW', 'KEKW KEKW', 'KEKW KEKW KEKW', 'KEKW KEKW', 'KEKW'];
    const sonuc = dizi.map((m) => p.mesaj('Ali', m));
    expect(sonuc).toEqual([0, 0, 0, 0, 3]);
  });

  it('başka kullanıcı ya da farklı emote bozar; 2 yükseklik sayılmaz', () => {
    const p = new PiramitIzci();
    p.mesaj('ali', 'E');
    p.mesaj('ali', 'E E');
    p.mesaj('veli', 'merhaba');
    p.mesaj('ali', 'E E E');
    p.mesaj('ali', 'E E');
    expect(p.mesaj('ali', 'E')).toBe(0);

    const q = new PiramitIzci();
    expect(['E', 'E E', 'E'].map((m) => q.mesaj('ali', m))).toEqual([0, 0, 0]);
  });

  it('bozulan desenden sonra yeniden başlayabilir', () => {
    const p = new PiramitIzci();
    p.mesaj('ali', 'E');
    p.mesaj('ali', 'E E');
    p.mesaj('ali', 'E E E E'); // atladı → bozuldu
    const r = ['E', 'E E', 'E E E', 'E E E E', 'E E E', 'E E', 'E'].map((m) => p.mesaj('ali', m));
    expect(r[r.length - 1]).toBe(4);
  });
});

describe('Bingo', () => {
  it('gizli emote yazılınca kazanılır ve oyun kapanır', () => {
    const b = new Bingo(() => 0.5);
    expect(b.baslat(['A', 'B', 'C', 'A'], 100, 0)).toEqual({ ok: true, adet: 3 });
    expect(b.durum()).toEqual({ secenekler: ['A', 'B', 'C'], odul: 100, basladi: 0 });
    expect(b.tahmin('A A')).toBeNull();
    expect(b.tahmin('selam B')).toEqual({ kazandi: true, emote: 'B', odul: 100 });
    expect(b.acikMi()).toBe(false);
  });

  it('tek seçenekle başlamaz; ödül sınırlanır', () => {
    const b = new Bingo(() => 0);
    expect(b.baslat(['A', 'A'], 5, 0).ok).toBe(false);
    b.baslat(['A', 'B'], 99_999_999, 0);
    expect(b.durum()?.odul).toBe(1_000_000);
    expect(b.durdur()).toBe('A');
  });

  it('rastgele 1 dönse de dizi dışına taşmaz', () => {
    const b = new Bingo(() => 0.9999999);
    b.baslat(['A', 'B'], 0, 0);
    expect(b.durdur()).toBe('B');
  });
});

describe('yardımcılar', () => {
  it('emoteAdlari', () => {
    expect(emoteAdlari('[emote:37226:KEKW] [emote:1:x_y]')).toBe('KEKW x_y');
  });
  it('duzenliAdi', () => {
    expect(duzenliAdi('@Ali_Veli')).toBe('ali_veli');
    expect(duzenliAdi('Çağrı')).toBe('çağrı');
    expect(duzenliAdi("x'; DROP")).toBeNull();
    expect(duzenliAdi('')).toBeNull();
  });
});
