import { describe, expect, it } from "vitest";
import type { StreamSession } from "../../lib/api/botApi";
import { enIyiDilim, karsilastirmaSatirlari } from "./YayinKarsilastirma";

const oturum = (id: string, baslangic: Date, sn: number | null, ort: number): StreamSession => ({
  id,
  channel_id: "c",
  started_at: baslangic.getTime(),
  ended_at: sn === null ? null : baslangic.getTime() + sn * 1000,
  title: null,
  category: null,
  peak_viewers: ort * 2,
  avg_viewers: ort,
  new_followers: 6,
  new_subs: 0,
  tips_total: 0,
  chat_messages: 240,
  duration_sec: sn,
  notes: null,
  vod_url: null,
});

describe("yayın karşılaştırması (Y3)", () => {
  it("biten yayınları oranlarla sıralar, açık ve çok kısa olanı atar", () => {
    const s = karsilastirmaSatirlari([
      oturum("b", new Date(2026, 10, 7, 20), 7200, 30),
      oturum("a", new Date(2026, 10, 1, 20), 3600, 10),
      oturum("acik", new Date(2026, 10, 8, 20), null, 99),
      oturum("kisa", new Date(2026, 10, 9, 20), 30, 99),
    ]);
    expect(s.map((x) => x.id)).toEqual(["a", "b"]);
    expect(s[0]).toMatchObject({ takipSaat: 6, mesajDk: 4 });
    expect(s[1]).toMatchObject({ takipSaat: 3, mesajDk: 2 });
  });

  it("gün ve saate göre en iyi ortalamayı bulur", () => {
    const s = karsilastirmaSatirlari([
      oturum("1", new Date(2026, 10, 7, 20, 10), 3600, 30), // Cumartesi
      oturum("2", new Date(2026, 10, 14, 20, 5), 3600, 50), // Cumartesi
      oturum("3", new Date(2026, 10, 10, 18), 3600, 35), // Salı
    ]);
    expect(enIyiDilim(s)).toEqual({ ad: "Cumartesi 20:00", ort: 40, yayin: 2 });
    expect(enIyiDilim(s.slice(0, 1))).toBeNull();
  });
});
