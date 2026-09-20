import { describe, expect, it } from "vitest";
import { safeMediaUrl, sanitizePlainText } from "../sanitizeChat";
import { normalizeParts } from "../chatParts";

describe("XSS guard", () => {
  it("rejects javascript and data URLs", () => {
    expect(safeMediaUrl("javascript:alert(1)")).toBeNull();
    expect(safeMediaUrl("data:text/html,<script>")).toBeNull();
    expect(safeMediaUrl("https://evil.example/x.png")).toBeNull();
    expect(safeMediaUrl("https://files.kick.com/emotes/1/fullsize")).toContain("files.kick.com");
  });

  it("normalizes hostile emote parts into text", () => {
    const parts = normalizeParts(
      [{ type: "emote", url: "javascript:alert(1)", name: "<img>" }],
      "hi"
    );
    expect(parts.some((p) => p.type === "emote")).toBe(false);
    expect(parts[0].type).toBe("text");
  });

  it("strips control characters from chat text", () => {
    expect(sanitizePlainText("selam\u0000<script>")).toBe("selam<script>");
  });
});
