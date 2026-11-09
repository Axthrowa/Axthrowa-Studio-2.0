import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANIM_SECENEKLERI, SUREKLI_EFEKTLER, animasyonCss, efektAnimasyonu, eskiHareketiCevir, ortakHareket } from './animations';
import { KABUK_CSS, YAPISAL_KABUKLAR, kokOzellik } from './kabuklar';
import { KUTU_TASARIMLARI, kartTasarimlari } from './widget-style';
import { GENEL_TEMALAR, renkKaristir, temayiUygula } from './themes';
import { WIDGET_DEFAULTS } from './widget-defaults';
import { olayYoksaGenel } from './alertQueue';

describe('ortak hareket', () => {
  it('giriş seçilen süreyle oynar, sürekli efekt girişten sonra başlar', () => {
    const a = ortakHareket({ animation: 'zoom', animationDuration: 300, surekliEfekt: 'nabiz', efektSuresi: 3 }).animation!;
    expect(a).toContain('axt-on-zoom 300ms');
    expect(a).toContain('axt-efekt-nabiz 3s');
    expect(a).toContain('300ms infinite');
  });

  it('kapalı ve bilinmeyen değerde widget çökmez', () => {
    expect(ortakHareket({ animation: 'none', surekliEfekt: 'none' })).toEqual({});
    expect(ortakHareket({ animation: 'none', surekliEfekt: 'yokboyle' })).toEqual({});
    expect(ortakHareket({ animation: 'yokboyle' }).animation).toContain('axt-on-fade');
    expect(ortakHareket({}).animation).toContain('axt-on-fade');
  });

  it('çarkta giriş ayrı anahtardan okunur: animation dönüş eğrisidir', () => {
    const a = ortakHareket({ animation: 'ease-out', girisAnimasyonu: 'flipX' }).animation!;
    expect(a).toContain('axt-on-flipX');
  });

  it('eski sonsuz pulse: giriş olmaz, yanıp sönmeye çevrilir', () => {
    expect(ortakHareket({ animation: 'pulse' }).animation).toContain('axt-efekt-nefes');
    expect(ortakHareket({ animation: 'pulse' }).animation).not.toContain('axt-on-');
    expect(eskiHareketiCevir({ animation: 'pulse', surekliEfekt: 'none' })).toMatchObject({ animation: 'none', surekliEfekt: 'nefes' });
    expect(eskiHareketiCevir({ animation: 'zoom', surekliEfekt: 'none' })).toMatchObject({ animation: 'zoom', surekliEfekt: 'none' });
  });

  it('istenirse yalnız giriş ya da yalnız efekt üretilir', () => {
    const s = { animation: 'zoom', surekliEfekt: 'nabiz' };
    expect(ortakHareket(s, { efekt: false }).animation).not.toContain('axt-efekt-');
    expect(ortakHareket(s, { giris: false }).animation).not.toContain('axt-on-');
    expect(efektAnimasyonu('yokboyle', 2)).toBeUndefined();
  });

  it('her giriş ve efektin CSS karşılığı var; kimlikler tekrarlanmaz', () => {
    const css = animasyonCss();
    for (const { value } of ANIM_SECENEKLERI) if (value !== 'none') expect(css).toContain(`@keyframes axt-on-${value}{`);
    for (const { value } of SUREKLI_EFEKTLER) if (value !== 'none') expect(css).toContain(`@keyframes axt-efekt-${value}{`);
    expect(new Set(ANIM_SECENEKLERI.map((o) => o.value)).size).toBe(ANIM_SECENEKLERI.length);
    expect(ANIM_SECENEKLERI.length).toBeGreaterThanOrEqual(55);
    expect(SUREKLI_EFEKTLER.length).toBeGreaterThanOrEqual(10);
  });
});

describe('ortak kapatma ayarları', () => {
  it('yalnız açık olan işaret yazılır', () => {
    expect(kokOzellik({})).toEqual({});
    expect(kokOzellik({ arkaPlanKapali: true, golgeKapali: true })).toEqual({ 'data-arka-yok': '', 'data-golge-yok': '' });
    expect(kokOzellik({ cerceveKapali: true })).toEqual({ 'data-cerceve-yok': '' });
  });

  it('yapısal tema işaretini yalnız bilinen tasarımda yazar', () => {
    expect(kokOzellik({ kabuk: 'crt' })).toEqual({ 'data-axt-kabuk': 'crt' });
    expect(kokOzellik({ kabuk: 'sivicam' })).toEqual({});
    expect(kokOzellik({ kabuk: '"><script>' })).toEqual({});
  });

  it('her widget ortak ayarları taşır; kutusu olmayanlar arka plan seçeneği sunmaz', () => {
    for (const [id, d] of Object.entries(WIDGET_DEFAULTS)) {
      expect(d, id).toHaveProperty('surekliEfekt');
      expect(d, id).toHaveProperty('animationDuration');
      expect(d, id).toHaveProperty('golgeKapali');
      if (id === 'on-screen-emotes' || id === 'emote-combo' || id === 'jumpscare') continue;
      expect(d, id).toHaveProperty('arkaPlanKapali');
      expect(d, id).toHaveProperty('cerceveKapali');
    }
    expect(WIDGET_DEFAULTS['wheel-of-fortune']).toHaveProperty('girisAnimasyonu');
  });
});

