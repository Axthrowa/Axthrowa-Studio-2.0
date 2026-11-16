import { describe, expect, it } from 'vitest';
import {
  VIDEO_UST_MS,
  asamaSuresi,
  donenSahneAnahtari,
  donguIlerle,
  guvenliMedya,
  hesapMetni,
  medyaTuru,
  ogeSuresiMs,
  ogeTuru
} from './donenWidget.js';

const tamTur = (d: { i: number; asama: any }, n: number, bekleme: number) => {
  const izlenen: string[] = [];
  for (let k = 0; k < 20; k++) {
    d = donguIlerle(d, n, bekleme);
    izlenen.push(`${d.i}:${d.asama}`);
  }
  return izlenen;
};

describe('döngü', () => {
  it('sırayla döner, sondan başa geçer', () => {
    const iz = tamTur({ i: 0, asama: 'entering' }, 2, 0);
    expect(iz.slice(0, 6)).toEqual(['0:visible', '0:exiting', '1:entering', '1:visible', '1:exiting', '0:entering']);
  });

  it('bekleme varsa yalnız tur sonunda gizlenir', () => {
    const iz = tamTur({ i: 0, asama: 'entering' }, 2, 5000);
    expect(iz.slice(0, 7)).toEqual(['0:visible', '0:exiting', '1:entering', '1:visible', '1:exiting', '0:hidden', '0:entering']);
  });

  it('liste küçülse de sınır dışına çıkmaz', () => {
    expect(donguIlerle({ i: 5, asama: 'exiting' }, 2, 0)).toEqual({ i: 0, asama: 'entering' });
  });

  it('giriş görünürle aynı kalır, hesap ve animasyon değişince yenilenir', () => {
    const ayar = { animation: 'perdeDikey', animationDuration: 600 };
    expect(donenSahneAnahtari(0, 'entering', ayar)).toBe(donenSahneAnahtari(0, 'visible', ayar));
    expect(donenSahneAnahtari(0, 'visible', ayar)).not.toBe(donenSahneAnahtari(0, 'exiting', ayar));
    expect(donenSahneAnahtari(0, 'entering', ayar)).not.toBe(donenSahneAnahtari(1, 'entering', ayar));
    expect(donenSahneAnahtari(0, 'visible', ayar)).not.toBe(donenSahneAnahtari(0, 'visible', { ...ayar, animation: 'bounce' }));
  });

  it('her aşamanın süresi doğru', () => {
    expect(asamaSuresi('visible', 6000, 9000, 400)).toBe(6000);
    expect(asamaSuresi('exiting', 6000, 9000, 400)).toBe(400);
    expect(asamaSuresi('hidden', 6000, 9000, 400)).toBe(9000);
    expect(asamaSuresi('visible', 0, 0, 400)).toBe(1000);
  });
});

describe('sosyal hesap metni', () => {
  it('@ ekler, yapıştırılan profil adresini ada çevirir', () => {
    expect(hesapMetni('kick', 'axthrowa')).toBe('@axthrowa');
    expect(hesapMetni('bluesky', 'axthrowa.bsky.social')).toBe('@axthrowa.bsky.social');
    expect(hesapMetni('facebook', 'ad.soyad')).toBe('@ad.soyad');
    expect(hesapMetni('instagram', 'instagram.com')).toBe('');
    expect(hesapMetni('kick', '@axthrowa')).toBe('@axthrowa');
    expect(hesapMetni('instagram', 'https://www.instagram.com/axthrowa/')).toBe('@axthrowa');
    expect(hesapMetni('youtube', 'https://youtube.com/@axthrowa')).toBe('@axthrowa');
  });

  it('Discord ve diğer hesaplar yazıldığı gibi kalır', () => {
    expect(hesapMetni('discord', 'https://discord.gg/abc')).toBe('discord.gg/abc');
    expect(hesapMetni('diger', 'site.com/ben')).toBe('site.com/ben');
  });

  it('boş girdi boş döner', () => {
    expect(hesapMetni('kick', '   ')).toBe('');
    expect(hesapMetni('kick', undefined)).toBe('');
    expect(hesapMetni('kick', 'https://kick.com/')).toBe('');
  });
});

describe('sponsor medyası', () => {
  it('yalnız kütüphane ve web adreslerini kabul eder', () => {
    expect(guvenliMedya('/api/media/abc/dosya')).toBe('/api/media/abc/dosya');
    expect(guvenliMedya(' https://site.com/a.gif ')).toBe('https://site.com/a.gif');
    expect(guvenliMedya('javascript:alert(1)')).toBe('');
    expect(guvenliMedya('file:///C:/a.png')).toBe('');
    expect(guvenliMedya('/api/media/../gizli')).toBe('');
    expect(guvenliMedya(undefined)).toBe('');
  });

  it('türü kayıttan, yoksa uzantıdan bulur', () => {
    expect(medyaTuru('https://a.com/b.MP4?x=1')).toBe('video');
    expect(medyaTuru('https://a.com/b.webm')).toBe('video');
    expect(medyaTuru('https://a.com/b.gif')).toBe('image');
    expect(ogeTuru({ url: '/api/media/x/dosya', tur: 'video' })).toBe('video');
    expect(ogeTuru({ url: 'https://a.com/b.mov' })).toBe('video');
  });

  it('süre: görsel varsayılana düşer, video bitene kadar oynar', () => {
    expect(ogeSuresiMs({ url: 'https://a.com/b.png', sure: 0 }, 10)).toBe(10_000);
    expect(ogeSuresiMs({ url: 'https://a.com/b.png', sure: 3 }, 10)).toBe(3000);
    expect(ogeSuresiMs({ url: 'https://a.com/b.mp4', sure: 0 }, 10)).toBe(VIDEO_UST_MS);
    expect(ogeSuresiMs({ url: 'https://a.com/b.mp4', sure: 4 }, 10)).toBe(4000);
  });
});
