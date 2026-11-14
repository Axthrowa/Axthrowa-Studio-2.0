/**
 * Twitch chat:write — tarayıcı OAuth (implicit) + IRC PRIVMSG.
 * Rust derlemesi gerekmez; token localStorage’da.
 */

const LS = "studio.twitchWrite.v1";
const AUTH_URL = "https://id.twitch.tv/oauth2/authorize";
const IRC_URL = "wss://irc-ws.chat.twitch.tv:443";
/** `channel:manage:broadcast`: Yayın Bilgisi dock'u (başlık/kategori/etiket; yalnız kullanıcı onaylayınca). Daha önce
 * bağlanmış oturumlarda yoktur — yeniden bağlanana dek yazma kapalı kalır. */
// `channel:manage:clips`: Y1 VOD'dan klip (Create Clip From VOD)
// Y7 reklam takvimi/erteleme, Y9 resmi sabitleme
const SCOPES = "chat:read chat:write user:read:chat channel:manage:broadcast clips:edit channel:manage:clips channel:read:ads channel:manage:ads moderator:manage:chat_messages";
const HELIX = "https://api.twitch.tv/helix";

export type TwitchWriteSession = {
  accessToken: string;
  login: string;
  userId?: string;
  clientId: string;
  expiresAt: number; // 0 = bilinmiyor
  /** /oauth2/validate yanıtındaki kapsamlar (eski oturumlarda yok) */
  scopes?: string[];
};

function load(): TwitchWriteSession | null {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    const j = JSON.parse(raw) as TwitchWriteSession;
    if (!j?.accessToken || !j?.login) return null;
    if (j.expiresAt > 0 && j.expiresAt < Date.now()) {
      localStorage.removeItem(LS);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

function save(s: TwitchWriteSession | null) {
  try {
    if (!s) localStorage.removeItem(LS);
    else localStorage.setItem(LS, JSON.stringify(s));
  } catch {
    /* */
  }
}

export function clearTwitchWriteSession() {
  save(null);
}

export function twitchWriteStatus() {
  const s = load();
  return {
    connected: !!s?.accessToken,
    login: s?.login || "",
    clientId: s?.clientId || "",
  };
}

/** Redirect URI — kullanıcı Twitch Developer Console’da bunu eklemeli */
export function twitchRedirectUri() {
  const base = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8843";
  return `${String(base).replace(/\/$/, "")}/oauth/twitch`;
}

export function buildTwitchAuthorizeUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: twitchRedirectUri(),
    response_type: "token",
    scope: SCOPES,
    force_verify: "true",
  });
  return `${AUTH_URL}?${params}`;
}

/** Callback sayfasından hash token yakala */
export async function completeTwitchOAuthFromHash(hash: string, clientId: string): Promise<TwitchWriteSession> {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = q.get("access_token") || "";
  if (!accessToken) throw new Error("Twitch access_token yok");
  const expiresIn = Number(q.get("expires_in") || 0);
  const validate = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!validate.ok) throw new Error("Twitch token doğrulanamadı");
  const v = (await validate.json()) as { login?: string; user_id?: string; scopes?: string[] };
  const login = String(v.login || "").toLowerCase();
  if (!login) throw new Error("Twitch login yok");
  const session: TwitchWriteSession = {
    accessToken,
    login,
    userId: v.user_id,
    scopes: Array.isArray(v.scopes) ? v.scopes : [],
    clientId: clientId.trim(),
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 - 30_000 : 0,
  };
  save(session);
  return session;
}

/** Tek seferlik IRC bağlantısı ile PRIVMSG gönder */
export function sendTwitchPrivmsg(channel: string, text: string): Promise<boolean> {
  const session = load();
  if (!session) return Promise.resolve(false);
  const ch = String(channel || "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();
  const msg = String(text || "")
    .trim()
    .slice(0, 480);
  if (!ch || !msg) return Promise.resolve(false);

  return new Promise((resolve) => {
    let done = false;
    let ws: WebSocket | null = null;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try {
        ws?.close();
      } catch {
        /* */
      }
      resolve(ok);
    };
    try {
      ws = new WebSocket(IRC_URL);
    } catch {
      finish(false);
      return;
    }
    const t = window.setTimeout(() => finish(false), 8000);
    ws.onopen = () => {
      ws!.send("CAP REQ :twitch.tv/commands");
      ws!.send(`PASS oauth:${session.accessToken}`);
      ws!.send(`NICK ${session.login}`);
    };
    ws.onmessage = (ev) => {
      const raw = String(ev.data || "");
      if (raw.includes("Login authentication failed") || raw.includes("Login unsuccessful")) {
        window.clearTimeout(t);
        clearTwitchWriteSession();
        finish(false);
        return;
      }
      // 001 = welcome → yaz
      if (raw.includes(" 001 ") || raw.includes("GLOBALUSERSTATE")) {
        try {
          ws!.send(`PRIVMSG #${ch} :${msg}`);
          window.clearTimeout(t);
          window.setTimeout(() => finish(true), 200);
        } catch {
          window.clearTimeout(t);
          finish(false);
        }
      }
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      finish(false);
    };
    ws.onclose = () => {
      window.clearTimeout(t);
      if (!done) finish(false);
    };
  });
}

