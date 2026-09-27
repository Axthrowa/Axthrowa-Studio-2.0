/**
 * Projektör ve ayrı pencereler: Tauri'de yeni bir webview penceresi (istenirse seçilen monitörde tam ekran), tarayıcıda
 * yeni sekme. Kayıtlı pencere konumu ekranların hiçbirinde değilse ana monitöre alınır (çoklu monitör sökülünce
 * pencere görünmez yerde kalmasın).
 */
import { isTauri } from "@tauri-apps/api/core";

export type Monitor = { ad: string; x: number; y: number; genislik: number; yukseklik: number; olcek: number };

export async function monitorler(): Promise<Monitor[]> {
  if (!isTauri()) return [];
  const { availableMonitors } = await import("@tauri-apps/api/window");
  const m = await availableMonitors();
  return m.map((x, i) => ({ ad: x.name ?? `Monitör ${i + 1}`, x: x.position.x, y: x.position.y, genislik: x.size.width, yukseklik: x.size.height, olcek: x.scaleFactor }));
}

/** Konum hiçbir monitörün içinde değilse ilk monitörün sol üstüne yakın bir konum döner */
export function gorunurKonum(konum: { x: number; y: number }, ekranlar: Monitor[]): { x: number; y: number } {
  const icinde = ekranlar.some((m) => konum.x >= m.x && konum.x < m.x + m.genislik && konum.y >= m.y && konum.y < m.y + m.yukseklik);
  if (icinde || !ekranlar.length) return konum;
  return { x: ekranlar[0].x + 80, y: ekranlar[0].y + 80 };
}

/** Ayrı pencerenin konumunu kaydeder (pencere kapanırken, kendi içinden) */
export async function konumuKaydet(etiket: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    const [p, olcek] = await Promise.all([w.outerPosition(), w.scaleFactor()]);
    localStorage.setItem(`yya.pencere.${etiket}`, JSON.stringify({ x: Math.round(p.x / olcek), y: Math.round(p.y / olcek) }));
  } catch {
    /* izin ya da depolama yok: konum hatırlanmaz */
  }
}

/**
 * Ayrı pencere açar. `yol`: uygulama içi rota (ör. `/projektor?tuval=ana`). `monitor` verilirse o monitörde tam
 * ekran. Aynı etiketle açık pencere varsa öne getirilir.
 */
export async function ayriPencere(etiket: string, yol: string, baslik: string, secenek: { monitor?: Monitor; genislik?: number; yukseklik?: number } = {}): Promise<void> {
  if (!isTauri()) {
    window.open(yol, `_${etiket}`, `width=${secenek.genislik ?? 960},height=${secenek.yukseklik ?? 540}`);
    return;
  }
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const var_olan = await WebviewWindow.getByLabel(etiket);
  if (var_olan) {
    await var_olan.setFocus();
    return;
  }
  const m = secenek.monitor;
  // Hatırlanan konum (ayrı dock); ekranlardan birinde değilse ana monitöre alınır
  let konum: { x: number; y: number } | null = null;
  if (!m) {
    try {
      const k = JSON.parse(localStorage.getItem(`yya.pencere.${etiket}`) ?? "null") as { x: number; y: number } | null;
      // Kayıtlı konum mantıksal piksel: monitörler de mantıksal birime çevrilir
      const mantiksal = (await monitorler()).map((e) => ({ ...e, x: e.x / e.olcek, y: e.y / e.olcek, genislik: e.genislik / e.olcek, yukseklik: e.yukseklik / e.olcek }));
      if (k && Number.isFinite(k.x) && Number.isFinite(k.y)) konum = gorunurKonum(k, mantiksal);
    } catch {
      konum = null;
    }
  }
  const w = new WebviewWindow(etiket, {
    url: yol,
    title: baslik,
    width: secenek.genislik ?? 960,
    height: secenek.yukseklik ?? 540,
    ...(m ? { x: m.x / m.olcek + 40, y: m.y / m.olcek + 40, fullscreen: true, decorations: false } : konum ? { x: konum.x, y: konum.y } : { center: true }),
  });
  await new Promise<void>((tamam, hata) => {
    void w.once("tauri://created", () => tamam());
    void w.once("tauri://error", (e) => hata(new Error(String(e.payload))));
  });
}
