/**
 * StreamAxT — animasyon ön ayarları
 * Developed by AxthrowA
 *
 * BotRix'in uyarı sayfasında 37 giriş animasyonu gözlemlendi
 * (BOTRIX_ALERT_MATRIX §3.1). Bizde ~9 vardı ve her widget kendi içinde
 * Tailwind `animate-bounce` yapıştırıyordu: süre, gecikme ve easing
 * ayarlanamıyordu, çıkış animasyonu hiç yoktu.
 *
 * Burada isimler aynı (kullanıcı ne beklediğini bilsin) ama **davranış
 * sıfırdan yazıldı** — `transform` + `opacity` ile. BotRix kodu veya
 * herhangi bir animasyon kütüphanesi kopyalanmadı.
 *
 * Her ön ayar `from` (giriş başlangıcı / çıkış bitişi) ve `to` (görünür hâl)
 * durumunu tanımlar. Çıkış, girişin tersidir: `to → from`.
 */
import type { CSSProperties } from 'react';

export type AnimGrubu = 'none' | 'fade' | 'slide' | 'zoom' | 'rotate' | 'flip' | 'bounce' | 'back';

export interface AnimOnAyari {
  id: string;
  etiket: string;
  grup: AnimGrubu;
  /** Görünmez/uzak hâl. */
  from: CSSProperties;
  /** Varsayılan easing — grubun karakterini verir. */
  easing?: string;
}

const GORUNUR: CSSProperties = { opacity: 1, transform: 'none' };

/** Kısa yazım: yalnız transform değişen ön ayarlar için. */
function ta(id: string, etiket: string, grup: AnimGrubu, transform: string, opacity = 0, easing?: string): AnimOnAyari {
  return { id, etiket, grup, from: { opacity, transform }, easing };
}

const YUMUSAK = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ZIPLAMA = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const GERI = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)';

export const ANIM_ON_AYARLARI: AnimOnAyari[] = [
  { id: 'none', etiket: 'Animasyon yok', grup: 'none', from: { opacity: 1, transform: 'none' } },

  // --- Fade (13) ---
  { id: 'fade', etiket: 'Soluk geçiş', grup: 'fade', from: { opacity: 0, transform: 'none' }, easing: YUMUSAK },
  ta('fadeDown', 'Soluk · yukarıdan', 'fade', 'translateY(-40px)', 0, YUMUSAK),
  ta('fadeDownBig', 'Soluk · yukarıdan (uzak)', 'fade', 'translateY(-260px)', 0, YUMUSAK),
  ta('fadeUp', 'Soluk · aşağıdan', 'fade', 'translateY(40px)', 0, YUMUSAK),
  ta('fadeUpBig', 'Soluk · aşağıdan (uzak)', 'fade', 'translateY(260px)', 0, YUMUSAK),
  ta('fadeLeft', 'Soluk · soldan', 'fade', 'translateX(-40px)', 0, YUMUSAK),
  ta('fadeLeftBig', 'Soluk · soldan (uzak)', 'fade', 'translateX(-260px)', 0, YUMUSAK),
  ta('fadeRight', 'Soluk · sağdan', 'fade', 'translateX(40px)', 0, YUMUSAK),
  ta('fadeRightBig', 'Soluk · sağdan (uzak)', 'fade', 'translateX(260px)', 0, YUMUSAK),
  ta('fadeTopLeft', 'Soluk · sol üstten', 'fade', 'translate(-60px, -60px)', 0, YUMUSAK),
  ta('fadeTopRight', 'Soluk · sağ üstten', 'fade', 'translate(60px, -60px)', 0, YUMUSAK),
  ta('fadeBottomLeft', 'Soluk · sol alttan', 'fade', 'translate(-60px, 60px)', 0, YUMUSAK),
  ta('fadeBottomRight', 'Soluk · sağ alttan', 'fade', 'translate(60px, 60px)', 0, YUMUSAK),

  // --- Slide (4) — opaklık değişmez, sadece kayar ---
  ta('slideUp', 'Kayarak · aşağıdan', 'slide', 'translateY(100%)', 1, YUMUSAK),
  ta('slideDown', 'Kayarak · yukarıdan', 'slide', 'translateY(-100%)', 1, YUMUSAK),
  ta('slideLeft', 'Kayarak · soldan', 'slide', 'translateX(-100%)', 1, YUMUSAK),
  ta('slideRight', 'Kayarak · sağdan', 'slide', 'translateX(100%)', 1, YUMUSAK),

  // --- Zoom (5) ---
  ta('zoom', 'Yakınlaşma', 'zoom', 'scale(0.3)', 0, ZIPLAMA),
  ta('zoomDown', 'Yakınlaşma · yukarıdan', 'zoom', 'scale(0.3) translateY(-120px)', 0, ZIPLAMA),
  ta('zoomUp', 'Yakınlaşma · aşağıdan', 'zoom', 'scale(0.3) translateY(120px)', 0, ZIPLAMA),
  ta('zoomLeft', 'Yakınlaşma · soldan', 'zoom', 'scale(0.3) translateX(-120px)', 0, ZIPLAMA),
  ta('zoomRight', 'Yakınlaşma · sağdan', 'zoom', 'scale(0.3) translateX(120px)', 0, ZIPLAMA),

  // --- Rotate (5) ---
  ta('rotate', 'Dönerek', 'rotate', 'rotate(-200deg) scale(0.6)', 0, YUMUSAK),
  ta('rotateDownLeft', 'Dönerek · sol üstten', 'rotate', 'rotate(-45deg) translate(-120px, -120px)', 0, YUMUSAK),
  ta('rotateDownRight', 'Dönerek · sağ üstten', 'rotate', 'rotate(45deg) translate(120px, -120px)', 0, YUMUSAK),
  ta('rotateUpLeft', 'Dönerek · sol alttan', 'rotate', 'rotate(45deg) translate(-120px, 120px)', 0, YUMUSAK),
  ta('rotateUpRight', 'Dönerek · sağ alttan', 'rotate', 'rotate(-45deg) translate(120px, 120px)', 0, YUMUSAK),

  // --- Flip (2) ---
  ta('flipX', 'Çevirme · yatay eksen', 'flip', 'perspective(600px) rotateX(90deg)', 0, YUMUSAK),
  ta('flipY', 'Çevirme · dikey eksen', 'flip', 'perspective(600px) rotateY(90deg)', 0, YUMUSAK),

  // --- Bounce (5) — yaylı easing ile ---
  ta('bounce', 'Zıplama', 'bounce', 'scale(0.4)', 0, ZIPLAMA),
  ta('bounceUp', 'Zıplayarak · aşağıdan', 'bounce', 'translateY(160px)', 0, ZIPLAMA),
  ta('bounceDown', 'Zıplayarak · yukarıdan', 'bounce', 'translateY(-160px)', 0, ZIPLAMA),
  ta('bounceLeft', 'Zıplayarak · soldan', 'bounce', 'translateX(-160px)', 0, ZIPLAMA),
  ta('bounceRight', 'Zıplayarak · sağdan', 'bounce', 'translateX(160px)', 0, ZIPLAMA),

  // --- Back (4) — geri çekilip fırlayan ---
  ta('backUp', 'Geri çekilerek · aşağıdan', 'back', 'translateY(220px) scale(0.7)', 0, GERI),
  ta('backDown', 'Geri çekilerek · yukarıdan', 'back', 'translateY(-220px) scale(0.7)', 0, GERI),
  ta('backLeft', 'Geri çekilerek · soldan', 'back', 'translateX(-220px) scale(0.7)', 0, GERI),
  ta('backRight', 'Geri çekilerek · sağdan', 'back', 'translateX(220px) scale(0.7)', 0, GERI)
];

