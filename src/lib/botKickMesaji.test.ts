import { describe, expect, it } from "vitest";
import { botKickMesaji } from "./chatHub";

describe("botKickMesaji", () => {
  it("botun Kick iletisini ortak iletiye çevirir, gerçek rozeti taşır", () => {
    const m = botKickMesaji({
      id: "7",
      platform: "kick",
      channel: "kanal",
      message: "selam",
      timestamp: 1000,
      user: { username: "ada", displayName: "Ada", color: "#fff", rawBadges: [{ type: "moderator" }] },
    });
    expect(m?.key).toBe("kick:7");
    expect(m?.user).toBe("Ada");
    expect(m?.text).toBe("selam");
    expect(m?.badges[0].svg).toContain("linearGradient");
  });

  it("kara listedeki ve kalkana takılan ileti gösterilmez", () => {
    const m = { platform: "kick", message: "x", user: { username: "a" } };
    expect(botKickMesaji({ ...m, karaListede: true })).toBeNull();
    expect(botKickMesaji({ ...m, kalkanda: "link" })).toBeNull();
  });

  it("başka platformun iletisini almaz", () => {
    expect(botKickMesaji({ platform: "twitch", message: "x", user: {} })).toBeNull();
  });
});
