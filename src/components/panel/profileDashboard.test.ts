import { describe, expect, it } from "vitest";
import { canPlayDirectly } from "./ProfileDashboard";

describe("canPlayDirectly", () => {
  const yok = () => "";
  const var_ = () => "maybe";

  it("HLS olmayan adresleri video etiketi oynatır", () => {
    expect(canPlayDirectly("https://x/y.mp4", yok)).toBe(true);
    expect(canPlayDirectly("https://x/stream.webm", yok)).toBe(true);
  });

  it("HLS desteklenmiyorsa iframe'e düşülür", () => {
    expect(canPlayDirectly("https://x/live.m3u8", yok)).toBe(false);
    expect(canPlayDirectly("https://x/live.m3u8?token=1", yok)).toBe(false);
  });

  it("HLS destekleniyorsa video etiketi kullanılır", () => {
    expect(canPlayDirectly("https://x/live.m3u8", var_)).toBe(true);
  });
});