const HARITA = new Map(ANIM_ON_AYARLARI.map((a) => [a.id, a]));

/** Bilinmeyen kimlikte `fade`e düşer — widget çökmesin. */
export function animBul(id: string | undefined): AnimOnAyari {
  return HARITA.get(String(id || 'fade')) || HARITA.get('fade')!;
}

/** Panel açılır listesi için. */
export const ANIM_SECENEKLERI = ANIM_ON_AYARLARI.map((a) => ({ value: a.id, label: a.etiket }));

/** Eski isimlerin yeni kimliklere eşlemesi — kayıtlı ayarlar bozulmasın. */
const ESKI_ADLAR: Record<string, string> = {
  slide: 'slideRight',
  'slide-left': 'slideLeft',
  'slide-right': 'slideRight',
  'slide-up': 'slideUp',
  'slide-down': 'slideDown',
  pulse: 'zoom',
  scale: 'zoom',
  spin: 'rotate'
};

export function animKimligi(ham: string | undefined): string {
  const k = String(ham || '').trim();
  if (!k) return 'fade';
  if (HARITA.has(k)) return k;
  return ESKI_ADLAR[k.toLowerCase()] || 'fade';
}

export type AnimAsamasi = 'entering' | 'visible' | 'exiting' | 'hidden';

/**
 * Bir aşamanın stilini üretir.
 *
 * `reduced` (işletim sisteminde "hareketi azalt" açık) ise tüm ön ayarlar
 * soluk geçişe düşer: hareket duyarlılığı olan izleyiciler için.
 */
export function animStili(
  animId: string,
  asama: AnimAsamasi,
  sureMs: number,
  gecikmeMs = 0,
  reduced = false
): CSSProperties {
  const a = animBul(animKimligi(animId));
  const hedefFrom = reduced ? { opacity: 0, transform: 'none' } : a.from;
  const gecis = `opacity ${sureMs}ms ${a.easing || 'ease'} ${gecikmeMs}ms, transform ${sureMs}ms ${a.easing || 'ease'} ${gecikmeMs}ms`;

  if (asama === 'hidden') return { ...hedefFrom, transition: 'none', visibility: 'hidden' };
  if (asama === 'entering') return { ...hedefFrom, transition: gecis };
  if (asama === 'exiting') return { ...hedefFrom, transition: gecis };
  return { ...GORUNUR, transition: gecis };
}

/** Metin katmanı efektleri (BotRix'te 6 seçenek gözlemlendi). */
export const METIN_EFEKTLERI = [
  { value: 'none', label: 'Yok' },
  { value: 'shine', label: 'Parıltı' },
  { value: 'wiggle', label: 'Sallanma' },
  { value: 'wave', label: 'Dalga' },
  { value: 'skew', label: 'Eğilme' },
  { value: 'elastic', label: 'Esneme' }
];
