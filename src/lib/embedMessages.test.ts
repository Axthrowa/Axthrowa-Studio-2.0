import { describe, expect, it } from "vitest";
import { OPEN_EXTERNAL_TYPE, frameOrigin, openExternalRequest, resonanceLinkAllowed } from "./embedMessages";

const frame = { name: "streamaxt-frame" };
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
