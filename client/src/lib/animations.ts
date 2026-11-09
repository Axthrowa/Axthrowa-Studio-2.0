/**
 * AxBoT — animasyon ön ayarları
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

export type AnimGrubu = 'none' | 'fade' | 'slide' | 'zoom' | 'rotate' | 'flip' | 'bounce' | 'back' | 'ozel';

export interface AnimOnAyari {
  id: string;
  etiket: string;
  grup: AnimGrubu;
  /** Görünmez/uzak hâl. */
  from: CSSProperties;
  /** Varsayılan easing — grubun karakterini verir. */
  easing?: string;
  /** Anahtar kareler: yalnız başlangıç-bitiş geçişiyle yapılamayan hareketler. */
  kare?: string;
}

const GORUNUR: CSSProperties = { opacity: 1, transform: 'none' };

/** Kısa yazım: yalnız transform değişen ön ayarlar için. */
function ta(id: string, etiket: string, grup: AnimGrubu, transform: string, opacity = 0, easing?: string): AnimOnAyari {
  return { id, etiket, grup, from: { opacity, transform }, easing };
}

const YUMUSAK = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ZIPLAMA = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const GERI = 'cubic-bezier(0.68, -0.6, 0.32, 1.6)';
/** Anahtar karelerin her aralığında: hızlanıp yavaşlar, kare geçişlerinde sarsılmaz */
const AKICI = 'cubic-bezier(0.4, 0, 0.2, 1)';
/** Çıkış: yavaş başlar, hızlanarak gider (girişten kısa sürer) */
const CIKIS = 'cubic-bezier(0.4, 0, 0.9, 0.6)';
/** Çıkış girişten kısa: göz giden öğeyi beklemez */
export const CIKIS_ORANI = 0.8;

