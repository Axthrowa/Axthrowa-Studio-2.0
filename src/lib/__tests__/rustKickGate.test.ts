import { describe, expect, it } from "vitest";
import { isRustKickChatActive, setRustKickChatActive } from "../rustKickGate";

describe("rustKickGate", () => {
  it("tracks rust kick listener without clearing on false→true", () => {
    setRustKickChatActive(false);
    expect(isRustKickChatActive()).toBe(false);
    setRustKickChatActive(true);
    expect(isRustKickChatActive()).toBe(true);
    setRustKickChatActive(0 as unknown as boolean);
    expect(isRustKickChatActive()).toBe(false);
    setRustKickChatActive(true);
    expect(isRustKickChatActive()).toBe(true);
  });
});
