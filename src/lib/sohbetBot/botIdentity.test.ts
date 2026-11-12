import { describe, expect, it } from "vitest";
import { isLocalBotUser } from "./botIdentity";

describe("isLocalBotUser", () => {
  it("bot adlarını sayar, izleyiciyi saymaz", () => {
    expect(isLocalBotUser("BotAxT")).toBe(true);
    expect(isLocalBotUser("@axbot")).toBe(true);
    expect(isLocalBotUser("izleyici")).toBe(false);
  });
});
