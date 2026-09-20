import { describe, expect, it } from "vitest";
import { kickParts, normalizeParts, partsToText, twitchParts } from "./chatParts";
import { kickBadges, twitchBadges, youtubeBadges } from "./chatBadges";
import { parseLine, normalizeTwitchChannel } from "./twitchChat";
import { chatHubConfig, configKey, kickSlugFrom, parseKickMessage, resolveChannels } from "./chatHub";

describe("Twitch emote ayrıştırma", () => {
  it("emote'u görsele çevirir, çevresindeki yazıyı korur", () => {
    const parts = twitchParts("selam Kappa dostum", "25:6-10");
    expect(parts).toEqual([
      { type: "text", text: "selam " },
      {
        type: "emote",
        url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0",
        name: "Kappa",
      },
      { type: "text", text: " dostum" },
    ]);
    expect(partsToText(parts)).toBe("selam Kappa dostum");
  });

  it("offsetleri kod noktası olarak sayar (emoji kaydırmasın)", () => {
    // "😀 Kappa" → 😀 UTF-16'da 2 birim, ama Twitch offseti 1 sayar
    const parts = twitchParts("😀 Kappa", "25:2-6");
    expect(parts).toEqual([
      { type: "text", text: "😀 " },
      {
        type: "emote",
        url: "https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0",
        name: "Kappa",
      },
    ]);
  });

  it("aynı emote'un birden çok tekrarını ve çoklu kümeleri işler", () => {
    const parts = twitchParts("Kappa a Kappa b PogChamp", "25:0-4,8-12/88:14-21");
    const emotes = parts.filter((p) => p.type === "emote");
    expect(emotes).toHaveLength(3);
    expect(partsToText(parts)).toBe("Kappa a Kappa b PogChamp");
  });

  it("etiket yoksa veya bozuksa düz metne düşer", () => {
    expect(twitchParts("düz mesaj", undefined)).toEqual([{ type: "text", text: "düz mesaj" }]);
    expect(twitchParts("düz mesaj", "")).toEqual([{ type: "text", text: "düz mesaj" }]);
    expect(twitchParts("düz mesaj", "çöp")).toEqual([{ type: "text", text: "düz mesaj" }]);
    // Aralık mesaj sonunu aşarsa taşmadan kırpılır
    expect(partsToText(twitchParts("kısa", "25:0-99"))).toBe("kısa");
  });
});

describe("Kick emote ayrıştırma", () => {
  it("[emote:id:ad] işaretini görsele çevirir", () => {
    const parts = kickParts("bak [emote:5748043:AINTNOWAY] buna");
    expect(parts).toEqual([
      { type: "text", text: "bak " },
      {
        type: "emote",
        url: "https://files.kick.com/emotes/5748043/fullsize",
        name: "AINTNOWAY",
      },
      { type: "text", text: " buna" },
    ]);
  });

  it("arka arkaya gelen emote'ları ayırır", () => {
    const parts = kickParts("[emote:1:a][emote:2:b]");
    expect(parts.filter((p) => p.type === "emote")).toHaveLength(2);
    expect(parts.some((p) => p.type === "text")).toBe(false);
  });

  it("emote yoksa metni bozmaz", () => {
    expect(kickParts("normal mesaj")).toEqual([{ type: "text", text: "normal mesaj" }]);
    // Yarım kalan işaret düz yazı sayılmalı
    expect(kickParts("[emote:12:")).toEqual([{ type: "text", text: "[emote:12:" }]);
  });
});

describe("Sunucudan gelen parçaların doğrulanması", () => {
  it("geçersiz parçaları eler, boşsa metne düşer", () => {
    expect(normalizeParts([{ type: "text", text: "a" }, null, { type: "emote" }], "yedek")).toEqual([
      { type: "text", text: "a" },
    ]);
    expect(normalizeParts("dizi değil", "yedek")).toEqual([{ type: "text", text: "yedek" }]);
    expect(normalizeParts([], "yedek")).toEqual([{ type: "text", text: "yedek" }]);
  });
});

