import { describe, expect, it } from 'vitest';
import { parcaHareketi } from './GoalWidget.js';
import { asamaAnimasyonu } from '../lib/donenWidget.js';

describe('hedef çubuğu parça hareketleri', () => {
  it('her parça kendi girişini ve efektini taşır, girişler kutudan sonra sırayla gelir', () => {
    const s = { animationDuration: 500, efektSuresi: 2, baslikGiris: 'zoom', rakamEfekti: 'nabiz', dolguGiris: 'fadeLeft', dolguEfekti: 'parlama' };
    expect(parcaHareketi(s, 'baslik', 500).animation).toContain('axt-on-zoom 500ms');
    expect(parcaHareketi(s, 'baslik', 500).animation).toContain(' 500ms both');
    expect(parcaHareketi(s, 'rakam', 500).animation).toBe('axt-efekt-nabiz 2s cubic-bezier(0.37, 0, 0.63, 1) 0ms infinite');
    const dolgu = String(parcaHareketi(s, 'dolgu', 500).animation);
    expect(dolgu).toContain('axt-on-fadeLeft 500ms');
    expect(dolgu).toContain('860ms both');
    expect(dolgu).toContain('axt-efekt-parlama 2s');
    expect(parcaHareketi(s, 'simge', 500)).toEqual({});
  });

  it('"genel" efekt eski tek hedef seçimine uyar (eski kayıtlar bozulmaz)', () => {
    const eski = { surekliEfekt: 'nefes', efektHedefi: 'yazi' };
    expect(parcaHareketi(eski, 'baslik', 0).animation).toContain('axt-efekt-nefes');
    expect(parcaHareketi(eski, 'rakam', 0).animation).toContain('axt-efekt-nefes');
    expect(parcaHareketi(eski, 'bar', 0)).toEqual({});
    expect(parcaHareketi({ animation: 'pulse' }, 'bar', 0).animation).toContain('axt-efekt-nefes');
    expect(parcaHareketi({ surekliEfekt: 'nabiz', efektHedefi: 'tum' }, 'bar', 0)).toEqual({});
  });
});

describe('dönen widget çıkışı', () => {
  it('çıkış ayrı seçilir; seçilmezse girişin tersi oynar', () => {
    expect(asamaAnimasyonu({ animation: 'slideUp', exitAnimation: 'zoom' }, 'exiting')).toBe('zoom');
    expect(asamaAnimasyonu({ animation: 'slideUp', exitAnimation: 'zoom' }, 'visible')).toBe('slideUp');
    expect(asamaAnimasyonu({ animation: 'slideUp', exitAnimation: 'ayni' }, 'exiting')).toBe('slideUp');
    expect(asamaAnimasyonu({ animation: 'slideUp' }, 'exiting')).toBe('slideUp');
  });
});
