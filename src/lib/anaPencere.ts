/**
 * Ana pencerenin konum/boyut kalıcılığı: kayıtlı konum ekranların hiçbirinde değilse ana monitöre alınır (çoklu
 * monitör sökülünce pencere görünmez yerde kalmasın).
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

type AnaPencere = { x: number; y: number; g: number; y2: number; buyuk: boolean };

/** Kayıtlı ana pencere durumunu doğrular (bozuk/aşırı değerler yok sayılır) */
export function anaPencereOku(metin: string | null): AnaPencere | null {
  try {
    const v = JSON.parse(metin ?? "null") as Partial<AnaPencere> | null;
    if (!v || ![v.x, v.y, v.g, v.y2].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    if (v.g! < 640 || v.y2! < 480 || v.g! > 16384 || v.y2! > 16384) return null;
    return { x: v.x!, y: v.y!, g: v.g!, y2: v.y2!, buyuk: !!v.buyuk };
  } catch {
    return null;
  }
}

/**
 * Ana pencerenin konum/boyut/büyütülmüş durumunu hatırlar (OBS gibi): açılışta geri yükler (ekranda değilse ana
 * monitöre), sonra değişiklikleri (yarım saniye gecikmeli) kaydeder. Yalnız masaüstü uygulamasında.
 */
export async function anaPencereyiHatirla(): Promise<() => void> {
  if (!isTauri()) return () => {};
  const ANAHTAR = "studio.pencere.ana";
  const { getCurrentWindow, LogicalPosition, LogicalSize } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  if (w.label !== "main") return () => {};
  try {
    const k = anaPencereOku(localStorage.getItem(ANAHTAR));
    if (k) {
      const mantiksal = (await monitorler()).map((e) => ({ ...e, x: e.x / e.olcek, y: e.y / e.olcek, genislik: e.genislik / e.olcek, yukseklik: e.yukseklik / e.olcek }));
      const p = gorunurKonum({ x: k.x, y: k.y }, mantiksal);
      await w.setSize(new LogicalSize(k.g, k.y2));
      await w.setPosition(new LogicalPosition(p.x, p.y));
      if (k.buyuk) await w.maximize();
    }
  } catch {
    /* izin ya da depolama yok: varsayılan konum */
  }
  let zaman: number | undefined;
  const kaydet = () => {
    window.clearTimeout(zaman);
    zaman = window.setTimeout(async () => {
      try {
        const [buyuk, olcek] = await Promise.all([w.isMaximized(), w.scaleFactor()]);
        // Büyütülmüşken boyut kaydedilmez (geri küçültünce eski boyut kalsın)
        const eski = anaPencereOku(localStorage.getItem(ANAHTAR));
        if (buyuk && eski) return localStorage.setItem(ANAHTAR, JSON.stringify({ ...eski, buyuk: true }));
        const [p, s] = await Promise.all([w.outerPosition(), w.innerSize()]);
        localStorage.setItem(ANAHTAR, JSON.stringify({ x: Math.round(p.x / olcek), y: Math.round(p.y / olcek), g: Math.round(s.width / olcek), y2: Math.round(s.height / olcek), buyuk }));
      } catch {
        /* yoksay */
      }
    }, 500);
  };
  const kaldir = await Promise.all([w.onMoved(kaydet), w.onResized(kaydet)]);
  return () => kaldir.forEach((f) => f());
}
