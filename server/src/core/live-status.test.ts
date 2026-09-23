/**
 * StreamAxT — yayın durumu ve Twitch kuralları testleri (saf)
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import {
  gecis,
  genelDurum,
  isoZamani,
  kickZamani,
  sureMetni,
  youtubeKimlikTuru,
  youtubeVideoKimligi,
  type PlatformYayinDurumu
} from './live-status-math.js';
import {
  kapsamVar,
  twitchHataAciklamasi,
  twitchJetonTemizle,
  twitchSureSinirla,
  twitchYayinCoz,
  TWITCH_ZAMAN_ASIMI_UST
} from '../platforms/twitch-rules.js';
import { zatenDuyuruldu } from '../modules/integrations/discord-rules.js';

const d = (o: Partial<PlatformYayinDurumu>): PlatformYayinDurumu => ({
  platform: 'kick',
  canli: false,
  baslangic: null,
  izleyici: 0,
  baslik: '',
  kategori: '',
  yayinId: '',
  kanal: '',
  guncelleme: 0,
  ...o
});

describe('kickZamani', () => {
  it('Kick v2 biçimini (saat dilimsiz) UTC olarak okur — 2026-09-23 gözlemi', () => {
    expect(kickZamani('2026-09-23 12:53:51')).toBe(Date.UTC(2026, 8, 23, 12, 53, 51));
  });

  it('resmi API biçimini (ISO, Z) okur', () => {
    expect(kickZamani('2026-09-23T12:53:51Z')).toBe(Date.UTC(2026, 8, 23, 12, 53, 51));
  });

  it('boş ve yer tutucu tarihte null', () => {
    expect(kickZamani('')).toBeNull();
    expect(kickZamani(null)).toBeNull();
    expect(kickZamani('0001-01-01T00:00:00Z')).toBeNull();
    expect(kickZamani('dün')).toBeNull();
  });
});

describe('isoZamani', () => {
  it('Twitch/YouTube ISO zamanı', () => {
    expect(isoZamani('2026-09-23T10:00:00Z')).toBe(Date.UTC(2026, 8, 23, 10, 0, 0));
    expect(isoZamani(undefined)).toBeNull();
  });
});

describe('gecis', () => {
  it('kapalıdan açığa = açıldı', () => expect(gecis(false, true)).toBe('acildi'));
  it('açıktan kapalıya = kapandı', () => expect(gecis(true, false)).toBe('kapandi'));
  it('değişmediyse olay yok', () => {
    expect(gecis(true, true)).toBeNull();
    expect(gecis(false, false)).toBeNull();
  });
  it('İLK gözlemde yayın açıksa açıldı sayılır (bot yayın ortasında açıldı)', () => {
    expect(gecis(undefined, true)).toBe('acildi');
  });
  it('ilk gözlemde kapalıysa olay yok', () => expect(gecis(undefined, false)).toBeNull());
});

describe('genelDurum', () => {
  it('hiç durum yoksa BİLİNMİYOR (null)', () => {
    expect(genelDurum([]).canli).toBeNull();
  });

  it('hepsi kapalıysa false', () => {
    expect(genelDurum([d({ canli: false }), d({ platform: 'twitch' })]).canli).toBe(false);
  });

  it('biri açıksa açık; başlangıç EN ERKEN açık platformdan, izleyiciler toplanır', () => {
    const g = genelDurum([
      d({ platform: 'kick', canli: true, baslangic: 2000, izleyici: 10 }),
      d({ platform: 'twitch', canli: true, baslangic: 1000, izleyici: 5 }),
      d({ platform: 'youtube', canli: false, baslangic: 500 })
    ]);
    expect(g.canli).toBe(true);
    expect(g.baslangic).toBe(1000);
    expect(g.izleyici).toBe(15);
    expect(g.canliPlatformlar.sort()).toEqual(['kick', 'twitch']);
  });

  it('başlangıcı bilinmeyen açık yayın', () => {
    const g = genelDurum([d({ canli: true, baslangic: null })]);
    expect(g.canli).toBe(true);
    expect(g.baslangic).toBeNull();
  });
});

describe('sureMetni', () => {
  it('eski getStreamUptime biçimiyle aynı', () => {
    expect(sureMetni(3725_000)).toBe('1 saat 2 dakika 5 saniye');
    expect(sureMetni(65_000)).toBe('1 dakika 5 saniye');
    expect(sureMetni(5_000)).toBe('5 saniye');
    expect(sureMetni(-10)).toBe('0 saniye');
  });
});

describe('YouTube kimlik ayrımı (eski hata: video kimliğiyle sohbet okunmuyordu)', () => {
  it('11 karakterlik video kimliği', () => {
    expect(youtubeKimlikTuru('dQw4w9WgXcQ')).toBe('video');
    expect(youtubeVideoKimligi('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('adresten video kimliği', () => {
    expect(youtubeVideoKimligi('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoKimligi('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoKimligi('https://www.youtube.com/live/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(youtubeKimlikTuru('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('video');
  });

  it('uzun kimlik canlı sohbet kimliğidir', () => {
    expect(youtubeKimlikTuru('Cg0KC2RRdzR3OVdnWGNRKicKGFVDX3g1WEc')).toBe('sohbet');
  });

  it('anlamsız girdi', () => {
    expect(youtubeKimlikTuru('abc')).toBe('bilinmiyor');
    expect(youtubeVideoKimligi('abc')).toBe('');
  });
});

describe('Twitch kuralları', () => {
  it('jeton öneklerini temizler', () => {
    expect(twitchJetonTemizle('oauth:abc123')).toBe('abc123');
    expect(twitchJetonTemizle('Bearer abc123')).toBe('abc123');
    expect(twitchJetonTemizle('  abc123 ')).toBe('abc123');
  });

  it('zaman aşımı Twitch sınırlarında (1 sn … 2 hafta)', () => {
    expect(twitchSureSinirla(0)).toBe(1);
    expect(twitchSureSinirla(600)).toBe(600);
    expect(twitchSureSinirla(99_999_999)).toBe(TWITCH_ZAMAN_ASIMI_UST);
  });

  it('kapsam denetimi', () => {
    expect(kapsamVar(['moderator:manage:banned_users'], 'moderator:manage:banned_users')).toBe(true);
    expect(kapsamVar(['chat:read'], 'moderator:manage:banned_users')).toBe(false);
    expect(kapsamVar(undefined, 'x')).toBe(false);
  });

  it('hata açıklamaları sebebi söyler — sessiz başarısızlık yok', () => {
    expect(twitchHataAciklamasi(403, {})).toContain('moderatör değil');
    expect(twitchHataAciklamasi(401, {}, 'moderator:manage:chat_messages')).toContain('moderator:manage:chat_messages');
    expect(twitchHataAciklamasi(429, {})).toContain('hız sınırı');
  });

  it('streams yanıtı: boş dizi = yayın kapalı', () => {
    expect(twitchYayinCoz({ data: [] }).canli).toBe(false);
  });

  it('streams yanıtı: canlı yayın alanları', () => {
    const y = twitchYayinCoz({
      data: [
        {
          id: '42',
          type: 'live',
          title: 'Başlık',
          game_name: 'Just Chatting',
          viewer_count: 77,
          started_at: '2026-09-23T10:00:00Z'
        }
      ]
    });
    expect(y).toEqual({
      canli: true,
      baslangic: Date.UTC(2026, 8, 23, 10, 0, 0),
      izleyici: 77,
      baslik: 'Başlık',
      kategori: 'Just Chatting',
      yayinId: '42'
    });
  });
});

describe('Discord: aynı yayın iki kez duyurulmaz', () => {
  it('aynı yayın kimliği = zaten duyuruldu (bot yeniden başlasa bile)', () => {
    expect(zatenDuyuruldu('123', '123')).toBe(true);
  });
  it('yeni yayın duyurulur', () => {
    expect(zatenDuyuruldu('124', '123')).toBe(false);
    expect(zatenDuyuruldu('124', undefined)).toBe(false);
  });
  it('kimlik yoksa bu engel devreye girmez (bekleme süresi korur)', () => {
    expect(zatenDuyuruldu('', '')).toBe(false);
    expect(zatenDuyuruldu(undefined, undefined)).toBe(false);
  });
});
