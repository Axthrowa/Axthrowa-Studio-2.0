import { describe, it, expect } from 'vitest';
import { buyukHarfMi, emojiSayisi, kalkanIhlali, linkVarMi, KALKAN_DESTEKLENMEYEN, type KalkanKurallari } from './shield-rules.js';

const HEPSI: KalkanKurallari = { isActive: true, blockLinks: true, blockCaps: true, blockEmotes: true, subOnly: false };
const izleyici = { isMod: false, isBroadcaster: false, isSub: false, isVip: false };
const mesaj = (metin: string, user = izleyici, emotes?: Record<string, string[]>) => ({ message: metin, user, emotes });

describe('kalkanIhlali', () => {
  it('kalkan kapalıyken hiçbir şey engellenmez (eski davranış)', () => {
    expect(kalkanIhlali({ ...HEPSI, isActive: false }, mesaj('BEDAVA TAKİPÇİ http://x.ru 🎁🎁🎁🎁🎁'))).toBeNull();
  });

  it('eskiden hiç uygulanmayan büyük harf ve emoji kuralları artık uygulanıyor', () => {
    expect(kalkanIhlali(HEPSI, mesaj('HERKES BURAYA GELSİN'))).toBe('caps');
    expect(kalkanIhlali(HEPSI, mesaj('selam 😂😂😂😂'))).toBe('emoji');
    expect(kalkanIhlali({ ...HEPSI, blockCaps: false }, mesaj('HERKES BURAYA GELSİN'))).toBeNull();
    expect(kalkanIhlali({ ...HEPSI, blockEmotes: false }, mesaj('selam 😂😂😂😂'))).toBeNull();
  });

  it('link kuralı çıplak alan adını da yakalar', () => {
    expect(kalkanIhlali(HEPSI, mesaj('ucuz takipçi www.spam.xyz'))).toBe('link');
    expect(kalkanIhlali(HEPSI, mesaj('bak spamsite.ru/kayit'))).toBe('link');
    expect(kalkanIhlali(HEPSI, mesaj('iyi yayınlar kolay gelsin'))).toBeNull();
  });

  it('yayıncı ve moderatör muaf; yalnız-abone kuralında abone ve VIP geçer', () => {
    const kurallar = { ...HEPSI, subOnly: true };
    expect(kalkanIhlali(kurallar, mesaj('merhaba'))).toBe('abone');
    expect(kalkanIhlali(kurallar, mesaj('merhaba', { ...izleyici, isSub: true }))).toBeNull();
    expect(kalkanIhlali(kurallar, mesaj('merhaba', { ...izleyici, isVip: true }))).toBeNull();
    expect(kalkanIhlali(kurallar, mesaj('BÜYÜK HARF LİNK http://a.io', { ...izleyici, isMod: true }))).toBeNull();
    expect(kalkanIhlali(kurallar, mesaj('BÜYÜK HARF LİNK http://a.io', { ...izleyici, isBroadcaster: true }))).toBeNull();
    // Abone olmak diğer kuralları atlatmaz
    expect(kalkanIhlali(kurallar, mesaj('HERKES BURAYA GELSİN', { ...izleyici, isSub: true }))).toBe('caps');
  });
});

describe('yardımcı kurallar', () => {
  it('büyük harf: Türkçe harfler sayılır, kısa bağırış ve emote işaretlemesi sayılmaz', () => {
    expect(buyukHarfMi('ŞİMDİ ÇIĞLIK ATIYORUM')).toBe(true);
    expect(buyukHarfMi('GG WP')).toBe(false); // 4 harf: eşik altı
    expect(buyukHarfMi('Bugün Harika Bir Yayın')).toBe(false);
    expect(buyukHarfMi('[emote:37226:KEKWKEKWKEKW] tamam')).toBe(false);
    expect(buyukHarfMi('12345678 !!!')).toBe(false);
  });

  it('emoji sayısı: unicode + Kick işaretlemesi + Twitch emotes etiketi', () => {
    expect(emojiSayisi('a 😂 b 🎉')).toBe(2);
    expect(emojiSayisi('[emote:1:A] [emote:2:B]')).toBe(2);
    expect(emojiSayisi('Kappa Kappa', { '25': ['0-4', '6-10'] })).toBe(2);
  });

  it('link: düz metin yanlış alarm vermez', () => {
    expect(linkVarMi('saat 12.30 da başlıyoruz')).toBe(false);
    expect(linkVarMi('https://example.com')).toBe(true);
  });

  it('uygulanamayan ayarlar gerekçesiyle belgelenmiş', () => {
    expect(Object.keys(KALKAN_DESTEKLENMEYEN).sort()).toEqual(['followerOnly', 'minAccountAgeDays']);
  });
});
