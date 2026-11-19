import { describe, expect, it } from 'vitest';
import { AtlaOyunu, beklemeKalan, puanGecerli, sonucMetni, sunucuAyari } from './atla-oyunu.js';
import type { ChatMessagePayload } from '../../core/event-bus.js';

const mesaj = (ad: string, ek: Partial<ChatMessagePayload['user']> = {}): ChatMessagePayload => ({
  id: 'm-' + ad,
  platform: 'kick',
  channel: 'kanal',
  user: { id: ad, username: ad, displayName: ad, badges: [], isMod: false, isSub: false, isVip: false, isBroadcaster: false, ...ek },
  message: '!atla',
  timestamp: Date.now()
});

function oyun() {
  const o = new AtlaOyunu();
  const giden: Record<string, any>[] = [];
  const sohbet: string[] = [];
  o.yayinla = (p) => giden.push(p);
  o.sohbeteYaz = (_p, m) => sohbet.push(m);
  o.katmanAcikMi = () => true;
  return { o, giden, sohbet, atlayislar: () => giden.filter((g) => g.type === 'atla_oyunu_atla') };
}

describe('atla oyunu: saf yardımcılar', () => {
  it('ayar sınırları', () => {
    expect(sunucuAyari({ beklemeSn: -5, enCokHavada: 999, puanCarpani: 'x', topluSn: 1 })).toEqual({ beklemeSn: 0, enCokHavada: 40, puanCarpani: 1, iskaDuyur: false, topluSn: 5 });
  });
  it('puan yalnız sayı, 0–100 tam sayı', () => {
    expect(puanGecerli(87.6)).toBe(88);
    expect(puanGecerli(140)).toBe(100);
    expect(puanGecerli('90')).toBeNull();
    expect(puanGecerli(Number.NaN)).toBeNull();
  });
  it('bekleme', () => {
    expect(beklemeKalan(undefined, 30)).toBe(0);
    expect(beklemeKalan(1000, 30, 11_000)).toBe(20);
    expect(beklemeKalan(1000, 0, 1001)).toBe(0);
  });
  it('sohbet metni', () => {
    expect(sonucMetni('ayse', 100, 100)).toContain('TAM İSABET');
    expect(sonucMetni('ayse', 0, 0)).toContain('ıskaladı');
  });
});

describe('atla oyunu: akış', () => {
  it('atlayış kimliği bir kez sayılır; puan, sohbet ve tablo yazılır', () => {
    const { o, sohbet, atlayislar } = oyun();
    expect(o.atla(mesaj('ayse'))).toBe('');
    const id = atlayislar()[0].data.id;
    expect(o.sonuc(id, 73)).toEqual({ kabul: true, puan: 73 });
    expect(o.sonuc(id, 100)).toEqual({ kabul: false });
    expect(o.sonuc('bilinmeyen', 50)).toEqual({ kabul: false });
    expect(sohbet.at(-1)).toContain('73 puan');
    expect(o.tablo(5)[0]).toMatchObject({ gorunen: 'ayse', enIyi: 73, toplam: 73, atlayis: 1, isabet: 1 });
  });

  it('kişi başı bekleme ve aynı kişinin havada iki karakteri olmaz', () => {
    const { o, atlayislar } = oyun();
    o.atla(mesaj('mert'));
    expect(o.atla(mesaj('mert'))).toMatch(/sn bekle/);
    expect(atlayislar()).toHaveLength(1);
  });

  it('katman kapalıysa atlamaz, söyler', () => {
    const { o, atlayislar } = oyun();
    o.katmanAcikMi = () => false;
    expect(o.atla(mesaj('ece'))).toMatch(/katmanı/);
    expect(atlayislar()).toHaveLength(0);
  });

  it('toplu atlama: bekleyiş boyunca sıraya girer, !atlat ile hepsi atlar', async () => {
    const { o, giden, atlayislar } = oyun();
    expect(o.topluAc(30)).toContain('TOPLU ATLAMA');
    o.atla(mesaj('a'));
    o.atla(mesaj('b'));
    o.atla(mesaj('a'));
    expect(atlayislar()).toHaveLength(0);
    expect(giden.filter((g) => g.type === 'atla_oyunu_toplu').at(-1)).toMatchObject({ acik: true, bekleyen: 2 });
    expect(o.birak()).toContain('2 kişi');
    await new Promise((r) => setTimeout(r, 400));
    expect(atlayislar().map((g) => g.data.kullanici)).toEqual(['a', 'b']);
  });

  it('skor ve en iyiler metni', () => {
    const { o, atlayislar } = oyun();
    o.atla(mesaj('zeynep'));
    o.sonuc(atlayislar()[0].data.id, 0);
    expect(o.skor(mesaj('zeynep'))).toMatch(/en iyi 0 .* 1 atlayış, 0 isabet/);
    expect(o.enler()).toContain('🏆');
    expect(o.sifirla()).toContain('sıfırlandı');
    expect(o.tablo()).toEqual([]);
  });
});