describe("Rozetler", () => {
  it("Twitch rozet kümesi inmemişken simge yedeğine düşer", () => {
    const badges = twitchBadges("moderator/1,subscriber/12");
    expect(badges).toHaveLength(2);
    expect(badges[0].url).toBeUndefined();
    expect(badges[0].label).toBe("Moderatör");
    expect(badges[0].icon?.path).toBeTruthy();
    expect(badges[0].icon?.color).toBe("#00ad03");
    expect(badges[1].icon?.color).toBe("#9146ff");
  });

  it("bilinmeyen Twitch rozet kümesi için de simge üretir", () => {
    const [b] = twitchBadges("bilinmeyen-set/3");
    expect(b.icon?.path).toBeTruthy();
    expect(b.label).toBe("bilinmeyen-set");
  });

  it("Twitch etiketi boşsa rozet üretmez", () => {
    expect(twitchBadges(undefined)).toEqual([]);
    expect(twitchBadges("")).toEqual([]);
    expect(twitchBadges("bozuk")).toEqual([]);
  });

  it("Kick rozetlerini simge ve sayıyla eşler", () => {
    const badges = kickBadges([
      { type: "moderator", text: "Moderator" },
      { type: "subscriber", text: "Subscriber", count: 9 },
      { type: "bilinmeyen", text: "Şey" },
    ]);
    expect(badges[0].icon?.color).toBe("#00c7ff");
    expect(badges[0].icon?.path).toBeTruthy();
    expect(badges[1].label).toBe("Subscriber (9)");
    // Tanınmayan tip de simgesiz kalmamalı
    expect(badges[2].icon?.path).toBeTruthy();
    expect(kickBadges(undefined)).toEqual([]);
  });

  it("görselli rozet bile yedek simge taşır (404'te kaybolmasın)", () => {
    const [b] = youtubeBadges([{ label: "Üye", url: "https://yt3.ggpht.com/uye/s32" }]);
    expect(b.url).toBeTruthy();
    expect(b.icon?.path).toBeTruthy();
  });

  it("YouTube rozetlerinde görsel ve simgeyi ayırır", () => {
    const badges = youtubeBadges([
      { label: "Moderatör", icon: "MODERATOR", url: null },
      { label: "Üye", url: "https://yt3.ggpht.com/uye/s32" },
      "eski-biçim",
      { label: "", url: null },
    ]);
    expect(badges).toHaveLength(3);
    // Sistem rozeti simgeye, üyelik rozeti kanalın kendi görseline gider
    expect(badges[0].icon?.color).toBe("#5e84f1");
    expect(badges[0].url).toBeUndefined();
    expect(badges[1].url).toBe("https://yt3.ggpht.com/uye/s32");
    expect(badges[2].label).toBe("eski-biçim");
    expect(badges[2].icon?.path).toBeTruthy();
  });
});

describe("Twitch IRC satır ayrıştırma", () => {
  it("PRIVMSG'i emote ve rozetlerle birlikte çözer", () => {
    const line =
      "@badges=moderator/1;color=#FF0000;display-name=Ayse;emotes=25:0-4;id=abc-123;room-id=999;tmi-sent-ts=1700000000000 " +
      ":ayse!ayse@ayse.tmi.twitch.tv PRIVMSG #kanal :Kappa merhaba";
    const m = parseLine(line);
    expect(m).not.toBeNull();
    expect(m!.user).toBe("Ayse");
    expect(m!.color).toBe("#FF0000");
    expect(m!.kind).toBe("chat");
    expect(m!.text).toBe("Kappa merhaba");
    expect(m!.parts[0]).toMatchObject({ type: "emote", name: "Kappa" });
    expect(m!.badges[0].icon?.path).toBeTruthy();
    expect(m!.badges[0].label).toBe("Moderatör");
    expect(m!.ts).toBe(1700000000000);
  });

  it("USERNOTICE'i abonelik olayına çevirir", () => {
    const line =
      "@msg-id=resub;system-msg=Ali\\s3\\saydır\\sabone!;display-name=Ali;id=x1 " +
      ":tmi.twitch.tv USERNOTICE #kanal :tesekkurler";
    const m = parseLine(line);
    expect(m!.kind).toBe("sub");
    expect(m!.text).toBe("Ali 3 aydır abone! — tesekkurler");
  });

  it("ilgisiz satırlarda null döner", () => {
    expect(parseLine(":tmi.twitch.tv 001 justinfan1 :Welcome")).toBeNull();
    expect(parseLine("")).toBeNull();
    expect(parseLine("PING :tmi.twitch.tv")).toBeNull();
  });

  it("kanal adını her biçimden normalleştirir", () => {
    expect(normalizeTwitchChannel("https://twitch.tv/Kanal")).toBe("kanal");
    expect(normalizeTwitchChannel("#Kanal")).toBe("kanal");
    expect(normalizeTwitchChannel("  Kanal/videos ")).toBe("kanal");
    expect(normalizeTwitchChannel("")).toBe("");
  });
});

