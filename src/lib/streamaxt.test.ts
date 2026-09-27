import { describe, expect, it } from "vitest";
import { baseFromUrl } from "./streamaxt";
import { isAudioInput, meterPercent, meterZone } from "./obsAudio";

describe("baseFromUrl", () => {
  it("durumdaki adresten kökü çıkarır; portu korur (eskiden 3001 sabitti)", () => {
    expect(baseFromUrl("http://127.0.0.1:3011/")).toBe("http://127.0.0.1:3011");
    expect(baseFromUrl("http://127.0.0.1:3001/#dashboard")).toBe("http://127.0.0.1:3001");
    expect(baseFromUrl("")).toBe("http://127.0.0.1:3001");
    expect(baseFromUrl("javascript:alert(1)")).toBe("http://127.0.0.1:3001");
  });
});

describe("isAudioInput", () => {
  it("ses taşıyan girişleri türünden ya da adından tanır", () => {
    expect(isAudioInput("wasapi_input_capture", "Mikrofon")).toBe(true);
    expect(isAudioInput("ffmpeg_source", "Intro")).toBe(true);
    expect(isAudioInput("dshow_input", "Mic kamera")).toBe(true);
    expect(isAudioInput("image_source", "Logo")).toBe(false);
    expect(isAudioInput("text_gdiplus_v3", "Başlık")).toBe(false);
  });
});

describe("ses ölçeri", () => {
  it("dBFS → doluluk ve bölge", () => {
    expect(meterPercent(-100)).toBe(0);
    expect(meterPercent(-60)).toBe(0);
    expect(meterPercent(-30)).toBe(50);
    expect(meterPercent(0)).toBe(100);
    expect(meterPercent(6)).toBe(100);
    expect(meterPercent(Number.NaN)).toBe(0);
    expect(meterZone(-30)).toBe("ok");
    expect(meterZone(-15)).toBe("hot");
    expect(meterZone(-3)).toBe("clip");
  });
});
