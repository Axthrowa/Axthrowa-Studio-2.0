/**
 * AxBoT — komut girdisi ve eşleme testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  adTemizle,
  anahtarKelimeEslesir,
  anahtarKomutuSec,
  erisimAciklamasi,
  erisimUygunMu,
  komutGirdisiniCoz,
  platformlariCoz,
  takmaAdlariCoz
} from './command-input.js';
import { trKatla } from '../../core/text.js';

describe('komutGirdisiniCoz — panel/istemci uyumu', () => {
  it('PANELİN gönderdiği yılan_adı alanları kabul edilir (eski hata: rol yok sayılıyordu)', () => {
    const r = komutGirdisiniCoz({
      name: 'denemekomut',
      response: 'merhaba',
      user_level: 'mod',
      cooldown: 7,
      aliases: '["tst"]',
      is_enabled: 1
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kayit.user_level).toBe('mod');
    expect(r.kayit.aliases).toBe('["tst"]');
    expect(r.kayit.cooldown).toBe(7);
  });

  it('eski istemcinin deveAdı alanları da kabul edilir', () => {
    const r = komutGirdisiniCoz({ name: 'x', response: 'y', userLevel: 'vip', isEnabled: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kayit.user_level).toBe('vip');
    expect(r.kayit.is_enabled).toBe(0);
  });

  it('DÜZENLEMEDE verilmeyen alanlar mevcuttan gelir (eski hata: düzenleme komutu kapatıyordu / 500)', () => {
    const mevcut = {
      name: 'selam',
      response: 'eski',
      user_level: 'mod' as const,
      is_enabled: 1,
      cost_points: 50,
      trigger_type: 'keyword' as const,
      access_mode: 'online' as const
    };
    const r = komutGirdisiniCoz({ response: 'yeni' }, mevcut);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kayit.response).toBe('yeni');
    expect(r.kayit.user_level).toBe('mod');
    expect(r.kayit.is_enabled).toBe(1);
    expect(r.kayit.cost_points).toBe(50);
    expect(r.kayit.trigger_type).toBe('keyword');
    expect(r.kayit.access_mode).toBe('online');
  });

  it('BotRix formundaki tüm alanlar yazılabilir', () => {
    const r = komutGirdisiniCoz({
      name: '!Selam',
      response: 'Hoş geldin $(sender)',
      cooldown_mode: 'user',
      user_cooldown: 30,
      cost_points: 100,
      min_level: 5,
      platforms: ['kick', 'twitch'],
      trigger_type: 'keyword',
      access_mode: 'offline'
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kayit.name).toBe('selam');
    expect(r.kayit.cooldown_mode).toBe('user');
    expect(r.kayit.user_cooldown).toBe(30);
    expect(r.kayit.cost_points).toBe(100);
    expect(r.kayit.min_level).toBe(5);
    expect(r.kayit.platforms).toBe('kick,twitch');
    expect(r.kayit.trigger_type).toBe('keyword');
    expect(r.kayit.access_mode).toBe('offline');
  });

  it('geçersiz seçenekler varsayılana düşer', () => {
    const r = komutGirdisiniCoz({ name: 'a1', response: 'b', user_level: 'kral', access_mode: 'bazen', trigger_type: 'x' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kayit.user_level).toBe('everyone');
    expect(r.kayit.access_mode).toBe('always');
    expect(r.kayit.trigger_type).toBe('command');
  });

  it('sayılar sınırlanır', () => {
    const r = komutGirdisiniCoz({ name: 'a1', response: 'b', cooldown: -5, cost_points: 'abc', user_cooldown: 999999 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kayit.cooldown).toBe(0);
    expect(r.kayit.cost_points).toBe(0);
    expect(r.kayit.user_cooldown).toBe(86400);
  });

  it('ad ve yanıt zorunlu', () => {
    expect(komutGirdisiniCoz({ response: 'x' }).ok).toBe(false);
    expect(komutGirdisiniCoz({ name: 'x', response: '   ' }).ok).toBe(false);
  });

  it('komut adı boşluk içeremez ama anahtar kelime öbek olabilir', () => {
    expect(komutGirdisiniCoz({ name: 'iyi yayınlar', response: 'x' }).ok).toBe(false);
    const r = komutGirdisiniCoz({ name: 'iyi yayınlar', response: 'x', trigger_type: 'keyword' });
    expect(r.ok).toBe(true);
  });

  it('tek harfli anahtar kelime reddedilir — her mesajda tetiklenirdi', () => {
    expect(komutGirdisiniCoz({ name: 'a', response: 'x', trigger_type: 'keyword' }).ok).toBe(false);
  });
});

describe('ad ve liste temizleme', () => {
  it('önek ve büyük harf temizlenir, Türkçe korunur', () => {
    expect(adTemizle('!SELAM')).toBe('selam');
    expect(adTemizle('  !İyi  ')).toBe('iyi');
  });

  it('takma adlar: dizi, JSON ve virgüllü metin; ana ad ve tekrarlar atılır', () => {
    expect(takmaAdlariCoz(['!a', 'b', 'a'], 'x')).toEqual(['a', 'b']);
    expect(takmaAdlariCoz('["c","!d"]')).toEqual(['c', 'd']);
    expect(takmaAdlariCoz('e, f ,e', 'e')).toEqual(['f']);
    expect(takmaAdlariCoz(undefined)).toEqual([]);
  });

  it('platformlar: bilinmeyen atılır, hepsi seçiliyse boş (= tümü)', () => {
    expect(platformlariCoz(['twitch', 'kick', 'myspace'])).toBe('kick,twitch');
    expect(platformlariCoz('kick,twitch,youtube,tiktok,discord,trovo')).toBe('');
    expect(platformlariCoz('')).toBe('');
  });
});

describe('anahtar kelime eşleşmesi', () => {
  it('bütün kelime olarak eşleşir', () => {
    expect(anahtarKelimeEslesir('selam millet', 'selam')).toBe(true);
    expect(anahtarKelimeEslesir('herkese selam!', 'selam')).toBe(true);
  });

  it('kelimenin İÇİNDE eşleşmez — "selamlar" "selam"ı tetiklemez', () => {
    expect(anahtarKelimeEslesir('selamlar', 'selam')).toBe(false);
    expect(anahtarKelimeEslesir('aselam', 'selam')).toBe(false);
  });

  it('Türkçe büyük/küçük harf ve karaktersiz yazım eşleşir', () => {
    expect(anahtarKelimeEslesir('İYİ YAYINLAR!!', 'iyi yayınlar')).toBe(true);
    expect(anahtarKelimeEslesir('iyi yayinlar', 'iyi yayınlar')).toBe(true);
    expect(anahtarKelimeEslesir('HAYIR', 'hayır')).toBe(true);
  });

  it('öbekteki birden çok boşluk sorun olmaz', () => {
    expect(anahtarKelimeEslesir('iyi    yayınlar', 'iyi yayınlar')).toBe(true);
  });

  it('düzenli ifade karakterleri güvenle kaçışlanır', () => {
    expect(anahtarKelimeEslesir('c++ seviyorum', 'c++')).toBe(true);
    expect(anahtarKelimeEslesir('cccc', 'c.')).toBe(false);
  });

  it('en UZUN anahtar kazanır ve tek yanıt üretilir', () => {
    const komutlar = [
      { name: 'iyi', aliases: '[]' },
      { name: 'iyi yayınlar', aliases: '[]' }
    ];
    expect(anahtarKomutuSec('iyi yayınlar herkese', komutlar)?.name).toBe('iyi yayınlar');
    expect(anahtarKomutuSec('iyi günler', komutlar)?.name).toBe('iyi');
    expect(anahtarKomutuSec('merhaba', komutlar)).toBeNull();
  });

  it('takma ad da anahtar kelime olarak çalışır', () => {
    const komutlar = [{ name: 'selam', aliases: '["merhaba"]' }];
    expect(anahtarKomutuSec('merhaba herkese', komutlar)?.name).toBe('selam');
  });
});

describe('erişim kipi', () => {
  it('her zaman', () => {
    expect(erisimUygunMu('always', true)).toBe(true);
    expect(erisimUygunMu('always', false)).toBe(true);
  });

  it('yalnız yayındayken', () => {
    expect(erisimUygunMu('online', true)).toBe(true);
    expect(erisimUygunMu('online', false)).toBe(false);
  });

  it('yalnız yayın kapalıyken', () => {
    expect(erisimUygunMu('offline', false)).toBe(true);
    expect(erisimUygunMu('offline', true)).toBe(false);
  });

  it('durum BİLİNMİYORSA engellenmez — algılama yok diye komut ölmesin', () => {
    expect(erisimUygunMu('online', null)).toBe(true);
    expect(erisimUygunMu('offline', null)).toBe(true);
  });

  it('açıklama metinleri', () => {
    expect(erisimAciklamasi('online')).toContain('açıkken');
    expect(erisimAciklamasi('offline')).toContain('kapalıyken');
    expect(erisimAciklamasi('always')).toBe('');
  });
});

describe('trKatla', () => {
  it('Türkçe karakterleri katlar', () => {
    expect(trKatla('ŞIĞÜÖÇ İ')).toBe('siguoc i');
    expect(trKatla(undefined as any)).toBe('');
  });
});

/**
 * YİNELENEN `case` KİLİDİ.
 *
 * Aynı `switch` içinde aynı etiket iki kez yazılırsa JavaScript ilkini
 * çalıştırır, ikincisi ÖLÜ kod olur — TypeScript bunu yakalamıyor. Bu yüzden
 * `!queue`/`!sira` izleyici kuyruğunu, `!watchtime`/`!followage` gerçek
 * uygulamalarını hiç çalıştıramıyordu. Kaynak metinden denetlenir.
 */
describe('yerleşik komutlarda yinelenen case etiketi yok', () => {
  it('command-manager.ts içinde her case etiketi bir kez geçer', () => {
    // `import.meta` sunucunun CommonJS derlemesinde kullanılamıyor; testler
    // hem kökten hem server/ içinden koşabildiği için iki yol denenir.
    const adaylar = [
      path.resolve(process.cwd(), 'src/modules/commands/command-manager.ts'),
      path.resolve(process.cwd(), 'server/src/modules/commands/command-manager.ts')
    ];
    const dosya = adaylar.find((a) => fs.existsSync(a));
    expect(dosya, 'command-manager.ts bulunamadı').toBeTruthy();
    const kaynak = fs.readFileSync(dosya!, 'utf8');
    const etiketler = [...kaynak.matchAll(/^\s*case '([^']+)':/gm)].map((m) => m[1]);
    const sayim = new Map<string, number>();
    for (const e of etiketler) sayim.set(e, (sayim.get(e) || 0) + 1);
    const yinelenen = [...sayim.entries()].filter(([, n]) => n > 1).map(([e]) => e);
    expect(yinelenen).toEqual([]);
    expect(etiketler.length).toBeGreaterThan(50);
  });
});
