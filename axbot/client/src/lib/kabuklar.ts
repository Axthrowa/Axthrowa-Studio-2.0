/**
 * Yapısal tema kabukları ve ortak kapatma işaretleri
 * Developed by AxthrowA
 *
 * Eski temaların çoğu renk ve yazı tipi değiştiriyordu. Buradakiler kutunun biçimini, dokusunu ve
 * hareketini değiştirir: sözde öğelerle (::before/::after) süs ekler, içerik düzenine dokunmaz.
 * Hareketler yalnız transform/opacity ile: arka plan konumu her karede sayfayı yeniden boyatıyordu.
 */
import type { CSSProperties } from 'react';
import { ozelCssKimligi } from './ozelGorunum.js';

export const YAPISAL_KABUKLAR: Array<{ value: string; label: string }> = [
  ['holo', 'Hologram (dönen kenar)'], ['crt', 'CRT ekran (tarama çizgili)'], ['brutal', 'Brutalist (köşe şeritli)'], ['defter', 'Karalama defteri (bantlı)'],
  ['ampul', 'Sahne ampulleri'], ['siber', 'Siber HUD (tarayan çizgi)'], ['kil', 'Kil (şişkin)'], ['krom', 'Y2K krom (yıldızlı)'],
  ['plan', 'Mavi plan (ölçü çizgili)'], ['bilet', 'Bilet (delikli)'], ['origami', 'Origami (katlanmış köşe)'], ['vapor', 'Vaporwave (akan ızgara)'],
  ['manga', 'Manga (hız çizgili)'], ['vitray', 'Vitray'], ['lav', 'Lav lambası'], ['perde', 'Tiyatro perdesi'],
  ['arcade', 'Arcade dolabı (ışıklı tabela)'], ['kaset', 'Kaset (makaralı)'], ['polaroid', 'Polaroid (bantlı fotoğraf)'], ['postit', 'Post-it (raptiyeli)'],
  ['piksel', 'Piksel çerçeve (8-bit)'], ['ahsap', 'Ahşap tabela (çivili)'], ['film', 'Sinema şeridi (akan delikler)'], ['buz', 'Kristal buz (kırağılı)'],
  ['washi', 'Washi bant (desenli)'], ['rozet', 'Rozet (madalyalı)'],
  ['terminal', 'Terminal penceresi'], ['gazete', 'Gazete manşeti'], ['neontabela', 'Neon tabela (yanıp sönen tüp)'], ['karton', 'Karton kutu (bantlı)'],
  ['mermer', 'Mermer (damarlı)'], ['sakiz', 'Sakız balonu (dalgalanan)']
].map(([value, label]) => ({ value, label }));

const KIMLIKLER = new Set(YAPISAL_KABUKLAR.map((k) => k.value));

export function yapisalKabukMu(id: unknown): boolean {
  return KIMLIKLER.has(String(id));
}

/**
 * Widget kök kutusuna yazılan işaretler. Kapatmalar CSS'te !important: widget'lar kutuyu satır içi
 * stille boyar, her birinin kendi zemin/çerçeve alanı farklı adlıdır.
 */
export function kokOzellik(s: Record<string, any>): Record<string, string> {
  const o: Record<string, string> = {};
  if (yapisalKabukMu(s.kabuk)) o['data-axt-kabuk'] = String(s.kabuk);
  if (s.arkaPlanKapali) o['data-arka-yok'] = '';
  if (s.cerceveKapali) o['data-cerceve-yok'] = '';
  if (s.golgeKapali) o['data-golge-yok'] = '';
  // WID-2: özel CSS yalnız bu köke kapsamlanır
  const css = ozelCssKimligi(s.ozelCss);
  if (css) o['data-axt-css'] = css;
  return o;
}

type Stil = CSSProperties & Record<`--${string}`, string>;

