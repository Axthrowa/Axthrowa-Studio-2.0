/**
 * StreamAxT — !clip yardımcıları testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { ffmpegArgumanlari, hataSatiriTemizle, klipAdiGecerliMi, klipDosyaAdi, klipSuresi, varyantSec } from './klip-saf.js';

describe('hataSatiriTemizle', () => {
  it('akış adresini (belirteçli) ve disk yolunu sohbete sızdırmaz', () => {
    const r = hataSatiriTemizle(
      'https://abc.live-video.net/v1/playlist/XYZ.m3u8?token=gizli123: Server returned 403 Forbidden C:\\Users\\Ax\\data\\klipler\\a.mp4'
    );
    expect(r).not.toContain('gizli123');
    expect(r).not.toContain('Users');
    expect(r).toContain('403 Forbidden');
    expect(hataSatiriTemizle('x'.repeat(500))).toHaveLength(120);
    expect(hataSatiriTemizle(undefined as any)).toBe('');
  });
});

describe('klipSuresi', () => {
  it('varsayılan, sınırlar', () => {
    expect(klipSuresi(undefined, 30, 120)).toBe(30);
    expect(klipSuresi('45', 30, 120)).toBe(45);
    expect(klipSuresi('500', 30, 120)).toBe(120);
    expect(klipSuresi('3', 30, 120)).toBe(10);
    expect(klipSuresi('abc', 30, 120)).toBe(30);
    expect(klipSuresi(undefined, 200, 60)).toBe(60);
  });
});

describe('varyantSec', () => {
  const ana = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=230000,RESOLUTION=284x160',
    '160p.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=8998851,RESOLUTION=1920x1080',
    'https://cdn.example/1080p.m3u8',
    '#EXT-X-STREAM-INF:BANDWIDTH=3422999,RESOLUTION=1280x720',
    '720p.m3u8'
  ].join('\n');
  it('720p seçer, göreli adresi çözer', () => {
    expect(varyantSec(ana, 'https://x.example/a/master.m3u8')).toBe('https://x.example/a/720p.m3u8');
    expect(varyantSec(ana, 'https://x.example/a/master.m3u8', 1080)).toBe('https://cdn.example/1080p.m3u8');
  });
  it('varyant yoksa null (doğrudan medya listesi)', () => {
    expect(varyantSec('#EXTM3U\n#EXTINF:1,\nseg1.ts', 'https://x/a.m3u8')).toBeNull();
  });
});

describe('dosya adları', () => {
  it('güvenli ad üretir ve doğrular', () => {
    const ad = klipDosyaAdi('Çağrı@Yılmaz!', new Date(2026, 9, 14, 21, 30, 5), 30);
    expect(ad).toBe('20261014-213005_CagrYlmaz_30sn.mp4');
    expect(klipAdiGecerliMi(ad)).toBe(true);
    expect(klipAdiGecerliMi('../streamaxt.sqlite')).toBe(false);
    expect(klipAdiGecerliMi('20261014-213005_a_30sn.mp4/../x')).toBe(false);
  });
});

describe('ffmpeg', () => {
  it('yeniden kodlamadan, en eski parçadan başlar', () => {
    const a = ffmpegArgumanlari('https://x/v.m3u8', 'C:/k/a.mp4', 30);
    expect(a).toContain('-live_start_index');
    expect(a[a.indexOf('-live_start_index') + 1]).toBe('0');
    expect(a[a.indexOf('-c') + 1]).toBe('copy');
    expect(a[a.indexOf('-t') + 1]).toBe('30');
    expect(a[a.length - 1]).toBe('C:/k/a.mp4');
  });
});
