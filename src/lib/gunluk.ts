/**
 * Merkezi günlük: masaüstü uygulamasında Rust ile aynı dosyaya (`data/logs/axthrowa.log`, 5 MB × 5 döndürmeli)
 * yazar; OBS tarayıcı kaynağı gibi Tauri dışı sayfalarda konsola düşer. Belirteçler Rust tarafında gizlenir.
 *
 *   gunluk.info("Yayın başlatıldı"); gunluk.error(`OBS bağlantısı koptu: ${e}`);
 */
import { isTauri } from "@tauri-apps/api/core";
import { error, info, warn } from "@tauri-apps/plugin-log";

type Yazici = (mesaj: string) => Promise<void>;

function yaz(tauri: Yazici, konsol: (...a: unknown[]) => void) {
  return (mesaj: string) => {
    if (!isTauri()) return konsol("[axthrowa]", mesaj);
    // Günlük yazılamadı diye uygulama akışı bozulmasın
    void tauri(mesaj).catch(() => konsol("[axthrowa]", mesaj));
  };
}

export const gunluk = {
  info: yaz(info, console.info),
  warn: yaz(warn, console.warn),
  error: yaz(error, console.error),
};
