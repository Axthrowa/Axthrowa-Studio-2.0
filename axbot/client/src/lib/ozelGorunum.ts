/**
 * WID-2: widget başına özel CSS ve uyarı kutusunun özel HTML şablonu.
 *
 * Özel CSS yalnız o widget'ın köküne kapsamlanır: her seçicinin önüne `[data-axt-css="…"]` eklenir, böylece
 * Tek URL sayfasında başka widget etkilenmez. (`@scope` / iç içe CSS OBS'in eski Chromium'unda yok.)
 *
 * Şablon HTML'i izin listesinden geçer: `<script>`, olay öznitelikleri, `javascript:` adresleri ve iframe çalışmaz.
 */

/** Kapsamın kendisi: `:kok` / `:root` / `&` widget kökünü gösterir */
function seciciKapsamla(secici: string, kok: string): string {
  return secici
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (/^(:kok|:root|html|body|&)$/.test(s)) return kok;
      const yeni = s.replace(/^(:kok|:root|html|body|&)(?=[\s>+~.:[#])/, kok);
      return yeni !== s ? yeni : `${kok} ${s}`;
    })
    .join(', ');
}

/** CSS'teki her kuralı `kok` seçicisinin altına alır; @media/@supports içine iner, @keyframes/@font-face olduğu gibi kalır. */
export function cssKapsamla(css: string, kok: string): string {
  // Yorumlar ve dış yükleme (@import) atılır; `</style>` stil etiketini kapatamasın
  const temiz = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;?/gi, '').replace(/<\/?style/gi, '');
  let cikti = '';
  let i = 0;
  const kuralOku = (bitis: number): void => {
    while (i < bitis) {
      const ac = temiz.indexOf('{', i);
      if (ac < 0 || ac >= bitis) {
        i = bitis;
        return;
      }
      const bas = temiz.slice(i, ac).trim();
      // Eşleşen kapanış
      let derinlik = 1;
      let j = ac + 1;
      while (j < temiz.length && derinlik) {
        if (temiz[j] === '{') derinlik++;
        else if (temiz[j] === '}') derinlik--;
        j++;
      }
      const govde = temiz.slice(ac + 1, j - 1);
      if (/^@(media|supports|container|layer)\b/i.test(bas)) {
        cikti += `${bas} {`;
        i = ac + 1;
        kuralOku(j - 1);
        i = j;
        cikti += '}\n';
        continue;
      }
      if (bas.startsWith('@')) cikti += `${bas} {${govde}}\n`;
      else if (bas) cikti += `${seciciKapsamla(bas, kok)} {${govde}}\n`;
      i = j;
    }
  };
  kuralOku(temiz.length);
  return cikti;
}

function ozet(metin: string): string {
  let h = 5381;
  for (let i = 0; i < metin.length; i++) h = ((h << 5) + h + metin.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Özel CSS'i sayfaya bir kez ekler ve köke yazılacak kimliği döner. Aynı CSS'i taşıyan widget'lar aynı stili paylaşır.
 * shortcut: CSS değişince eski <style> sayfada kalır (artık eşleşen kök yok, etkisiz); düzenleme sırasında birkaç KB.
 */
export function ozelCssKimligi(css: unknown): string | null {
  if (typeof css !== 'string' || !css.trim() || typeof document === 'undefined') return null;
  const id = ozet(css);
  if (!document.getElementById(`axt-css-${id}`)) {
    const el = document.createElement('style');
    el.id = `axt-css-${id}`;
    el.textContent = cssKapsamla(css, `[data-axt-css="${id}"]`);
    document.head.appendChild(el);
  }
  return id;
}

const IZINLI_ETIKET = new Set(
  'div span p b i u s em strong small br hr img h1 h2 h3 h4 h5 h6 ul ol li figure figcaption section header footer mark sub sup'.split(' ')
);
const IZINLI_OZNITELIK = new Set(['class', 'style', 'src', 'alt', 'title', 'width', 'height', 'id']);

function kacisla(m: unknown): string {
  return String(m ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Güvenli adres: http(s), göreli ya da görsel veri adresi */
function guvenliAdres(u: string): boolean {
  const t = u.trim().toLowerCase();
  return /^(https?:|\/|\.\/|data:image\/)/.test(t) || !/^[a-z][a-z0-9+.-]*:/.test(t);
}

function temizle(dugum: Element) {
  for (const c of [...dugum.children]) {
    const ad = c.tagName.toLowerCase();
    if (!IZINLI_ETIKET.has(ad)) {
      c.remove();
      continue;
    }
    for (const o of [...c.attributes]) {
      const oad = o.name.toLowerCase();
      if (!IZINLI_OZNITELIK.has(oad) && !oad.startsWith('data-')) c.removeAttribute(o.name);
      else if (oad === 'src' && !guvenliAdres(o.value)) c.removeAttribute(o.name);
      else if (oad === 'style' && /expression\(|javascript:/i.test(o.value)) c.removeAttribute(o.name);
    }
    temizle(c);
  }
}

export interface SablonDegerleri {
  ad?: string;
  metin?: string;
  tutar?: number | string;
  mesaj?: string;
  gorsel?: string;
}

/**
 * `{ad}`, `{metin}`, `{tutar}`, `{mesaj}`, `{gorsel}` yerleştirilir (değerler kaçışlanır: izleyici adı HTML taşıyamaz),
 * sonra izin listesinden geçer. DOMParser'da betik çalışmaz; çıkan HTML'de de betik kalmaz.
 */
export function uyariSablonuHtml(sablon: string, d: SablonDegerleri): string {
  const dolu = sablon.replace(/\{(ad|metin|tutar|mesaj|gorsel)\}/g, (_, k: keyof SablonDegerleri) => kacisla(d[k]));
  const belge = new DOMParser().parseFromString(`<div>${dolu}</div>`, 'text/html');
  const kok = belge.body.firstElementChild as Element;
  temizle(kok);
  return kok.innerHTML;
}
