import { describe, expect, it } from 'vitest';
import { BASLANGIC, kontrolUygula, SonUyarilar, uyariKimligi } from './control.js';

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
