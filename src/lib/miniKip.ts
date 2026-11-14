/**
 * U10 mini kip: ana pencere her zaman üstte dar bir şeride küçülür, çıkınca eski konum/boyutuna döner.
 * Mini kipteyken ana pencere konum kaydı (`anaPencereyiHatirla`) durur; yoksa küçük boyut kalıcı olurdu.
 */
import { isTauri } from "@tauri-apps/api/core";

export const MINI_BOYUT = { g: 520, y: 150 };
const TAM_EN_AZ = { g: 1024, y: 768 };

let onceki: { x: number; y: number; g: number; y2: number; buyuk: boolean } | null = null;
let acik = false;

export function miniKipAcik(): boolean {
  return acik;
}

/** "1:02:03" ya da "12:05" */
export function sureMetni(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const iki = (n: number) => String(n).padStart(2, "0");
  const sa = Math.floor(s / 3600);
  const dk = Math.floor((s % 3600) / 60);
  return sa ? `${sa}:${iki(dk)}:${iki(s % 60)}` : `${dk}:${iki(s % 60)}`;
}

export async function miniKipAyarla(mini: boolean): Promise<void> {
  if (mini === acik) return;
  acik = mini;
  if (!isTauri()) return;
  const { getCurrentWindow, LogicalPosition, LogicalSize } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  try {
    if (mini) {
      const [buyuk, olcek, p, s] = await Promise.all([w.isMaximized(), w.scaleFactor(), w.outerPosition(), w.innerSize()]);
      onceki = { x: p.x / olcek, y: p.y / olcek, g: s.width / olcek, y2: s.height / olcek, buyuk };
      if (buyuk) await w.unmaximize();
      await w.setMinSize(null);
      await w.setSize(new LogicalSize(MINI_BOYUT.g, MINI_BOYUT.y));
      await w.setAlwaysOnTop(true);
    } else {
      await w.setAlwaysOnTop(false);
      await w.setMinSize(new LogicalSize(TAM_EN_AZ.g, TAM_EN_AZ.y));
      if (onceki) {
        await w.setSize(new LogicalSize(Math.max(TAM_EN_AZ.g, onceki.g), Math.max(TAM_EN_AZ.y, onceki.y2)));
        await w.setPosition(new LogicalPosition(onceki.x, onceki.y));
        if (onceki.buyuk) await w.maximize();
      }
    }
  } catch {
    /* izin yoksa pencere olduğu gibi kalır; arayüz yine mini/tam çizilir */
  }
}
