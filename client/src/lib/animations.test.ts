import { describe, expect, it } from 'vitest';
import { ANIM_SECENEKLERI, animStili, animasyonCss, cikisKimligi, hareketAnahtari } from './animations';

describe('animasyonCss', () => {
  it('panelde sunulan her animasyonun bir CSS sınıfı vardır', () => {
    const css = animasyonCss();
    const eksik = ANIM_SECENEKLERI.map((s) => s.value).filter((id) => !css.includes(`.axt-anim-${id}{`));
    expect(eksik).toEqual([]);
    expect(ANIM_SECENEKLERI.length).toBeGreaterThan(30);
  });

  it('giriş, ön ayarın başlangıç hâlinden görünür hâle gider', () => {
    const css = animasyonCss(300);
    expect(css).toContain('@keyframes axt-on-slideRight{from{opacity:1;transform:translateX(100%)}to{opacity:1;transform:none}}');
    expect(css).toContain('.axt-anim-slideRight{animation:axt-on-slideRight 300ms');
    expect(css).toContain('.axt-anim-none{animation:none}');
    expect(css).toContain('.axt-anim-daktilo{');
    expect(css).toContain('.axt-cikis-slideRight{animation:axt-on-slideRight');
    expect(css).toContain('reverse both');
  });

  it('çıkış girişin tersidir ve seçilmemişse girişle aynı kimliği kullanır', () => {
    const cikis = animStili('bounce', 'exiting', 500);
    expect(String(cikis.animation)).toContain('axt-on-bounce');
    expect(String(cikis.animation)).toContain('reverse');
    expect(String(cikis.animation)).not.toBe(String(animStili('bounce', 'entering', 500).animation || ''));
    expect(animStili('none', 'exiting', 400).opacity).toBe(0);
    expect(cikisKimligi('zoom', 'ayni')).toBe('zoom');
    expect(cikisKimligi('slide', undefined)).toBe('slideRight');
    expect(cikisKimligi('fadeUp', 'fade')).toBe('fade');
  });

  it('görünür aşama opaklık ve dönüşümü yazmaz', () => {
    const s = animStili('slideRight', 'visible', 400);
    expect(s.opacity).toBeUndefined();
    expect(s.transform).toBeUndefined();
    expect(String(s.animation)).toContain('axt-on-slideRight');
  });

  it('animasyon ayarı değişince kurulum anahtarı değişir', () => {
    expect(hareketAnahtari({ animation: 'fade' })).not.toBe(hareketAnahtari({ animation: 'bounce' }));
    expect(hareketAnahtari({ animation: 'fade', fontSize: 12 })).toBe(hareketAnahtari({ animation: 'fade', fontSize: 40 }));
  });
});
