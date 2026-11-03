/**
 * AxBoT (gömülü bot sunucusu) adresi — tek kaynak.
 *
 * Panel AxBoT'u `YYA_STREAMAXT_PORT` ile başka bir portta başlatabiliyor; eskiden Bot sekmesi dışındaki
 * kullanıcılar (Kontrol Merkezi uyarı kuyruğu, Dashboard bot kartı) 3001'e sabitti ve o durumda sessizce
 * "kapalı" görünüyordu. Masaüstünde adres Rust `streamaxt_status`'tan, tarayıcıda varsayılandan gelir.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";

/** Rust `streamaxt_status` çıktısı. */
export type StreamAxtStatus = {
  installed: boolean;
  dir: string | null;
  node: boolean;
  running: boolean;
  own: boolean;
  external: boolean;
  disabled: boolean;
  port: number;
  url: string;
};

export const FALLBACK_PORT = 3001;

/** Tarayıcıda (Tauri dışı) yalnız sağlık kontrolü yapılabilir. Geliştirme düzeneği portu `VITE_STREAMAXT_PORT` ile verir. */
async function browserStatus(): Promise<StreamAxtStatus> {
  const port = Number(import.meta.env.VITE_STREAMAXT_PORT) || FALLBACK_PORT;
  const url = `http://127.0.0.1:${port}/`;
  let running = false;
  try {
    const r = await fetch(`${url}health`, { cache: "no-store" });
    running = r.ok;
  } catch {
    running = false;
  }
  return {
    installed: true,
    dir: null,
    node: true,
    running,
    own: false,
    external: running,
    disabled: false,
    port,
    url,
  };
}

export async function streamaxtStatus(): Promise<StreamAxtStatus> {
  if (!isTauri()) return browserStatus();
  return invoke<StreamAxtStatus>("streamaxt_status");
}

/** `http://127.0.0.1:3001/` → `http://127.0.0.1:3001`; geçersizse varsayılan. */
export function baseFromUrl(url: string | null | undefined): string {
  const m = /^(https?:\/\/[^/?#]+)/i.exec(String(url || "").trim());
  return m ? m[1] : `http://127.0.0.1:${FALLBACK_PORT}`;
}

let base: Promise<string> | null = null;

/** Sondaki eğik çizgi olmadan AxBoT kökü. Port uygulama çalışırken değişmez: bir kez sorulur. */
export function streamaxtBase(): Promise<string> {
  if (!base) {
    base = streamaxtStatus()
      .then((s) => baseFromUrl(s.url))
      .catch(() => {
        base = null; // bir sonraki çağrı yeniden denesin
        return baseFromUrl(null);
      });
  }
  return base;
}
