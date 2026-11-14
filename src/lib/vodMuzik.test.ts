import { describe, expect, it } from "vitest";
import { muzikGirisiMi, vodaGidenMuzik, vodIzi } from "./vodMuzik";

describe("VOD için müzik denetimi (Y14)", () => {
  it("müzik kaynağını tanır", () => {
    expect(muzikGirisiMi({ ad: "Müzik", tur: "ffmpeg_source" })).toBe(true);
    expect(muzikGirisiMi({ ad: "Uygulama sesi", tur: "wasapi_process_output_capture", ayar: { window: "Spotify Premium:Chrome_WidgetWin_0:Spotify.exe" } })).toBe(true);
    expect(muzikGirisiMi({ ad: "Çalar", tur: "browser_source", ayar: { url: "http://127.0.0.1:8850/overlay" } })).toBe(true);
    expect(muzikGirisiMi({ ad: "Mikrofon", tur: "wasapi_input_capture" })).toBe(false);
    expect(muzikGirisiMi({ ad: "Oyun", tur: "wasapi_process_output_capture", ayar: { window: "Valorant:x:VALORANT.exe" } })).toBe(false);
  });

  it("VOD izi ve o ize giden müzik", () => {
    expect(vodIzi({ mod: "Advanced", acik: true, iz: 3 })).toBe(3);
    expect(vodIzi({ mod: "Advanced", acik: false, iz: 3 })).toBeNull();
    expect(vodIzi({ mod: "Simple", acik: true, iz: 0 })).toBe(2);
    const girisler = [
      { ad: "Müzik", izler: { "1": true, "2": true } },
      { ad: "Spotify", izler: { "1": true, "2": false } },
    ];
    expect(vodaGidenMuzik(2, girisler)).toEqual(["Müzik"]);
    expect(vodaGidenMuzik(null, girisler)).toEqual([]);
  });
});
