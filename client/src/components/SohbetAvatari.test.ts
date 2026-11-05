import { describe, expect, it } from 'vitest';
import { avatarAdresi, basHarf } from './SohbetAvatari.js';

describe('avatar adresi', () => {
  it('mesajla gelen https adresi önceliklidir', () => {
    expect(avatarAdresi('youtube', 'ali', 'https://yt3.ggpht.com/a')).toBe('https://yt3.ggpht.com/a');
    expect(avatarAdresi('kick', 'ali', 'https://files.kick.com/a')).toBe('https://files.kick.com/a');
  });

  it('adres yoksa yalnız Kick ve Twitch sunucudan sorulur', () => {
    expect(avatarAdresi('kick', 'ali_1')).toBe('/api/chat/avatar/kick/ali_1');
    expect(avatarAdresi('twitch', 'ali')).toBe('/api/chat/avatar/twitch/ali');
    expect(avatarAdresi('youtube', 'ali')).toBe('');
    expect(avatarAdresi('olay', 'ali')).toBe('');
  });

  it('güvensiz ad ve adres kullanılmaz', () => {
    expect(avatarAdresi('kick', '../x')).toBe('');
    expect(avatarAdresi('kick', undefined)).toBe('');
    expect(avatarAdresi('youtube', 'ali', 'javascript:alert(1)')).toBe('');
  });
});

describe('baş harf', () => {
  it('Türkçe büyük harf ve emoji güvenli', () => {
    expect(basHarf('ilker')).toBe('İ');
    expect(basHarf('  ali')).toBe('A');
    expect(basHarf('😀x')).toBe('😀');
    expect(basHarf('')).toBe('?');
  });
});