/** Kısa yazım: anahtar kareli ön ayar. Hareketi azalt açıksa `from` ile soluk geçişe düşer. */
function ka(id: string, etiket: string, kare: string, easing = AKICI): AnimOnAyari {
  return { id, etiket, grup: 'ozel', from: { opacity: 0, transform: 'none' }, easing, kare };
}

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
  ta('backRight', 'Geri çekilerek · sağdan', 'back', 'translateX(220px) scale(0.7)', 0, GERI),

  // --- Özel (anahtar kareli): kayıp giden geçişlerle yapılamayan hareketler ---
  ka('pop', 'Pop (fırlayarak)', '0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:none}', ZIPLAMA),
  ka('bulanik', 'Bulanıktan netleşme', 'from{opacity:0;filter:blur(10px);transform:translateY(6px)}to{opacity:1;filter:none;transform:none}'),
  ka('elastik', 'Elastik', '0%{opacity:0;transform-origin:left center;transform:scaleX(.3) scaleY(1.4)}55%{opacity:1;transform:scaleX(1.1) scaleY(.9)}80%{transform:scaleX(.97) scaleY(1.03)}100%{opacity:1;transform:none}'),
  ka('daktilo', 'Daktilo (soldan açılır)', 'from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}', 'steps(28,end)'),
  ka('jole', 'Jöle', '0%{opacity:0;transform:scale(.7)}30%{opacity:1;transform:scale3d(1.2,.8,1)}45%{transform:scale3d(.85,1.15,1)}60%{transform:scale3d(1.08,.95,1)}80%{transform:scale3d(.98,1.02,1)}100%{opacity:1;transform:none}'),
  ka('tokat', 'Tokat', '0%{opacity:0;transform:scale(1.8)}55%{opacity:1;transform:scale(.92)}75%{transform:scale(1.04)}100%{opacity:1;transform:none}'),
  ka('sarkac', 'Sarkaç', '0%{opacity:0;transform-origin:top center;transform:rotate(-32deg)}35%{opacity:1;transform:rotate(16deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(3deg)}100%{opacity:1;transform:none}'),
  ka('isikHizi', 'Işık hızı', '0%{opacity:0;transform:translateX(70%) skewX(-30deg)}60%{opacity:1;transform:translateX(-4%) skewX(14deg)}80%{transform:skewX(-6deg)}100%{opacity:1;transform:none}'),
  ka('yuvarlanma', 'Yuvarlanarak', 'from{opacity:0;transform:translateX(-100%) rotate(-120deg)}to{opacity:1;transform:none}', YUMUSAK),
  ka('perdeOrta', 'Perde · ortadan açılır', 'from{clip-path:inset(0 50% 0 50%)}to{clip-path:inset(0 0 0 0)}', YUMUSAK),
  ka('perdeDikey', 'Perde · yukarıdan iner', 'from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}', YUMUSAK),
  ka('silmeSag', 'Silme · sağdan', 'from{clip-path:inset(0 0 0 100%)}to{clip-path:inset(0 0 0 0)}', YUMUSAK),
  ka('daire', 'Daire · ortadan büyür', 'from{clip-path:circle(0% at 50% 50%)}to{clip-path:circle(120% at 50% 50%)}', YUMUSAK),
  ka('neonYanma', 'Neon yanması', '0%,18%,32%{opacity:0}10%,24%,40%{opacity:.8}55%{opacity:.35}70%,100%{opacity:1}', 'linear'),
  ka('glitch', 'Bozulma (glitch)', '0%{opacity:0;transform:translate(-14px,3px) skewX(14deg)}20%{opacity:1;transform:translate(10px,-3px)}40%{transform:translate(-6px,2px) skewX(-8deg)}60%{transform:translate(4px,0)}80%{transform:translate(-2px,1px)}100%{opacity:1;transform:none}', 'steps(8,end)'),
  ka('dusus', 'Tepeden düşüş', '0%{opacity:0;transform:translateY(-120%)}60%{opacity:1;transform:translateY(8%)}78%{transform:translateY(-4%)}100%{opacity:1;transform:none}'),
  ka('katlanma', 'Katlanarak açılma', '0%{opacity:0;transform-origin:top;transform:perspective(700px) rotateX(-85deg)}60%{opacity:1;transform:perspective(700px) rotateX(12deg)}100%{opacity:1;transform:none}'),
  ka('kalpAtisi', 'Kalp atışı', '0%{opacity:0;transform:scale(.5)}35%{opacity:1;transform:scale(1.14)}55%{transform:scale(.96)}75%{transform:scale(1.06)}100%{opacity:1;transform:none}'),
  ka('yayin', 'Yayılma (harf aralığı)', 'from{opacity:0;letter-spacing:.6em;filter:blur(4px)}to{opacity:1;letter-spacing:inherit;filter:none}'),
  ka('sinema', 'Sinema (yakından uzaklaşır)', 'from{opacity:0;transform:scale(1.4);filter:blur(6px)}to{opacity:1;transform:none;filter:none}', YUMUSAK),

  // --- Eğlenceli girişler: yalnız transform/opacity; son kare `transform:none` (sürekli efekt üstüne oturur) ---
  ka('konfeti', 'Konfeti patlaması', '0%{opacity:0;transform:scale(.2) rotate(-180deg)}55%{opacity:1;transform:scale(1.15) rotate(12deg)}75%{transform:scale(.95) rotate(-4deg)}100%{opacity:1;transform:none}'),
  ka('miknatis', 'Mıknatıs çekimi', '0%{opacity:0;transform:translateX(-140px) scale(1.25,.85)}60%{opacity:1;transform:translateX(10px) scale(.94,1.06)}80%{transform:translateX(-3px) scale(1.01,.99)}100%{opacity:1;transform:none}'),
  ka('yaprak', 'Yaprak düşüşü', '0%{opacity:0;transform:translate(-30px,-120px) rotate(-18deg)}30%{opacity:1;transform:translate(24px,-70px) rotate(12deg)}55%{transform:translate(-16px,-30px) rotate(-8deg)}80%{transform:translate(6px,-6px) rotate(3deg)}100%{opacity:1;transform:none}'),
  ka('balon', 'Balon şişmesi', '0%{opacity:0;transform:scale(.1)}40%{opacity:1;transform:scale(.8,1.1)}65%{transform:scale(1.12,.92)}85%{transform:scale(.97,1.03)}100%{opacity:1;transform:none}'),
  ka('kart3b', 'Kart çevirme (3B)', '0%{opacity:0;transform:perspective(800px) rotateY(-95deg) scale(.85)}60%{opacity:1;transform:perspective(800px) rotateY(14deg) scale(1.02)}80%{transform:perspective(800px) rotateY(-5deg) scale(1)}100%{opacity:1;transform:none}'),
  ka('isinlanma', 'Işınlanma', '0%{opacity:0;transform:scale(.04,1.5)}35%{opacity:1;transform:scale(.04,1)}65%{transform:scale(1.08,.96)}85%{transform:scale(.98,1.02)}100%{opacity:1;transform:none}'),
  ka('damla', 'Damla', '0%{opacity:0;transform:translateY(-90px) scale(.5,1.4)}55%{opacity:1;transform:translateY(0) scale(1.2,.8)}75%{transform:translateY(0) scale(.94,1.06)}100%{opacity:1;transform:none}'),
  ka('yay', 'Yay gerilmesi', '0%{opacity:0;transform:translateY(60px) scaleY(.4)}45%{opacity:1;transform:translateY(-14px) scaleY(1.18)}65%{transform:translateY(4px) scaleY(.94)}82%{transform:translateY(-2px) scaleY(1.03)}100%{opacity:1;transform:none}'),
  ka('zipzip', 'Zıp zıp', '0%{opacity:0;transform:translateY(-140px) scale(1)}30%{opacity:1;transform:translateY(0) scale(1.08,.9)}45%{transform:translateY(-46px) scale(.97,1.03)}60%{transform:translateY(0) scale(1.04,.96)}72%{transform:translateY(-16px) scale(1)}84%{transform:translateY(0) scale(1.02,.98)}100%{opacity:1;transform:none}'),
  ka('kagitAcilma', 'Kâğıt açılma', '0%{opacity:0;transform:scale(.3,.06)}35%{opacity:1;transform:scale(1.04,.06)}55%{transform:scale(1,.06)}85%{transform:scale(1,1.04)}100%{opacity:1;transform:none}'),
  ka('roket', 'Roket kalkışı', '0%{opacity:0;transform:translateY(160px) scale(.8,1.3)}60%{opacity:1;transform:translateY(-12px) scale(.96,1.06)}80%{transform:translateY(3px) scale(1)}100%{opacity:1;transform:none}'),
  ka('kalpCarpinti', 'Kalp çarpıntısı', '0%{opacity:0;transform:scale(.3) rotate(0)}25%{opacity:1;transform:scale(1.18) rotate(-6deg)}38%{transform:scale(.92) rotate(0)}52%{transform:scale(1.12) rotate(4deg)}68%{transform:scale(.97) rotate(0)}100%{opacity:1;transform:none}'),
  ka('kasirga', 'Kasırga', '0%{opacity:0;transform:rotate(-540deg) scale(0)}70%{opacity:1;transform:rotate(15deg) scale(1.05)}100%{opacity:1;transform:none}', YUMUSAK),
  ka('savrulma', 'Savrulma (sağdan)', '0%{opacity:0;transform:translateX(120%) rotate(20deg)}60%{opacity:1;transform:translateX(-6%) rotate(-6deg)}80%{transform:translateX(2%) rotate(2deg)}100%{opacity:1;transform:none}'),
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
 */
