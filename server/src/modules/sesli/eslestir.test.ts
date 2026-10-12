import { describe, expect, it } from 'vitest';
import {
  ayarlariDuzelt,
  belirtmeHali,
  benzerlik,
  dilbilgisi,
  eslestir,
  eylemDuzelt,
  ifadePuani,
  normalize,
  ORNEK_KOMUTLAR,
  overlayEslestir,
  panoEslestir,
  uyandirmayiAyikla,
  type SesliKomut
} from './eslestir.js';

const komutlar: SesliKomut[] = ORNEK_KOMUTLAR.map((k, i) => ({ ...k, id: `k${i}` }));
const ayar = { esik: 0.78, dinamikPano: true, dinamikOverlay: true };
const pano = [
  { id: 'p1', ad: 'Davul', komut: 'davul' },
  { id: 'p2', ad: 'Alkış', komut: 'alkis' },
  { id: 'p3', ad: 'Kötü Şaka', komut: 'kotu-saka' }
];

describe('sesli komut eşleştirme', () => {
  it('Türkçe karakterleri ve noktalamayı katlar', () => {
    expect(normalize('  Şarkıyı GEÇ!  ')).toBe('sarkiyi gec');
    expect(normalize('Çarkıfelek, İLERİ')).toBe('carkifelek ileri');
  });

  it('benzerlik ve pencereli ifade puanı', () => {
    expect(benzerlik('abc', 'abc')).toBe(1);
    expect(ifadePuani('bot lütfen sohbeti temizle', 'sohbeti temizle')).toBeGreaterThanOrEqual(0.99);
    // Tanıyıcının sık hatası: ek ayrı sözcük gibi çıkar
    expect(ifadePuani('sohbet i temizle', 'sohbeti temizle')).toBeGreaterThan(0.85);
    expect(ifadePuani('hava çok güzel', 'sohbeti temizle')).toBeLessThan(0.6);
  });

  it('uyandırma sözcüğünü ayıklar (bulanık, ilk iki sözcükte)', () => {
    expect(uyandirmayiAyikla('bot sohbeti temizle', 'bot')).toBe('sohbeti temizle');
    expect(uyandirmayiAyikla('hey bot şarkıyı geç', 'bot')).toBe('sarkiyi gec');
    expect(uyandirmayiAyikla('bat sohbeti temizle', 'bot')).toBe('sohbeti temizle');
    expect(uyandirmayiAyikla('sohbeti temizle', 'bot')).toBeNull();
    expect(uyandirmayiAyikla('yayın botu açalım mı', 'bot')).toBeNull();
    expect(uyandirmayiAyikla('asistan anketi aç', 'asistan')).toBe('anketi ac');
  });

  it('tanımlı komutu bulur', () => {
    const e = eslestir('şarkıyı geç', komutlar, ayar, pano);
    expect(e?.kaynak).toBe('komut');
    expect(e?.kaynak === 'komut' && e.komut.eylem).toEqual({ tur: 'sarki_atla' });
    expect(eslestir('bugün hava çok güzel', komutlar, ayar, pano)).toBeNull();
  });

  it('kapalı komut eşleşmez', () => {
    const kapali = komutlar.map((k) => ({ ...k, etkin: false }));
    expect(eslestir('şarkıyı geç', kapali, ayar, pano)).toBeNull();
  });

  it('panodan ada göre çalar', () => {
    expect(panoEslestir('davul çal', pano, 0.78)?.oge.id).toBe('p1');
    expect(panoEslestir('alkış sesini çal', pano, 0.78)?.oge.id).toBe('p2');
    expect(panoEslestir('oynat kötü şaka', pano, 0.78)?.oge.id).toBe('p3');
    expect(panoEslestir('trompet çal', pano, 0.78)).toBeNull();
    expect(panoEslestir('davul', pano, 0.78)).toBeNull();
    const e = eslestir('davul sesini çal', komutlar, ayar, pano);
    expect(e?.kaynak === 'pano' && e.oge.id).toBe('p1');
  });

  it('overlay widget aç/kapat', () => {
    expect(overlayEslestir('anketi aç', 0.78)).toMatchObject({ widget: 'polls', durum: 'ac' });
    expect(overlayEslestir('sohbeti gizle', 0.78)).toMatchObject({ widget: 'chat', durum: 'kapat' });
    expect(overlayEslestir('çarkıfelek göster', 0.78)).toMatchObject({ widget: 'wheel', durum: 'ac' });
    expect(overlayEslestir('kapıyı aç', 0.78)).toBeNull();
    expect(overlayEslestir('aç', 0.78)).toBeNull();
  });

  it('dinamik kalıplar ayardan kapatılabilir', () => {
    expect(eslestir('davul çal', [], { ...ayar, dinamikPano: false }, pano)).toBeNull();
    expect(eslestir('anketi aç', [], { ...ayar, dinamikOverlay: false }, pano)).toBeNull();
  });

  it('tanımlı ifade dinamik kalıba üstün gelir', () => {
    const ozel: SesliKomut = { id: 'o', ad: 'Anket', ifadeler: ['anketi aç'], eylem: { tur: 'komut', metin: '!anket' }, etkin: true };
    const e = eslestir('anketi aç', [ozel], ayar, pano);
    expect(e?.kaynak).toBe('komut');
  });

  it('eylem doğrulaması', () => {
    expect(eylemDuzelt({ tur: 'komut', metin: ' !çekiliş ' })).toEqual({ tur: 'komut', metin: '!çekiliş' });
    expect(eylemDuzelt({ tur: 'komut', metin: '' })).toBeNull();
    expect(eylemDuzelt({ tur: 'overlay', widget: 'polls', durum: 'ac' })).toEqual({ tur: 'overlay', widget: 'polls', durum: 'ac' });
    expect(eylemDuzelt({ tur: 'overlay', widget: 'yok', durum: 'ac' })).toBeNull();
    expect(eylemDuzelt({ tur: 'widget_test', widget: '../x' })).toBeNull();
    expect(eylemDuzelt({ tur: 'kalkan', durum: 'ac' })).toEqual({ tur: 'kalkan', durum: 'ac' });
    expect(eylemDuzelt({ tur: 'rm -rf' })).toBeNull();
  });

  it('belirtme hali ünlü uyumuyla', () => {
    expect(belirtmeHali('anket')).toBe('anketi');
    expect(belirtmeHali('çark')).toBe('çarkı');
    expect(belirtmeHali('kupa')).toBe('kupayı');
    expect(belirtmeHali('sohbet')).toBe('sohbeti');
    expect(belirtmeHali('çalan şarkı')).toBe('çalan şarkıyı');
    expect(belirtmeHali('emote kombo')).toBe('emote komboyu');
    expect(belirtmeHali('hype treni')).toBe('hype treniyi');
  });

  it('tanıyıcı dilbilgisi: ifadeler, uyandırmalı halleri, pano ve widget kalıpları', () => {
    const d = dilbilgisi({ uyandirma: 'Bot', dinamikPano: true, dinamikOverlay: true }, komutlar, pano);
    expect(d).toContain('şarkıyı geç');
    expect(d).toContain('bot şarkıyı geç');
    expect(d).toContain('davul çal');
    expect(d).toContain('bot alkış sesini çal');
    expect(d).toContain('anketi aç');
    expect(d).toContain('bot çarkı göster');
    expect(d).toContain('bot');
    expect(d[d.length - 1]).toBe('[unk]');
    expect(new Set(d).size).toBe(d.length);
    const sade = dilbilgisi({ uyandirma: 'bot', dinamikPano: false, dinamikOverlay: false }, [], pano);
    expect(sade).toEqual(['bot', '[unk]']);
  });

  it('ayarlar sınırlanır', () => {
    const a = ayarlariDuzelt({ esik: 5, kip: 'hepsi', uyandirma: '   ', platform: 'myspace' });
    expect(a.esik).toBe(0.98);
    expect(a.kip).toBe('ikisi');
    expect(a.uyandirma).toBe('bot');
    expect(a.platform).toBe('kick');
  });
});
