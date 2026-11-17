// UI-10: gömülü bot paneli Studio'nun dilini ?dil=en ile alır
import { describe, expect, it } from "vitest";
import { frameUrl } from "./AxBotHost";

describe("frameUrl", () => {
  it("gömme ve dil parametresini birlikte yazar, eski sorguyu atar", () => {
    expect(frameUrl("http://127.0.0.1:3001/?x=1#eski", "trivia", true, "en")).toBe("http://127.0.0.1:3001/?embed=1&dil=en#trivia");
  });
  it("Türkçede dil parametresi eklenmez", () => {
    expect(frameUrl("http://127.0.0.1:3001/", "multichat", true, "tr")).toBe("http://127.0.0.1:3001/?embed=1#multichat");
    expect(frameUrl("http://127.0.0.1:3001/")).toBe("http://127.0.0.1:3001/");
  });
});
