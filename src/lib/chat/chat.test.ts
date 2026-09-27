import { describe, expect, it } from "vitest";
import { isQuestion, mentions, normalizeActivity, normalizeChat } from "./normalize";
import { addActivity, addChat, emptyChat, filterChat, platformCounts, type ChatFilter } from "./store";

const yuk = (o: Record<string, unknown> = {}, user: Record<string, unknown> = {}) => ({
  id: "m1",
  platform: "twitch",
  channel: "axthrowa",
  user: { id: "u1", username: "ali", displayName: "Ali", badges: ["subscriber"], isMod: false, isSub: true, isVip: false, isBroadcaster: false, ...user },
  message: "merhaba",
  timestamp: 1000,
  ...o,
});
const tum: ChatFilter = { view: "all", platforms: new Set(), query: "", showBots: true };

describe("normalizeChat", () => {
  it("kimlik platform + kullanıcı kimliğidir; aynı ad farklı platformda farklı kişidir", () => {
    const tw = normalizeChat(yuk())!;
    const yt = normalizeChat(yuk({ id: "m2", platform: "youtube" }, { id: "UCxyz" }))!;
    expect(tw.userKey).toBe("twitch:u1");
    expect(yt.userKey).toBe("youtube:UCxyz");
    expect(tw.userKey).not.toBe(yt.userKey);
    expect(tw.key).toBe("twitch:m1");
  });

  it("kimlik yoksa ada düşer ve bunu işaretler", () => {
    const m = normalizeChat(yuk({}, { id: "" }))!;
    expect(m.userKey).toBe("twitch:ad:ali");
    expect(m.userKeySource).toBe("name");
  });

  it("roller, bot/sistem, kara liste ve kalkan işaretleri", () => {
    const m = normalizeChat(yuk({}, { isMod: true, isBroadcaster: true }))!;
    expect(m.roles).toEqual(["broadcaster", "moderator", "subscriber"]);
    expect(normalizeChat(yuk({}, { id: "streamaxt_bot" }))!.isBot).toBe(true);
    expect(normalizeChat(yuk({}, { id: "streamaxt_system" }))!.isSystem).toBe(true);
    expect(normalizeChat(yuk({ karaListede: true }))!.moderation).toBe("blocked");
    const k = normalizeChat(yuk({ kalkanda: "caps" }))!;
    expect(k.moderation).toBe("shielded");
    expect(k.moderationReason).toBe("caps");
  });

  it("bozuk yük çökmez; bilinmeyen platform ve geçersiz renk güvenli", () => {
    expect(normalizeChat(null)).toBeNull();
    expect(normalizeChat({})).toBeNull();
    const m = normalizeChat({ platform: "myspace", user: { username: "x", color: "red;background:url(x)" }, message: "a" })!;
    expect(m.platform).toBe("unknown");
    expect(m.color).toBeUndefined();
    expect(m.messageId).toMatch(/^yerel-/);
  });

  it("bahsetme ve soru tespiti", () => {
    expect(mentions("selam @Axthrowa nasılsın", "axthrowa")).toBe(true);
    expect(mentions("axthrowa efsane", "axthrowa")).toBe(true);
    expect(mentions("axthrowa2 başka biri", "axthrowa")).toBe(false);
    expect(normalizeChat(yuk({ message: "@axthrowa bak" }))!.mentionsChannel).toBe(true);
    expect(isQuestion("hangi oyun bu?")).toBe(true);
    expect(isQuestion("?")).toBe(false);
    expect(isQuestion("tamam")).toBe(false);
  });
});

describe("sohbet deposu", () => {
  it("aynı ileti iki kez gelirse tek görünür; ilk kez yazan bir kez işaretlenir", () => {
    let s = emptyChat();
    s = addChat(s, normalizeChat(yuk())!);
    const once = s;
    s = addChat(s, normalizeChat(yuk())!);
    expect(s).toBe(once);
    s = addChat(s, normalizeChat(yuk({ id: "m2" }))!);
    expect(s.messages.map((m) => m.firstInSession)).toEqual([true, false]);
    // Aynı ad, başka platform → ayrı kişi, o da ilk kez
    s = addChat(s, normalizeChat(yuk({ id: "m3", platform: "kick" }))!);
    expect(s.messages[2].firstInSession).toBe(true);
  });

  it("tampon sınırlı; en eskiler düşer", () => {
    let s = emptyChat();
    for (let i = 0; i < 12; i++) s = addChat(s, normalizeChat(yuk({ id: `m${i}` }))!, 5);
    expect(s.messages.map((m) => m.messageId)).toEqual(["m7", "m8", "m9", "m10", "m11"]);
  });

  it("görünümler, platform süzgeci ve arama", () => {
    let s = emptyChat();
    s = addChat(s, normalizeChat(yuk({ id: "a", message: "@axthrowa selam" }))!);
    s = addChat(s, normalizeChat(yuk({ id: "b", platform: "kick", message: "bu hangi oyun?" }, { id: "k1", isSub: false }))!);
    s = addChat(s, normalizeChat(yuk({ id: "c", karaListede: true }, { id: "u9" }))!);
    s = addChat(s, normalizeChat(yuk({ id: "d", message: "komut çalıştı" }, { id: "streamaxt_bot" }))!);
    const ids = (f: Partial<ChatFilter>) => filterChat(s.messages, { ...tum, ...f }).map((m) => m.messageId);
    expect(ids({ view: "mentions" })).toEqual(["a"]);
    expect(ids({ view: "questions" })).toEqual(["b"]);
    expect(ids({ view: "moderation" })).toEqual(["c"]);
    expect(ids({ view: "members" })).toEqual(["a", "c", "d"]);
    expect(ids({ platforms: new Set(["kick"]) })).toEqual(["b"]);
    expect(ids({ showBots: false })).toEqual(["a", "b", "c"]);
    expect(ids({ query: "HANGİ" })).toEqual(["b"]);
    expect(platformCounts(s.messages)).toEqual({ twitch: 3, kick: 1 });
  });
});

describe("etkinlik akışı", () => {
  const alert = (id: string, subType = "tip", data: Record<string, unknown> = {}) => ({
    type: "alert",
    subType,
    data: { platform: "kick", username: "veli", displayName: "Veli", amount: 50, currency: "TRY", message: "iyi yayınlar", timestamp: 5, ...data },
    alert: { id, isTest: false },
  });

  it("uyarı iletisini olaya çevirir; uyarı kimliği olay kimliğidir", () => {
    const e = normalizeActivity(alert("uyari-7"))!;
    expect(e).toMatchObject({ eventId: "uyari-7", alertId: "uyari-7", platform: "kick", eventType: "tip", user: "Veli", amount: 50, currency: "TRY", isTest: false });
    expect(normalizeActivity({ type: "chat" })).toBeNull();
    expect(normalizeActivity(alert("t", "follow", { isTest: true }))!.isTest).toBe(true);
  });

  it("aynı olay yeniden gelirse (yeniden bağlanma) tek kayıt; en yeni başta", () => {
    let l = addActivity([], normalizeActivity(alert("a"))!);
    l = addActivity(l, normalizeActivity(alert("b", "follow"))!);
    l = addActivity(l, normalizeActivity(alert("a"))!);
    expect(l.map((e) => e.eventId)).toEqual(["b", "a"]);
  });
});