export function animStili(
  animId: string,
  asama: AnimAsamasi,
  sureMs: number,
  gecikmeMs = 0
): CSSProperties {
  const a = animBul(animKimligi(animId));
  const egri = a.easing || YUMUSAK;
  const cikisMs = Math.round(sureMs * CIKIS_ORANI);
  const gecis = `opacity ${sureMs}ms ${egri} ${gecikmeMs}ms, transform ${sureMs}ms ${egri} ${gecikmeMs}ms`;

  if (a.kare) {
    // Tersine oynarken eğri de tersine döner: giriş yavaşlayarak biter, çıkış hızlanarak gider
    const oyna = (ms: number, yon = '') => `axt-on-${a.id} ${ms}ms ${egri} ${gecikmeMs}ms ${yon} both`.replace('  ', ' ');
    if (asama === 'hidden') return { opacity: 0, transition: 'none', visibility: 'hidden' };
    if (asama === 'entering') return { opacity: 0 };
    if (asama === 'exiting') return { animation: oyna(cikisMs, 'reverse') };
    return { animation: oyna(sureMs) };
  }

  if (asama === 'hidden') return { ...a.from, transition: 'none', visibility: 'hidden' };
  if (asama === 'entering') return { ...a.from, transition: gecis };
  if (asama === 'exiting')
    return { ...a.from, transition: `opacity ${cikisMs}ms ${CIKIS} ${gecikmeMs}ms, transform ${cikisMs}ms ${CIKIS} ${gecikmeMs}ms` };
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

/**
 * Tüm ön ayarlar için `.axt-anim-<id>` giriş sınıfları.
 *
 * Sohbet, aktivite akışı, emote kombo, etkinlik etiketleri, çekiliş, hedef ve anket
 * widget'ları `axt-anim-${ayar}` sınıfını kullanıyor; panel 38 ön ayar sunduğu hâlde
 * CSS'te yalnız birkaç eski ad vardı — "Kayarak · sağdan" seçilince hiçbir şey olmuyordu.
 * Sınıflar ön ayarların kendisinden üretilir; ek olarak sohbete özgü "daktilo".
 */
export function animasyonCss(sureMs = 600): string {
  const satirlar: string[] = [];
  for (const a of ANIM_ON_AYARLARI) {
    if (a.id === 'none') {
      satirlar.push('.axt-anim-none{animation:none}', '.axt-cikis-none{animation:none;opacity:0}');
      continue;
    }
    const from = `opacity:${a.from.opacity ?? 1};transform:${a.from.transform ?? 'none'}`;
    satirlar.push(
      a.kare ? `@keyframes axt-on-${a.id}{${a.kare}}` : `@keyframes axt-on-${a.id}{from{${from}}to{opacity:1;transform:none}}`,
      `.axt-anim-${a.id}{animation:axt-on-${a.id} ${sureMs}ms ${a.easing || YUMUSAK} both}`,
      // Çıkış: girişin tersi (görünürden uzak hâle), sonunda görünmez kalır
      `.axt-cikis-${a.id}{animation:axt-on-${a.id} ${Math.round(sureMs * CIKIS_ORANI)}ms ${a.easing || YUMUSAK} reverse both}`
    );
  }
  for (const e of EFEKT_TANIMLARI) satirlar.push(`@keyframes axt-efekt-${e.id}{${e.kare}}`);
  return satirlar.join('\n');
}


/**
 * Giriş bir kez oynar; hep ekranda duran widget'ta sonradan hareket görünmez. Sürekli efekt bunun için:
 * yalnız transform, opacity ve filter (yerleşim değişmez, sayfa yeniden dizilmez).
 */
const EFEKT_TANIMLARI: Array<{ id: string; etiket: string; kare: string; egri?: string }> = [
  { id: 'nefes', etiket: 'Yanıp sönme', kare: '0%,100%{opacity:1}50%{opacity:.35}' },
  { id: 'nabiz', etiket: 'Nabız', kare: '0%,100%{transform:scale(1)}50%{transform:scale(1.045)}' },
  { id: 'suzulme', etiket: 'Süzülme', kare: '0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}' },
  { id: 'sallanma', etiket: 'Sallanma', kare: '0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}' },
  { id: 'sekme', etiket: 'Sekme', kare: '0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}45%{transform:translateY(-3px)}' },
  { id: 'kayma', etiket: 'Yana kayma', kare: '0%,100%{transform:translateX(-5px)}50%{transform:translateX(5px)}' },
  { id: 'egilme', etiket: 'Eğilme', kare: '0%,100%{transform:skewX(-2deg)}50%{transform:skewX(2deg)}' },
  { id: 'parlama', etiket: 'Parlama', kare: '0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}' },
  { id: 'titreme', etiket: 'Neon titremesi', kare: '0%,19%,23%,55%,100%{opacity:1}20%,22%,54%{opacity:.45}', egri: 'linear' },
  { id: 'glitch', etiket: 'Bozulma (glitch)', kare: '0%,86%,100%{transform:none}88%{transform:translate(-3px,1px) skewX(6deg)}91%{transform:translate(3px,-1px)}94%{transform:translate(-2px,0) skewX(-4deg)}', egri: 'steps(1,end)' },
  { id: 'renk', etiket: 'Renk döngüsü', kare: 'from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}', egri: 'linear' },
  { id: 'donme3b', etiket: '3B sallanma', kare: '0%,100%{transform:perspective(700px) rotateY(-6deg)}50%{transform:perspective(700px) rotateY(6deg)}' },
  // İnce efektler: genlik küçük, çoğu döngünün büyük kısmında durur (yayın üstünde göz yormaz)
  { id: 'kipirdama', etiket: 'Kıpırdama (ara ara)', kare: '0%,80%,100%{transform:rotate(0)}84%{transform:rotate(-3deg)}88%{transform:rotate(3deg)}92%{transform:rotate(-2deg)}96%{transform:rotate(1deg)}' },
  { id: 'salinim', etiket: 'Salınım (üstten asılı)', kare: '0%,100%{transform-origin:50% 0;transform:rotate(-2deg)}50%{transform-origin:50% 0;transform:rotate(2deg)}' },
  { id: 'isiltiSupurme', etiket: 'Işıltı süpürmesi', kare: '0%,62%,100%{filter:brightness(1) drop-shadow(-8px 0 0 rgba(255,255,255,0))}78%{filter:brightness(1.3) drop-shadow(0 0 8px rgba(255,255,255,.45))}92%{filter:brightness(1.05) drop-shadow(8px 0 0 rgba(255,255,255,0))}' },
  { id: 'yuzme', etiket: 'Yüzme (dalgada)', kare: '0%,100%{transform:translate(0,0) rotate(0)}25%{transform:translate(3px,-4px) rotate(1deg)}50%{transform:translate(0,-6px) rotate(0)}75%{transform:translate(-3px,-3px) rotate(-1deg)}' },
  { id: 'kalp', etiket: 'Kalp atışı (çift vuruş)', kare: '0%,40%,100%{transform:scale(1)}10%{transform:scale(1.06)}20%{transform:scale(1)}30%{transform:scale(1.04)}' },
  { id: 'yorunge', etiket: 'Yörünge (hafif dönme)', kare: 'from{transform:rotate(0) translateX(3px) rotate(0)}to{transform:rotate(360deg) translateX(3px) rotate(-360deg)}', egri: 'linear' },
  { id: 'nefesAl', etiket: 'Nefes alma', kare: '0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.02);opacity:.88}' },
  { id: 'bayrak', etiket: 'Bayrak dalgası', kare: '0%,100%{transform:skewY(0)}25%{transform:skewY(1.5deg)}75%{transform:skewY(-1.5deg)}' }
];

const EFEKT_HARITA = new Map(EFEKT_TANIMLARI.map((e) => [e.id, e]));

/** Sürekli efekt seçenekleri (panel) */
export const SUREKLI_EFEKTLER = [{ value: 'none', label: 'Yok' }, ...EFEKT_TANIMLARI.map((e) => ({ value: e.id, label: e.etiket }))];

/** Bilinmeyen ya da kapalı efektte undefined */
export function efektAnimasyonu(id: unknown, saniye: unknown, gecikmeMs = 0): string | undefined {
  const e = EFEKT_HARITA.get(String(id));
  if (!e) return undefined;
  const sn = Math.max(0.2, Number(saniye) || 2);
  // Sinüse yakın eğri: uçlarda yumuşak döner, ortada takılmaz
  return `axt-efekt-${e.id} ${sn}s ${e.egri || 'cubic-bezier(0.37, 0, 0.63, 1)'} ${gecikmeMs}ms infinite`;
}

/**
 * Eski `pulse` sonsuza dek yanıp sönen bir "giriş"ti ve widget'ın tamamına uygulanıyordu.
 * Artık girişsiz + yanıp sönme efekti: panelde de öyle görünür, başka seçim yapılınca kalkar.
 */
export function eskiHareketiCevir<T extends Record<string, any>>(s: T): T {
  if (s.animation !== 'pulse') return s;
  return { ...s, animation: 'none', surekliEfekt: s.surekliEfekt && s.surekliEfekt !== 'none' ? s.surekliEfekt : 'nefes' };
}

/**
 * Bir widget kutusunun giriş + sürekli efekt animasyonu (kök kutunun stiline eklenir).
 * Çarkta `animation` dönüş eğrisi olduğu için giriş `girisAnimasyonu` anahtarından okunur.
 */
export function ortakHareket(ham: Record<string, any>, secim: { giris?: boolean; efekt?: boolean } = {}): CSSProperties {
  const s = eskiHareketiCevir(ham);
  const parca: string[] = [];
  const girisAdi = String(s.girisAnimasyonu ?? s.animation ?? 'fade');
  const giris = animBul(animKimligi(girisAdi));
  const sure = Math.max(0, Number(s.animationDuration) || 600);
  const girisVar = secim.giris !== false && giris.id !== 'none' && girisAdi !== 'marquee';
  if (girisVar) parca.push(`axt-on-${giris.id} ${sure}ms ${giris.easing || YUMUSAK} both`);
  const efekt = secim.efekt !== false ? efektAnimasyonu(s.surekliEfekt, s.efektSuresi, girisVar ? sure : 0) : undefined;
  if (efekt) parca.push(efekt);
  return parca.length ? { animation: parca.join(', ') } : {};
}

/** Görünür aşamadaki kutuya sürekli efekti ekler (animStili kullanan widget'lar: uyarı, sponsor). */
export function efektEkle(stil: CSSProperties, ayar: Record<string, any>, asama: AnimAsamasi, sureMs: number): CSSProperties {
  const efekt = asama === 'visible' ? efektAnimasyonu(ayar.surekliEfekt, ayar.efektSuresi, sureMs) : undefined;
  if (!efekt) return stil;
  return { ...stil, animation: stil.animation ? `${stil.animation}, ${efekt}` : efekt };
}

/** Sınıfları belgeye bir kez ekler (main.tsx). */
export function animasyonStiliniEkle(): void {
  if (typeof document === 'undefined' || document.getElementById('axt-anim-on-ayarlari')) return;
  const el = document.createElement('style');
  el.id = 'axt-anim-on-ayarlari';
  el.textContent = animasyonCss();
  document.head.appendChild(el);
}
