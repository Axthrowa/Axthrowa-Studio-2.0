/**
 * WID-5: yerel yazı tipleri. Yüklenenler sunucunun `/api/fonts.css`'iyle her sayfaya gelir (OBS katmanı dahil);
 * yükleme/silme `yazi_tipleri` yayınıyla ayar kanalından duyurulur ve CSS yeniden çekilir.
 * Bilgisayarda kurulu yazı tipi adıyla kullanılır: OBS'in tarayıcısı sistem yazı tiplerini görür.
 */
import { useEffect, useState } from 'react';
import { ayarKanalinaKatil, obsSayfasiMi, YAZI_TIPI_KIMLIGI } from './ayarKanali.js';
import { yaziAilesi } from './widget-style.js';

export interface YuklenenYaziTipi {
  id: string;
  ad: string;
  bicim: string;
  boyut: number;
}

const BAG_KIMLIGI = 'axt-yazi-tipleri';
let surum = 0;
const dinleyiciler = new Set<() => void>();

/** Yazı tipi CSS bağlantısını kurar ya da (değişiklik sonrası) yeniler */
export function yaziTipiCssYenile(): void {
  if (typeof document === 'undefined') return;
  let bag = document.getElementById(BAG_KIMLIGI) as HTMLLinkElement | null;
  if (!bag) {
    bag = document.createElement('link');
    bag.id = BAG_KIMLIGI;
    bag.rel = 'stylesheet';
    document.head.appendChild(bag);
  }
  bag.href = `/api/fonts.css?v=${++surum}`;
  dinleyiciler.forEach((f) => f());
}

/** Açılışta bir kez: CSS + OBS sayfalarında canlı yenileme */
export function yaziTipleriniBaslat(): void {
  yaziTipiCssYenile();
  if (obsSayfasiMi(window.location.pathname)) {
    ayarKanalinaKatil({ widgetId: YAZI_TIPI_KIMLIGI, ayar: yaziTipiCssYenile, tazele: yaziTipiCssYenile });
  }
}

/** Ayar değeri → görünen ad: `"Ad", system-ui, sans-serif` → `Ad` */
export function yaziAdiCoz(deger: unknown): string {
  return String(deger ?? '').replace(/^"([^"]+)".*$/, '$1');
}

/** Panelde seçici için yüklenenlerin listesi (değişince tazelenir) */
export function useYuklenenYaziTipleri(): [YuklenenYaziTipi[], () => void] {
  const [liste, setListe] = useState<YuklenenYaziTipi[]>([]);
  useEffect(() => {
    let iptal = false;
    const yukle = () =>
      fetch('/api/fonts')
        .then((r) => (r.ok ? r.json() : { ogeler: [] }))
        .then((d) => !iptal && setListe(Array.isArray(d?.ogeler) ? d.ogeler : []))
        .catch(() => {});
    void yukle();
    // Yükleme bu panelden yapılır ve yaziTipiCssYenile listeyi tazeler; ayrı soket gerekmez
    dinleyiciler.add(yukle);
    return () => {
      iptal = true;
      dinleyiciler.delete(yukle);
    };
  }, []);
  return [liste, yaziTipiCssYenile];
}

/** Dosyayı sunucuya yükler; ayar değeri olarak kullanılacak aile değerini döner */
export async function yaziTipiYukle(dosya: File, ad: string): Promise<string> {
  const veri = await new Promise<string>((tamam, hata) => {
    const o = new FileReader();
    o.onload = () => tamam(String(o.result));
    o.onerror = () => hata(new Error('Dosya okunamadı'));
    o.readAsDataURL(dosya);
  });
  const r = await fetch('/api/fonts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad, veri }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.hata || 'Yazı tipi yüklenemedi');
  yaziTipiCssYenile();
  return yaziAilesi(j.oge.ad);
}

/** Bilgisayarda kurulu aileler (Local Font Access; destek ya da izin yoksa boş) */
export async function kuruluYaziTipleri(): Promise<string[]> {
  const sorgu = (window as any).queryLocalFonts as undefined | (() => Promise<Array<{ family: string }>>);
  if (!sorgu) return [];
  try {
    return [...new Set((await sorgu()).map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}
