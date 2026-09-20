/**
 * Yedek dosyasında sır taşımama.
 *
 * Yedek JSON'u kullanıcı tarafından paylaşılabilir (destek isterken, başka
 * bilgisayara taşırken). OBS WebSocket şifresi düz metin duruyordu. Dışa
 * aktarımda şifre çıkarılır; içe aktarımda **mevcut şifre korunur** — yoksa
 * yedek yüklemek OBS bağlantısını sessizce koparırdı.
 */

type Json = Record<string, any>;

const SECRET_OBS_KEYS = ["password"] as const;

/** Ayarın kopyasını, `obs` içindeki sırlar çıkarılmış hâlde döner. */
export function stripBackupSecrets(settings: Json | null | undefined): Json {
  const copy: Json = JSON.parse(JSON.stringify(settings || {}));
  if (copy.obs && typeof copy.obs === "object") {
    for (const k of SECRET_OBS_KEYS) delete copy.obs[k];
  }
  return copy;
}

/**
 * Yedeğin ayarını yüklemeden önce, yedekte olmayan sırları mevcut ayardan taşır.
 * Yedekte açıkça bir şifre varsa (eski yedekler) o kazanır.
 */
export function restoreBackupSecrets(incoming: Json, current: Json | null | undefined): Json {
  const out: Json = JSON.parse(JSON.stringify(incoming || {}));
  const cur = current?.obs;
  if (!cur || typeof cur !== "object") return out;
  const obs = out.obs && typeof out.obs === "object" ? out.obs : (out.obs = {});
  for (const k of SECRET_OBS_KEYS) {
    if (obs[k] === undefined && cur[k] !== undefined) obs[k] = cur[k];
  }
  return out;
}
