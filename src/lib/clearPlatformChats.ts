/**
 * Sohbeti seçilen platformlarda temizler (işi bot yapar) ve YYA sohbet katmanını sıfırlar.
 */
import { patchSettings } from "./api";
import { streamaxtBase } from "./streamaxt";

export type TemizlenebilirPlatform = { id: string; bagli: boolean; tumu: boolean };

export type ClearPlatformResult = {
  local: boolean;
  sonuclar: Record<string, { ok: boolean; yontem?: string; silinen?: number; kalan?: number; hata?: string }>;
  hata?: string;
};

export async function temizlenebilirPlatformlar(): Promise<TemizlenebilirPlatform[]> {
  const r = await fetch(`${await streamaxtBase()}/api/chat/clear-platforms`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Bot yanıt vermedi (${r.status})`);
  return ((await r.json()) as { platformlar: TemizlenebilirPlatform[] }).platformlar;
}

export async function clearPlatformChats(platforms: string[]): Promise<ClearPlatformResult> {
  let local = false;
  try {
    await patchSettings("chat", { clearEpoch: Date.now() });
    local = true;
  } catch {
    /* sonuç iletisinde yazar */
  }
  if (!platforms.length) return { local, sonuclar: {} };
  try {
    const r = await fetch(`${await streamaxtBase()}/api/chat/clear-platforms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platforms }),
    });
    const d = await r.json();
    return r.ok ? { local, sonuclar: d.sonuclar || {} } : { local, sonuclar: {}, hata: d.hata || `Bot ${r.status}` };
  } catch (e) {
    return { local, sonuclar: {}, hata: `Bota ulaşılamadı: ${String((e as Error).message || e)}` };
  }
}

export function clearResultToast(r: ClearPlatformResult): string {
  if (r.hata) return r.hata;
  const satirlar = Object.entries(r.sonuclar).map(([p, s]) =>
    s.ok ? `${p}: ${s.yontem === "tek-tek" ? `${s.silinen} ileti silindi${s.kalan ? `, ${s.kalan} ileti kaldı` : ""}` : "temizlendi"}` : `${p}: ${s.hata || "temizlenemedi"}`
  );
  if (!satirlar.length) return r.local ? "Yayın sohbet katmanı temizlendi" : "Sohbet temizlenemedi";
  return satirlar.join(" · ");
}
