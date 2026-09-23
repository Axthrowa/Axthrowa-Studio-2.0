/**
 * StreamAxT — moderasyon eylem testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import {
  bypassEder,
  timeoutKademesi,
  eylemPlani,
  kuralAyariOku,
  sureyiYaz,
  TIMEOUT_KADEMELERI,
  type KuralAyari
} from './enforcement.js';

function ayar(ek: Partial<KuralAyari> = {}): KuralAyari {
  return { eylem: 'warn', timeoutSn: 60, mesaj: 'kural ihlali', bypass: ['mod', 'broadcaster'], ...ek };
}

describe('bypassEder', () => {
  it('yayıncı ve moderatör HER ZAMAN muaf', () => {
    // BotRix: "Moderatör her zaman bypass'a sahiptir"
    expect(bypassEder({ isBroadcaster: true }, [])).toBe(true);
    expect(bypassEder({ isMod: true }, [])).toBe(true);
  });

  it('listede olan rol muaf', () => {
    expect(bypassEder({ isVip: true }, ['vip'])).toBe(true);
    expect(bypassEder({ isSub: true }, ['sub'])).toBe(true);
    expect(bypassEder({ isOg: true }, ['og'])).toBe(true);
  });

  it('listede olmayan rol muaf değil', () => {
    expect(bypassEder({ isVip: true }, ['sub'])).toBe(false);
    expect(bypassEder({ isSub: true }, [])).toBe(false);
  });

  it('sıradan izleyici muaf değil', () => {
    expect(bypassEder({}, ['vip', 'sub'])).toBe(false);
  });
});

describe('timeoutKademesi', () => {
  it('geçerli kademeyi aynen bırakır', () => {
    for (const k of TIMEOUT_KADEMELERI) expect(timeoutKademesi(k)).toBe(k);
  });

  it('ara değeri en yakın kademeye yuvarlar', () => {
    expect(timeoutKademesi(45)).toBe(30);
    expect(timeoutKademesi(55)).toBe(60);
    expect(timeoutKademesi(200)).toBe(120);
  });

  it('geçersiz girdide en düşük kademeye düşer', () => {
    expect(timeoutKademesi(0)).toBe(30);
    expect(timeoutKademesi(-5)).toBe(30);
    expect(timeoutKademesi(NaN)).toBe(30);
  });
});

describe('eylemPlani', () => {
  it('sadece uyarı', () => {
    const p = eylemPlani(ayar({ eylem: 'warn' }), 'kick');
    expect(p).toMatchObject({ uyar: true, sil: false, timeoutSn: 0 });
    expect(p.dusurulen).toBeUndefined();
  });

  it('Kick zaman aşımını destekler', () => {
    const p = eylemPlani(ayar({ eylem: 'timeout', timeoutSn: 300 }), 'kick');
    expect(p.timeoutSn).toBe(300);
    expect(p.uyar).toBe(false);
    expect(p.dusurulen).toBeUndefined();
  });

  it('zaman aşımı + uyarı birlikte', () => {
    const p = eylemPlani(ayar({ eylem: 'timeout_warn', timeoutSn: 60 }), 'kick');
    expect(p.timeoutSn).toBe(60);
    expect(p.uyar).toBe(true);
  });

  // Aşağıdaki üç test eskiden YouTube/Kick/Twitch ile yazılmıştı; o
  // platformlarda moderasyon artık UYGULANDI (bkz. capabilities.ts). "Desteklemeyen
  // platformda uyarıya düş" davranışı değişmedi — örnek platform, bugün
  // gerçekten desteklemeyenlerle değiştirildi.
  it('TikTok zaman aşımını DESTEKLEMEZ — uyarıya düşer, sebebi bildirir', () => {
    const p = eylemPlani(ayar({ eylem: 'timeout' }), 'tiktok');
    expect(p.timeoutSn).toBe(0);
    // İhlal cevapsız kalmamalı
    expect(p.uyar).toBe(true);
    expect(p.dusurulen).toContain('zaman aşımı');
  });

  it('Discord mesaj silmeyi desteklemez — uyarıya düşer', () => {
    const p = eylemPlani(ayar({ eylem: 'delete' }), 'discord');
    expect(p.sil).toBe(false);
    expect(p.uyar).toBe(true);
    expect(p.dusurulen).toContain('mesaj silme');
  });

  it('Trovo zaman aşımı belgelenmediği için UYGULANMADI — uyarıya düşer', () => {
    const p = eylemPlani(ayar({ eylem: 'timeout_warn' }), 'trovo');
    expect(p.timeoutSn).toBe(0);
    expect(p.uyar).toBe(true);
  });

  it('Twitch artık zaman aşımı ve mesaj silme uygular (Helix)', () => {
    const t = eylemPlani(ayar({ eylem: 'timeout' }), 'twitch');
    expect(t.timeoutSn).toBeGreaterThan(0);
    const d = eylemPlani(ayar({ eylem: 'delete_warn' }), 'twitch');
    expect(d.sil).toBe(true);
    expect(d.uyar).toBe(true);
  });

  it('Kick artık mesaj siler (DELETE /public/v1/chat/{id})', () => {
    const p = eylemPlani(ayar({ eylem: 'delete' }), 'kick');
    expect(p.sil).toBe(true);
    expect(p.dusurulen || '').not.toContain('mesaj silme');
  });

  it('YouTube artık zaman aşımı uygular (liveChatBans)', () => {
    const p = eylemPlani(ayar({ eylem: 'timeout' }), 'youtube');
    expect(p.timeoutSn).toBeGreaterThan(0);
  });

  it('bilinmeyen platformda her şey uyarıya düşer', () => {
    const p = eylemPlani(ayar({ eylem: 'timeout' }), 'bilinmeyen');
    expect(p.timeoutSn).toBe(0);
    expect(p.uyar).toBe(true);
  });
});

describe('kuralAyariOku', () => {
  it('veritabanı satırından okur', () => {
    const row = {
      caps_action: 'timeout_warn',
      caps_timeout: 300,
      caps_message: 'Büyük harf spamı yapma',
      caps_bypass: '["vip","sub"]'
    };
    expect(kuralAyariOku(row, 'caps', 'varsayılan')).toEqual({
      eylem: 'timeout_warn',
      timeoutSn: 300,
      mesaj: 'Büyük harf spamı yapma',
      bypass: ['vip', 'sub']
    });
  });

  it('boş mesajda varsayılana düşer', () => {
    expect(kuralAyariOku({ caps_message: '  ' }, 'caps', 'varsayılan metin').mesaj).toBe('varsayılan metin');
  });

  it('bozuk JSON bypass listesinde varsayılanda kalır', () => {
    expect(kuralAyariOku({ caps_bypass: '{bozuk' }, 'caps', 'x').bypass).toEqual(['mod', 'broadcaster']);
  });

  it('eksik satırda güvenli varsayılan verir', () => {
    const a = kuralAyariOku(undefined, 'links', 'link yasak');
    expect(a.eylem).toBe('warn');
    expect(a.mesaj).toBe('link yasak');
  });
});

describe('sureyiYaz', () => {
  it('okunur süre üretir', () => {
    expect(sureyiYaz(30)).toBe('30 saniye');
    expect(sureyiYaz(300)).toBe('5 dakika');
    expect(sureyiYaz(7200)).toBe('2 saat');
    expect(sureyiYaz(86400)).toBe('1 gün');
  });
});
