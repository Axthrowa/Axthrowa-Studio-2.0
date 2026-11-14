/**
 * U9 ayrılabilir paneller: Canlı ekranındaki sohbet, etkinlik, uyarı kuyruğu ve mikser `/dock?id=…` sayfasıyla
 * ayrı pencerede açılır. Konum/boyut ve "ayrık mı" bilgisi saklanır; uygulama yeniden açılınca pencere aynı yerde
 * açılır, pencere kapanınca panel Canlı ekranına döner. Pencereyi ana pencere izler (ayrık pencerenin IPC izni yok).
 */
import { create } from "zustand";
import { isTauri } from "@tauri-apps/api/core";
import { gorunurKonum, monitorler } from "./anaPencere";

export const AYRILABILIR = { sohbet: "Çoklu Sohbet", etkinlik: "Etkinlik Akışı", uyarilar: "Uyarı Kuyruğu", mikser: "Ses Karıştırıcısı" } as const;
export type AyrikId = keyof typeof AYRILABILIR;

type Geometri = { x: number; y: number; g: number; y2: number };
type Kayit = Partial<Record<AyrikId, { acik: boolean; geo?: Geometri }>>;
const ANAHTAR = "studio.ayrikPaneller";

/** Bozuk kayıt ya da bilinmeyen panel yok sayılır */
export function kayitOku(metin: string | null): Kayit {
  try {
    const v = JSON.parse(metin ?? "{}") as Record<string, { acik?: unknown; geo?: Partial<Geometri> }>;
    const out: Kayit = {};
    for (const id of Object.keys(AYRILABILIR) as AyrikId[]) {
      const k = v?.[id];
      if (!k || typeof k !== "object") continue;
      const g = k.geo;
      const gecerli = g && [g.x, g.y, g.g, g.y2].every((n) => typeof n === "number" && Number.isFinite(n)) && g.g! >= 200 && g.y2! >= 150;
      out[id] = { acik: k.acik === true, geo: gecerli ? (g as Geometri) : undefined };
    }
    return out;
  } catch {
    return {};
  }
}

function oku(): Kayit {
  try {
    return kayitOku(localStorage.getItem(ANAHTAR));
  } catch {
    return {};
  }
}
function yaz(k: Kayit) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(k));
  } catch {
    /* depolama yok */
  }
}

export const useAyrikPaneller = create<{ ayrik: AyrikId[] }>(() => ({
  ayrik: (Object.keys(oku()) as AyrikId[]).filter((id) => oku()[id]?.acik && isTauri()),
}));

function isaretle(id: AyrikId, acik: boolean, geo?: Geometri) {
  const k = oku();
  k[id] = { acik, geo: geo ?? k[id]?.geo };
  yaz(k);
  const s = new Set(useAyrikPaneller.getState().ayrik);
  if (acik) s.add(id);
  else s.delete(id);
  useAyrikPaneller.setState({ ayrik: [...s] });
}

const etiket = (id: AyrikId) => `dock-${id}`;
// Aynı etiketle ikinci pencere hata verir (çift tık, StrictMode çift etkisi); açılmakta olanı tekrar açma
const aciliyor = new Set<AyrikId>();
let geriAcildi = false;

export async function panelAyir(id: AyrikId): Promise<void> {
  if (!isTauri()) {
    // Tarayıcıda yalnız açılır pencere; konum hatırlanmaz
    window.open(`/dock?id=${id}`, etiket(id), "popup,width=420,height=640");
    return;
  }
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const { LogicalPosition } = await import("@tauri-apps/api/window");
  if (aciliyor.has(id)) return;
  const varolan = await WebviewWindow.getByLabel(etiket(id));
  if (varolan) {
    await varolan.setFocus().catch(() => {});
    return;
  }
  aciliyor.add(id);
  const geo = oku()[id]?.geo;
  const w = new WebviewWindow(etiket(id), {
    // Ana pencere yerel sunucudan yüklenir; dock da aynı kökenden (API adresi aynı kalsın)
    url: `${window.location.origin}/dock?id=${id}`,
    title: `${AYRILABILIR[id]} — AxthrowA Studio`,
    width: geo?.g ?? 420,
    height: geo?.y2 ?? 640,
  });
  isaretle(id, true);
  w.once("tauri://created", async () => {
    aciliyor.delete(id);
    if (geo) {
      // Monitör sökülmüşse ana monitöre al
      const ekranlar = (await monitorler()).map((e) => ({ ...e, x: e.x / e.olcek, y: e.y / e.olcek, genislik: e.genislik / e.olcek, yukseklik: e.yukseklik / e.olcek }));
      const p = gorunurKonum({ x: geo.x, y: geo.y }, ekranlar);
      await w.setPosition(new LogicalPosition(p.x, p.y)).catch(() => {});
    }
    let zaman: number | undefined;
    const kaydet = () => {
      window.clearTimeout(zaman);
      zaman = window.setTimeout(async () => {
        try {
          const [olcek, p, s] = await Promise.all([w.scaleFactor(), w.outerPosition(), w.innerSize()]);
          isaretle(id, true, { x: Math.round(p.x / olcek), y: Math.round(p.y / olcek), g: Math.round(s.width / olcek), y2: Math.round(s.height / olcek) });
        } catch {
          /* pencere kapanıyor */
        }
      }, 500);
    };
    const kaldir = await Promise.all([w.onMoved(kaydet), w.onResized(kaydet)]);
    // Yalnız kullanıcı kapatınca panel yerine döner; uygulama kapanırken pencere ayrık kalır (açılışta geri gelir)
    await w.onCloseRequested(() => {
      window.clearTimeout(zaman);
      kaldir.forEach((f) => f());
      isaretle(id, false);
    });
  });
  w.once("tauri://error", () => {
    aciliyor.delete(id);
    isaretle(id, false);
  });
}

/** Panel yerine dönsün: pencereyi kapatır (kapanınca kayıt da düşer) */
export async function paneliGeriAl(id: AyrikId): Promise<void> {
  if (isTauri()) {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const w = await WebviewWindow.getByLabel(etiket(id));
    if (w) return void (await w.close().catch(() => isaretle(id, false)));
  }
  isaretle(id, false);
}

/** Açılışta: önceki oturumda ayrık kalan panelleri aynı yerde yeniden açar */
export async function ayrikPencereleriGeriAc(): Promise<void> {
  if (!isTauri() || geriAcildi) return;
  geriAcildi = true;
  const k = oku();
  for (const id of Object.keys(k) as AyrikId[]) if (k[id]?.acik) await panelAyir(id).catch(() => isaretle(id, false));
}
