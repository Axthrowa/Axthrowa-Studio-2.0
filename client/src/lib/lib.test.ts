/**
 * StreamAxT — panel saf modül testleri
 * Developed by AxthrowA
 *
 * Bu turda eklenen istemci mantığının kilidi: animasyon ön ayarları,
 * uyarı kuyruğu durum makinesi, tema uygulama ve yetenek etiketleri.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ANIM_ON_AYARLARI, ANIM_SECENEKLERI, animBul, animKimligi, animStili, METIN_EFEKTLERI } from './animations.js';
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
import { GENEL_TEMALAR, temaBul, temalar, temayiUygula } from './themes.js';
import { birlesikRoller, olayEtiketi, olayiDestekleyenler, onbellegiTemizle, yetenekleriGetir } from './capabilities.js';

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

  it('görünür aşama tam opaklık verir', () => {
    const s = animStili('fadeUp', 'visible', 400);
    expect(s.opacity).toBe(1);
  });

  it('gizli aşama geçişsizdir — ilk karede animasyon oynamasın', () => {
    const s = animStili('fadeUp', 'hidden', 400);
    expect(s.transition).toBe('none');
    expect(s.visibility).toBe('hidden');
  });

  it('"hareketi azalt" açıkken taşıma yapılmaz', () => {
    const normal = animStili('slideLeft', 'entering', 400, 0, false);
    const azalt = animStili('slideLeft', 'entering', 400, 0, true);
    expect(String(normal.transform)).not.toBe('none');
    expect(azalt.transform).toBe('none');
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

  it('temaBul bilinmeyen kimlikte undefined döner', () => {
    expect(temaBul('alert-box', 'yok-boyle')).toBeUndefined();
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

  it('roller doğru sırayla birleşir', () => {
    expect(birlesikRoller(YETENEK)).toEqual(['everyone', 'sub', 'vip', 'og', 'mod']);
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

describe('metin görünüm penceresi (BotRix: Metin görünümü ms – ms)', () => {
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
