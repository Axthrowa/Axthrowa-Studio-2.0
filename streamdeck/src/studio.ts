/**
 * U12: Studio'nun yerel HTTP yolu (eylem kayıt defteri). Stream Deck eklentisi yalnız 127.0.0.1'e bağlanır;
 * loopback isteği Bearer istemez, izin/onay/denetim sunucuda uygulanır. Saf mantık: `node --test` ile sınanır.
 */
export type DesteDugmesi = { id: string; label: string; actionId: string; params: Record<string, string>; sayfa: string };
export type Durum = { streaming: boolean; recording: boolean; inputs: { name: string; muted: boolean }[] };
export type Sonuc = { tur: "tamam" } | { tur: "onay"; mesaj: string } | { tur: "hata"; mesaj: string };

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** Panel ayarındaki `controlDeck` → düz düğme listesi (bozuk kayıtlar atlanır) */
export function desteDugmeleri(deck: unknown): DesteDugmesi[] {
  const pages = (deck as { pages?: unknown })?.pages;
  if (!Array.isArray(pages)) return [];
  const out: DesteDugmesi[] = [];
  for (const p of pages) {
    const sayfa = typeof p?.name === "string" ? p.name : "";
    for (const b of Array.isArray(p?.buttons) ? p.buttons : []) {
      if (typeof b?.id !== "string" || typeof b?.actionId !== "string") continue;
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(b.params && typeof b.params === "object" ? b.params : {})) if (typeof v === "string") params[k] = v;
      out.push({ id: b.id, label: typeof b.label === "string" && b.label ? b.label : b.actionId, actionId: b.actionId, params, sayfa });
    }
  }
  return out;
}

export class Studio {
  readonly adres: string;
  private f: Fetch;
  constructor(adres: string, f: Fetch = fetch as unknown as Fetch) {
    this.adres = adres;
    this.f = f;
  }

  private async istek<T>(yol: string, govde?: unknown): Promise<{ status: number; veri: T | null; metin: string }> {
    const r = await this.f(`${this.adres}${yol}`, {
      method: govde === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: govde === undefined ? undefined : JSON.stringify(govde),
      signal: AbortSignal.timeout(4000),
    });
    const metin = await r.text();
    let veri: T | null = null;
    try {
      veri = metin ? (JSON.parse(metin) as T) : null;
    } catch {
      /* düz metin hata */
    }
    return { status: r.status, veri, metin };
  }

  async deste(): Promise<DesteDugmesi[]> {
    const r = await this.istek<{ deck: unknown }>("/api/actions/deste");
    return r.status === 200 ? desteDugmeleri(r.veri?.deck) : [];
  }

  /** OBS bağlı değilse null */
  async durum(): Promise<Durum | null> {
    const r = await this.istek<Durum>("/api/obs/kumanda");
    return r.status === 200 && r.veri ? { streaming: !!r.veri.streaming, recording: !!r.veri.recording, inputs: r.veri.inputs ?? [] } : null;
  }

  async calistir(id: string, params: Record<string, string> = {}, onay = false): Promise<Sonuc> {
    try {
      const r = await this.istek("/api/actions/run", { id, params, confirm: onay });
      if (r.status === 200) return { tur: "tamam" };
      if (r.status === 428) return { tur: "onay", mesaj: r.metin };
      return { tur: "hata", mesaj: r.metin || `HTTP ${r.status}` };
    } catch (e) {
      return { tur: "hata", mesaj: String((e as Error)?.message || e) };
    }
  }
}

/** Onay isteyen eylem: aynı tuşa `sureMs` içinde ikinci basış onay sayılır */
export class OnayKapisi {
  private bekleyen = new Map<string, number>();
  private sureMs: number;
  constructor(sureMs = 3000) {
    this.sureMs = sureMs;
  }
  /** İlk basışta false (bekletir), süre içinde ikinci basışta true */
  onaylandi(anahtar: string, simdi = Date.now()): boolean {
    const t = this.bekleyen.get(anahtar);
    this.bekleyen.delete(anahtar);
    return t !== undefined && simdi - t <= this.sureMs;
  }
  bekle(anahtar: string, simdi = Date.now()) {
    this.bekleyen.set(anahtar, simdi);
  }
}
