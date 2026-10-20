/**
 * StreamAxT — entegrasyon testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { webhookGecerliMi, etiketOneki } from './discord-rules.js';
import { seviyeCevir, sablonCevir } from './nightbot-map.js';

describe('webhookGecerliMi', () => {
  it('gerçek Discord webhook adresini kabul eder', () => {
    expect(webhookGecerliMi('https://discord.com/api/webhooks/123/abcDEF')).toBe(true);
    expect(webhookGecerliMi('https://discordapp.com/api/webhooks/1/x')).toBe(true);
  });

  it('başka siteleri REDDEDER — webhook adresi token taşır', () => {
    // Kullanıcı yanlışlıkla başka bir adres yapıştırırsa token oraya gitmesin
    expect(webhookGecerliMi('https://evil.example/api/webhooks/1/x')).toBe(false);
    expect(webhookGecerliMi('https://discord.com.evil.example/api/webhooks/1/x')).toBe(false);
  });

  it('http (şifresiz) reddedilir', () => {
    expect(webhookGecerliMi('http://discord.com/api/webhooks/1/x')).toBe(false);
  });

  it('webhook olmayan Discord adresini reddeder', () => {
    expect(webhookGecerliMi('https://discord.com/channels/123/456')).toBe(false);
  });

  it('boş ve bozuk girdiyi reddeder', () => {
    expect(webhookGecerliMi('')).toBe(false);
    expect(webhookGecerliMi('şey değil')).toBe(false);
  });
});

describe('etiketOneki', () => {
  it('doğru öneki üretir', () => {
    expect(etiketOneki('yok')).toBe('');
    expect(etiketOneki('here')).toBe('@here ');
    expect(etiketOneki('everyone')).toBe('@everyone ');
  });
});

describe('seviyeCevir', () => {
  it('Nightbot seviyelerini eşler', () => {
    expect(seviyeCevir('owner')).toBe('broadcaster');
    expect(seviyeCevir('moderator')).toBe('mod');
    expect(seviyeCevir('vip')).toBe('vip');
    expect(seviyeCevir('subscriber')).toBe('sub');
    expect(seviyeCevir('regular')).toBe('regular');
    expect(seviyeCevir('everyone')).toBe('everyone');
  });

  it('bilinmeyen seviyede herkese açar', () => {
    expect(seviyeCevir('zzz')).toBe('everyone');
    expect(seviyeCevir(undefined)).toBe('everyone');
  });
});

describe('sablonCevir', () => {
  it('$(user) → $(sender)', () => {
    expect(sablonCevir('Merhaba $(user)!').metin).toBe('Merhaba $(sender)!');
  });

  it('$(touser) → $(toname)', () => {
    expect(sablonCevir('Selam $(touser)').metin).toBe('Selam $(toname)');
  });

  it('$(query) → $(variable)', () => {
    expect(sablonCevir('Aradığın: $(query)').metin).toBe('Aradığın: $(variable)');
  });

  it('$(querystring) kodlanmış hâle çevrilir', () => {
    expect(sablonCevir('$(querystring)').metin).toBe('$(urlencode $(variable))');
  });

  it('aynı olan değişkenlere dokunmaz', () => {
    expect(sablonCevir('$(count) ölüm').metin).toBe('$(count) ölüm');
  });

  it('desteklenmeyen değişkeni UYARIR — sessizce bozuk komut oluşturmaz', () => {
    const r = sablonCevir('$(weather istanbul)');
    expect(r.uyarilar.length).toBe(1);
    expect(r.uyarilar[0]).toContain('hava durumu');
  });

  it('customapi için yönlendirme verir', () => {
    expect(sablonCevir('$(customapi https://a.com)').uyarilar[0]).toContain('urlfetch');
  });

  it('uyarı yoksa liste boş', () => {
    expect(sablonCevir('düz metin').uyarilar).toEqual([]);
  });

  it('boş girdide çökmez', () => {
    expect(sablonCevir('').metin).toBe('');
  });
});
