import { describe, expect, it } from "vitest";
import { adresGecerli, temizle } from "./ozelDocklar";

describe("özel tarayıcı dock'ları", () => {
  it("yalnız http(s) adresi", () => {
    expect(adresGecerli("https://dashboard.twitch.tv/popout/u/x/stream-manager/activity-feed")).toBe(true);
    expect(adresGecerli("http://127.0.0.1:8843/widgets/chat")).toBe(true);
    expect(adresGecerli("javascript:alert(1)")).toBe(false);
    expect(adresGecerli("file:///C:/x.html")).toBe(false);
    expect(adresGecerli("data:text/html,x")).toBe(false);
    expect(adresGecerli("sohbet")).toBe(false);
  });
  it("bozuk kayıtlar ayıklanır", () => {
    expect(temizle([{ id: "a", ad: " Sohbet ", url: "https://ornek.com" }, { id: "b", ad: "", url: "https://x" }, { id: "c", ad: "X", url: "javascript:1" }, 5])).toEqual([
      { id: "a", ad: "Sohbet", url: "https://ornek.com" },
    ]);
    expect(temizle(null)).toEqual([]);
  });
});
