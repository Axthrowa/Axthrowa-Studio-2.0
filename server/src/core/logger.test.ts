/**
 * AxBoT — günlük sır maskeleme testleri (B5)
 * Developed by AxthrowA
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import util from 'node:util';
import { hataMetni, seyrekUyar, sirlariMaskele } from './logger.js';

describe('sirlariMaskele', () => {
  it('Authorization başlıkları', () => {
    expect(sirlariMaskele('Authorization: Bearer abcdef123456789')).toBe('Authorization: Bearer ••••');
    expect(sirlariMaskele('Authorization: OAuth zyxwvut98765')).toBe('Authorization: OAuth ••••');
    expect(sirlariMaskele('PASS oauth:abcdefghij123')).toBe('PASS oauth:••••');
  });

  it('adresteki anahtarlar', () => {
    const s = sirlariMaskele('GET https://www.googleapis.com/youtube/v3/videos?id=x&key=AIzaSyA1234567890abcdef');
    expect(s).toContain('key=••••');
    expect(s).not.toContain('AIzaSy');
    expect(sirlariMaskele('?access_token=zzz111&x=1')).toBe('?access_token=••••&x=1');
  });

  it('Discord webhook adresi', () => {
    const s = sirlariMaskele('POST https://discord.com/api/webhooks/123456/AbC-dEf_ghi');
    expect(s).toBe('POST https://discord.com/api/webhooks/••••');
  });

  it('nesne olarak basılan hata (axios config başlıkları dahil)', () => {
    const hata = {
      message: 'Request failed',
      config: { headers: { Authorization: 'Bearer GIZLI_TOKEN_123456' }, params: { client_secret: 'cs_987654321' } },
      refresh_token: 'rt_abcdefghijk'
    };
    const s = sirlariMaskele(util.format('Kick hata:', hata));
    expect(s).not.toContain('GIZLI_TOKEN_123456');
    expect(s).not.toContain('cs_987654321');
    expect(s).not.toContain('rt_abcdefghijk');
    expect(s).toContain('Request failed');
  });

  it('sıradan metne dokunmaz', () => {
    const d = '[Kick Chat] <ali>: token nedir? 5 dk sonra geliyorum';
    expect(sirlariMaskele(d)).toBe(d);
    expect(sirlariMaskele('[Yayın] kick AÇIK (kanal)')).toBe('[Yayın] kick AÇIK (kanal)');
  });

  it('kasa değerlerini kısaltır', () => {
    expect(sirlariMaskele('deger=dpapi:v1:AQAAANCMnd8BFdERjHoAwE')).toBe('deger=dpapi:v1:••••');
  });
});

describe('hataMetni', () => {
  it('Error, metin ve nesne', () => {
    expect(hataMetni(new Error('disk dolu'))).toBe('disk dolu');
    expect(hataMetni('düz metin')).toBe('düz metin');
    expect(hataMetni({ kod: 5 })).toContain('kod');
  });
  it('sırları maskeler ve tek satıra indirir', () => {
    expect(hataMetni(new Error('istek başarısız\nAuthorization: Bearer abcdefghijkl'))).toBe(
      'istek başarısız Authorization: Bearer ••••'
    );
  });
});

describe('seyrekUyar', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('aralık içinde tekrarı bastırır, sonra sayısını yazar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    const uyari = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(seyrekUyar('test:a', '[Test] bozuk', new Error('x'), 1000)).toBe(true);
    expect(seyrekUyar('test:a', '[Test] bozuk', new Error('x'), 1000)).toBe(false);
    expect(seyrekUyar('test:a', '[Test] bozuk', new Error('x'), 1000)).toBe(false);
    expect(uyari).toHaveBeenCalledTimes(1);
    expect(uyari.mock.calls[0][0]).toBe('[Test] bozuk: x');

    vi.setSystemTime(new Date('2026-09-24T12:00:01.500Z'));
    expect(seyrekUyar('test:a', '[Test] bozuk', new Error('x'), 1000)).toBe(true);
    expect(uyari.mock.calls[1][0]).toBe('[Test] bozuk: x (son uyarıdan beri 2 tekrar)');
  });

  it('farklı anahtarlar birbirini bastırmaz', () => {
    const uyari = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seyrekUyar('test:b', 'B');
    seyrekUyar('test:c', 'C');
    expect(uyari).toHaveBeenCalledTimes(2);
  });
});