describe("Kick mesaj gövdesi", () => {
  const payload = {
    id: "m1",
    content: "selam [emote:7:kek]",
    created_at: "2026-09-05T19:00:00Z",
    sender: {
      username: "Veli",
      identity: { color: "#00FF00", badges: [{ type: "vip", text: "VIP" }] },
    },
  };

  it("nesne ve JSON string biçimlerini kabul eder", () => {
    const a = parseKickMessage(payload);
    const b = parseKickMessage(JSON.stringify(payload));
    expect(a).toEqual(b);
    expect(a!.user).toBe("Veli");
    expect(a!.key).toBe("kick:m1");
    expect(a!.parts.filter((p) => p.type === "emote")).toHaveLength(1);
    expect(a!.badges[0].label).toBe("VIP");
    expect(a!.badges[0].icon?.color).toBe("#e9b800");
  });

  it("boş veya bozuk gövdeyi eler", () => {
    expect(parseKickMessage(null)).toBeNull();
    expect(parseKickMessage("json değil")).toBeNull();
    expect(parseKickMessage({ id: "x", content: "   " })).toBeNull();
  });
});

describe("Kanal çözümleme", () => {
  it("boş alanları Giriş ekranı sosyal hesaplarından doldurur", () => {
    const chat = { autoDetect: true, kickSlug: "", twitchChannel: "", youtubeChannel: "" };
    const starting = {
      socials: {
        kick: { handle: "https://kick.com/AxThrowa" },
        twitch: { handle: "#BenimKanalim" },
        youtube: { handle: "@yayinci" },
      },
    };
    expect(resolveChannels(chat, starting)).toEqual({
      kick: "axthrowa",
      twitch: "benimkanalim",
      youtube: "@yayinci",
      youtubeVideoId: "",
    });
  });

  it("açıkça yazılan değer sosyal hesabı ezer", () => {
    const out = resolveChannels(
      { autoDetect: true, twitchChannel: "elle" },
      { socials: { twitch: { handle: "otomatik" } } }
    );
    expect(out.twitch).toBe("elle");
  });

  it("autoDetect kapalıyken sosyal hesapları kullanmaz", () => {
    const out = resolveChannels(
      { autoDetect: false, twitchChannel: "" },
      { socials: { twitch: { handle: "otomatik" } } }
    );
    expect(out.twitch).toBe("");
  });

  it("kick adresini her biçimden ayıklar", () => {
    expect(kickSlugFrom("@Axthrowa")).toBe("axthrowa");
    expect(kickSlugFrom("kick.com/axthrowa/videos")).toBe("axthrowa");
    expect(kickSlugFrom("")).toBe("");
  });
});

describe("Hub yapılandırması", () => {
  it("kanal yoksa platformu kapalı sayar", () => {
    const cfg = chatHubConfig({ autoDetect: false }, null);
    expect(cfg.kick.enabled).toBe(false);
    expect(cfg.twitch.enabled).toBe(false);
    expect(cfg.youtube.enabled).toBe(false);
  });

  it("videoId kanaldan önce gelir", () => {
    const cfg = chatHubConfig(
      { autoDetect: false, youtubeChannel: "@kanal", youtubeVideoId: "dQw4w9WgXcQ" },
      null
    );
    expect(cfg.youtube.ref).toBe("dQw4w9WgXcQ");
  });

  it("anahtar yalnız gerçek değişimde değişir", () => {
    const a = chatHubConfig({ autoDetect: false, twitchChannel: "kanal" }, null);
    const b = chatHubConfig({ autoDetect: false, twitchChannel: "KANAL" }, null);
    const c = chatHubConfig({ autoDetect: false, twitchChannel: "baska" }, null);
    expect(configKey(a)).toBe(configKey(b));
    expect(configKey(a)).not.toBe(configKey(c));
  });
});
