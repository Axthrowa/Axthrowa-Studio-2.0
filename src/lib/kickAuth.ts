/** Kick girişi: botun resmi izin sayfasını varsayılan tarayıcıda açar; onaydan sonra bot kaydeder ve bağlanır. */
import { openExternal } from "./openExternal";
import { streamaxtBase } from "./streamaxt";

export async function kickGirisiAc(hedef: "bot" | "kanal"): Promise<{ ok: boolean; message: string; needConfig?: boolean }> {
  try {
    const r = await fetch(`${await streamaxtBase()}/api/platforms/kick/auth-url?hedef=${hedef}`, { method: "POST", cache: "no-store" });
    const d = (await r.json()) as { authUrl?: string };
    if (!r.ok || !d.authUrl) {
      return { ok: false, needConfig: true, message: "Önce Kick Client ID gerekli: Bot › Platformlar › Kick" };
    }
    const sonuc = await openExternal(d.authUrl);
    return { ok: true, message: sonuc === "opened" ? "Kick izin sayfası tarayıcıda açıldı" : "Giriş adresi panoya kopyalandı" };
  } catch {
    return { ok: false, message: "Bot kapalı — Kick girişi açılamadı" };
  }
}
