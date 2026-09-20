import { describe, expect, it } from "vitest";
import {
  extractDiscordInvite,
  finalizeCommandReply,
  normalizeSocialUrl,
  sanitizeCommandResponse,
} from "../commandTemplate";

describe("commandTemplate", () => {
  it("builds discord invite from code or domain", () => {
    expect(normalizeSocialUrl("discord", "abc123")).toBe("https://discord.gg/abc123");
    expect(normalizeSocialUrl("discord", "discord.gg/abc123")).toBe(
      "https://discord.gg/abc123"
    );
    expect(normalizeSocialUrl("discord", "https://discord.gg/abc123")).toBe(
      "https://discord.gg/abc123"
    );
    expect(extractDiscordInvite("gel: https://discord.gg/abc123")).toBe(
      "https://discord.gg/abc123"
    );
  });

  it("does not save !discord as the reply text", () => {
    expect(sanitizeCommandResponse("discord", "!discord")).toBe("Discord: {url}");
    expect(sanitizeCommandResponse("discord", "discord")).toBe("Discord: {url}");
    expect(sanitizeCommandResponse("discord", "https://discord.gg/x")).toBe(
      "Discord: {url}"
    );
    expect(sanitizeCommandResponse("discord", "Sunucu: https://discord.gg/x")).toBe(
      "Sunucu: https://discord.gg/x"
    );
  });

  it("replaces echo and leftover {url} with the invite", () => {
    expect(
      finalizeCommandReply({
        name: "discord",
        reply: "!discord",
        url: "https://discord.gg/abc",
        trigger: "!discord",
      })
    ).toBe("Discord: https://discord.gg/abc");
    expect(
      finalizeCommandReply({
        name: "discord",
        reply: "Discord: {url}",
        url: "https://discord.gg/abc",
        trigger: "!discord",
      })
    ).toBe("Discord: https://discord.gg/abc");
  });

  it("asks to set the link when url is missing", () => {
    const msg = finalizeCommandReply({
      name: "discord",
      reply: "Discord: {url}",
      url: "",
      trigger: "!discord",
    });
    expect(msg).toContain("Komutlar");
    expect(msg).not.toContain("{url}");
    expect(msg.toLowerCase()).not.toBe("!discord");
  });
});
