/**
 * StreamAxT — Spotify yardımcıları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  calaniAyikla,
  clientIdGecerliMi,
  donusAdresiSec,
  koduAyikla,
  oynaticiHatasi,
  parcaKimligi,
  pkceUret,
  yetkiAdresi
} from './spotify-saf.js';

describe('PKCE ve yetki adresi', () => {
  it('meydan okuma = base64url(sha256(doğrulayıcı))', () => {
    const { dogrulayici, meydanOkuma } = pkceUret();
    expect(dogrulayici.length).toBeGreaterThanOrEqual(43);
    expect(meydanOkuma).toBe(crypto.createHash('sha256').update(dogrulayici).digest('base64url'));
  });
  it('adres kapsamları ve S256 taşır', () => {
    const u = new URL(yetkiAdresi('a'.repeat(32), 'http://127.0.0.1:3001/callback', 'mo', 'd1'));
    expect(u.origin).toBe('https://accounts.spotify.com');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toContain('user-modify-playback-state');
    expect(u.searchParams.get('state')).toBe('d1');
  });
  it('dönüş adresi yalnız bilinen yollardan', () => {
    const kok = 'http://127.0.0.1:3001';
    expect(donusAdresiSec(kok, `${kok}/callback`)).toBe(`${kok}/callback`);
    expect(donusAdresiSec(kok, 'https://evil.example/callback')).toBe(`${kok}/resonance/callback`);
  });
  it('client id biçimi', () => {
    expect(clientIdGecerliMi('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(clientIdGecerliMi('kısa')).toBe(false);
  });
});

describe('koduAyikla', () => {
  it('tam adres, çıplak kod, hata', () => {
    const kod = 'AQB' + 'x'.repeat(40);
    expect(koduAyikla(`http://127.0.0.1:3001/callback?code=${kod}&state=1`)).toEqual({ kod });
    expect(koduAyikla(kod)).toEqual({ kod });
    expect(koduAyikla('http://127.0.0.1/callback?error=access_denied')).toEqual({ hata: 'Spotify hata döndürdü: access_denied' });
    expect('hata' in koduAyikla('kisa')).toBe(true);
  });
});

describe('calaniAyikla', () => {
  it('şarkı', () => {
    const r = calaniAyikla(
      {
        is_playing: true,
        progress_ms: 1000,
        item: { name: 'Paramparça', duration_ms: 200000, artists: [{ name: 'Teoman' }], album: { name: 'O', images: [{ url: 'https://i.scdn.co/x' }] } }
      },
      5
    );
    expect(r).toEqual({
      title: 'Paramparça', artist: 'Teoman', album: 'O', albumArt: 'https://i.scdn.co/x',
      isPlaying: true, progress: 1000, duration: 200000, source: 'spotify', updatedAt: 5
    });
  });
  it('podcast bölümü ve boş', () => {
    expect(calaniAyikla({ item: { name: 'B1', show: { name: 'Yayın', images: [] } } })?.artist).toBe('Yayın');
    expect(calaniAyikla({ item: null })).toBeNull();
    expect(calaniAyikla(null)).toBeNull();
  });
});

describe('parça ve hata', () => {
  it('link ve URI', () => {
    expect(parcaKimligi('https://open.spotify.com/intl-tr/track/4uLU6hMCjMI75M1A2tKUQC?si=x')).toBe('4uLU6hMCjMI75M1A2tKUQC');
    expect(parcaKimligi('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toBe('4uLU6hMCjMI75M1A2tKUQC');
    expect(parcaKimligi('teoman paramparça')).toBeNull();
  });
  it('Premium ve cihaz uyarısı', () => {
    expect(oynaticiHatasi(403)).toMatch(/Premium/);
    expect(oynaticiHatasi(404)).toMatch(/cihaz/);
  });
});