// ─── Yayın bilgisi (Helix; resmi belge: dev.twitch.tv/docs/api/reference — Modify/Get Channel Information, Search
// Categories). Helix tarayıcıdan çağrılabilir (CORS `*`, ön kontrolle gözlendi). ───

export type TwitchKanalBilgisi = { baslik: string; kategori: { id: string; ad: string } | null; etiketler: string[] };

/** Oturum kanal bilgisini yazabilir mi (kapsam + kullanıcı kimliği) */
export function twitchKanalYazabilir(): boolean {
  const s = load();
  return !!s?.userId && !!s.scopes?.includes("channel:manage:broadcast");
}

/** PATCH gövdesi (belge: başlık boş olamaz, en çok 140 karakter; en çok 10 etiket, her biri en çok 25 karakter, boş ya da
 * özel karakterli olamaz; kategori "" ile kaldırılır) */
export function twitchKanalGovdesi(d: { baslik?: string; kategoriId?: string | null; etiketler?: string[] }): Record<string, unknown> {
  const g: Record<string, unknown> = {};
  if (d.baslik !== undefined) {
    const b = d.baslik.trim();
    if (!b) throw new Error("başlık boş olamaz");
    if ([...b].length > 140) throw new Error("başlık en çok 140 karakter");
    g.title = b;
  }
  if (d.kategoriId !== undefined) g.game_id = d.kategoriId ?? "";
  if (d.etiketler !== undefined) {
    const e = d.etiketler.map((x) => x.trim()).filter(Boolean);
    if (e.length > 10) throw new Error("en çok 10 etiket");
    const kotu = e.find((x) => [...x].length > 25 || !/^[\p{L}\p{N}]+$/u.test(x));
    if (kotu) throw new Error(`geçersiz etiket: «${kotu}» (yalnız harf/rakam, en çok 25)`);
    g.tags = e;
  }
  if (!Object.keys(g).length) throw new Error("değiştirilecek alan yok");
  return g;
}