/** Kutunun satır içi stili: renkler CSS değişkeni olarak sözde öğelere geçer. */
export function yapisalKabukStilleri(zemin: string, vurgu: string): Record<string, CSSProperties> {
  const taban = (ek: CSSProperties): Stil => ({ '--axt-zemin': zemin, '--axt-vurgu': vurgu, position: 'relative', isolation: 'isolate', ...ek });
  return {
    holo: taban({ background: zemin, border: 'none', overflow: 'hidden' }),
    crt: taban({ background: zemin, border: '2px solid #1f2937', borderRadius: 18, overflow: 'hidden', boxShadow: 'inset 0 0 34px rgba(0,0,0,.75), 0 0 18px rgba(34,197,94,.25)' }),
    brutal: taban({ background: zemin, border: '3px solid #000', borderRadius: 0, boxShadow: '7px 7px 0 #000', overflow: 'hidden', rotate: '-.5deg' }),
    defter: taban({ background: 'repeating-linear-gradient(180deg,#fdf6e3 0 23px,#e5d9b8 23px 24px)', color: '#3b2f1a', border: 'none', borderRadius: 2, boxShadow: '0 8px 18px rgba(0,0,0,.4)', overflow: 'hidden', rotate: '.5deg' }),
    ampul: taban({ background: zemin, border: `2px solid ${vurgu}`, borderRadius: 14, overflow: 'hidden', padding: 22 }),
    siber: taban({ background: zemin, border: 'none', overflow: 'hidden', clipPath: 'polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)' }),
    kil: taban({ background: zemin, border: 'none', borderRadius: 26, overflow: 'hidden', boxShadow: 'inset -7px -7px 14px rgba(0,0,0,.28), inset 7px 7px 14px rgba(255,255,255,.3), 8px 14px 22px rgba(0,0,0,.35)' }),
    krom: taban({ background: `linear-gradient(${zemin},${zemin}) padding-box, linear-gradient(135deg,#f8fafc,#64748b 28%,#e2e8f0 50%,#475569 72%,#f8fafc) border-box`, border: '3px solid transparent', borderRadius: 16, overflow: 'hidden' }),
    plan: taban({ background: `linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px) 0 0/100% 20px, linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px) 0 0/20px 100%, #0b3a75`, color: '#e0f2fe', border: '1px dashed rgba(224,242,254,.7)', borderRadius: 0, overflow: 'hidden' }),
    bilet: taban({ background: zemin, border: 'none', borderRadius: 8, overflow: 'hidden', WebkitMaskImage: 'radial-gradient(circle 11px at 0 50%,transparent 97%,#000),radial-gradient(circle 11px at 100% 50%,transparent 97%,#000)', WebkitMaskComposite: 'source-in', maskImage: 'radial-gradient(circle 11px at 0 50%,transparent 97%,#000),radial-gradient(circle 11px at 100% 50%,transparent 97%,#000)', maskComposite: 'intersect' }),
    origami: taban({ background: zemin, border: 'none', borderRadius: 0, overflow: 'hidden', clipPath: 'polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,0 100%)', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,.4))' }),
    vapor: taban({ background: 'linear-gradient(180deg,#12062e 0 55%,#2a0a4f)', color: '#fdf4ff', border: '1px solid #f472b6', borderRadius: 10, overflow: 'hidden' }),
    manga: taban({ background: '#ffffff', color: '#111111', border: '3px solid #111', borderRadius: 0, overflow: 'hidden', transform: 'skewX(-2deg)' }),
    vitray: taban({ background: zemin, border: '3px solid #0a0a0a', borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 22px rgba(255,255,255,.14)' }),
    lav: taban({ background: zemin, border: 'none', borderRadius: 22, overflow: 'hidden' }),
    perde: taban({ background: zemin, border: 'none', borderTop: '5px solid #d4a843', borderRadius: 6, overflow: 'hidden', paddingLeft: 'max(9%, 22px)', paddingRight: 'max(9%, 22px)' }),
    // Eğim `rotate` ile: giriş animasyonu `transform`u sıfırlasa da kutu eğik kalır
    arcade: taban({ background: zemin, border: '5px solid #111', borderTopWidth: 16, borderRadius: '14px 14px 6px 6px', overflow: 'hidden', boxShadow: `inset 0 0 0 2px ${vurgu}, inset 0 0 22px rgba(0,0,0,.6), 0 10px 24px rgba(0,0,0,.5)` }),
    kaset: taban({ background: `linear-gradient(180deg,rgba(255,255,255,.07),transparent 40%), ${zemin}`, border: '3px solid #1c1917', borderRadius: 10, overflow: 'hidden', boxShadow: 'inset 0 0 0 4px rgba(255,255,255,.06), 0 8px 18px rgba(0,0,0,.45)', paddingBottom: 26 }),
    polaroid: taban({ background: zemin, border: '10px solid #fafaf9', borderBottomWidth: 30, borderRadius: 3, boxShadow: '0 10px 22px rgba(0,0,0,.45)', rotate: '-1.2deg' }),
    postit: taban({ background: `linear-gradient(175deg,rgba(255,255,255,.22),transparent 45%), ${zemin}`, border: 'none', borderRadius: '2px 2px 4px 26px / 2px 2px 4px 10px', boxShadow: 'inset 0 -12px 16px -12px rgba(0,0,0,.28), 0 6px 12px rgba(0,0,0,.35)', rotate: '1deg', paddingTop: 22 }),
    piksel: taban({ background: zemin, border: 'none', borderRadius: 0, boxShadow: `inset 0 0 0 4px ${vurgu}, inset -8px -8px 0 0 rgba(0,0,0,.32), inset 8px 8px 0 0 rgba(255,255,255,.16)`, clipPath: 'polygon(0 8px,4px 8px,4px 4px,8px 4px,8px 0,calc(100% - 8px) 0,calc(100% - 8px) 4px,calc(100% - 4px) 4px,calc(100% - 4px) 8px,100% 8px,100% calc(100% - 8px),calc(100% - 4px) calc(100% - 8px),calc(100% - 4px) calc(100% - 4px),calc(100% - 8px) calc(100% - 4px),calc(100% - 8px) 100%,8px 100%,8px calc(100% - 4px),4px calc(100% - 4px),4px calc(100% - 8px),0 calc(100% - 8px))' }),
    // Ahşap sabit renkli: yazı açık kalır (temanın zemini tahtayı boyamaz)
    ahsap: taban({ background: 'repeating-linear-gradient(180deg,transparent 0 30px,rgba(0,0,0,.3) 30px 32px), repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 3px,transparent 3px 11px), linear-gradient(180deg,#8a5426,#6b4019 60%,#55320f)', color: '#fff7e6', border: '3px solid #3b2410', borderRadius: 8, overflow: 'hidden', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.18), inset 0 -3px 0 rgba(0,0,0,.3), 0 8px 18px rgba(0,0,0,.45)' }),
    film: taban({ background: zemin, border: 'none', borderRadius: 2, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1), 0 8px 18px rgba(0,0,0,.45)', paddingTop: 16, paddingBottom: 16 }),
    buz: taban({ background: `linear-gradient(135deg,rgba(255,255,255,.2),transparent 40%), linear-gradient(315deg,rgba(186,230,253,.22),transparent 45%), ${zemin}`, border: '1px solid rgba(224,242,254,.65)', borderRadius: 14, overflow: 'hidden', boxShadow: 'inset 0 0 18px rgba(186,230,253,.3), 0 0 16px rgba(125,211,252,.28)' }),
    washi: taban({ background: `radial-gradient(rgba(0,0,0,.06) 1px,transparent 1.5px) 0 0/8px 8px, ${zemin}`, border: 'none', borderRadius: 4, boxShadow: '0 6px 16px rgba(0,0,0,.35)' }),
    rozet: taban({ background: zemin, border: `2px solid ${vurgu}`, borderRadius: 16, boxShadow: `inset 0 0 0 4px ${zemin}, inset 0 0 0 5px ${vurgu}, 0 8px 20px rgba(0,0,0,.4)`, paddingLeft: 40 }),
    terminal: taban({ background: zemin, border: '1px solid rgba(255,255,255,.16)', borderTop: '24px solid #1f2937', borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 28px rgba(0,0,0,.5)' }),
    gazete: taban({ background: `radial-gradient(rgba(0,0,0,.05) 1px,transparent 1.4px) 0 0/5px 5px, ${zemin}`, border: 'none', borderTop: '4px double currentColor', borderBottom: '4px double currentColor', borderRadius: 0, boxShadow: '0 8px 18px rgba(0,0,0,.35)' }),
    neontabela: taban({ background: zemin, border: `3px solid ${vurgu}`, borderRadius: 18, boxShadow: `0 0 8px ${vurgu}, 0 0 22px ${vurgu}, inset 0 0 12px ${vurgu}` }),
    // Karton sabit renkli: yazı koyu kalır (temanın zemini kartonu boyamaz)
    karton: taban({ background: 'repeating-linear-gradient(90deg,rgba(0,0,0,.04) 0 2px,transparent 2px 6px), linear-gradient(180deg,#c89b63,#b0814b)', color: '#2b1a0a', border: 'none', borderRadius: 4, boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.12), 0 8px 18px rgba(0,0,0,.4)' }),
    mermer: taban({ background: `linear-gradient(115deg,transparent 40%,rgba(255,255,255,.22) 45%,transparent 50%) 0 0/180px 120px, linear-gradient(25deg,transparent 55%,rgba(0,0,0,.18) 58%,transparent 62%) 0 0/220px 140px, ${zemin}`, border: `1px solid ${vurgu}`, borderRadius: 6, boxShadow: '0 10px 22px rgba(0,0,0,.4)' }),
    sakiz: taban({ background: `radial-gradient(circle at 28% 22%,rgba(255,255,255,.45),transparent 30%), ${zemin}`, border: 'none', borderRadius: '42% 58% 46% 54% / 56% 44% 56% 44%', boxShadow: 'inset -6px -8px 14px rgba(0,0,0,.18), 0 10px 22px rgba(0,0,0,.35)', padding: 22 })
  };
}

const s = (id: string) => `[data-axt-kabuk="${id}"]`;
const kaplama = 'content:"";position:absolute;pointer-events:none;';

export const KABUK_CSS = `
[data-arka-yok]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-arka-yok] [data-yuzey]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-cerceve-yok],[data-cerceve-yok] [data-yuzey]{border-color:transparent!important;outline:none!important}
[data-cerceve-yok] [data-cizgi]{border-color:transparent!important}
[data-golge-yok],[data-golge-yok] [data-yuzey]{box-shadow:none!important;filter:none!important}
[data-arka-yok] [data-sohbet-satir]>div{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
[data-cerceve-yok] [data-sohbet-satir]>div{border-color:transparent!important;outline:none!important}
[data-golge-yok] [data-sohbet-satir]>div{box-shadow:none!important}
.axt-avatar-yuva:empty{display:none}
[data-arka-yok][data-axt-kabuk]::before,[data-arka-yok][data-axt-kabuk]::after,[data-cerceve-yok][data-axt-kabuk]::before,[data-cerceve-yok][data-axt-kabuk]::after{display:none!important}
@keyframes axt-k-don{to{rotate:360deg}}
@keyframes axt-k-tara{from{transform:translateY(-120%)}to{transform:translateY(900%)}}
@keyframes axt-k-supur{from{transform:translateX(-160%) skewX(-20deg)}to{transform:translateX(420%) skewX(-20deg)}}
@keyframes axt-k-ampul{0%,49%{opacity:1}50%,100%{opacity:.15}}
@keyframes axt-k-yildiz{0%,100%{transform:scale(.55) rotate(0);opacity:.5}50%{transform:scale(1) rotate(45deg);opacity:1}}
@keyframes axt-k-izgara{to{transform:perspective(160px) rotateX(62deg) translateY(24px)}}
@keyframes axt-k-lav1{0%,100%{transform:translate(-10%,30%) scale(1)}50%{transform:translate(60%,-40%) scale(1.3)}}
@keyframes axt-k-lav2{0%,100%{transform:translate(160%,-20%) scale(1.1)}50%{transform:translate(70%,50%) scale(.8)}}
@keyframes axt-k-perde{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.9)}}
@keyframes axt-k-kirpis{0%,100%{opacity:.9}48%{opacity:.82}50%{opacity:1}}

${s('holo')}::before{${kaplama}left:50%;top:50%;width:220%;aspect-ratio:1;translate:-50% -50%;background:conic-gradient(#22d3ee,#a78bfa,#f472b6,#fbbf24,#22d3ee);animation:axt-k-don 5s linear infinite;z-index:-2}
${s('holo')}::after{${kaplama}inset:3px;border-radius:inherit;background:var(--axt-zemin);box-shadow:inset 0 0 26px rgba(167,139,250,.28);z-index:-1}

${s('crt')}::before{${kaplama}left:0;right:0;top:0;height:18%;background:linear-gradient(180deg,transparent,rgba(134,239,172,.14),transparent);animation:axt-k-tara 6s linear infinite;z-index:4}
${s('crt')}::after{${kaplama}inset:0;background:repeating-linear-gradient(180deg,rgba(0,0,0,.28) 0 2px,transparent 2px 4px);animation:axt-k-kirpis 3.4s linear infinite;z-index:5}

${s('brutal')}::before{${kaplama}top:12px;right:-34px;width:120px;height:18px;rotate:38deg;background:repeating-linear-gradient(90deg,var(--axt-vurgu) 0 14px,#000 14px 28px);z-index:3}
${s('brutal')}::after{${kaplama}left:0;bottom:0;width:38%;height:5px;background:var(--axt-vurgu);z-index:3}

${s('defter')}::before{${kaplama}top:0;left:50%;width:84px;height:20px;translate:-50% 0;rotate:-3deg;background:rgba(244,114,182,.55);box-shadow:0 1px 2px rgba(0,0,0,.2);z-index:3}
${s('defter')}::after{${kaplama}bottom:4px;right:-14px;width:70px;height:18px;rotate:-38deg;background:repeating-linear-gradient(90deg,rgba(34,211,238,.6) 0 8px,rgba(255,255,255,.5) 8px 16px);z-index:3}

${s('ampul')}::before,${s('ampul')}::after{${kaplama}inset:4px;z-index:2;
  background:radial-gradient(circle 4px,#fde68a 92%,transparent) 0 0/22px 14px repeat-x,radial-gradient(circle 4px,#fde68a 92%,transparent) 0 100%/22px 14px repeat-x,radial-gradient(circle 4px,#fde68a 92%,transparent) 0 0/14px 22px repeat-y,radial-gradient(circle 4px,#fde68a 92%,transparent) 100% 0/14px 22px repeat-y;
  filter:drop-shadow(0 0 4px #fbbf24);animation:axt-k-ampul 1.1s linear infinite}
${s('ampul')}::after{background-position:11px 0,11px 100%,0 11px,100% 11px;animation-delay:.55s}

${s('siber')}::before{${kaplama}inset:0;z-index:2;background:linear-gradient(var(--axt-vurgu),var(--axt-vurgu)) 16px 0/30% 2px no-repeat,linear-gradient(var(--axt-vurgu),var(--axt-vurgu)) 0 16px/2px 36% no-repeat,linear-gradient(var(--axt-vurgu),var(--axt-vurgu)) calc(100% - 16px) 100%/30% 2px no-repeat,linear-gradient(var(--axt-vurgu),var(--axt-vurgu)) 100% calc(100% - 16px)/2px 36% no-repeat}
${s('siber')}::after{${kaplama}left:0;right:0;top:0;height:14%;background:linear-gradient(180deg,transparent,var(--axt-vurgu));opacity:.22;animation:axt-k-tara 3.6s linear infinite;z-index:3}

${s('kil')}::before{${kaplama}top:8%;left:6%;width:30%;height:22%;border-radius:50%;background:rgba(255,255,255,.28);filter:blur(10px);z-index:-1}
${s('kil')}::after{${kaplama}bottom:-20%;right:-8%;width:42%;aspect-ratio:1;border-radius:50%;background:var(--axt-vurgu);opacity:.3;filter:blur(18px);z-index:-1}

${s('krom')}::before{${kaplama}top:0;bottom:0;left:0;width:26%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.34),transparent);animation:axt-k-supur 4.5s ease-in-out infinite;z-index:3}
${s('krom')}::after{${kaplama}top:6px;right:8px;width:20px;height:20px;background:#fff;clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);animation:axt-k-yildiz 2.4s ease-in-out infinite;z-index:3}

${s('plan')}::before{${kaplama}inset:5px;z-index:1;--c:rgba(224,242,254,.85);background:linear-gradient(var(--c),var(--c)) 0 0/12px 1px no-repeat,linear-gradient(var(--c),var(--c)) 0 0/1px 12px no-repeat,linear-gradient(var(--c),var(--c)) 100% 0/12px 1px no-repeat,linear-gradient(var(--c),var(--c)) 100% 0/1px 12px no-repeat,linear-gradient(var(--c),var(--c)) 0 100%/12px 1px no-repeat,linear-gradient(var(--c),var(--c)) 0 100%/1px 12px no-repeat,linear-gradient(var(--c),var(--c)) 100% 100%/12px 1px no-repeat,linear-gradient(var(--c),var(--c)) 100% 100%/1px 12px no-repeat}
${s('plan')}::after{${kaplama}left:12px;right:12px;bottom:3px;height:4px;z-index:1;background:repeating-linear-gradient(90deg,rgba(224,242,254,.7) 0 1px,transparent 1px 10px)}

${s('bilet')}::before{${kaplama}top:8px;bottom:8px;left:26px;border-left:2px dashed var(--axt-vurgu);opacity:.65;z-index:1}
${s('bilet')}::after{${kaplama}top:8px;bottom:8px;right:26px;border-left:2px dashed var(--axt-vurgu);opacity:.65;z-index:1}

${s('origami')}::before{${kaplama}inset:0;background:linear-gradient(115deg,rgba(255,255,255,.1) 0 34%,transparent 34% 62%,rgba(0,0,0,.2) 62%);z-index:-1}
${s('origami')}::after{${kaplama}top:0;right:0;width:26px;height:26px;background:linear-gradient(225deg,transparent 50%,var(--axt-vurgu) 50%);box-shadow:-3px 3px 6px rgba(0,0,0,.4);z-index:3}

${s('vapor')}::before{${kaplama}left:-40%;right:-40%;bottom:-30%;height:90%;z-index:-1;transform:perspective(160px) rotateX(62deg);background:linear-gradient(#f472b6 1px,transparent 1px) 0 0/100% 24px,linear-gradient(90deg,#22d3ee 1px,transparent 1px) 0 0/34px 100%;opacity:.55;animation:axt-k-izgara 1.4s linear infinite}
${s('vapor')}::after{${kaplama}top:6%;right:8%;width:46px;height:46px;border-radius:50%;z-index:-1;background:repeating-linear-gradient(180deg,#fbbf24 0 5px,#f472b6 5px 7px)}

${s('manga')}::before{${kaplama}inset:-30%;z-index:-1;background:repeating-conic-gradient(rgba(0,0,0,.09) 0 2deg,transparent 2deg 9deg)}
${s('manga')}::after{${kaplama}right:0;bottom:0;width:46%;height:60%;z-index:-1;background:radial-gradient(circle 2.5px,rgba(0,0,0,.42) 96%,transparent) 0 0/9px 9px;-webkit-mask-image:linear-gradient(315deg,#000,transparent 75%);mask-image:linear-gradient(315deg,#000,transparent 75%)}

${s('vitray')}::before{${kaplama}inset:0;z-index:-2;opacity:.5;background:conic-gradient(from 45deg at 20% 30%,#ef4444,#f59e0b,#22c55e,#0ea5e9,#a855f7,#ef4444),conic-gradient(from 200deg at 80% 70%,#a855f7,#0ea5e9,#22c55e,#f59e0b,#ef4444,#a855f7);background-blend-mode:screen}
${s('vitray')}::after{${kaplama}inset:0;z-index:-1;background:linear-gradient(64deg,transparent 49.4%,#0a0a0a 49.4% 50.6%,transparent 50.6%) 0 0/70px 58px,linear-gradient(-64deg,transparent 49.4%,#0a0a0a 49.4% 50.6%,transparent 50.6%) 0 0/70px 58px,rgba(0,0,0,.42)}

${s('lav')}::before,${s('lav')}::after{${kaplama}top:0;left:0;width:42%;aspect-ratio:1;border-radius:50%;background:var(--axt-vurgu);filter:blur(16px);opacity:.55;z-index:-1;animation:axt-k-lav1 9s ease-in-out infinite}
${s('lav')}::after{background:#f472b6;animation:axt-k-lav2 12s ease-in-out infinite}

${s('perde')}::before,${s('perde')}::after{${kaplama}top:0;bottom:0;width:max(8%, 20px);z-index:2;background:repeating-linear-gradient(90deg,#7f1d1d 0 5px,#b91c1c 5px 9px,#450a0a 9px 12px);animation:axt-k-perde 5s ease-in-out infinite}
${s('perde')}::before{left:0;transform-origin:left center;box-shadow:3px 0 8px rgba(0,0,0,.55)}
${s('perde')}::after{right:0;transform-origin:right center;box-shadow:-3px 0 8px rgba(0,0,0,.55);animation-delay:.6s}

@keyframes axt-k-film{from{transform:translateX(-22px)}to{transform:translateX(0)}}
@keyframes axt-k-rozet{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}

${s('arcade')}::before{${kaplama}left:0;right:0;top:0;height:5px;z-index:3;background:linear-gradient(90deg,var(--axt-vurgu),#f472b6,#facc15,#22d3ee,var(--axt-vurgu));box-shadow:0 0 10px var(--axt-vurgu);animation:axt-k-kirpis 2.6s linear infinite}
${s('arcade')}::after{${kaplama}right:8px;bottom:6px;width:36px;height:10px;z-index:3;background:radial-gradient(circle 4px,#ef4444 88%,transparent) 0 50%/12px 10px no-repeat,radial-gradient(circle 4px,#facc15 88%,transparent) 12px 50%/12px 10px no-repeat,radial-gradient(circle 4px,#22d3ee 88%,transparent) 24px 50%/12px 10px no-repeat}

${s('kaset')}::before{${kaplama}right:10px;bottom:5px;width:64px;height:18px;border-radius:9px;z-index:2;border:2px solid rgba(255,255,255,.18);background:radial-gradient(circle at 24% 50%,#f5f5f4 0 2px,#44403c 2.5px 6px,transparent 6.5px),radial-gradient(circle at 76% 50%,#f5f5f4 0 2px,#44403c 2.5px 6px,transparent 6.5px),linear-gradient(90deg,transparent 30%,rgba(120,53,15,.65) 30% 70%,transparent 70%) 0 50%/100% 6px no-repeat,#0c0a09}
${s('kaset')}::after{${kaplama}left:10px;right:10px;top:6px;height:5px;border-radius:3px;z-index:2;background:linear-gradient(90deg,var(--axt-vurgu) 0 34%,#f472b6 34% 67%,#fbbf24 67%)}

${s('polaroid')}::before{${kaplama}top:-18px;left:50%;width:72px;height:22px;translate:-50% 0;rotate:2deg;z-index:3;background:rgba(253,230,138,.72);box-shadow:0 1px 3px rgba(0,0,0,.25)}
${s('polaroid')}::after{${kaplama}left:6px;right:40%;bottom:-17px;height:2px;z-index:3;background:repeating-linear-gradient(90deg,rgba(0,0,0,.38) 0 9px,transparent 9px 13px)}

${s('postit')}::before{${kaplama}top:5px;left:50%;width:14px;height:14px;translate:-50% 0;border-radius:50%;z-index:3;background:radial-gradient(circle at 35% 35%,#fecaca,#dc2626 60%,#7f1d1d);box-shadow:2px 3px 3px rgba(0,0,0,.35)}
${s('postit')}::after{${kaplama}left:0;right:0;top:0;height:22px;z-index:-1;background:linear-gradient(180deg,rgba(0,0,0,.09),transparent)}

${s('piksel')}::before{${kaplama}top:10px;right:12px;width:8px;height:8px;z-index:3;background:var(--axt-vurgu);box-shadow:8px 0 0 var(--axt-vurgu),0 8px 0 var(--axt-vurgu);animation:axt-k-ampul 1.2s linear infinite}
${s('piksel')}::after{${kaplama}left:8px;right:8px;bottom:8px;height:4px;z-index:1;background:repeating-linear-gradient(90deg,rgba(255,255,255,.16) 0 4px,transparent 4px 8px)}

${s('ahsap')}::before{${kaplama}inset:5px;z-index:2;--civi:radial-gradient(circle 3.5px,#e7e5e4 0 1.5px,#78716c 2px 3px,transparent 3.5px);background:var(--civi) 0 0/8px 8px no-repeat,var(--civi) 100% 0/8px 8px no-repeat,var(--civi) 0 100%/8px 8px no-repeat,var(--civi) 100% 100%/8px 8px no-repeat}
${s('ahsap')}::after{${kaplama}left:14%;bottom:18%;width:30px;height:13px;border-radius:50%;z-index:-1;background:radial-gradient(ellipse,rgba(0,0,0,.4) 0 28%,rgba(0,0,0,.14) 30% 60%,transparent 64%)}

${s('film')}::before,${s('film')}::after{${kaplama}left:-22px;right:0;height:7px;z-index:2;background:linear-gradient(90deg,rgba(245,245,245,.82) 0 11px,transparent 11px) 0 0/22px 100% repeat-x;animation:axt-k-film 2.4s linear infinite}
${s('film')}::before{top:4px}
${s('film')}::after{bottom:4px}
/* Kenardaki süs (makara, delik şeridi, raptiye, madalya) içeriğin üstüne binmesin: widget'ın kendi dolgusu yetmez */
${s('kaset')}{padding-bottom:30px!important}
${s('film')}{padding-top:17px!important;padding-bottom:17px!important}
${s('postit')}{padding-top:16px!important}
${s('rozet')}{padding-left:28px!important}
${s('terminal')}{padding-top:10px!important}
${s('karton')}{padding-top:18px!important}

${s('buz')}::before{${kaplama}top:-12px;left:-12px;width:84px;height:84px;z-index:-1;background:repeating-conic-gradient(rgba(255,255,255,.5) 0 3deg,transparent 3deg 30deg);-webkit-mask-image:radial-gradient(circle at 12px 12px,#000,transparent 70%);mask-image:radial-gradient(circle at 12px 12px,#000,transparent 70%)}
${s('buz')}::after{${kaplama}top:8px;right:10px;width:14px;height:14px;z-index:3;background:#f0f9ff;filter:drop-shadow(0 0 4px #7dd3fc);clip-path:polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%);animation:axt-k-yildiz 3.2s ease-in-out infinite}

${s('washi')}::before{${kaplama}top:-8px;left:-16px;width:74px;height:20px;rotate:-35deg;z-index:3;opacity:.85;background:repeating-linear-gradient(45deg,var(--axt-vurgu) 0 5px,rgba(255,255,255,.65) 5px 10px)}
${s('washi')}::after{${kaplama}top:-8px;right:-16px;width:74px;height:20px;rotate:35deg;z-index:3;opacity:.8;background:radial-gradient(circle 2.5px,rgba(255,255,255,.9) 90%,transparent) 0 0/9px 9px,#f472b6}

${s('rozet')}::before{${kaplama}top:-10px;left:-10px;width:30px;height:30px;border-radius:50%;z-index:3;background:radial-gradient(circle at 35% 30%,#fff7c2,#f5c518 45%,#a16207);box-shadow:0 0 0 3px var(--axt-vurgu),0 4px 8px rgba(0,0,0,.45);animation:axt-k-rozet 4s ease-in-out infinite}
${s('rozet')}::after{${kaplama}top:12px;left:-4px;width:20px;height:28px;z-index:2;background:linear-gradient(90deg,var(--axt-vurgu) 0 50%,#ef4444 50%);clip-path:polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)}
@keyframes axt-k-neon{0%,100%{opacity:1}8%,12%{opacity:.35}10%{opacity:.9}}
@keyframes axt-k-sakiz{0%,100%{transform:scale(1,1)}50%{transform:scale(1.015,.985)}}
${s('terminal')}::before{${kaplama}top:-16px;left:10px;width:9px;height:9px;border-radius:50%;z-index:3;background:#ef4444;box-shadow:15px 0 0 #f59e0b,30px 0 0 #22c55e}
${s('terminal')}::after{${kaplama}right:12px;bottom:10px;width:9px;height:16px;z-index:3;background:var(--axt-vurgu);animation:axt-k-ampul 1.1s steps(1) infinite}
${s('gazete')}::before{${kaplama}left:10px;right:10px;top:4px;height:1px;z-index:2;background:currentColor;opacity:.45}
${s('gazete')}::after{${kaplama}right:10px;top:-14px;padding:1px 6px;z-index:3;content:"SON DAKİKA";font:800 9px/12px sans-serif;letter-spacing:1px;color:#fff;background:#b91c1c}
${s('neontabela')}::before{${kaplama}inset:-3px;border-radius:inherit;z-index:-1;box-shadow:0 0 26px var(--axt-vurgu);animation:axt-k-neon 5s linear infinite}
${s('karton')}::before{${kaplama}top:0;left:50%;width:34%;height:14px;translate:-50% 0;z-index:3;background:linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,.12)),#d9b98a;box-shadow:0 1px 2px rgba(0,0,0,.25)}
${s('karton')}::after{${kaplama}right:10px;bottom:6px;z-index:3;content:"BU TARAF ÜSTE";font:700 8px/10px sans-serif;letter-spacing:1px;color:rgba(43,26,10,.55)}
${s('mermer')}::before{${kaplama}inset:4px;border-radius:3px;z-index:-1;border:1px solid var(--axt-vurgu);opacity:.5}
${s('sakiz')}{animation:axt-k-sakiz 7s ease-in-out infinite}
${s('sakiz')}::after{${kaplama}top:10px;right:16%;width:14px;height:8px;border-radius:50%;z-index:3;background:rgba(255,255,255,.65);rotate:-25deg}
`;

/** Kuralları belgeye bir kez ekler (main.tsx). */
export function kabukStiliniEkle(): void {
  if (typeof document === 'undefined' || document.getElementById('axt-kabuklar')) return;
  const el = document.createElement('style');
  el.id = 'axt-kabuklar';
  el.textContent = KABUK_CSS;
  document.head.appendChild(el);
}
