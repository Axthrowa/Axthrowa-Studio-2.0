import { describe, expect, it } from "vitest";
import {
  clampLoops,
  describeRule,
  nextLoopState,
  resolveEndRule,
  ruleStopStream,
  ruleThenScene,
  shouldCountLoop,
  STARTING_DEFAULT_MINUTES,
} from "./endRules";

describe("resolveEndRule — eski alanlardan türetme (geriye uyum)", () => {
  // Kural yokken eski davranış birebir korunmalı: bu tablo onun sözleşmesi.
  it("giriş: kodda sabit 5 dakika, targetDate yok sayılır", () => {
    const r = resolveEndRule("starting", undefined, { targetDate: "2030-01-01T00:00" });
    expect(r.explicit).toBe(false);
    expect(r.mode).toBe("minutes");
    expect(r.minutes).toBe(STARTING_DEFAULT_MINUTES);
    expect(r.useTargetDate).toBe(false);
  });

  it("mola: brbMinutes dakikası", () => {
    const r = resolveEndRule("brb", {}, { brbMinutes: 7 });
    expect(r).toMatchObject({ explicit: false, mode: "minutes", minutes: 7 });
  });

  it("çıkış: endingMinutes dakikası, 0 ise sayaç yok", () => {
    expect(resolveEndRule("ending", {}, { endingMinutes: 3 }).minutes).toBe(3);
    expect(resolveEndRule("ending", {}, { endingMinutes: 0 }).minutes).toBe(0);
  });

  it("mola ve çıkışta targetDate varsa dakikanın yerine geçer", () => {
    const r = resolveEndRule("brb", {}, { brbMinutes: 5, targetDate: "2030-01-01T20:00" });
    expect(r).toMatchObject({ mode: "targetDate", useTargetDate: true, minutes: 0 });
  });

  it("bozuk/boş değerler 0 dakikaya iner", () => {
    expect(resolveEndRule("brb", {}, { brbMinutes: "abc" }).minutes).toBe(0);
    expect(resolveEndRule("brb", {}, { brbMinutes: -4 }).minutes).toBe(0);
  });
});

describe("resolveEndRule — açık kural", () => {
  it("video N kez modu", () => {
    const r = resolveEndRule("starting", { endRules: { starting: { mode: "mediaLoops", loops: 3 } } }, {});
    expect(r).toMatchObject({ explicit: true, mode: "mediaLoops", loops: 3, usesMedia: true, minutes: 0 });
  });

  it("video bitince modu tek turda biter", () => {
    const r = resolveEndRule("ending", { endRules: { ending: { mode: "mediaEnd" } } }, {});
    expect(r).toMatchObject({ explicit: true, usesMedia: true, loops: 1, minutes: 0 });
  });

  it("süre veya video bitişi: ikisi birden etkin", () => {
    // Eskiden "dakika" ile "medya bitişi" birbirini dışlıyordu.
    const r = resolveEndRule(
      "brb",
      { endRules: { brb: { mode: "minutesOrMediaEnd", minutes: 10 } } },
      {}
    );
    expect(r).toMatchObject({ explicit: true, minutes: 10, usesMedia: true });
  });

  it("hedef saat modu giriş ekranında da geçerli", () => {
    // Eski davranışta giriş ekranı targetDate'i yok sayıyordu.
    const r = resolveEndRule("starting", { endRules: { starting: { mode: "targetDate" } } }, {});
    expect(r).toMatchObject({ explicit: true, useTargetDate: true });
  });

  it("hedef saat: kuralın kendi tarihi ekran alanından önceliklidir", () => {
    const r = resolveEndRule(
      "ending",
      { endRules: { ending: { mode: "targetDate", targetDate: "2030-05-05T21:00" } } },
      { targetDate: "2029-01-01T00:00" }
    );
    expect(r.targetDate).toBe("2030-05-05T21:00");
    // Kuralda tarih yoksa ekranın eski alanı kullanılır
    const f = resolveEndRule(
      "ending",
      { endRules: { ending: { mode: "targetDate" } } },
      { targetDate: "2029-01-01T00:00" }
    );
    expect(f.targetDate).toBe("2029-01-01T00:00");
    // Tarih modunda değilse tarih taşınmaz
    const m = resolveEndRule("ending", { endRules: { ending: { mode: "mediaEnd", targetDate: "x" } } }, {});
    expect(m.targetDate).toBe("");
  });

  it("süre modunda dakika girilmemişse eski varsayılana düşer", () => {
    const r = resolveEndRule("starting", { endRules: { starting: { mode: "minutes" } } }, {});
    expect(r.minutes).toBe(STARTING_DEFAULT_MINUTES);
    const b = resolveEndRule("brb", { endRules: { brb: { mode: "minutes" } } }, { brbMinutes: 9 });
    expect(b.minutes).toBe(9);
  });

  it("elle geç kendiliğinden bitmez", () => {
    const r = resolveEndRule("brb", { endRules: { brb: { mode: "manual" } } }, { brbMinutes: 5 });
    expect(r).toMatchObject({ explicit: true, minutes: 0, usesMedia: false, useTargetDate: false });
  });

  it("null kural 'kural yok' demektir (sıfırlama bu yolla yapılır)", () => {
    // Ekranlar arası yansıtma deep_merge ile yapıldığı için sıfırlama anahtarı
    // silmek yerine null yazıyor; çözümleyici bunu eski davranışa çevirmeli.
    const r = resolveEndRule("brb", { endRules: { brb: null } }, { brbMinutes: 5 });
    expect(r).toMatchObject({ explicit: false, minutes: 5 });
    expect(resolveEndRule("brb", { endRules: null }, { brbMinutes: 5 }).explicit).toBe(false);
  });

  it("geçersiz mod yok sayılır, eski davranışa dönülür", () => {
    const r = resolveEndRule(
      "brb",
      { endRules: { brb: { mode: "uydurma" as never } } },
      { brbMinutes: 5 }
    );
    expect(r).toMatchObject({ explicit: false, minutes: 5 });
  });

  it("bitişte sahne ve yayın kapatma alanlarını taşır", () => {
    const r = resolveEndRule(
      "ending",
      { endRules: { ending: { mode: "mediaEnd", thenScene: " Oyun ", stopStream: false } } },
      {}
    );
    expect(r.thenScene).toBe("Oyun");
    expect(r.stopStream).toBe(false);
  });
});

