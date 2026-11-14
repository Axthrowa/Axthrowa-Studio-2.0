import { describe, expect, it } from 'vitest';
import { kosulEngeli, kuralDuzelt, metniDoldur, PatlamaSayaci, tetikUyar, type Olay } from './kural.js';

const taban = { ad: 'Test', tetik: { tur: 'takip' }, eylemler: [{ tur: 'sohbet', metin: 'selam' }] };

describe('kuralDuzelt', () => {
  it('geçerli kuralı alır, süreleri sınırlar', () => {
    const r = kuralDuzelt({ ...taban, beklemeSn: 1, eylemler: [{ tur: 'bekle', saniye: 9999 }] });
    expect(r.ok && r.kural.beklemeSn).toBe(5);
    expect(r.ok && r.kural.eylemler[0]).toEqual({ tur: 'bekle', saniye: 60 });
  });

  it('sohbet patlamasında bekleme en az 30 sn', () => {
    const r = kuralDuzelt({ ...taban, tetik: { tur: 'patlama', mesaj: 20, saniye: 10 } });
    expect(r.ok && r.kural.beklemeSn).toBe(30);
  });

  it('adsız, eylemsiz ve bilinmeyen eylemli kuralı reddeder', () => {
    expect(kuralDuzelt({ ...taban, ad: ' ' }).ok).toBe(false);
    expect(kuralDuzelt({ ...taban, eylemler: [] }).ok).toBe(false);
    expect(kuralDuzelt({ ...taban, eylemler: [{ tur: 'sistem', metin: 'x' }] }).ok).toBe(false);
    expect(kuralDuzelt({ ...taban, tetik: { tur: 'yok' } }).ok).toBe(false);
  });

  it('komut eylemi ! ile başlamalı', () => {
    expect(kuralDuzelt({ ...taban, eylemler: [{ tur: 'komut', metin: 'ban ali' }] }).ok).toBe(false);
  });

  it('tetik komutu önekten arınır', () => {
    const r = kuralDuzelt({ ...taban, tetik: { tur: 'komut', komut: '!Hype' } });
    expect(r.ok && r.kural.tetik).toEqual({ tur: 'komut', komut: 'hype' });
  });
});

describe('tetikUyar', () => {
  it('komutu ilk sözcükte arar', () => {
    const t = { tur: 'komut', komut: 'hype' } as const;
    expect(tetikUyar(t, { tur: 'komut', mesaj: '!HYPE bugün' })).toBe(true);
    expect(tetikUyar(t, { tur: 'komut', mesaj: 'bugün !hype' })).toBe(false);
    expect(tetikUyar(t, { tur: 'komut', mesaj: '!hypetrain' })).toBe(false);
  });

  it('bağış eşiğine bakar, tür farklıysa uymaz', () => {
    expect(tetikUyar({ tur: 'bagis', enAz: 50 }, { tur: 'bagis', miktar: 49 })).toBe(false);
    expect(tetikUyar({ tur: 'bagis', enAz: 50 }, { tur: 'bagis', miktar: 50 })).toBe(true);
    expect(tetikUyar({ tur: 'takip' }, { tur: 'abone' })).toBe(false);
  });
});

describe('kosulEngeli', () => {
  const o: Olay = { tur: 'komut', mod: false, abone: true };
  it('sağlanmayan koşulu söyler', () => {
    expect(kosulEngeli([{ tur: 'mod' }], o, { puan: 0, canli: true })).toContain('moderatör');
    expect(kosulEngeli([{ tur: 'en_az_puan', puan: 100 }], o, { puan: 99, canli: true })).toContain('Puan');
  });
  it('yayın durumu bilinmiyorsa canlı sayılmaz', () => {
    expect(kosulEngeli([{ tur: 'canli' }], o, { puan: 0, canli: null })).toContain('canlı');
  });
  it('hepsi sağlanınca null', () => {
    expect(kosulEngeli([{ tur: 'abone' }, { tur: 'canli' }], o, { puan: 0, canli: true })).toBeNull();
  });
});

describe('metniDoldur', () => {
  it('alanları doldurur', () => {
    expect(metniDoldur('{kullanici} {miktar} TL', { tur: 'bagis', kullanici: 'ali', miktar: 5 })).toBe('ali 5 TL');
  });
  it('izleyici metni komut olarak başlayamaz, satır kıramaz', () => {
    expect(metniDoldur('{mesaj}', { tur: 'komut', mesaj: '!ban ali\n/timeout veli' })).toBe('ban ali /timeout veli');
    expect(metniDoldur('{mesaj}', { tur: 'komut', mesaj: '/ban ali' })).toBe('ban ali');
  });
  it('bilinmeyen alana dokunmaz', () => {
    expect(metniDoldur('{yok}', { tur: 'takip' })).toBe('{yok}');
  });
});

describe('PatlamaSayaci', () => {
  it('pencerede eşik dolunca bir kez tetikler', () => {
    const s = new PatlamaSayaci();
    expect(s.ekle(0, 3, 10)).toBe(false);
    expect(s.ekle(1000, 3, 10)).toBe(false);
    expect(s.ekle(2000, 3, 10)).toBe(true);
    expect(s.ekle(2100, 3, 10)).toBe(false);
  });
  it('pencereden çıkan mesaj sayılmaz', () => {
    const s = new PatlamaSayaci();
    s.ekle(0, 2, 5);
    expect(s.ekle(6000, 2, 5)).toBe(false);
  });
});

describe('Y12 Studio bağlantı tetikleri', () => {
  it('kare düşüşü eşiği yüzdeyle uyar, bit hızı tetiği türle', () => {
    const r = kuralDuzelt({ ad: 'k', tetik: { tur: 'kare_dususu', enAz: 5 }, eylemler: [{ tur: 'sohbet', metin: 'x' }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(tetikUyar(r.kural.tetik, { tur: 'kare_dususu', miktar: 7 })).toBe(true);
    expect(tetikUyar(r.kural.tetik, { tur: 'kare_dususu', miktar: 3 })).toBe(false);
    expect(tetikUyar({ tur: 'bit_hizi_dustu' }, { tur: 'bit_hizi_dustu' })).toBe(true);
    expect(tetikUyar({ tur: 'bit_hizi_dustu' }, { tur: 'baglanti_duzeldi' })).toBe(false);
  });
});

describe('Y7 Twitch reklam tetikleri', () => {
  it('reklam tetikleri türle eşleşir', () => {
    const r = kuralDuzelt({ ad: 'r', tetik: { tur: 'reklam_basliyor' }, eylemler: [{ tur: 'sohbet', metin: 'x' }] });
    expect(r.ok && r.kural.tetik).toEqual({ tur: 'reklam_basliyor' });
    expect(tetikUyar({ tur: 'reklam_bitti' }, { tur: 'reklam_basliyor' })).toBe(false);
  });
});
