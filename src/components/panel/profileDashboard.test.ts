import { describe, expect, it } from "vitest";
import { canPlayDirectly } from "./ProfileDashboard";

describe("canPlayDirectly", () => {
  it("HLS olmayan adresleri video etiketi oynatır", () => {
    expect(canPlayDirectly("https://x/y.mp4")).toBe(true);
    expect(canPlayDirectly("https://x/stream.webm")).toBe(true);
  });

  it("HLS'te Kick oynatıcısına düşülür", () => {
    expect(canPlayDirectly("https://x/live.m3u8")).toBe(false);
    expect(canPlayDirectly("https://x/live.m3u8?token=1")).toBe(false);
  });
});
