/**
 * Windows bildirimi — yalnız pencere tepside ya da simge durumundayken. Pencere açıksa kullanıcı zaten
 * paneldeki uyarıyı görür; ikinci kez masaüstüne bildirim düşmez. Tauri dışında (OBS kaynağı, tarayıcı) bir şey yapmaz.
 *
 *   void yerelBildirim("OBS bağlantısı koptu", "OBS kapandı ya da ağ kesildi.");
 */
import { isTauri } from "@tauri-apps/api/core";
import { gunluk } from "./gunluk";

export async function yerelBildirim(baslik: string, govde?: string): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const w = getCurrentWindow();
    if ((await w.isVisible()) && !(await w.isMinimized())) return;
    const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
    if (!(await isPermissionGranted()) && (await requestPermission()) !== "granted") return;
    sendNotification({ title: baslik, body: govde });
  } catch (e) {
    gunluk.warn(`Masaüstü bildirimi gösterilemedi: ${e}`);
  }
}
