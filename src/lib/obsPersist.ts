/** OBS WS adresi için yerel yedek. Şifre yazılmaz (kasada durur); eski kayıtta kalan şifre okunup kasaya taşınır. */

export type ObsSavedConn = {
  host: string;
  port: number;
  password: string;
};

const KEY = "yya.obs.connection";

export function loadObsSaved(): ObsSavedConn | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<ObsSavedConn>;
    const host = String(j.host || "").trim() || "127.0.0.1";
    const port = Number(j.port) || 4455;
    return { host, port, password: String(j.password || "") };
  } catch {
    return null;
  }
}

export function saveObsSaved(cfg: Pick<ObsSavedConn, "host" | "port">) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        host: cfg.host.trim() || "127.0.0.1",
        port: Number(cfg.port) || 4455,
      })
    );
  } catch {
    /* quota / gizli mod */
  }
}