describe("döngü sayacı", () => {
  it("clampLoops güvenli aralıkta tutar", () => {
    expect(clampLoops(0)).toBe(1);
    expect(clampLoops(-5)).toBe(1);
    expect(clampLoops(3.6)).toBe(4);
    expect(clampLoops(500)).toBe(99);
    expect(clampLoops("abc")).toBe(1);
  });

  it("N tura ulaşınca biter, öncesinde sürdürür", () => {
    let seen = 0;
    const gecmis: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      const st = nextLoopState(seen, 3);
      seen = st.seen;
      gecmis.push(st.done);
    }
    expect(gecmis).toEqual([false, false, true]);
  });

  it("hedef 1 ise ilk bitişte tamamdır", () => {
    expect(nextLoopState(0, 1)).toEqual({ seen: 1, done: true });
  });

  it("aynı turun iki olayla iki kez sayılması engellenir", () => {
    // timeupdate (bitişe 0.2 sn) + ended aynı turu bildirir.
    expect(shouldCountLoop(0, 10_000)).toBe(true);
    expect(shouldCountLoop(10_000, 10_300)).toBe(false);
    expect(shouldCountLoop(10_000, 11_600)).toBe(true);
  });
});

describe("describeRule", () => {
  it("okunur özet üretir", () => {
    const r = resolveEndRule("starting", { endRules: { starting: { mode: "mediaLoops", loops: 4 } } }, {});
    expect(describeRule(r)).toBe("Video 4 kez dönünce biter");
    const m = resolveEndRule("brb", {}, { brbMinutes: 5 });
    expect(describeRule(m)).toBe("5 dakika sonra biter");
  });
});

describe("bitiş eylemi — sahne ve yayın kapatma", () => {
  it("kuralda seçilen sahne eski çözümden önceliklidir", () => {
    const obs = { endRules: { starting: { mode: "mediaEnd" as const, thenScene: " Oyun 2 " } } };
    expect(ruleThenScene(obs, "starting", "Eski Oyun")).toBe("Oyun 2");
  });

  it("kural yoksa ya da sahne boşsa eski çözüme düşer", () => {
    expect(ruleThenScene({}, "starting", "Eski Oyun")).toBe("Eski Oyun");
    expect(ruleThenScene(undefined, "brb", "Dönüş")).toBe("Dönüş");
    expect(
      ruleThenScene({ endRules: { brb: { mode: "minutes" as const, thenScene: "  " } } }, "brb", "Dönüş")
    ).toBe("Dönüş");
    // null (sıfırlanmış) kural da eski çözüme düşer
    expect(ruleThenScene({ endRules: { brb: null } }, "brb", "Dönüş")).toBe("Dönüş");
  });

  it("yayın kapatma: kural açıkça seçtiyse o, yoksa eski ayar (varsayılan kapat)", () => {
    expect(ruleStopStream({})).toBe(true);
    expect(ruleStopStream({ stopStreamOnEnd: false })).toBe(false);
    expect(ruleStopStream({ endRules: { ending: { mode: "mediaEnd" as const, stopStream: false } } })).toBe(false);
    // Kural bir şey söylemiyorsa eski ayar geçerli
    expect(
      ruleStopStream({ stopStreamOnEnd: false, endRules: { ending: { mode: "mediaEnd" as const } } })
    ).toBe(false);
    // Kural true derse eski false'u ezer
    expect(
      ruleStopStream({ stopStreamOnEnd: false, endRules: { ending: { mode: "mediaEnd" as const, stopStream: true } } })
    ).toBe(true);
  });
});
