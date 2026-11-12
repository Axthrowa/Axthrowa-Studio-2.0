import { describe, expect, it } from "vitest";
import { discordWebhookAllowed, pickCategory } from "./platformActions";

describe("platformActions", () => {
  it("accepts only Discord webhook URLs", () => {
    expect(discordWebhookAllowed("https://discord.com/api/webhooks/1/abc")).toBe(true);
    expect(discordWebhookAllowed("https://discordapp.com/api/webhooks/1/abc")).toBe(true);
    expect(discordWebhookAllowed("https://evil.example/api/webhooks/1/abc")).toBe(false);
    expect(discordWebhookAllowed("http://discord.com/api/webhooks/1/abc")).toBe(false);
    expect(discordWebhookAllowed("")).toBe(false);
  });

  it("picks an exact category name, otherwise the first hit", () => {
    const list = [
      { id: 1, name: "Just Chatting" },
      { id: 2, name: "Just Chatting 2" },
    ];
    expect(pickCategory(list, "just chatting")?.id).toBe(1);
    expect(pickCategory(list, "yok")?.id).toBe(1);
    expect(pickCategory([], "x")).toBeNull();
  });
});
