import { describe, expect, it } from "vitest";
import { formatAppError, isErrorLike } from "../appAlert";

describe("appAlert", () => {
  it("maps Failed to fetch to Turkish recovery text", () => {
    const msg = formatAppError("Failed to fetch");
    expect(msg).toContain("Yerel uygulamaya ulaşılamadı");
    expect(msg).toContain("Baslat.bat");
    expect(msg).not.toContain("sohbet dinleniyor");
  });

  it("maps Kick 429 rate limit to a queue hint", () => {
    const msg = formatAppError(
      'Kick API chat gönderilemedi (429: {"data":{},"message":"Rate limit exceeded"})'
    );
    expect(msg).toContain("hız limiti");
    expect(msg).toContain("/mod verin");
    expect(msg).not.toContain("Rate limit exceeded");
  });

  it("classifies errors vs success toasts", () => {
    expect(isErrorLike("Failed to fetch")).toBe(true);
    expect(isErrorLike("Komut kaydedilemedi")).toBe(true);
    expect(isErrorLike("Kick sohbet bağlanamadı")).toBe(true);
    expect(isErrorLike("Komut kaydedildi")).toBe(false);
    expect(isErrorLike("Kick API bağlandı ✓")).toBe(false);
    expect(isErrorLike("Test mesajı gönderildi ✓ (Kick API)")).toBe(false);
  });
});
