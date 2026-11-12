/**
 * AxBoT — animasyon ve uyarı kuyruğu testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import {
  ANIM_ON_AYARLARI,
  ANIM_SECENEKLERI,
  animBul,
  animKimligi,
  animStili,
  METIN_EFEKTLERI
} from './animations.js';
import {
  BOS_DURUM,
  GorulenKimlikler,
  asamaSuresi,
  atla,
  gorunurSure,
  ilerlet,
  kuyrugaEkle,
  sonrakiTik,
  type UyariOgesi
} from './alertQueue.js';

// ---- Animasyonlar -----------------------------------------------------------

describe('animasyon ön ayarları', () => {
  it('BotRix seviyesinde çeşitlilik sunar', () => {
    // BOTRIX_ALERT_MATRIX §3.1: 37 giriş animasyonu gözlemlendi
    expect(ANIM_ON_AYARLARI.length).toBeGreaterThanOrEqual(37);
  });

  it('kimlikler benzersiz', () => {
    const idler = ANIM_ON_AYARLARI.map((a) => a.id);
    expect(new Set(idler).size).toBe(idler.length);
  });

  it('her ön ayarın etiketi ve from durumu var', () => {
    for (const a of ANIM_ON_AYARLARI) {
      expect(a.etiket, a.id).toBeTruthy();
      expect(a.from, a.id).toBeTruthy();
      expect(a.grup, a.id).toBeTruthy();
    }
  });

  it('açılır liste ön ayarlarla aynı uzunlukta', () => {
    expect(ANIM_SECENEKLERI.length).toBe(ANIM_ON_AYARLARI.length);
  });

  it('slide animasyonları opaklığı DEĞİŞTİRMEZ (sadece kayar)', () => {
    for (const id of ['slideUp', 'slideDown', 'slideLeft', 'slideRight']) {
      expect(animBul(id).from.opacity, id).toBe(1);
    }
  });
});

describe('animKimligi — geriye uyum', () => {
  it('bilinen kimliği aynen bırakır', () => {
    expect(animKimligi('fadeUpBig')).toBe('fadeUpBig');
  });

  it('eski adları yeni kimliğe eşler', () => {
    // Kayıtlı ayarlar bozulmasın
    expect(animKimligi('slide')).toBe('slideRight');
    expect(animKimligi('pulse')).toBe('zoom');
    expect(animKimligi('spin')).toBe('rotate');
  });

  it('tanımsız değerde fade e düşer', () => {
    expect(animKimligi('boyleBirSeyYok')).toBe('fade');
    expect(animKimligi('')).toBe('fade');
    expect(animKimligi(undefined)).toBe('fade');
  });
});

describe('animStili', () => {
  it('görünür aşamada giriş animasyonu bir kez oynar', () => {
    const s = animStili('fadeUp', 'visible', 400);
    expect(s.opacity).toBeUndefined();
    expect(s.transform).toBeUndefined();
    expect(String(s.animation)).toContain('axt-on-fadeUp');
    expect(String(s.animation)).not.toContain('reverse');
  });

  it('giriş aşaması aynı anahtar kareyi başlatır', () => {
    const s = animStili('fadeUp', 'entering', 400);
    expect(String(s.animation)).toContain('axt-on-fadeUp');
    expect(String(s.animation)).not.toContain('reverse');
  });

  it('gizli aşamada geçiş yok ve görünmez', () => {
    const s = animStili('fadeUp', 'hidden', 400);
    expect(s.transition).toBe('none');
    expect(s.visibility).toBe('hidden');
  });

  it('süre ve gecikme animasyona yazılır', () => {
    const s = animStili('zoom', 'entering', 650, 120);
    expect(String(s.animation)).toContain('650ms');
    expect(String(s.animation)).toContain('120ms');
  });

});

describe('metin efektleri', () => {
  it('BotRix ile aynı sayıda seçenek', () => {
    expect(METIN_EFEKTLERI.length).toBe(6);
  });
});

// ---- Uyarı kuyruğu ----------------------------------------------------------

function oge(id: string, ek: Partial<UyariOgesi> = {}): UyariOgesi {
  return { id, tur: 'follow', veri: {}, sureMs: 5000, animMs: 500, ...ek };
}

describe('gorunurSure', () => {
  it('toplam süreden giriş ve çıkışı düşer', () => {
    expect(gorunurSure(oge('a', { sureMs: 5000, animMs: 500 }))).toBe(4000);
  });

  it('ses daha uzunsa sese uyar — uyarı sesi yarıda kesilmesin', () => {
    expect(gorunurSure(oge('a', { sureMs: 3000, animMs: 500, sesMs: 9000 }))).toBe(8500);
  });

  it('çok kısa sürede alt sınır uygular', () => {
    expect(gorunurSure(oge('a', { sureMs: 100, animMs: 500 }))).toBeGreaterThanOrEqual(200);
  });
});

describe('kuyrugaEkle', () => {
  it('boşken doğrudan gösterime alır', () => {
    const d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 1000);
    expect(d.aktif?.id).toBe('1');
    expect(d.asama).toBe('entering');
    expect(d.asamaBitis).toBe(1500);
  });

  it('meşgulken SIRAYA alır — üzerine yazmaz', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 0);
    d = kuyrugaEkle(d, oge('2'), true, 100);
    expect(d.aktif?.id).toBe('1');
    expect(d.bekleyen.map((x) => x.id)).toEqual(['2']);
  });

  it('kuyruk kapalıyken yeni uyarı mevcut olanı ANINDA değiştirir', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 0);
    d = kuyrugaEkle(d, oge('2'), false, 100);
    expect(d.aktif?.id).toBe('2');
    expect(d.bekleyen).toEqual([]);
  });
});

describe('duraklatma (ekip çapında denetim)', () => {
  it('duraklatılmışken yeni uyarı başlamaz, bekler', () => {
    const d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 0, true);
    expect(d.aktif).toBeNull();
    expect(d.bekleyen.map((x) => x.id)).toEqual(['1']);
    // Kuyruk kapalı (anında değiştir) kipte bile duraklatma uyarıyı bekletir
    const k = kuyrugaEkle(BOS_DURUM, oge('2'), false, 0, true);
    expect(k.aktif).toBeNull();
  });

  it('ekrandaki uyarı biter ama sıradaki duraklatma kalkana kadar başlamaz', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge('1', { sureMs: 1000, animMs: 0 }), true, 0);
    d = kuyrugaEkle(d, oge('2'), true, 10);
    d = ilerlet(d, 0, 0, true); // entering → visible
    d = ilerlet(d, 0, 1000, true); // visible → exiting
    d = ilerlet(d, 0, 1000, true); // exiting → completed
    expect(d.aktif).toBeNull();
    expect(ilerlet(d, 0, 5000, true).aktif).toBeNull();
    // Sürdür
    expect(ilerlet(d, 0, 5000, false).aktif?.id).toBe('2');
  });
});

describe('ilerlet — tam yaşam döngüsü', () => {
  it('queued → entering → visible → exiting → completed', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge('1', { sureMs: 5000, animMs: 500 }), true, 0);
    expect(d.asama).toBe('entering');

    d = ilerlet(d, 300, 500);
    expect(d.asama).toBe('visible');

    d = ilerlet(d, 300, 4500);
    expect(d.asama).toBe('exiting');

    d = ilerlet(d, 300, 5000);
    expect(d.asama).toBe('completed');
    expect(d.aktif).toBeNull();
  });

  it('aşama bitmeden ilerlemez', () => {
    const d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 0);
    expect(ilerlet(d, 0, 200).asama).toBe('entering');
  });

  it('boşluk süresi dolmadan sıradaki başlamaz', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge('1', { sureMs: 1000, animMs: 100 }), true, 0);
    d = kuyrugaEkle(d, oge('2'), true, 10);

    d = ilerlet(d, 1000, 100); // visible
    d = ilerlet(d, 1000, 1000); // exiting
    d = ilerlet(d, 1000, 1100); // completed, boşluk 1000ms
    expect(d.aktif).toBeNull();

    d = ilerlet(d, 1000, 1500); // boşluk dolmadı
    expect(d.aktif).toBeNull();

    d = ilerlet(d, 1000, 2100); // boşluk doldu
    expect(d.aktif?.id).toBe('2');
  });

  it('bekleyen yoksa boşta kalır', () => {
    const d = ilerlet(BOS_DURUM, 0, 9999);
    expect(d.aktif).toBeNull();
  });
});

describe('atla', () => {
  it('aktif uyarıyı hemen çıkışa alır', () => {
    let d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 0);
    d = atla(d, 200);
    expect(d.asama).toBe('exiting');
    expect(d.asamaBitis).toBe(200);
  });

  it('boşken bir şey yapmaz', () => {
    expect(atla(BOS_DURUM)).toEqual(BOS_DURUM);
  });
});

describe('sonrakiTik', () => {
  it('boşta null döner — gereksiz uyanma yok', () => {
    expect(sonrakiTik(BOS_DURUM)).toBeNull();
  });

  it('aktifken kalan süreyi verir', () => {
    const d = kuyrugaEkle(BOS_DURUM, oge('1'), true, 0);
    expect(sonrakiTik(d, 100)).toBe(400);
  });
});

describe('GorulenKimlikler — tekrar oynatmayı önler', () => {
  it('aynı kimliği iki kez görmez', () => {
    const g = new GorulenKimlikler(10);
    expect(g.gorduk('a')).toBe(false);
    g.ekle('a');
    expect(g.gorduk('a')).toBe(true);
  });

  it('yeniden bağlanmada tekrar gelen olayı eler', () => {
    // WS koptuğunda sunucu son olayları tekrar gönderebiliyor.
    const g = new GorulenKimlikler(10);
    const gelen = ['e1', 'e2', 'e3', 'e2', 'e1'];
    const oynatilan = gelen.filter((id) => {
      if (g.gorduk(id)) return false;
      g.ekle(id);
      return true;
    });
    expect(oynatilan).toEqual(['e1', 'e2', 'e3']);
  });

  it('tavanı aşınca en eskiyi düşürür', () => {
    const g = new GorulenKimlikler(3);
    ['a', 'b', 'c', 'd'].forEach((x) => g.ekle(x));
    expect(g.boyut).toBe(3);
    expect(g.gorduk('a')).toBe(false);
    expect(g.gorduk('d')).toBe(true);
  });
});

describe('asamaSuresi', () => {
  it('tamamlanmış aşama sıfır sürer', () => {
    expect(asamaSuresi(oge('1'), 'completed')).toBe(0);
    expect(asamaSuresi(oge('1'), 'queued')).toBe(0);
  });
});
