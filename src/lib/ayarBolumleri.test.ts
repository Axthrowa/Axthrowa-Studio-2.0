import { describe, expect, it } from "vitest";
import { SETTINGS_SECTIONS } from "./panelLayout";
import { en, tr, type MsgKey } from "../i18n/messages";
import AYAR_DIZINI from "./ayarDizini.json";

describe("Ayarlar bölümleri (UI-6)", () => {
  it("plandaki bölümler sırayla, Gelişmiş, Yardım ve Hakkında sonda", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual(["gorunum", "obs", "yedek", "guncelleme", "paylasim", "altyazi", "gizlilik", "gelismis", "help", "about"]);
  });

  it("her bölümün iki dilde adı var", () => {
    for (const s of SETTINGS_SECTIONS) {
      expect(tr[s.labelKey as MsgKey], s.id).toBeTruthy();
      expect(en[s.labelKey as MsgKey], s.id).toBeTruthy();
    }
  });

  it("komut paletinin ayar dizini var olan bölüm adlarına iner", () => {
    const adlar = new Set<string>(SETTINGS_SECTIONS.map((s) => tr[s.labelKey as MsgKey]));
    const ayarlar = (AYAR_DIZINI as { s: string; t?: string }[]).filter((k) => k.s === "settings" && k.t);
    expect(ayarlar.length).toBeGreaterThan(10);
    for (const k of ayarlar) expect(adlar.has(k.t!), k.t).toBe(true);
  });
});