async function helix(yol: string, init: RequestInit = {}): Promise<Response> {
  const s = load();
  if (!s?.userId) throw new Error("Twitch bağlı değil");
  const r = await fetch(`${HELIX}${yol}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.accessToken}`, "Client-Id": s.clientId, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  if (!r.ok) {
    const t = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error(`Twitch ${r.status}${t ? `: ${t}` : ""}`);
  }
  return r;
}

export async function twitchKanalOku(): Promise<TwitchKanalBilgisi> {
  const id = load()?.userId ?? "";
  const j = (await (await helix(`/channels?broadcaster_id=${encodeURIComponent(id)}`)).json()) as {
    data?: { title?: string; game_id?: string; game_name?: string; tags?: string[] }[];
  };
  const c = j.data?.[0];
  if (!c) throw new Error("Twitch kanalı bulunamadı");
  return { baslik: c.title ?? "", kategori: c.game_id ? { id: c.game_id, ad: c.game_name ?? c.game_id } : null, etiketler: c.tags ?? [] };
}

export async function twitchKategoriAra(q: string): Promise<{ id: string; ad: string }[]> {
  const j = (await (await helix(`/search/categories?first=20&query=${encodeURIComponent(q)}`)).json()) as { data?: { id: string; name: string }[] };
  return (j.data ?? []).map((c) => ({ id: c.id, ad: c.name }));
}

export async function twitchKanalGuncelle(d: { baslik?: string; kategoriId?: string | null; etiketler?: string[] }): Promise<void> {
  if (!twitchKanalYazabilir()) throw new Error("Twitch oturumunda channel:manage:broadcast izni yok — Twitch'i yeniden bağlayın");
  const govde = twitchKanalGovdesi(d);
  const id = load()?.userId ?? "";
  await helix(`/channels?broadcaster_id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(govde) });
}

/** Y1: Twitch süre biçimi "1h2m3s" → saniye */
export function twitchSuresi(s: string): number {
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(s.trim());
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

type Vod = { id: string; created_at: string; duration: string };

/** İşaret anını (ms) içeren VOD ve işaretin VOD içindeki saniyesi */
export function vodBul(videolar: Vod[], anMs: number): { vodId: string; ofsetSn: number } | null {
  for (const v of videolar) {
    const bas = Date.parse(v.created_at);
    const ofset = (anMs - bas) / 1000;
    if (Number.isFinite(bas) && ofset >= 0 && ofset <= twitchSuresi(v.duration)) return { vodId: v.id, ofsetSn: ofset };
  }
  return null;
}

/** Klibin VOD'da bittiği saniye: işaret + kaydırma (başlangıç) + süre; Twitch süreden küçüğünü reddeder */
export function klipBitisi(ofsetSn: number, kaydirmaSn: number, sureSn: number): number {
  return Math.max(Math.ceil(sureSn), Math.round(ofsetSn + kaydirmaSn + sureSn));
}

export function twitchKlipYazabilir(): boolean {
  const s = load();
  return !!s?.userId && !!s.scopes?.includes("channel:manage:clips");
}

/** Create Clip From VOD: 202 ile işlem başlar; dönen düzenleme adresi listede gösterilir */
export async function twitchVodKlibi(d: { anMs: number; baslik: string; sureSn: number; kaydirmaSn: number }): Promise<{ id: string; editUrl: string }> {
  if (!twitchKlipYazabilir()) throw new Error("Twitch oturumunda channel:manage:clips izni yok — Twitch'i yeniden bağlayın");
  const sure = Math.min(60, Math.max(5, Math.round(d.sureSn * 10) / 10));
  const id = load()?.userId ?? "";
  const v = (await (await helix(`/videos?user_id=${encodeURIComponent(id)}&type=archive&first=20`)).json()) as { data?: Vod[] };
  const vod = vodBul(v.data ?? [], d.anMs);
  if (!vod) throw new Error("Bu anı içeren Twitch VOD'u bulunamadı (VOD kaydı kapalı ya da silinmiş olabilir)");
  const q = new URLSearchParams({
    editor_id: id,
    broadcaster_id: id,
    vod_id: vod.vodId,
    vod_offset: String(klipBitisi(vod.ofsetSn, d.kaydirmaSn, sure)),
    duration: String(sure),
    title: d.baslik.trim().slice(0, 100) || "Klip",
  });
  const j = (await (await helix(`/videos/clips?${q}`, { method: "POST" })).json()) as { data?: { id: string; edit_url: string }[] };
  const k = j.data?.[0];
  if (!k) throw new Error("Twitch klip kimliği dönmedi");
  return { id: k.id, editUrl: k.edit_url };
}

/** Y7: GET /channels/ads — zamanlar Unix saniye (0 = yok / yayında değil) */
export type ReklamTakvimi = { sonrakiReklam: number; sure: number; ertelemeHakki: number; ertelemeYenilenme: number; sonReklam: number; prerollSuresi: number };

export function twitchReklamOkuyabilir(): boolean {
  const s = load();
  return !!s?.userId && !!s.scopes?.includes("channel:read:ads");
}

function takvimCevir(d: Record<string, unknown> | undefined): ReklamTakvimi {
  const n = (k: string) => Number(d?.[k]) || 0;
  return { sonrakiReklam: n("next_ad_at"), sure: n("duration"), ertelemeHakki: n("snooze_count"), ertelemeYenilenme: n("snooze_refresh_at"), sonReklam: n("last_ad_at"), prerollSuresi: n("preroll_free_time") };
}

export async function twitchReklamTakvimi(): Promise<ReklamTakvimi> {
  const id = load()?.userId ?? "";
  const j = (await (await helix(`/channels/ads?broadcaster_id=${encodeURIComponent(id)}`)).json()) as { data?: Record<string, unknown>[] };
  return takvimCevir(j.data?.[0]);
}

/** Sonraki reklamı 5 dk erteler; hak yoksa Twitch 429 döner */
export async function twitchReklamErtele(): Promise<Pick<ReklamTakvimi, "sonrakiReklam" | "ertelemeHakki" | "ertelemeYenilenme">> {
  const s = load();
  if (!s?.scopes?.includes("channel:manage:ads")) throw new Error("Twitch oturumunda channel:manage:ads izni yok — Twitch'i yeniden bağlayın");
  const j = (await (await helix(`/channels/ads/schedule/snooze?broadcaster_id=${encodeURIComponent(s.userId ?? "")}`, { method: "POST" })).json()) as { data?: Record<string, unknown>[] };
  // Yanıtta yalnız erteleme alanları ve yeni zaman var
  const { sonrakiReklam, ertelemeHakki, ertelemeYenilenme } = takvimCevir(j.data?.[0]);
  return { sonrakiReklam, ertelemeHakki, ertelemeYenilenme };
}

/** Y9: Twitch'in resmi sabitlemesi (izleyicilerin sohbetinin üstünde); yayıncı oturumu moderatör olarak kullanılır */
export function twitchSabitleyebilir(): boolean {
  const s = load();
  return !!s?.userId && !!s.scopes?.includes("moderator:manage:chat_messages");
}

/** sureSn null = yayın bitene dek; Twitch 30-1800 sn kabul eder. Başka mesaj sabitliyse 409 döner. */
export async function twitchSabitle(mesajId: string, sureSn: number | null): Promise<void> {
  if (!twitchSabitleyebilir()) throw new Error("Twitch oturumunda moderator:manage:chat_messages izni yok — Twitch'i yeniden bağlayın");
  const id = encodeURIComponent(load()?.userId ?? "");
  const sure = sureSn === null ? "" : `&duration_seconds=${Math.min(1800, Math.max(30, Math.round(sureSn)))}`;
  await helix(`/chat/pins?broadcaster_id=${id}&moderator_id=${id}&message_id=${encodeURIComponent(mesajId)}${sure}`, { method: "PUT" });
}
