import { describe, expect, it } from "vitest";
import type { StreamSession } from "./api/botApi";
import { vodHatirlatmalari } from "./vodHatirlatici";

const GUN = 86_400_000;
const simdi = Date.UTC(2026, 10, 14, 12);
const oturum = (id: string, bitisGunOnce: number | null): StreamSession => ({
  id,
  channel_id: "c",
  started_at: simdi - (bitisGunOnce ?? 0) * GUN - 3_600_000,
  ended_at: bitisGunOnce === null ? null : simdi - bitisGunOnce * GUN,
  title: id === "a" ? "Gece yayını" : null,
  category: null,
  peak_viewers: 0,
  avg_viewers: 0,
  new_followers: 0,
  new_subs: 0,
  tips_total: 0,
  chat_messages: 0,
  duration_sec: 3600,
  notes: null,
  vod_url: null,
});

describe("VOD hatırlatıcısı (Y4)", () => {
  it("silinmeye 2 gün kalan yayınları bir kez hatırlatır", () => {
    const liste = [oturum("a", 5.5), oturum("b", 6.9), oturum("yeni", 2), oturum("silindi", 8), oturum("acik", null)];
    const r = vodHatirlatmalari(liste, simdi, new Set());
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r[0].metin).toContain("(Gece yayını) Kick VOD'u 2 gün içinde silinir");
    expect(r[1].metin).toContain("1 gün içinde");
    expect(vodHatirlatmalari(liste, simdi, new Set(["a", "b"]))).toEqual([]);
  });
});
