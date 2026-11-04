/**
 * AxBoT — widget ayar kanalı (sayfa başına TEK WebSocket)
 * Developed by AxthrowA
 *
 * Kullanıcı bildirdi: "Overlay Stüdyo'da yaptığım değişiklikler OBS'e
 * yansımıyor." Sebeplerinden biri: her widget ayarlarını kendi açtığı bir
 * WebSocket'ten dinliyordu ve bu soket KOPUNCA YENİDEN BAĞLANMIYORDU. OBS
 * tarayıcı kaynakları saatlerce açık kalır; AxBoT bir kez yeniden
 * başlayınca (panel yeniden açıldı, güncelleme geldi…) sonraki tüm ayar
 * değişiklikleri o kaynağa hiç ulaşmıyordu. Ayrıca tek tuvalde 14 widget = 14
 * ayrı soket demekti.
 *
 * Artık: tek soket, kopunca yeniden bağlanır; yeniden bağlanınca her widget
 * ayarını sunucudan TAZELER (kopukken kaydedilenler kaybolmaz). OBS sayfası
 * (/widgets, /overlay) yeniden bağlandığında sunucuda yeni bir sürüm varsa
 * kendini yeniler — güncellemeden sonra OBS'te elle "Yenile" gerekmez.
 */
import { wsAdresi } from './widget-style.js';
import { KaliciSoket } from './kaliciSoket.js';

export interface AyarDinleyicisi {
  widgetId: string;
  /** Sunucu bu widget'ın ayarını değiştirdi (canlı). */
  ayar: (ayarlar: Record<string, unknown>) => void;
  /** Bağlantı koptu ve geri geldi: ayarı sunucudan yeniden oku. */
  tazele: () => void;
}

/** Tek tuval yerleşimini (`all_in_one_overlay_settings`) dinlemek için ayrılmış kimlik. */
export const YERLESIM_KIMLIGI = '__tek-tuval-yerlesimi__';

const dinleyiciler = new Set<AyarDinleyicisi>();
let soket: KaliciSoket | null = null;

/** index.html'deki ana paket adresi (Vite her derlemede adı değiştirir). */
export function anaPaketAdresi(html: string): string | null {
  const m = html.match(/<script[^>]*\bsrc="([^"]*\/assets\/index-[^"]+\.js)"/);
  return m ? m[1] : null;
}

/** OBS'te açık kalan sayfalar mı (yeniden yükleme yalnız bunlarda yapılır). */
export function obsSayfasiMi(yol: string): boolean {
  return /^\/(widgets|overlay)(\/|$|\?)/.test(yol);
}

async function surumDenetle() {
  if (!obsSayfasiMi(window.location.pathname)) return;
  const simdiki = [...document.querySelectorAll('script[src]')]
    .map((s) => s.getAttribute('src') || '')
    .find((s) => /\/assets\/index-[^/]+\.js$/.test(s));
  if (!simdiki) return; // geliştirme sunucusu (vite dev): paket adı yok
  try {
    const html = await fetch('/', { cache: 'no-store' }).then((r) => r.text());
    const yeni = anaPaketAdresi(html);
    if (yeni && yeni !== simdiki) window.location.reload();
  } catch {
    /* sunucu henüz hazır değil; bir sonraki bağlanmada yeniden bakılır */
  }
}

function baglan() {
  const ws = new KaliciSoket(wsAdresi('all'));
  soket = ws;
  ws.onyenidenbaglandi = () => {
    for (const d of dinleyiciler) d.tazele();
    void surumDenetle();
  };
  ws.onmessage = (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg?.type === 'widget_settings' && msg.widgetId && msg.settings) {
      for (const d of dinleyiciler) if (d.widgetId === msg.widgetId) d.ayar(msg.settings);
    } else if (msg?.type === 'all_in_one_overlay_settings' && msg.config) {
      for (const d of dinleyiciler) if (d.widgetId === YERLESIM_KIMLIGI) d.ayar(msg.config);
    }
  };
}

/** Kanala katıl; dönen işlev ayrılır. Son dinleyici ayrılınca soket kapanır. */
export function ayarKanalinaKatil(d: AyarDinleyicisi): () => void {
  dinleyiciler.add(d);
  if (!soket) baglan();
  return () => {
    dinleyiciler.delete(d);
    if (dinleyiciler.size) return;
    soket?.close();
    soket = null;
  };
}
