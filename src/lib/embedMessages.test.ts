import { describe, expect, it } from "vitest";
import { KOMUT_PALETI_TYPE, ODAK_BIRAK_TYPE, OPEN_EXTERNAL_TYPE, OPEN_MUSIC_TYPE, GERI_AL_MESAJI, ayaraGitMesaji, bekleyenBotAyariAl, botAyariIste, frameOrigin, geriAlBotaGider, komutPaletiRequest, odakBirakRequest, openExternalRequest, openMusicRequest, resonanceLinkAllowed, temaIstegi } from "./embedMessages";

const frame = { name: "axbot-frame" };
const origin = "http://127.0.0.1:3001";
const ok = (url: string) => ({ data: { type: OPEN_EXTERNAL_TYPE, url }, origin, source: frame });

describe("frameOrigin", () => {
  it("adresin kökenini verir", () => {
    expect(frameOrigin("http://127.0.0.1:3001/?embed=1#platforms")).toBe(origin);
  });
  it("bozuk adreste null", () => {
    expect(frameOrigin("::yok::")).toBeNull();
  });
});

describe("openExternalRequest", () => {
  it("bizim çerçeveden gelen http(s) isteğini kabul eder", () => {
    expect(openExternalRequest(ok("http://127.0.0.1:3001/widgets/alertbox"), frame, origin)).toBe(
      "http://127.0.0.1:3001/widgets/alertbox",
    );
    expect(openExternalRequest(ok("https://id.kick.com/oauth/authorize?x=1"), frame, origin)).toBe(
      "https://id.kick.com/oauth/authorize?x=1",
    );
  });

  it("başka pencereden gelen isteği reddeder", () => {
    expect(openExternalRequest({ ...ok("https://ornek.com"), source: {} }, frame, origin)).toBeNull();
    expect(openExternalRequest(ok("https://ornek.com"), null, origin)).toBeNull();
  });

  it("başka kökenden gelen isteği reddeder", () => {
    expect(openExternalRequest({ ...ok("https://ornek.com"), origin: "https://kotu.example" }, frame, origin)).toBeNull();
    expect(openExternalRequest(ok("https://ornek.com"), frame, null)).toBeNull();
  });

  it("http(s) dışı şemaları reddeder", () => {
    for (const url of ["javascript:alert(1)", "file:///C:/Windows/System32/calc.exe", "ms-settings:privacy", "//ornek.com", "https://a b.com"]) {
      expect(openExternalRequest(ok(url), frame, origin)).toBeNull();
    }
  });

  it("biçimi bozuk mesajları reddeder", () => {
    for (const data of [null, "metin", { type: "baska" }, { type: OPEN_EXTERNAL_TYPE, url: 5 }]) {
      expect(openExternalRequest({ data, origin, source: frame }, frame, origin)).toBeNull();
    }
  });
});

describe("resonanceLinkAllowed", () => {
  it("Spotify onay sayfası gibi beklenen adresleri kabul eder", () => {
    expect(resonanceLinkAllowed("https://accounts.spotify.com/authorize?client_id=x&state=y")).toBe(true);
    expect(resonanceLinkAllowed("https://developer.spotify.com/dashboard")).toBe(true);
  });

  it("başka çerçevelerin açtırmak isteyeceği rastgele adresleri reddeder", () => {
    expect(resonanceLinkAllowed("https://kotu.example/phish")).toBe(false);
    // Önek hilesi: alan adı spotify ile BAŞLAMIYOR
    expect(resonanceLinkAllowed("https://accounts.spotify.com.kotu.example/")).toBe(false);
    expect(resonanceLinkAllowed("http://accounts.spotify.com/authorize")).toBe(false);
    expect(resonanceLinkAllowed("javascript:alert(1)")).toBe(false);
    expect(resonanceLinkAllowed(42)).toBe(false);
  });
});


describe("komutPaletiRequest", () => {
  it("yalnız bizim çerçeveden ve kökenden gelen isteği kabul eder", () => {
    const m = { data: { type: KOMUT_PALETI_TYPE }, origin, source: frame };
    expect(komutPaletiRequest(m, frame, origin)).toBe(true);
    expect(komutPaletiRequest({ ...m, source: {} }, frame, origin)).toBe(false);
    expect(komutPaletiRequest({ ...m, origin: "https://ornek.com" }, frame, origin)).toBe(false);
    expect(komutPaletiRequest(ok("https://ornek.com"), frame, origin)).toBe(false);
  });
});

describe("openMusicRequest", () => {
  it("yalnız bizim çerçeveden ve kökenden gelen isteği kabul eder", () => {
    const m = { data: { type: OPEN_MUSIC_TYPE }, origin, source: frame };
    expect(openMusicRequest(m, frame, origin)).toBe(true);
    expect(openMusicRequest({ ...m, source: {} }, frame, origin)).toBe(false);
    expect(openMusicRequest({ ...m, origin: "https://ornek.com" }, frame, origin)).toBe(false);
    expect(openMusicRequest(ok("https://ornek.com"), frame, origin)).toBe(false);
  });
});

describe("temaIstegi", () => {
  it("yalnız bizim çerçeveden gelen tema isteğini kabul eder", () => {
    const m = { data: { tur: "studio-tema-iste" }, origin, source: frame };
    expect(temaIstegi(m, frame, origin)).toBe(true);
    expect(temaIstegi({ ...m, source: {} }, frame, origin)).toBe(false);
    expect(temaIstegi({ ...m, origin: "https://ornek.com" }, frame, origin)).toBe(false);
  });
});

describe("gömülü sözleşme (T2)", () => {
  it("odak-birak yalnız bizim çerçeveden ve kökenden kabul edilir", () => {
    const m = { data: { type: ODAK_BIRAK_TYPE }, origin, source: frame };
    expect(odakBirakRequest(m, frame, origin)).toBe(true);
    expect(odakBirakRequest({ ...m, source: {} }, frame, origin)).toBe(false);
    expect(odakBirakRequest({ ...m, origin: "https://ornek.com" }, frame, origin)).toBe(false);
  });

  it("ayara-git ve geri-al iletileri botun beklediği biçimde", () => {
    expect(ayaraGitMesaji("Komutları içe aktar", "Komut Aktarma")).toEqual({ tur: "ayara-git", ayar: "Komutları içe aktar", sekme: "Komut Aktarma" });
    expect(ayaraGitMesaji("Bekleme (dakika)")).toEqual({ tur: "ayara-git", ayar: "Bekleme (dakika)" });
    expect(GERI_AL_MESAJI).toEqual({ tur: "geri-al" });
  });

  it("bot ayarı isteği bir kez alınır", () => {
    const olaylar: string[] = [];
    (globalThis as { window?: unknown }).window ??= { dispatchEvent: (e: Event) => olaylar.push(e.type) };
    botAyariIste("Etiket", "Genel");
    expect(bekleyenBotAyariAl()).toEqual({ ayar: "Etiket", sekme: "Genel" });
    expect(bekleyenBotAyariAl()).toBeNull();
  });

  it("Ctrl+Z yazı alanında tarayıcıda kalır, başka yerde bota gider", () => {
    const z = { key: "z", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
    expect(geriAlBotaGider(z, { tagName: "BUTTON" })).toBe(true);
    expect(geriAlBotaGider(z, null)).toBe(true);
    expect(geriAlBotaGider(z, { tagName: "INPUT" })).toBe(false);
    expect(geriAlBotaGider(z, { tagName: "DIV", isContentEditable: true })).toBe(false);
    expect(geriAlBotaGider({ ...z, shiftKey: true }, null)).toBe(false);
  });
});
