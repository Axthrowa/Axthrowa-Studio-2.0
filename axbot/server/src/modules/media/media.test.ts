/**
 * AxBoT — medya doğrulama testleri
 * Developed by AxthrowA
 *
 * Yalnız saf doğrulama fonksiyonları; `media.ts` veritabanı ve dosya sistemi
 * açtığı için buradan yüklenmez — saf parçalar `validate.ts`te.
 */
import { describe, it, expect } from 'vitest';
import { imzadanTur, guvenliAd, IZINLI } from './validate.js';

const B = (...bayt: number[]) => Buffer.from([...bayt, ...new Array(20).fill(0)]);

describe('imzadanTur — içerikten doğrulama', () => {
  it('PNG imzasını tanır', () => {
    expect(imzadanTur(B(0x89, 0x50, 0x4e, 0x47))).toBe('image/png');
  });

  it('JPEG imzasını tanır', () => {
    expect(imzadanTur(B(0xff, 0xd8, 0xff))).toBe('image/jpeg');
  });

  it('GIF imzasını tanır', () => {
    expect(imzadanTur(Buffer.from('GIF89a' + '\0'.repeat(20)))).toBe('image/gif');
  });

  it('WEBP ve WAV ikisi de RIFF ile başlar — alt türü ayırır', () => {
    const riff = (alt: string) => Buffer.from('RIFF' + '\0\0\0\0' + alt + '\0'.repeat(20));
    expect(imzadanTur(riff('WEBP'))).toBe('image/webp');
    expect(imzadanTur(riff('WAVE'))).toBe('audio/wav');
  });

  it('MP3 (ID3 ve çerçeve) tanınır', () => {
    expect(imzadanTur(Buffer.from('ID3' + '\0'.repeat(20)))).toBe('audio/mpeg');
    expect(imzadanTur(B(0xff, 0xfb))).toBe('audio/mpeg');
  });

  it('MP4 ve WEBM tanınır', () => {
    expect(imzadanTur(Buffer.from('\0\0\0\x18ftypmp42' + '\0'.repeat(20)))).toBe('video/mp4');
    expect(imzadanTur(B(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm');
  });

  it('HTML dosyası PNG diye gönderilse bile REDDEDİLİR', () => {
    // Saldırı senaryosu: script içeren dosyayı .png adıyla yükleyip
    // overlay'de çalıştırmak. İçerik imzası buna izin vermez.
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    expect(imzadanTur(html)).toBeNull();
  });

  it('SVG izinli listede YOK — içine script gömülebilir', () => {
    expect(IZINLI['image/svg+xml']).toBeUndefined();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(imzadanTur(svg)).toBeNull();
  });

  it('çok kısa dosyayı reddeder', () => {
    expect(imzadanTur(Buffer.from([0x89]))).toBeNull();
  });

  it('rastgele baytı reddeder', () => {
    expect(imzadanTur(B(0x01, 0x02, 0x03, 0x04))).toBeNull();
  });
});

describe('guvenliAd', () => {
  it('dizin çıkışını engeller', () => {
    expect(guvenliAd('../../etc/passwd')).not.toContain('..');
    expect(guvenliAd('../../etc/passwd')).not.toContain('/');
  });

  it('ters eğik çizgiyi temizler', () => {
    expect(guvenliAd('C:\\Windows\\system32')).not.toContain('\\');
  });

  it('Türkçe karakterleri korur', () => {
    expect(guvenliAd('çığlık sesi.mp3')).toBe('çığlık sesi.mp3');
  });

  it('boş girdide varsayılan verir', () => {
    expect(guvenliAd('')).toBe('dosya');
    expect(guvenliAd('///')).toBe('dosya');
  });

  it('çok uzun adı kırpar', () => {
    expect(guvenliAd('a'.repeat(500)).length).toBeLessThanOrEqual(80);
  });
});

describe('IZINLI liste', () => {
  it('her giriş tür ve uzantı taşır', () => {
    for (const [mime, v] of Object.entries(IZINLI)) {
      expect(v.tur, mime).toBeTruthy();
      expect(v.uzanti.startsWith('.'), mime).toBe(true);
    }
  });

  it('yürütülebilir türler yok', () => {
    for (const mime of Object.keys(IZINLI)) {
      expect(mime).not.toMatch(/html|javascript|svg|xml/);
    }
  });
});
