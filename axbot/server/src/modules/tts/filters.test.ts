/**
 * AxBoT — TTS filtre testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { kufurleriMaskele, metniHazirla, rolSeviyesi, rolYeterli, TTSBekleme, VARSAYILAN_FILTRE } from './filters.js';

const A = (ek = {}) => ({ ...VARSAYILAN_FILTRE, ...ek });

describe('metniHazirla — link', () => {
  it('adresi okumaz, yerine "bağlantı" der', () => {
    const r = metniHazirla('şuna bak https://evil.example/kayit', 'ali', A());
    expect(r?.metin).toBe('şuna bak bağlantı');
  });

  it('protokolsüz adresi de yakalar', () => {
    expect(metniHazirla('bak www.site.com güzel', 'ali', A())?.metin).toContain('bağlantı');
    expect(metniHazirla('site.com adresine gir', 'ali', A())?.metin).toContain('bağlantı');
  });

  it('açıkken adresi olduğu gibi bırakır', () => {
    const r = metniHazirla('bak https://a.com', 'ali', A({ linkleriOku: true, sembolleriOku: true }));
    expect(r?.metin).toContain('https://a.com');
  });
});

describe('metniHazirla — emoji / sayı / sembol', () => {
  it('emojileri atar', () => {
    expect(metniHazirla('merhaba 🔥🔥 dünya', 'ali', A())?.metin).toBe('merhaba dünya');
  });

  it('emoji okuma açıkken bırakır', () => {
    expect(metniHazirla('merhaba 🔥', 'ali', A({ emojileriOku: true }))?.metin).toContain('🔥');
  });

  it('sayıları kapatınca atar', () => {
    expect(metniHazirla('ben 1234 yaşındayım', 'ali', A({ sayilariOku: false }))?.metin).toBe('ben yaşındayım');
  });

  it('sayılar varsayılan olarak okunur', () => {
    expect(metniHazirla('ben 25 yaşındayım', 'ali', A())?.metin).toBe('ben 25 yaşındayım');
  });

  it('sembolleri atar ama noktalamayı korur', () => {
    const r = metniHazirla('merhaba ~^#@ dünya, nasılsın?', 'ali', A());
    expect(r?.metin).toBe('merhaba dünya, nasılsın?');
  });
});

describe('metniHazirla — tekrar kısaltma', () => {
  it('uzatılmış harfleri kısaltır', () => {
    expect(metniHazirla('aaaaaaaa çok iyiii', 'ali', A())?.metin).toBe('aa çok iyii');
  });

  it('tekrarlı noktalamayı teke indirir', () => {
    expect(metniHazirla('ne!!!!! olmuş????', 'ali', A())?.metin).toBe('ne! olmuş?');
  });

  it('kapalıyken dokunmaz', () => {
    expect(metniHazirla('aaaaaaaa', 'ali', A({ tekrarlariKisalt: false }))?.metin).toBe('aaaaaaaa');
  });
});

describe('metniHazirla — sınırlar', () => {
  it('karakter sınırında kırpar', () => {
    const r = metniHazirla('x'.repeat(500), 'ali', A({ karakterSiniri: 50, tekrarlariKisalt: false }));
    expect(r?.metin.length).toBeLessThanOrEqual(50);
  });

  it('sınır 0 ise kırpmaz', () => {
    const uzun = 'ab '.repeat(200).trim();
    expect(metniHazirla(uzun, 'ali', A({ karakterSiniri: 0 }))?.metin.length).toBeGreaterThan(400);
  });

  it('çok kısa mesajı okumaz', () => {
    expect(metniHazirla('a', 'ali', A({ minUzunluk: 2 }))).toBeNull();
  });

  it('boş mesajı okumaz', () => {
    expect(metniHazirla('', 'ali', A())).toBeNull();
    expect(metniHazirla('   ', 'ali', A())).toBeNull();
  });

  it('yalnız emojiden oluşan mesaj okunmaz', () => {
    expect(metniHazirla('🔥🔥🔥', 'ali', A())).toBeNull();
  });
});

describe('metniHazirla — kara liste ve engelli kullanıcı', () => {
  it('yasaklı kelime içeren mesajı okumaz', () => {
    expect(metniHazirla('şu KÜFÜR burada', 'ali', A({ karaListe: ['küfür'] }))).toBeNull();
  });

  it('engelli kullanıcıyı okumaz', () => {
    expect(metniHazirla('merhaba', 'Troll', A({ engelliKullanicilar: ['@troll'] }))).toBeNull();
  });

  it('engelli olmayan kullanıcıyı okur', () => {
    expect(metniHazirla('merhaba', 'Ali', A({ engelliKullanicilar: ['troll'] }))?.metin).toBe('merhaba');
  });
});

describe('metniHazirla — okuma şablonu', () => {
  it('kullanıcı adını ekler', () => {
    const r = metniHazirla('selam', 'Ali', A({ sablon: '{user} diyor ki {message}' }));
    expect(r?.metin).toBe('Ali diyor ki selam');
  });

  it('varsayılan şablon yalnız mesajı okur', () => {
    expect(metniHazirla('selam', 'Ali', A())?.metin).toBe('selam');
  });
});

describe('rol kontrolü', () => {
  it('rol sırası doğru', () => {
    expect(rolSeviyesi({ isBroadcaster: true })).toBe(5);
    expect(rolSeviyesi({ isMod: true })).toBe(4);
    expect(rolSeviyesi({ isVip: true })).toBe(2);
    expect(rolSeviyesi({ isSub: true })).toBe(1);
    expect(rolSeviyesi({})).toBe(0);
  });

  it('herkes ayarında sıradan izleyici geçer', () => {
    expect(rolYeterli({}, 'everyone')).toBe(true);
  });

  it('abone ayarında sıradan izleyici geçemez', () => {
    expect(rolYeterli({}, 'sub')).toBe(false);
    expect(rolYeterli({ isSub: true }, 'sub')).toBe(true);
  });

  it('yayıncı her ayarı geçer', () => {
    expect(rolYeterli({ isBroadcaster: true }, 'mod')).toBe(true);
  });
});

describe('TTSBekleme', () => {
  it('bekleme 0 ise hep hazır', () => {
    const b = new TTSBekleme();
    expect(b.hazirMi('ali', 0)).toBe(true);
  });

  it('bekleme dolmadan ikinci kez okumaz', () => {
    const b = new TTSBekleme();
    b.isaretle('ali', 1000);
    expect(b.hazirMi('ali', 30, 5000)).toBe(false);
    expect(b.hazirMi('ali', 30, 31500)).toBe(true);
  });

  it('kullanıcılar birbirini etkilemez', () => {
    const b = new TTSBekleme();
    b.isaretle('ali', 1000);
    expect(b.hazirMi('veli', 30, 2000)).toBe(true);
  });

  it('büyük/küçük harf duyarsız', () => {
    const b = new TTSBekleme();
    b.isaretle('Ali', 1000);
    expect(b.hazirMi('ALI', 30, 2000)).toBe(false);
  });
});

describe('kufurleriMaskele', () => {
  it('Türkçe harfle biten kelimeleri de maskeler (eski \b sınırı kaçırıyordu)', () => {
    expect(kufurleriMaskele('sen bir piç')).toBe('sen bir ***');
    expect(kufurleriMaskele('oç!')).toBe('***!');
    expect(kufurleriMaskele('ananı')).toBe('***');
  });

  it('Türkçe büyük harfleri tanır', () => {
    expect(kufurleriMaskele('SİKTİR git')).toBe('*** git');
    expect(kufurleriMaskele('PİÇ')).toBe('***');
  });

  it('kelime içindeki eşleşmeye dokunmaz', () => {
    expect(kufurleriMaskele('sikke koleksiyonu')).toBe('sikke koleksiyonu');
    expect(kufurleriMaskele('kitapçı')).toBe('kitapçı');
  });
});

describe('metniHazirla — şablon güvenliği', () => {
  it('kullanıcı adındaki $ kalıbı ve yer tutucu metni bozmaz', () => {
    const ayar = { ...VARSAYILAN_FILTRE, sablon: '{user} diyor ki {message}' };
    // Mesajdaki semboller zaten ayıklanıyor; kullanıcı adı ayıklanmıyor.
    expect(metniHazirla('selam', '$&ali', ayar)?.metin).toBe('$&ali diyor ki selam');
    expect(metniHazirla('selam', '{message}', ayar)?.metin).toBe('{message} diyor ki selam');
  });
});
