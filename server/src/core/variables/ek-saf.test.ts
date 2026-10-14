/**
 * StreamAxT — ek değişkenler (if, pickw, weather, kick) testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { agirlikliSec, havaKoduMetni, havaMetni, ifSonucu, kickAlaniCoz, kickProfilAlani, kosulDegerlendir } from './ek-saf.js';

describe('$(if)', () => {
  it('metin karşılaştırması Türkçe katlanır', () => {
    expect(kosulDegerlendir('EVET == evet')).toBe(true);
    expect(kosulDegerlendir('İstanbul == istanbul')).toBe(true);
    expect(kosulDegerlendir('elma != armut')).toBe(true);
    expect(kosulDegerlendir('Merhaba dünya ~= DÜNYA')).toBe(true);
  });
  it('sayısal karşılaştırma', () => {
    expect(kosulDegerlendir('10 > 9')).toBe(true);
    expect(kosulDegerlendir('10 >= 10')).toBe(true);
    expect(kosulDegerlendir('2 < 10')).toBe(true);
    expect(kosulDegerlendir('"10" == 10')).toBe(true);
  });
  it('tek değer doğruluğu', () => {
    expect(kosulDegerlendir('ali')).toBe(true);
    expect(kosulDegerlendir('')).toBe(false);
    expect(kosulDegerlendir('0')).toBe(false);
    expect(kosulDegerlendir('hayır')).toBe(false);
  });
  it('dallar', () => {
    expect(ifSonucu(['5 > 3', 'büyük', 'küçük'])).toBe('büyük');
    expect(ifSonucu(['1 > 3', 'büyük', 'küçük'])).toBe('küçük');
    expect(ifSonucu(['', 'var'])).toBe('');
  });
});

describe('$(pickw)', () => {
  it('ağırlığa göre seçer', () => {
    const p = ['kazandın:10', 'kaybettin:90'];
    expect(agirlikliSec(p, () => 0.05)).toBe('kazandın');
    expect(agirlikliSec(p, () => 0.5)).toBe('kaybettin');
    expect(agirlikliSec(p, () => 0.9999)).toBe('kaybettin');
  });
  it('ağırlıksız öğe 1, sıfır ağırlık hiç seçilmez', () => {
    expect(agirlikliSec(['a', 'b:0'], () => 0.99)).toBe('a');
    expect(agirlikliSec([], () => 0.5)).toBe('');
    expect(agirlikliSec(['saat 12:30'], () => 0)).toBe('saat 12');
  });
});

describe('$(weather)', () => {
  it('WMO kodları', () => {
    expect(havaKoduMetni(0).metin).toBe('Açık');
    expect(havaKoduMetni(63).metin).toBe('Yağmurlu');
    expect(havaKoduMetni(95).metin).toBe('Gök gürültülü fırtına');
  });
  it('sohbet satırı', () => {
    expect(
      havaMetni(
        { name: 'İstanbul', country: 'Türkiye' },
        { temperature_2m: 18.4, apparent_temperature: 16.6, relative_humidity_2m: 72, wind_speed_10m: 13.7, weather_code: 2 }
      )
    ).toBe('⛅ İstanbul, Türkiye: Parçalı bulutlu, 18°C (hissedilen 17°C), nem %72, rüzgâr 14 km/s');
  });
});

describe('$(kick alan)', () => {
  const kanal = { slug: 'axthrowa', followers_count: 24, user: { bio: 'Selam', instagram: 'axt', twitter: '' } };
  it('alan adları ve takma adlar', () => {
    expect(kickAlaniCoz('Biyografi')).toBe('bio');
    expect(kickAlaniCoz('takipçi')).toBe('takipci');
    expect(kickAlaniCoz('X')).toBe('twitter');
    expect(kickAlaniCoz('sifre')).toBeNull();
  });
  it('profilden okur', () => {
    expect(kickProfilAlani(kanal, 'bio', 'axthrowa')).toBe('Selam');
    expect(kickProfilAlani(kanal, 'instagram', 'axthrowa')).toBe('axt');
    expect(kickProfilAlani(kanal, 'takipci', 'axthrowa')).toBe('24');
    expect(kickProfilAlani(kanal, 'url', 'AxthrowA')).toBe('https://kick.com/axthrowa');
    expect(kickProfilAlani(kanal, 'twitter', 'axthrowa')).toBe('');
  });
});