describe('yapısal temalar', () => {
  it('her tema seçilebilir, CSS kuralı ve hazır tema kaydı vardır', () => {
    const secenek = new Set(KUTU_TASARIMLARI.map((k) => k.value));
    const temalar = kartTasarimlari({ bgColor: '#000000', accentColor: '#ffffff' });
    expect(YAPISAL_KABUKLAR.length).toBeGreaterThanOrEqual(14);
    for (const { value } of YAPISAL_KABUKLAR) {
      expect(secenek.has(value), value).toBe(true);
      expect(temalar[value], value).toBeTruthy();
      expect(KABUK_CSS).toContain(`[data-axt-kabuk="${value}"]`);
      expect(GENEL_TEMALAR.some((t) => t.degerler.kabuk === value), value).toBe(true);
    }
  });

  it('temalar sözde öğeyle yapı ekler: yalnız renk değiştirmez', () => {
    for (const { value } of YAPISAL_KABUKLAR) expect(KABUK_CSS, value).toMatch(new RegExp(`data-axt-kabuk="${value}"\\]::(before|after)`));
  });
});

describe('widget kaynakları', () => {
  const kaynaklar = readdirSync(new URL('../widgets/', import.meta.url)).filter((f) => /Widget\.tsx$/.test(f));

  it('tanımsız hareket sınıfı kullanılmaz', () => {
    for (const f of kaynaklar) {
      const src = readFileSync(new URL(`../widgets/${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/animate-(fadeIn|in)\b/);
    }
  });

  it('izleyicinin gördüğü hareket yayıncının Windows ayarına bağlı değildir', () => {
    for (const f of kaynaklar) {
      expect(readFileSync(new URL(`../widgets/${f}`, import.meta.url), 'utf8'), f).not.toContain('prefers-reduced-motion');
    }
  });

  it('ortak ayarlar her görünür widget kökünde okunur', () => {
    const haric = new Set(['UnifiedOverlayWidget.tsx', 'ResonanceWidget.tsx', 'SoundBoardWidget.tsx', 'MuzikVideoWidget.tsx']);
    for (const f of kaynaklar.filter((x) => !haric.has(x))) {
      const src = readFileSync(new URL(`../widgets/${f}`, import.meta.url), 'utf8');
      expect(src, f).toContain('kokOzellik(');
      expect(src, f).toMatch(/ortakHareket\(|efektEkle\(|efektAnimasyonu\(/);
    }
  });
});

describe('uyarı olayı ve genel ayar', () => {
  it('olay hazır değerdeyse genel seçim uygulanır, olay kendi seçtiyse o kalır', () => {
    expect(olayYoksaGenel('bounce', 'jole', 'bounce')).toBe('jole');
    expect(olayYoksaGenel('zoom', 'jole', 'bounce')).toBe('zoom');
    expect(olayYoksaGenel(undefined, undefined, 'bounce')).toBe('bounce');
    expect(olayYoksaGenel('', 'jole', 'bounce')).toBe('jole');
  });
});

describe('eğlenceli hareketler ve yeni kabuklar', () => {
  const css = animasyonCss();
  const YENI_GIRIS = ['konfeti', 'miknatis', 'yaprak', 'balon', 'kart3b', 'isinlanma', 'damla', 'yay', 'zipzip', 'kagitAcilma', 'roket', 'kalpCarpinti', 'kasirga', 'savrulma'];
  const YENI_EFEKT = ['kipirdama', 'salinim', 'isiltiSupurme', 'yuzme', 'kalp', 'yorunge', 'nefesAl', 'bayrak'];
  const YENI_KABUK = ['arcade', 'kaset', 'polaroid', 'postit', 'piksel', 'ahsap', 'film', 'buz', 'washi', 'rozet'];
  const kare = (ad: string) => css.match(new RegExp(`@keyframes ${ad}\{(.*)\}$`, 'm'))?.[1] ?? '';

  it('yeni girişler görünür hâlde biter ve yerleşim özelliği oynatmaz', () => {
    for (const id of YENI_GIRIS) {
      const k = kare(`axt-on-${id}`);
      expect(k, id).toMatch(/100%\{opacity:1;transform:none\}$/);
      expect(k, id).not.toMatch(/(^|[{;])(width|height|top|left|right|bottom|margin[a-z-]*|padding[a-z-]*):/);
    }
  });

  it('yeni efektler seçilebilir ve yalnız transform/opacity/filter kullanır', () => {
    const secenek = new Set(SUREKLI_EFEKTLER.map((e) => e.value));
    for (const id of YENI_EFEKT) {
      expect(secenek.has(id), id).toBe(true);
      const ozellikler = [...kare(`axt-efekt-${id}`).matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(ozellikler.every((o) => ['transform', 'transform-origin', 'opacity', 'filter'].includes(o)), id).toBe(true);
    }
  });

  it('yeni kabuklar kayıtlı; kabuk hareketleri yalnız transform/opacity', () => {
    const kayitli = new Set(YAPISAL_KABUKLAR.map((k) => k.value));
    for (const id of YENI_KABUK) expect(kayitli.has(id), id).toBe(true);
    expect(new Set(KUTU_TASARIMLARI.map((k) => k.value)).size).toBe(KUTU_TASARIMLARI.length);
    for (const [, ad, govde] of KABUK_CSS.matchAll(/@keyframes (axt-k-[a-z0-9]+)\{(.*)\}$/gm)) {
      const ozellikler = [...govde.matchAll(/([a-z-]+):/g)].map((m) => m[1]);
      expect(ozellikler.every((o) => ['transform', 'opacity', 'rotate'].includes(o)), ad).toBe(true);
    }
  });

  it('opak hazır temalarda yazı zeminde okunur (≥ 4.5:1)', () => {
    const p = (h: string) => {
      const n = parseInt(h.slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255]
        .map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4))
        .reduce((t, v, i) => t + v * [0.2126, 0.7152, 0.0722][i], 0);
    };
    const k = (a: string, b: string) => { const [x, y] = [p(a), p(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
    const zayif = GENEL_TEMALAR.flatMap((t) => {
      const d = t.degerler;
      const zemin = hex(d.bgColor);
      const yazi = hex(d.textColor);
      return zemin && yazi && Number(d.bgOpacity ?? 1) >= 0.5 && k(yazi, zemin) < 4.5 ? [t.id] : [];
    });
    expect(zayif).toEqual([]);
  });
});

describe('genel temalar çubuğu da değiştirir', () => {
  it('hedef çubuğunda hiçbir renk alanı eski temada kalmaz, dolgu biçimi temadan temaya değişir', () => {
    for (const id of ['donation-goal', 'polls', 'sponsor-banner', 'lyrics', 'jumpscare', 'trivia', 'chat-overlay']) {
      const def = WIDGET_DEFAULTS[id];
      const renkler = Object.keys(def).filter((k) => /^#[0-9a-f]{3,8}$/i.test(String(def[k])));
      const degismeyen = renkler.filter((k) => GENEL_TEMALAR.every((t) => temayiUygula(def, t, Object.keys(def), () => true)[k] === def[k]));
      expect(degismeyen, id).toEqual([]);
    }
    const hedef = WIDGET_DEFAULTS['donation-goal'];
    const bicimler = new Set(GENEL_TEMALAR.map((t) => temayiUygula(hedef, t, Object.keys(hedef), () => true).barStyle));
    expect(bicimler.size).toBeGreaterThanOrEqual(6);
    const crt = temayiUygula(hedef, GENEL_TEMALAR.find((t) => t.id === 'yapi_crt')!, Object.keys(hedef), () => true);
    expect(crt).toMatchObject({ barStyle: 'segment', barRadius: 0, barColor: '#22c55e', barBackground: '#86efac29' });
  });

  it('temanın kendi verdiği çubuk değeri ezilmez; renk karıştırma doğru', () => {
    const t = { id: 'x', etiket: 'x', degerler: { accentColor: '#ff0000', barStyle: 'halka' }, onizleme: { arka: '', vurgu: '', metin: '' } };
    expect(temayiUygula({ barStyle: 'flat', barColor2: '#000000' }, t, ['barStyle', 'barColor2']).barStyle).toBe('halka');
    expect(renkKaristir('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(renkKaristir('#f00', 'yok', 0.5)).toBe('#ff0000');
  });
});
