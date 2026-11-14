import { describe, expect, it } from "vitest";
import { sureMetni } from "./miniKip";

describe("mini kip süre metni (U10)", () => {
  it("saatli ve saatsiz biçim", () => {
    expect(sureMetni(0)).toBe("0:00");
    expect(sureMetni(725_000)).toBe("12:05");
    expect(sureMetni(3_723_000)).toBe("1:02:03");
    expect(sureMetni(-5)).toBe("0:00");
  });
});
