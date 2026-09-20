import { describe, expect, it } from "vitest";
import { obsHatasiniCevir } from "./obsErrors";

describe("obsHatasiniCevir", () => {
  it("eksik şifreyi ham protokol metni yerine somut adıma çevirir", () => {
    const ham =
      "Your payload's data is missing an 'authentication' string, however authentication is required.";
    const h = obsHatasiniCevir(ham);
    expect(h.metin).toBe("OBS şifre istiyor ama şifre alanı boş.");
    // Ham İngilizce metin kullanıcıya sızmamalı
    expect(h.metin).not.toContain("payload");
    expect(h.ipucu).toContain("WebSocket Sunucu Ayarları");
  });

  it("yanlış şifreyi eksik şifreden ayırır", () => {
    expect(obsHatasiniCevir("Authentication failed.").metin).toBe("OBS şifresi yanlış.");
    expect(obsHatasiniCevir("code 4009").metin).toBe("OBS şifresi yanlış.");
  });

  it("bağlantı reddinde portu ipucuna yazar", () => {
    const h = obsHatasiniCevir("connect ECONNREFUSED 127.0.0.1:4455", 4455);
    expect(h.metin).toContain("bağlantı reddedildi");
    expect(h.ipucu).toContain("4455");
  });

  it("yanlış portu el sıkışma hatasından tanır", () => {
    const h = obsHatasiniCevir("Server sent no subprotocol", 4444);
    expect(h.metin).toBe("Bağlanılan port OBS WebSocket değil.");
    expect(h.ipucu).toContain("4444");
  });

  it("zaman aşımı ve DNS hatalarını ayırır", () => {
    expect(obsHatasiniCevir("connect ETIMEDOUT").metin).toContain("zaman aşımı");
    expect(obsHatasiniCevir("getaddrinfo ENOTFOUND obs.local").metin).toContain("çözümlenemedi");
  });

  it("tanımadığı hatada ham metni gösterir ama yine de yol gösterir", () => {
    const h = obsHatasiniCevir("beklenmedik bir şey");
    expect(h.metin).toContain("beklenmedik bir şey");
    expect(h.ipucu.length).toBeGreaterThan(20);
  });
});
