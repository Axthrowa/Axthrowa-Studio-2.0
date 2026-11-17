/**
 * AxthrowA Studio ile gömülü AxBoT arasındaki iletiler (T2). Tam liste ve yönler:
 * AxthrowA Studio deposunda docs/GOMULU_SOZLESME.md. Tema iletisi lib/studioTemasi.ts içinde.
 */

/** Bot → Studio: Esc ile odak çerçeveden çıkıp Studio menüsüne döner */
export const ODAK_BIRAK = 'axbot:odak-birak';
/** Bot → Studio: bot sunucusu kapandı, Studio başlatsın (UI-5; yalnız Studio çerçevesinde anlamlı) */
export const BOT_BASLAT = 'axbot:baslat';
/** Bot içinde geri alma isteği (Ctrl+Z ya da Studio'dan gelen `geri-al`) bu pencere olayıyla dağılır */
export const GERI_AL_OLAYI = 'axbot:geri-al';

export type StudioIstegi = { tur: 'ayara-git'; ayar: string; sekme?: string } | { tur: 'geri-al' };

const METIN = /^[^<>\n]{1,80}$/;

/** Studio'dan gelen iletiyi doğrular; tanınmayan ya da bozuk ileti `null`. */
export function studioIstegiCoz(veri: unknown): StudioIstegi | null {
  if (!veri || typeof veri !== 'object') return null;
  const v = veri as { tur?: unknown; ayar?: unknown; sekme?: unknown };
  if (v.tur === 'geri-al') return { tur: 'geri-al' };
  if (v.tur !== 'ayara-git' || typeof v.ayar !== 'string' || !METIN.test(v.ayar)) return null;
  const sekme = typeof v.sekme === 'string' && METIN.test(v.sekme) ? v.sekme : undefined;
  return sekme ? { tur: 'ayara-git', ayar: v.ayar, sekme } : { tur: 'ayara-git', ayar: v.ayar };
}

/** Studio'nun ayar dizini bu öğelerin yazısından üretilir (scripts/ayar-dizini.mjs) */
const AYAR_SECICI = 'label, legend, h2, h3, h4, summary, button, [role="tab"]';
export const metniDuzle = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();

/** Adaylardan yazısı ayarın adıyla aynı olanı seçer; aynı ad birkaç kez geçerse ilki */
export function ayarAdayiSec<T extends { textContent: string | null }>(adaylar: T[], ad: string): T | undefined {
  const hedef = metniDuzle(ad);
  return adaylar.find((e) => metniDuzle(e.textContent) === hedef);
}

/** Sayfa yüklendikten sonra ayar görünmüyorsa iç sekmeler sırayla açılır (Studio dizini iç sekmeyi bilmez) */
const SEKME_GEZ_BASLA = 4;

/** Ayarı bulur (gerekirse sekmesini açar), görünür yere kaydırır, vurgular ve denetimine odaklanır. Sayfa geç gelirse ~3 sn dener. */
export function ayaraGit(ad: string, sekme?: string, deneme = 0, ilkSekme?: HTMLElement | null): void {
  const bul = (metin: string) => ayarAdayiSec([...document.querySelectorAll<HTMLElement>(AYAR_SECICI)], metin);
  if (sekme && deneme === 0) bul(sekme)?.click();
  const el = bul(ad);
  if (!el) {
    const tablar = [...document.querySelectorAll<HTMLElement>('main [role="tab"]')];
    if (deneme === SEKME_GEZ_BASLA) ilkSekme = tablar.find((t) => t.getAttribute('aria-selected') === 'true') ?? null;
    if (deneme < 20) {
      if (!sekme && deneme >= SEKME_GEZ_BASLA) tablar[deneme - SEKME_GEZ_BASLA]?.click();
      window.setTimeout(() => ayaraGit(ad, sekme, deneme + 1, ilkSekme), 150);
    } else ilkSekme?.click(); // bulunamadı: kullanıcı başladığı sekmeye döner
    return;
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('axt-ayar-vurgu');
  window.setTimeout(() => el.classList.remove('axt-ayar-vurgu'), 1800);
  // Etiketin kendi denetimi, yoksa aynı kart ya da bölümdeki ilk denetim
  const DENETIM = 'input:not([type="hidden"]), select, textarea, button';
  const denetim = el.matches('button, summary, [role="tab"]')
    ? el
    : (el.querySelector<HTMLElement>(DENETIM) ?? el.closest('.glass-panel, section, fieldset, form')?.querySelector<HTMLElement>(DENETIM));
  denetim?.focus({ preventScroll: true });
}
