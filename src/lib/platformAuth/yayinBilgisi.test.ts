/**
 * Yayın bilgisi istekleri — gerçek platforma gidilmez: `fetch` ve `localStorage` sahtedir, yalnız istek biçimi ve
 * belge kuralları (Twitch başlık/etiket sınırları, YouTube "boş bırakılan alan silinir") sınanır.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { twitchKanalGovdesi, twitchKanalGuncelle, twitchKanalYazabilir } from "./twitchWrite";
import { youtubeSnippetBirlestir, youtubeYayinGuncelle } from "./youtubeWrite";

type Istek = { url: string; method: string; body?: unknown; headers: Record<string, string> };

function sahteOrtam(depo: Record<string, unknown>, yanit: (i: Istek) => { status: number; json?: unknown }) {
  const istekler: Istek[] = [];
  const ls = new Map(Object.entries(depo).map(([k, v]) => [k, JSON.stringify(v)]));
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => ls.get(k) ?? null,
    setItem: (k: string, v: string) => void ls.set(k, v),
    removeItem: (k: string) => void ls.delete(k),
  });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const i: Istek = {
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    istekler.push(i);
    const y = yanit(i);
    return new Response(y.json === undefined ? null : JSON.stringify(y.json), { status: y.status });
  });
  return istekler;
}

const TWITCH = { accessToken: "sahte-belirtec", login: "kanal", userId: "42", clientId: "istemci", expiresAt: 0 };
const YOUTUBE = { accessToken: "sahte-yt", clientId: "istemci", expiresAt: 0 };

describe("Twitch yayın bilgisi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("gövde belge sınırlarını uygular", () => {
    expect(twitchKanalGovdesi({ baslik: "  Akşam ", kategoriId: "509658", etiketler: ["Türkçe", " fps "] })).toEqual({
      title: "Akşam",
      game_id: "509658",
      tags: ["Türkçe", "fps"],
    });
    expect(twitchKanalGovdesi({ kategoriId: null })).toEqual({ game_id: "" });
    expect(() => twitchKanalGovdesi({ baslik: " " })).toThrow();
    expect(() => twitchKanalGovdesi({ baslik: "a".repeat(141) })).toThrow();
    expect(() => twitchKanalGovdesi({ etiketler: Array.from({ length: 11 }, (_, i) => `e${i}`) })).toThrow();
    expect(() => twitchKanalGovdesi({ etiketler: ["boşluk var"] })).toThrow();
    expect(() => twitchKanalGovdesi({ etiketler: ["a".repeat(26)] })).toThrow();
    expect(() => twitchKanalGovdesi({})).toThrow();
  });

  it("kapsam yoksa yazma kapalı, varsa PATCH broadcaster_id ile gider", async () => {
    sahteOrtam({ "yya.twitchWrite.v1": TWITCH }, () => ({ status: 204 }));
    expect(twitchKanalYazabilir()).toBe(false);
    await expect(twitchKanalGuncelle({ baslik: "x" })).rejects.toThrow(/channel:manage:broadcast/);
    vi.unstubAllGlobals();
    const istekler = sahteOrtam({ "yya.twitchWrite.v1": { ...TWITCH, scopes: ["chat:write", "channel:manage:broadcast"] } }, () => ({ status: 204 }));
    expect(twitchKanalYazabilir()).toBe(true);
    await twitchKanalGuncelle({ baslik: "Yeni başlık" });
    expect(istekler).toHaveLength(1);
    expect(istekler[0].url).toBe("https://api.twitch.tv/helix/channels?broadcaster_id=42");
    expect(istekler[0].method).toBe("PATCH");
    expect(istekler[0].body).toEqual({ title: "Yeni başlık" });
    expect(istekler[0].headers["Client-Id"]).toBe("istemci");
  });
});

describe("YouTube yayın bilgisi", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("snippet birleştirme yazılabilir alanları korur, salt-okunurları göndermez", () => {
    const eski = { title: "Eski", description: "Açıklama", tags: ["a"], categoryId: "20", channelId: "UC1", publishedAt: "2026", thumbnails: {} };
    expect(youtubeSnippetBirlestir(eski, { baslik: "Yeni" })).toEqual({ title: "Yeni", description: "Açıklama", tags: ["a"], categoryId: "20" });
    expect(youtubeSnippetBirlestir(eski, { kategoriId: "24", etiketler: [" x ", ""] })).toEqual({
      title: "Eski",
      description: "Açıklama",
      tags: ["x"],
      categoryId: "24",
    });
    expect(() => youtubeSnippetBirlestir(eski, { baslik: " " })).toThrow();
  });

  it("yayın videosu doğrulanırsa videos.update (açıklama korunur)", async () => {
    const istekler = sahteOrtam({ "yya.youtubeWrite.v1": YOUTUBE }, (i) => {
      if (i.url.includes("/liveBroadcasts?part=snippet&broadcastStatus=active"))
        return { status: 200, json: { items: [{ id: "vid1", snippet: { title: "Eski" } }] } };
      if (i.url.includes("/videos?part=snippet&id=vid1"))
        return { status: 200, json: { items: [{ id: "vid1", snippet: { title: "Eski", description: "D", categoryId: "20" } }] } };
      if (i.method === "PUT") return { status: 200, json: {} };
      return { status: 404 };
    });
    expect(await youtubeYayinGuncelle({ baslik: "Yeni", kategoriId: "24" })).toBe("video");
    const put = istekler.find((i) => i.method === "PUT")!;
    expect(put.url).toBe("https://www.googleapis.com/youtube/v3/videos?part=snippet");
    expect(put.body).toEqual({ id: "vid1", snippet: { title: "Yeni", description: "D", categoryId: "24" } });
  });

  it("video doğrulanamazsa yalnız başlık liveBroadcasts.update ile; kategori reddedilir", async () => {
    const istekler = sahteOrtam({ "yya.youtubeWrite.v1": YOUTUBE }, (i) => {
      if (i.url.includes("broadcastStatus=active")) return { status: 200, json: { items: [] } };
      if (i.url.includes("broadcastStatus=upcoming"))
        return { status: 200, json: { items: [{ id: "b1", snippet: { title: "Plan", scheduledStartTime: "2026-10-06T18:00:00Z", description: "D" } }] } };
      if (i.url.includes("/videos?")) return { status: 200, json: { items: [] } };
      if (i.method === "PUT") return { status: 200, json: {} };
      return { status: 404 };
    });
    await expect(youtubeYayinGuncelle({ kategoriId: "24" })).rejects.toThrow(/doğrulanamadı/);
    expect(await youtubeYayinGuncelle({ baslik: "Yeni plan" })).toBe("yayin");
    const put = istekler.find((i) => i.method === "PUT")!;
    expect(put.url).toBe("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet");
    expect(put.body).toEqual({ id: "b1", snippet: { title: "Yeni plan", scheduledStartTime: "2026-10-06T18:00:00Z", description: "D" } });
  });
});
