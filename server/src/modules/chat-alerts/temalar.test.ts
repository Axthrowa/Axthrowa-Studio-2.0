/**
 * AxBoT — temalı sohbet uyarısı testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { takipAdaylari, takipTemalariCoz, TAKIP_TEMA_ADLARI, rastgeleFarkli, temaAdaylari, TEMA_MESAJLARI } from './temalar.js';

const OLAYLAR = ['follow', 'sub', 'resub', 'gift_sub', 'tip', 'kicks', 'host', 'raid', 'welcome', 'stream_online'] as const;

describe('temalar', () => {
  it('her tema her olay için en az 3 mesaj içerir', () => {
    for (const [tema, m] of Object.entries(TEMA_MESAJLARI)) {
      for (const o of OLAYLAR) expect(m[o]?.length, `${tema}/${o}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('değer gerektiren olaylarda $(v1), kişi olaylarında $(sender) geçer', () => {
    for (const m of Object.values(TEMA_MESAJLARI)) {
      for (const o of ['resub', 'gift_sub', 'tip', 'kicks', 'host', 'raid'] as const) for (const t of m[o]) expect(t).toContain('$(v1)');
      for (const o of ['follow', 'sub', 'welcome'] as const) for (const t of m[o]) expect(t).toContain('$(sender)');
      for (const t of m.stream_online) expect(t).toContain('$(platformurl)');
    }
  });
  it('mesajlar sohbet sınırının altında', () => {
    for (const m of Object.values(TEMA_MESAJLARI)) for (const l of Object.values(m)) for (const t of l) expect(t.length).toBeLessThan(200);
  });
  it('karışık tema tüm temalardan aday verir; bilinmeyen tema boş', () => {
    expect(temaAdaylari('karisik', 'follow').length).toBe(Object.keys(TEMA_MESAJLARI).length * 3);
    expect(temaAdaylari('yok', 'follow')).toEqual([]);
  });
  it('aynı mesaj art arda gelmez', () => {
    const l = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(rastgeleFarkli(l, 'a')).not.toBe('a');
    expect(rastgeleFarkli(['tek'], 'tek')).toBe('tek');
    expect(rastgeleFarkli([], undefined)).toBeUndefined();
  });
});

describe('yeni takipçi karşılaması', () => {
  it('her temada adı geçen mesajlar var, Discord kalıbı kalmadı', () => {
    for (const id of Object.keys(TAKIP_TEMA_ADLARI)) {
      const m = takipAdaylari([id]);
      expect(m.length).toBeGreaterThanOrEqual(3);
      for (const x of m) {
        expect(x).toContain('$(sender)');
        expect(x).not.toMatch(/[{}*]/);
      }
    }
  });
  it('istenen temalar seçilebilir', () => {
    for (const ad of ['Harry Potter', 'Yüzüklerin Efendisi', 'Star Wars', 'Game of Thrones', 'Breaking Bad']) expect(Object.values(TAKIP_TEMA_ADLARI)).toContain(ad);
  });
  it('hiç seçim yoksa hepsi karışık; kendi ayarı varsa ona dokunulmaz; boş liste kendi şablonu', () => {
    expect(takipTemalariCoz(undefined, false)).toEqual(Object.keys(TAKIP_TEMA_ADLARI));
    expect(takipTemalariCoz(undefined, true)).toEqual([]);
    expect(takipTemalariCoz('[]', false)).toEqual([]);
    expect(takipTemalariCoz('["lotr","uydurma"]', false)).toEqual(['lotr']);
    expect(takipTemalariCoz('bozuk', false)).toEqual([]);
  });
});
