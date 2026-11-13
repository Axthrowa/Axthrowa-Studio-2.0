import { describe, expect, it } from 'vitest';
import { BASLANGIC, BOS_AYNA, KuyrukAynalari, kontrolUygula, kuyrukRaporuTemizle, SonUyarilar, uyariKimligi } from './control.js';

describe('kontrolUygula', () => {
  it('duraklat / sürdür / sustur / sesi aç durumu değiştirir ve sürümü artırır', () => {
    let d = BASLANGIC;
    for (const [eylem, beklenen] of [
      ['pause', { paused: true, muted: false }],
      ['mute', { paused: true, muted: true }],
      ['resume', { paused: false, muted: true }],
      ['unmute', { paused: false, muted: false }]
    ] as const) {
      const r = kontrolUygula(d, eylem, 'modA');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect({ paused: r.durum.paused, muted: r.durum.muted }).toEqual(beklenen);
      expect(r.durum.version).toBe(d.version + 1);
      expect(r.durum.lastAction).toBe(eylem);
      d = r.durum;
    }
  });

  it('iyimser kilit: eski sürümle gelen istek reddedilir, güncel durum döner', () => {
    const a = kontrolUygula(BASLANGIC, 'skip', 'modA', 0);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    // Mod B hâlâ sürüm 0'ı görüyor
    const b = kontrolUygula(a.durum, 'skip', 'modB', 0);
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.kod).toBe('conflict');
    expect(b.mesaj).toContain('modA');
    expect(b.durum.version).toBe(1);
  });

  it('sürüm verilmezse kilit uygulanmaz; geçersiz eylem reddedilir', () => {
    const d = { ...BASLANGIC, version: 7 };
    expect(kontrolUygula(d, 'skip', 'kısayol').ok).toBe(true);
    const r = kontrolUygula(d, 'sil-her-sey', 'x');
    expect(r.ok).toBe(false);
  });
});

describe('uyariKimligi', () => {
  it('aynı türde iki olay farklı kimlik alır (widget ikincisini atmasın)', () => {
    const a = uyariKimligi('follow', 1000, () => 0.1);
    const b = uyariKimligi('follow', 1000, () => 0.2);
    expect(a).not.toBe(b);
    expect(a.startsWith('follow-')).toBe(true);
    const cok = new Set(Array.from({ length: 500 }, () => uyariKimligi('sub')));
    expect(cok.size).toBe(500);
  });

  it('tür adındaki beklenmedik karakterleri ayıklar', () => {
    expect(uyariKimligi('<script>', 0, () => 0)).toMatch(/^script-/);
  });
});

describe('SonUyarilar teşekkür işareti (U4)', () => {
  it('halkadaki uyarıyı işaretler, olmayanı reddeder', () => {
    const s = new SonUyarilar(3);
    s.ekle({ id: 'a', eventType: 'follow', title: '', message: '', at: 1, isTest: false, alert: {}, data: { username: 'x' } });
    expect(s.tesekkurIsaretle('a', true)).toBe(true);
    expect(s.bul('a')?.tesekkur).toBe(true);
    expect(s.tesekkurIsaretle('a', false)).toBe(true);
    expect(s.bul('a')?.tesekkur).toBe(false);
    expect(s.tesekkurIsaretle('yok', true)).toBe(false);
  });
});

describe('SonUyarilar', () => {
  it('en yenisi başta, tavanı aşmaz, kimlikle bulunur', () => {
    const s = new SonUyarilar(3);
    for (let i = 0; i < 5; i++) {
      s.ekle({ id: `u${i}`, eventType: 'follow', title: '', message: '', at: i, isTest: false, alert: {} });
    }
    expect(s.hepsi().map((x) => x.id)).toEqual(['u4', 'u3', 'u2']);
    expect(s.bul('u3')?.at).toBe(3);
    expect(s.bul('u0')).toBeUndefined();
  });
});

describe('kuyruk aynası (U3)', () => {
  it('ham raporu süzer: kimliksiz öğe düşer, liste 30 ile sınırlı, metin kısalır', () => {
    const r = kuyrukRaporuTemizle({
      aktif: { id: 'a1', eventType: 'follow', title: 'x'.repeat(200), isTest: true },
      bekleyen: [{ id: '' }, ...Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, eventType: 'tip', title: 'T' }))]
    })!;
    expect(r.aktif).toEqual({ id: 'a1', eventType: 'follow', title: 'x'.repeat(80), message: '', isTest: true });
    expect(r.bekleyen).toHaveLength(29);
    expect(kuyrukRaporuTemizle({ aktif: null })).toBeNull();
    expect(kuyrukRaporuTemizle('x')).toBeNull();
  });

  it('OBS kaynağının son raporu gösterilir; önizleme yalnız tek başınaysa; kopan kaynak düşer', () => {
    const a = new KuyrukAynalari<string>();
    expect(a.ozet()).toEqual(BOS_AYNA);
    const oge = (id: string) => ({ id, eventType: 'follow', title: id, message: '', isTest: false });
    a.bildir('onizleme', { aktif: oge('p'), bekleyen: [] }, false, 30);
    expect(a.ozet().aktif?.id).toBe('p');
    a.bildir('obs1', { aktif: oge('o1'), bekleyen: [oge('o2')] }, true, 10);
    a.bildir('obs2', { aktif: null, bekleyen: [] }, true, 20);
    expect(a.ozet()).toMatchObject({ aktif: null, guncellendi: 20, kaynak: 3 });
    expect(a.kopar('obs2')).toBe(true);
    expect(a.ozet()).toMatchObject({ aktif: { id: 'o1' }, bekleyen: [{ id: 'o2' }], kaynak: 2 });
    expect(a.kopar('yok')).toBe(false);
  });
});

describe('SonUyarilar kalıcılık (K1)', () => {
  it('kaydedilen liste ve teşekkür işareti yeni örneğe geri yüklenir', () => {
    let kayit: unknown = null;
    const s = new SonUyarilar(3, (l) => (kayit = JSON.parse(JSON.stringify(l))));
    s.ekle({ id: 'a', eventType: 'follow', title: '', message: '', at: 1, isTest: false, alert: {} });
    s.tesekkurIsaretle('a', true);
    const yeni = new SonUyarilar(3, undefined, kayit);
    expect(yeni.bul('a')?.tesekkur).toBe(true);
    expect(new SonUyarilar(3, undefined, 'bozuk').hepsi()).toEqual([]);
  });
});
