/**
 * WID-1: StreamElements widget'ını zip (ya da ayrı dosyalar) olarak içe alma.
 * Zip, tarayıcının yerleşik DecompressionStream'iyle açılır (bağımlılık yok); yalnız "stored" ve "deflate".
 */
import type { OzelWidget, SeAlan } from './ozelWidget.js';

export interface Dosya {
  ad: string;
  metin: string;
}

async function inflate(veri: Uint8Array): Promise<Uint8Array> {
  const akis = new Blob([new Uint8Array(veri)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(akis).arrayBuffer());
}

/** Zip'in merkezi dizininden metin dosyalarını okur (en çok 5 MB'lık dosyalar) */
export async function zipAc(tampon: ArrayBuffer): Promise<Dosya[]> {
  const b = new Uint8Array(tampon);
  const v = new DataView(tampon);
  // Merkezi dizin sonu kaydı (sondan geriye)
  let son = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      son = i;
      break;
    }
  }
  if (son < 0) throw new Error('Zip dosyası okunamadı');
  const adet = v.getUint16(son + 10, true);
  let p = v.getUint32(son + 16, true);
  const cozucu = new TextDecoder();
  const dosyalar: Dosya[] = [];
  for (let k = 0; k < adet; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Zip dizini bozuk');
    const yontem = v.getUint16(p + 10, true);
    const sikisik = v.getUint32(p + 20, true);
    const acik = v.getUint32(p + 24, true);
    const adUz = v.getUint16(p + 28, true);
    const ekUz = v.getUint16(p + 30, true);
    const notUz = v.getUint16(p + 32, true);
    const yerel = v.getUint32(p + 42, true);
    const ad = cozucu.decode(b.subarray(p + 46, p + 46 + adUz));
    p += 46 + adUz + ekUz + notUz;
    if (ad.endsWith('/') || ad.startsWith('__MACOSX/') || acik > 5 * 1024 * 1024) continue;
    const veriBas = yerel + 30 + v.getUint16(yerel + 26, true) + v.getUint16(yerel + 28, true);
    const ham = b.subarray(veriBas, veriBas + sikisik);
    const icerik = yontem === 0 ? ham : yontem === 8 ? await inflate(ham) : null;
    if (icerik) dosyalar.push({ ad, metin: cozucu.decode(icerik) });
  }
  return dosyalar;
}

/** Dosya adlarına bakarak SE parçalarını ayırır: .html, .css, .js; JSON adında "data" geçiyorsa değerler, yoksa alanlar */
export function seParcalari(dosyalar: Dosya[], ad = 'İçe alınan widget'): OzelWidget {
  const uzanti = (u: string) => dosyalar.find((d) => d.ad.toLowerCase().endsWith(u));
  const html = uzanti('.html') ?? uzanti('.htm');
  const css = uzanti('.css');
  const js = uzanti('.js');
  let alanlar: Record<string, SeAlan> = {};
  let veri: Record<string, unknown> = {};
  for (const d of dosyalar.filter((x) => x.ad.toLowerCase().endsWith('.json'))) {
    let j: unknown;
    try {
      j = JSON.parse(d.metin);
    } catch {
      throw new Error(`${d.ad}: geçersiz JSON`);
    }
    if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
    const taban = d.ad.split('/').pop()!.toLowerCase();
    if (taban.includes('data')) veri = j as Record<string, unknown>;
    else alanlar = j as Record<string, SeAlan>;
  }
  if (!html && !js) throw new Error('Zip içinde .html ya da .js dosyası yok');
  const kok = (html ?? js)!.ad.split('/');
  return {
    ad: kok.length > 1 ? kok[kok.length - 2] : ad,
    html: html?.metin ?? '',
    css: css?.metin ?? '',
    js: js?.metin ?? '',
    alanlar,
    veri
  };
}
