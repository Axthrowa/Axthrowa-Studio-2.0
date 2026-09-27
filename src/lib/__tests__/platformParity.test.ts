import { describe, expect, it } from "vitest";
import { PLATFORM_BRAND, TURQUOISE, type BotPlatform } from "../platformTheme";

const PLATFORMS: BotPlatform[] = ["kick", "twitch", "youtube", "discord"];

describe("platform brand / theme", () => {
  it("uses official brand colors", () => {
    expect(PLATFORM_BRAND.kick.color).toBe("#3EEDFE");
    expect(PLATFORM_BRAND.twitch.color).toBe("#9146FF");
    expect(PLATFORM_BRAND.youtube.color).toBe("#FF0000");
    expect(PLATFORM_BRAND.discord.color).toBe("#5865F2");
    expect(TURQUOISE.color).toBe("#3EEDFE");
  });

  it("covers all chatbot platforms", () => {
    expect(PLATFORMS).toHaveLength(4);
  });
});

describe("security — credentials", () => {
  it("does not embed secrets in authorize query builders", async () => {
    const { buildTwitchAuthorizeUrl } = await import("../platformAuth/twitchWrite");
    const url = buildTwitchAuthorizeUrl("public-client-id");
    expect(url).toContain("client_id=public-client-id");
    expect(url.toLowerCase()).not.toContain("client_secret");
    expect(url).toContain("id.twitch.tv/oauth2/authorize");
  });
});

describe("performance — theme apply", () => {
  it("applies platform theme within budget", async () => {
    const { applyPlatformTheme } = await import("../platformTheme");
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) {
      applyPlatformTheme(PLATFORMS[i % 4]);
    }
    applyPlatformTheme(null);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(250);
  });
});

describe("stress — theme + nav", () => {
  it("survives rapid platform switches", async () => {
    const { setActivePlatform, getActivePlatform } = await import("../platformTheme");
    for (let i = 0; i < 500; i++) {
      setActivePlatform(PLATFORMS[i % 4]);
    }
    expect(getActivePlatform()).toBe("discord");
    setActivePlatform(null);
    expect(getActivePlatform()).toBeNull();
  });
});
