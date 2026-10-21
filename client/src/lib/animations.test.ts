import { describe, expect, it } from 'vitest';
import { ANIM_SECENEKLERI, animasyonCss } from './animations';

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
  });
});
