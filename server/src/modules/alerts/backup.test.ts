/**
 * StreamAxT — uyarı yedeği testleri (saf kısım)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { medyaBaglantisiniCevir, medyaKimligi, yerelMedyaMi, yedekGecerliMi, YEDEK_SURUMU } from './backup.js';

describe('yerelMedyaMi', () => {
  it('kütüphane bağlantısını tanır', () => {
    expect(yerelMedyaMi('/api/media/8f14e45f-ea1f-4b2c-9c3a-1234567890ab/dosya')).toBe(true);
  });

  it('harici adresi yerel saymaz', () => {
    expect(yerelMedyaMi('https://ornek.com/a.gif')).toBe(false);
    expect(yerelMedyaMi('')).toBe(false);
    expect(yerelMedyaMi(undefined)).toBe(false);
    expect(yerelMedyaMi(42)).toBe(false);
  });

  it('benzeyen ama farklı yolu kabul etmez', () => {
    expect(yerelMedyaMi('/api/media/../../etc/passwd/dosya')).toBe(false);
    expect(yerelMedyaMi('https://kotu.example/api/media/abc/dosya')).toBe(false);
  });
});

describe('yedekGecerliMi', () => {
  const saglam = { uygulama: 'StreamAxT', surum: 1, presets: [], varyantlar: [] };

  it('kendi yedeğimizi kabul eder', () => {
    expect(yedekGecerliMi(saglam)).toEqual({ ok: true });
  });

  it('başka uygulamanın dosyasını reddeder', () => {
    const r = yedekGecerliMi({ ...saglam, uygulama: 'Nightbot' });
    expect(r.ok).toBe(false);
  });

  it('JSON olmayanı reddeder', () => {
    expect(yedekGecerliMi(null).ok).toBe(false);
    expect(yedekGecerliMi('metin').ok).toBe(false);
  });

  it('İLERİ sürümü reddeder — sessizce veri kaybı olmasın', () => {
    const r = yedekGecerliMi({ ...saglam, surum: YEDEK_SURUMU + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.hata).toContain('sürüm');
  });

  it('içi boş yedeği reddeder', () => {
    const r = yedekGecerliMi({ uygulama: 'StreamAxT', surum: 1 });
    expect(r.ok).toBe(false);
  });

  it('yalnız varyant taşıyan yedek geçerlidir', () => {
    expect(yedekGecerliMi({ uygulama: 'StreamAxT', surum: 1, varyantlar: [{}] }).ok).toBe(true);
  });
});

describe('gömülü medya bağlantıları', () => {
  const id = '8f14e45f-ea1f-4b2c-9c3a-1234567890ab';

  it('bağlantıdan kimlik çıkarır', () => {
    expect(medyaKimligi(`/api/media/${id}/dosya`)).toBe(id);
    expect(medyaKimligi('https://ornek.com/a.gif')).toBe('');
    expect(medyaKimligi(undefined)).toBe('');
  });

  it('eski kimliği yeni makinedeki kimliğe çevirir', () => {
    const harita = new Map([[id, 'aaaaaaaa-0000-0000-0000-000000000001']]);
    expect(medyaBaglantisiniCevir(`/api/media/${id}/dosya`, harita)).toBe('/api/media/aaaaaaaa-0000-0000-0000-000000000001/dosya');
  });

  it('haritada olmayan ve harici bağlantılara DOKUNMAZ', () => {
    const harita = new Map<string, string>();
    expect(medyaBaglantisiniCevir(`/api/media/${id}/dosya`, harita)).toBe(`/api/media/${id}/dosya`);
    expect(medyaBaglantisiniCevir('https://ornek.com/a.gif', harita)).toBe('https://ornek.com/a.gif');
    expect(medyaBaglantisiniCevir('', harita)).toBe('');
  });
});
