/**
 * AxBoT — panel saf modül testleri
 * Developed by AxthrowA
 *
 * Bu turda eklenen istemci mantığının kilidi: animasyon ön ayarları,
 * uyarı kuyruğu durum makinesi, tema uygulama ve yetenek etiketleri.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ANIM_ON_AYARLARI, ANIM_SECENEKLERI, animBul, animKimligi, animStili, METIN_EFEKTLERI } from './animations.js';
import { sunucuPortu } from './widget-style.js';
import { anlikGoruntu, kaydedilmemisVar, kirliIsaretle, kirlileriBirak } from './kaydedilmemis.js';
import {
  BOS_DURUM,
  GorulenKimlikler,
  asamaSuresi,
  atla,
  gorunurSure,
  ilerlet,
  kuyrugaEkle,
  metinPenceresiAcik,
  sonrakiMetinSiniri,
  sonrakiTik,
  type UyariOgesi
} from './alertQueue.js';
import { GENEL_TEMALAR, WIDGET_TEMALARI, temalar, temayiUygula } from './themes.js';
import { FONTS } from './widget-defaults.js';
import { tuvaleSigdirmaPayi } from './katmanCakisma.js';
import { yuvalariGuncelle } from '../widgets/WordCloudWidget.js';
import { bitmisBosCekilis, kasaSeridi } from '../widgets/GiveawayWidget.js';
import { olayEtiketi, olayiDestekleyenler, onbellegiTemizle, yetenekleriGetir } from './capabilities.js';
import { genelRozet, platformRozeti, type CanliOzet } from './live-status.js';

const oge = (o: Partial<UyariOgesi> = {}): UyariOgesi => ({
  id: 'a1',
  tur: 'follow',
  veri: {},
  sureMs: 5000,
  animMs: 500,
  ...o
});

// ------------------------------------------------------------ animasyon ----

describe('animasyon ön ayarları', () => {
  it('her ön ayarın kimliği benzersizdir', () => {
    const idler = ANIM_ON_AYARLARI.map((a) => a.id);
    expect(new Set(idler).size).toBe(idler.length);
  });

  it('her ön ayarın etiketi vardır — panelde boş satır çıkmasın', () => {
    for (const a of ANIM_ON_AYARLARI) expect(a.etiket.trim().length).toBeGreaterThan(0);
    expect(ANIM_SECENEKLERI.length).toBe(ANIM_ON_AYARLARI.length);
  });

  it('bilinmeyen kimlik soluk geçişe düşer, çökertmez', () => {
    expect(animBul('yok-boyle-bir-sey').id).toBe('fade');
    expect(animKimligi(undefined)).toBe('fade');
    expect(animKimligi('')).toBe('fade');
  });

  it('ESKİ ayar adları korunur — kayıtlı widget bozulmaz', () => {
    expect(animKimligi('slide')).toBe('slideRight');
    expect(animKimligi('slide-left')).toBe('slideLeft');
    expect(animKimligi('pulse')).toBe('zoom');
    expect(animKimligi('spin')).toBe('rotate');
  });

  it('görünür aşama opaklığı sabitlemez ki anahtar kare oynasın', () => {
    const s = animStili('fadeUp', 'visible', 400);
    expect(s.opacity).toBeUndefined();
    expect(s.transform).toBeUndefined();
    expect(String(s.animation)).toContain('axt-on-fadeUp');
  });

  it('gizli aşama geçişsizdir — ilk karede animasyon oynamasın', () => {
    const s = animStili('fadeUp', 'hidden', 400);
    expect(s.transition).toBe('none');
    expect(s.visibility).toBe('hidden');
  });

  it('metin efektleri listesi boş değil', () => {
    expect(METIN_EFEKTLERI.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------- kuyruk ----

describe('uyarı kuyruğu', () => {
  it('ses toplam süreden uzunsa görünür aşama sese uyar', () => {
    // 5000 ms uyarı ama 9000 ms ses: ses yarıda kesilmemeli
    expect(gorunurSure(oge({ sureMs: 5000, animMs: 500, sesMs: 9000 }))).toBe(8500);
  });

  it('ses yoksa görünür süre toplam eksi iki animasyondur', () => {
    expect(gorunurSure(oge({ sureMs: 5000, animMs: 500 }))).toBe(4000);
  });

  it('çok kısa süre bile en az 200 ms görünür kalır', () => {
    expect(gorunurSure(oge({ sureMs: 100, animMs: 500 }))).toBe(200);
  });

  it('aşama süreleri tutarlıdır', () => {
    const o = oge();
    expect(asamaSuresi(o, 'entering')).toBe(500);
    expect(asamaSuresi(o, 'exiting')).toBe(500);
    expect(asamaSuresi(o, 'completed')).toBe(0);
  });

  it('kuyruk AÇIKKEN ikinci uyarı bekler', () => {
    const d1 = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 1000);
    const d2 = kuyrugaEkle(d1, oge({ id: 'b' }), true, 1100);
    expect(d2.aktif?.id).toBe('a');
    expect(d2.bekleyen.map((x) => x.id)).toEqual(['b']);
  });

  it('kuyruk KAPALIYKEN yeni uyarı mevcudu anında değiştirir', () => {
    const d1 = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 1000);
    const d2 = kuyrugaEkle(d1, oge({ id: 'b' }), false, 1100);
    expect(d2.aktif?.id).toBe('b');
    expect(d2.bekleyen).toEqual([]);
  });

  it('aşamalar sırayla ilerler: entering → visible → exiting → sıradaki', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 0);
    d = kuyrugaEkle(d, oge({ id: 'b' }), true, 0);
    expect(d.asama).toBe('entering');

    d = ilerlet(d, 0, d.asamaBitis);
    expect(d.asama).toBe('visible');

    d = ilerlet(d, 0, d.asamaBitis);
    expect(d.asama).toBe('exiting');

    // Çıkış bitince ARADA bir boşluk durumu var: iki uyarı üst üste
    // binmesin diye önce ekran boşalır (gapMs kadar), sonra sıradaki başlar.
    d = ilerlet(d, 0, d.asamaBitis);
    expect(d.asama).toBe('completed');
    expect(d.aktif).toBeNull();
    expect(d.bekleyen.map((x) => x.id)).toEqual(['b']);

    d = ilerlet(d, 0, d.asamaBitis);
    expect(d.aktif?.id).toBe('b');
    expect(d.asama).toBe('entering');
  });

  it('boşluk (gap) süresi dolmadan sıradaki başlamaz', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 0);
    d = kuyrugaEkle(d, oge({ id: 'b' }), true, 0);
    d = ilerlet(d, 0, d.asamaBitis); // visible
    d = ilerlet(d, 0, d.asamaBitis); // exiting
    d = ilerlet(d, 2000, d.asamaBitis); // completed + 2 sn boşluk
    expect(ilerlet(d, 2000, d.asamaBitis - 1).aktif).toBeNull();
    expect(ilerlet(d, 2000, d.asamaBitis).aktif?.id).toBe('b');
  });

  it('süre dolmadan ilerlet() durumu değiştirmez', () => {
    const d = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 0);
    expect(ilerlet(d, 0, d.asamaBitis - 1).asama).toBe('entering');
  });

  it('atla() aktif uyarıyı çıkışa alır', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 0);
    d = ilerlet(d, 0, d.asamaBitis); // visible
    d = atla(d, 100);
    expect(d.asama).toBe('exiting');
  });

  it('sonrakiTik boşta null döner', () => {
    expect(sonrakiTik(BOS_DURUM, 0)).toBeNull();
  });
});

describe('GorulenKimlikler', () => {
  it('aynı kimliği iki kez oynatmaz', () => {
    const g = new GorulenKimlikler(4);
    expect(g.gorduk('x')).toBe(false);
    g.ekle('x');
    expect(g.gorduk('x')).toBe(true);
  });

  it('halka tamponu taşınca en eski unutulur', () => {
    const g = new GorulenKimlikler(2);
    g.ekle('a');
    g.ekle('b');
    g.ekle('c');
    expect(g.gorduk('a')).toBe(false);
    expect(g.gorduk('c')).toBe(true);
  });
});

// ------------------------------------------------------------------ tema ----

describe('temalar', () => {
  it('genel temaların kimlikleri benzersizdir', () => {
    const idler = GENEL_TEMALAR.map((t) => t.id);
    expect(new Set(idler).size).toBe(idler.length);
  });

  it('tema yalnız widget’ın TANIDIĞI anahtarları yazar', () => {
    const tema = { id: 't', ad: 'T', degerler: { renk: '#fff', bilinmeyen: 'x' } } as any;
    const sonuc = temayiUygula({ renk: '#000', baska: 1 }, tema, ['renk']);
    expect(sonuc.renk).toBe('#fff');
    expect(sonuc.bilinmeyen).toBeUndefined();
    expect(sonuc.baska).toBe(1);
  });

  it('genel anahtar widget’ın kendi anahtarına da yazılır (hedef barı)', () => {
    const tema = { id: 't', degerler: { accentColor: '#f00', textColor: '#fff', bgColor: '#111' } } as any;
    const sonuc = temayiUygula({ barColor: '#0f0' }, tema, ['barColor', 'fontColor', 'backgroundColor']);
    expect(sonuc).toEqual({ barColor: '#f00', fontColor: '#fff', backgroundColor: '#111' });
  });

  it('temalar() en az bir seçenek verir', () => {
    expect(temalar('alert-box').length).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------- yetenek ----

const YETENEK = {
  kick: { olaylar: ['chat', 'kicks', 'follow'], roller: ['everyone', 'sub', 'og', 'mod'] },
  twitch: { olaylar: ['chat', 'bits', 'follow'], roller: ['everyone', 'sub', 'vip', 'mod'] }
} as any;

describe('yetenek etiketleri', () => {
  it('olayı üreten platformları bulur', () => {
    expect(olayiDestekleyenler(YETENEK, 'kicks')).toEqual(['kick']);
    expect(olayiDestekleyenler(YETENEK, 'chat').sort()).toEqual(['kick', 'twitch']);
  });

  it('HERKES destekliyorsa etiket üretmez — gereksiz gürültü olmasın', () => {
    expect(olayEtiketi(YETENEK, 'chat')).toBe('');
  });

  it('bir kısmı destekliyorsa platform adlarını yazar', () => {
    expect(olayEtiketi(YETENEK, 'kicks')).toBe('Kick');
    expect(olayEtiketi(YETENEK, 'bits')).toBe('Twitch');
  });

  it('hiçbiri desteklemiyorsa bunu açıkça söyler', () => {
    expect(olayEtiketi(YETENEK, 'superchat')).toContain('Hiçbir');
  });

  it('yetenek haritası boşken sessiz kalır — panel çökmesin', () => {
    expect(olayEtiketi({}, 'chat')).toBe('');
  });

  it('bağış etiketinde DIŞ kaynak da anılır — Kick yayıncısı yanılmasın', () => {
    // BynoGame bağışı platformdan bağımsızdır; yalnız "Twitch · YouTube"
    // yazmak Kick yayıncısına "bende çalışmaz" dedirtirdi.
    const h = { kick: { olaylar: ['chat'] }, twitch: { olaylar: ['chat', 'tip'] } } as any;
    const e = olayEtiketi(h, 'tip');
    expect(e).toContain('Twitch');
    expect(e).toContain('BynoGame');
  });

  it('hiçbir platform üretmese bile dış kaynak varsa onu söyler', () => {
    const h = { kick: { olaylar: ['chat'] } } as any;
    expect(olayEtiketi(h, 'tip')).toContain('BynoGame');
    expect(olayEtiketi(h, 'tip')).not.toContain('Hiçbir');
  });
});

describe('yetenekleriGetir', () => {
  beforeEach(() => onbellegiTemizle());
  afterEach(() => vi.unstubAllGlobals());

  it('ağ hatasında BOŞ harita döner, hata fırlatmaz', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ağ yok')));
    await expect(yetenekleriGetir()).resolves.toEqual({});
  });

  it('bir kez çeker, ikincide önbellekten verir', async () => {
    const sahte = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ yetenekler: YETENEK }) });
    vi.stubGlobal('fetch', sahte);
    await yetenekleriGetir();
    await yetenekleriGetir();
    expect(sahte).toHaveBeenCalledTimes(1);
  });
});

describe('metin görünüm penceresi (örnek alınan bot: Metin görünümü ms – ms)', () => {
  it('0–0 her zaman görünür', () => {
    expect(metinPenceresiAcik(0, 0, 0)).toBe(true);
    expect(metinPenceresiAcik(9999, 0, 0)).toBe(true);
  });

  it('1500–4000: başta gizli, pencerede görünür, sonra gizli', () => {
    expect(metinPenceresiAcik(0, 1500, 4000)).toBe(false);
    expect(metinPenceresiAcik(1500, 1500, 4000)).toBe(true);
    expect(metinPenceresiAcik(3999, 1500, 4000)).toBe(true);
    expect(metinPenceresiAcik(4000, 1500, 4000)).toBe(false);
  });

  it('yalnız başlangıç: o andan sonuna kadar; yalnız bitiş: baştan o ana kadar', () => {
    expect(metinPenceresiAcik(500, 1000, 0)).toBe(false);
    expect(metinPenceresiAcik(8000, 1000, 0)).toBe(true);
    expect(metinPenceresiAcik(500, 0, 1000)).toBe(true);
    expect(metinPenceresiAcik(1500, 0, 1000)).toBe(false);
  });

  it('bir sonraki sınıra kalan süre — widget tam o anda yeniden çizilir', () => {
    expect(sonrakiMetinSiniri(0, 1500, 4000)).toBe(1500);
    expect(sonrakiMetinSiniri(2000, 1500, 4000)).toBe(2000);
    expect(sonrakiMetinSiniri(5000, 1500, 4000)).toBeNull();
    expect(sonrakiMetinSiniri(0, 0, 0)).toBeNull();
  });

  it('ESKİ HATA: geçen süre uyarının BAŞLANGICINDAN ölçülür, aşama bitişinden değil', () => {
    const d = kuyrugaEkle(BOS_DURUM, oge({ id: 'a', sureMs: 5000, animMs: 500 }), true, 10_000);
    expect(d.aktifBaslangic).toBe(10_000);
    // Başladıktan 100 ms sonra "1500 ms'de belir" diyen metin henüz gizli olmalı
    expect(metinPenceresiAcik(10_100 - d.aktifBaslangic, 1500, 0)).toBe(false);
  });

  it('sıradaki uyarı başlayınca başlangıç yenilenir', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge({ id: 'a' }), true, 0);
    d = kuyrugaEkle(d, oge({ id: 'b' }), true, 0);
    d = ilerlet(d, 0, d.asamaBitis);
    d = ilerlet(d, 0, d.asamaBitis);
    d = ilerlet(d, 0, d.asamaBitis); // completed
    const an = d.asamaBitis;
    d = ilerlet(d, 0, an); // b başlar
    expect(d.aktif?.id).toBe('b');
    expect(d.aktifBaslangic).toBe(an);
  });
});

describe('canlı yayın rozetleri', () => {
  const kapali: CanliOzet = { canli: false, baslangic: null, izleyici: 0, canliPlatformlar: [], platformlar: [] };
  const canli: CanliOzet = {
    canli: true,
    baslangic: 1,
    izleyici: 1234,
    canliPlatformlar: ['kick', 'youtube'],
    platformlar: [
      { platform: 'kick', canli: true, izleyici: 1000, baslik: 'Gece yayını', kategori: 'Just Chatting', baslangic: 1 },
      { platform: 'youtube', canli: true, izleyici: 234, baslik: '', kategori: '', baslangic: 1 },
      { platform: 'twitch', canli: false, izleyici: 0, baslik: '', kategori: '', baslangic: null }
    ]
  };

  it('bilinmiyor: hiçbir platform bildirmediyse engellenmediği söylenir', () => {
    expect(genelRozet(null).tur).toBe('bilinmiyor');
    const r = genelRozet({ ...kapali, canli: null });
    expect(r.tur).toBe('bilinmiyor');
    expect(r.ipucu).toContain('engellenmez');
  });

  it('canlı: toplam izleyici ve platform adları', () => {
    const r = genelRozet(canli);
    expect(r.tur).toBe('canli');
    expect(r.metin).toBe('CANLI · 1.234 izleyici');
    expect(r.ipucu).toBe('Yayında: Kick, YouTube');
  });

  it('kapalı', () => {
    expect(genelRozet(kapali)).toMatchObject({ tur: 'kapali', metin: 'Yayın kapalı' });
  });

  it('platform satırı: canlı, kapalı, bildirmeyen', () => {
    expect(platformRozeti(canli, 'kick')).toMatchObject({ tur: 'canli', ipucu: 'Gece yayını · Just Chatting' });
    expect(platformRozeti(canli, 'youtube')?.ipucu).toBe('YouTube yayında');
    expect(platformRozeti(canli, 'twitch')?.tur).toBe('kapali');
    expect(platformRozeti(canli, 'tiktok')).toBeNull();
    expect(platformRozeti(undefined, 'kick')).toBeNull();
  });
});

describe('sunucuPortu', () => {
  it('sayfanın açıldığı portu kullanır; yalnız vite geliştirme portları 3001 olur', () => {
    // Eskiden kenar çubuğu ve Kick yetki penceresi 3001'e sabitti
    expect(sunucuPortu({ port: '3011' })).toBe('3011');
    expect(sunucuPortu({ port: '3001' })).toBe('3001');
    expect(sunucuPortu({ port: '5173' })).toBe('3001');
    expect(sunucuPortu({ port: '3000' })).toBe('3001');
    expect(sunucuPortu({ port: '' })).toBe('3001');
  });
});

describe('kaydedilmemiş değişiklik kaydı', () => {
  afterEach(() => kirlileriBirak());

  it('kirli kaynak varken sekme geçişi sorulur; temizlenince sorulmaz', () => {
    expect(kaydedilmemisVar()).toBe(false);
    kirliIsaretle('ayarlar', true);
    kirliIsaretle('automod', true);
    expect(kaydedilmemisVar()).toBe(true);
    kirliIsaretle('ayarlar', false);
    expect(kaydedilmemisVar()).toBe(true);
    kirliIsaretle('automod', false);
    expect(kaydedilmemisVar()).toBe(false);
  });

  it('kullanıcı ayrılmayı onaylayınca kayıt boşalır', () => {
    kirliIsaretle('a', true);
    kirlileriBirak();
    expect(kaydedilmemisVar()).toBe(false);
  });

  it('anahtar sırası farkı değişiklik sayılmaz, değer farkı sayılır', () => {
    expect(anlikGoruntu({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(anlikGoruntu({ b: { d: [1, 2], c: 2 }, a: 1 }));
    expect(anlikGoruntu({ a: 1 })).not.toBe(anlikGoruntu({ a: '1' }));
    expect(anlikGoruntu({ l: [1, 2] })).not.toBe(anlikGoruntu({ l: [2, 1] }));
  });
});

describe('tema okunurluğu', () => {
  const parlaklik = (h: string) => {
    const k = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  };
  const kontrast = (a: string, b: string) => {
    const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const hex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

  it('genel temalarda metin ve başlık zeminde okunur, yazı tipi listede ve Türkçe harfli', () => {
    const kotu: string[] = [];
    for (const t of [...GENEL_TEMALAR, ...Object.values(WIDGET_TEMALARI).flat()]) {
      const d = t.degerler as Record<string, unknown>;
      const bgColor = d.bgColor ?? d.backgroundColor ?? d.messageBgColor;
      const textColor = d.textColor ?? d.fontColor ?? d.messageColor;
      const accentColor = d.titleColor ?? d.accentColor;
      const { fontFamily } = d;
      // Yarı saydam zemin (cam) sahneye göre değişir: rengiyle ölçülmez
      if (Number(d.bgOpacity ?? d.backgroundOpacity ?? d.messageBgOpacity ?? 1) < 0.5) continue;
      if (hex(bgColor) && hex(textColor) && kontrast(bgColor, textColor) < 4.5) kotu.push(`${t.id} metin ${kontrast(bgColor, textColor).toFixed(1)}`);
      if (hex(bgColor) && hex(accentColor) && kontrast(bgColor, accentColor) < 3) kotu.push(`${t.id} başlık ${kontrast(bgColor, accentColor).toFixed(1)}`);
      if (typeof fontFamily === 'string' && !fontFamily.includes(',') && (!FONTS.includes(fontFamily) || ['Orbitron', 'Creepster'].includes(fontFamily))) kotu.push(`${t.id} yazı ${fontFamily}`);
    }
    expect(kotu).toEqual([]);
  });
});

describe('kelime bulutu yuvaları', () => {
  const say = (l: string[]) => l.reduce<Record<string, number>>((a, k) => ({ ...a, [k]: (a[k] || 0) + 1 }), {});

  it('az sözcükte her sözcükten eşit sayıda doldurur', () => {
    expect(say(yuvalariGuncelle([], ['a', 'b'], 10))).toEqual({ a: 5, b: 5 });
    expect(yuvalariGuncelle([], ['a', 'b'], 4)).toEqual(['a', 'b', 'a', 'b']);
    expect(yuvalariGuncelle([], [], 4)).toEqual([]);
  });

  it('yeni sözcük yalnız fazla kopyaların yerine geçer, diğer yuvalar yerinde kalır', () => {
    const once = yuvalariGuncelle([], ['a', 'b'], 12);
    const sonra = yuvalariGuncelle(once, ['a', 'b', 'c'], 12);
    expect(say(sonra)).toEqual({ a: 4, b: 4, c: 4 });
    expect(sonra.filter((k, i) => k === once[i]).length).toBe(8);
  });
});

describe('katman tuvale sığdırma', () => {
  it('yalnız alttan taşan kadar yukarı alır, üstü geçmez', () => {
    expect(tuvaleSigdirmaPayi(760, 240)).toBe(0);
    expect(tuvaleSigdirmaPayi(760, 400)).toBe(80);
    expect(tuvaleSigdirmaPayi(760, 400, 2)).toBe(480);
    expect(tuvaleSigdirmaPayi(100, 5000)).toBe(100);
  });
});

describe('çekiliş kasa şeridi', () => {
  it('işaret kazanan kartın üstünde durur', () => {
    for (const r of [() => 0, () => 0.5, () => 0.999]) {
      const { isimler, kayma } = kasaSeridi('Kazanan', ['a', 'b'], r);
      expect(isimler[Math.floor(kayma / 178)]).toBe('Kazanan');
    }
  });
  it('aday yoksa da çalışır', () => {
    expect(kasaSeridi('K', []).isimler.every((a) => a === 'K')).toBe(true);
  });
});

describe('tema biçim değiştirir', () => {
  const secili = (id: string) => temayiUygula({ kabuk: '', barColor: '#000' }, temalar(id).find((t) => t.id === 'o-nisanci')!, ['kabuk', 'barColor'], () => true);
  it('görünüm seçeneği olmayan widget kutu tasarımını alır', () => {
    expect(secili('polls').kabuk).toBe('hud');
  });
  it('film, oyun ve dizi temalarının hepsi bir aileye bağlı', () => {
    const uretilen = new Set(
      GENEL_TEMALAR.filter((t) => !t.id.startsWith('kutu_')).map(
        (t) => temayiUygula({ kabuk: '' }, t, ['kabuk'], () => true).kabuk as string
      )
    );
    expect(uretilen.has('')).toBe(false);
    expect(uretilen.size).toBeGreaterThanOrEqual(12);
  });
  it('kutu temasının kendi tasarımı ezilmez', () => {
    const t = GENEL_TEMALAR.find((x) => x.id === 'kutu_not')!;
    expect(temayiUygula({ kabuk: '' }, t, ['kabuk'], () => true).kabuk).toBe('yapiskan');
  });
});

describe('hız ayarı', () => {
  it('0 en yavaşa iner, boş normal kalır', async () => {
    const { hizCarpani } = await import('./widget-style.js');
    expect(hizCarpani(0)).toBe(0.5);
    expect(hizCarpani(0.3)).toBe(0.3);
    expect(hizCarpani(undefined)).toBe(1);
    expect(hizCarpani('abc')).toBe(1);
    expect(hizCarpani(9)).toBe(4);
  });
});

describe('çekiliş şeridi okunur hızda', () => {
  it('süre uzadıkça kart sayısı orantılı, art arda aynı isim yok', () => {
    const { isimler, kayma } = kasaSeridi('K', ['a', 'b', 'c'], Math.random, 10_000);
    expect(isimler.length).toBe(21);
    expect(kayma / 178 / 10).toBeLessThan(2);
    for (let i = 1; i < isimler.length; i++) if (isimler[i] !== 'K' && isimler[i - 1] !== 'K') expect(isimler[i]).not.toBe(isimler[i - 1]);
  });
});

describe('çekiliş widget görünürlüğü', () => {
  const c = { created_at: 1000, duration_minutes: 1 };
  it('süresi dolmuş ve katılımsız çekiliş gizlenir', () => {
    expect(bitmisBosCekilis(c, 0, 1000 + 60_000)).toBe(true);
  });
  it('süresi sürüyorsa, katılımcı varsa ya da süresizse görünür', () => {
    expect(bitmisBosCekilis(c, 0, 1000 + 59_000)).toBe(false);
    expect(bitmisBosCekilis(c, 3, 1000 + 60_000)).toBe(false);
    expect(bitmisBosCekilis({ created_at: 1000, duration_minutes: 0 }, 0, 9e9)).toBe(false);
    expect(bitmisBosCekilis(null, 0, 9e9)).toBe(false);
  });
});
