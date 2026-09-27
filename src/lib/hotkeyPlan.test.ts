import { describe, expect, it } from "vitest";
import {
  bindingName,
  buildHotkeyPlan,
  conflictFailures,
  migrateHotkeyDefaults,
} from "./hotkeyPlan";

describe("buildHotkeyPlan", () => {
  it("boş kısayola varsayılan atamaz", () => {
    // Regresyon: `hk.starting || "F1"` yüzünden kullanıcı temizlese bile
    // F1-F4 işletim sisteminde kayıtlı kalıyordu.
    const plan = buildHotkeyPlan({ obs: { hotkeys: {} } });
    expect(plan.bindings).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it("tuş metnini canonical hâle getirir", () => {
    // Diskte "CTRL+F1", arayüzde "Ctrl+F1" yazıyordu; ikisi aynı tuş.
    const plan = buildHotkeyPlan({ obs: { hotkeys: { starting: "CTRL+F1" } } });
    expect(plan.bindings).toHaveLength(1);
    expect(plan.bindings[0].spec).toBe("Ctrl+F1");
  });

  it("aynı tuşu farklı yazımla isteyen iki eylem çakışma sayılır", () => {
    // Asıl hata: biri Rust'ta, diğeri WebView'de tetikleniyordu.
    const plan = buildHotkeyPlan({
      obs: { hotkeys: { starting: "CTRL+F1" } },
      sfxPads: [{ id: "pad1", name: "Alkış", hotkey: "Ctrl+F1" }],
    });
    expect(plan.bindings).toHaveLength(1);
    expect(plan.bindings[0].id).toBe("starting");
    expect(plan.conflicts).toEqual([
      { spec: "Ctrl+F1", winnerId: "starting", loserIds: ["sfx:pad1"] },
    ]);
    // Yalnız kaybeden uyarı alır; kazanan kısayol çalışmaya devam eder.
    expect(conflictFailures(plan).map((f) => f.id)).toEqual(["sfx:pad1"]);
  });

  it("sahne kısayolu aksiyondan önce gelir", () => {
    const plan = buildHotkeyPlan({
      obs: { hotkeys: { brb: "F3", muteAll: "F3" } },
    });
    expect(plan.bindings.map((b) => b.id)).toEqual(["brb"]);
    expect(plan.conflicts[0].loserIds).toEqual(["muteAll"]);
  });

  it("geçersiz kombinasyon invalid listesine düşer, planı bozmaz", () => {
    const plan = buildHotkeyPlan({
      obs: { hotkeys: { starting: "Ctrl+", ending: "F2" } },
    });
    expect(plan.invalid).toEqual([{ id: "starting", spec: "Ctrl+" }]);
    expect(plan.bindings.map((b) => b.id)).toEqual(["ending"]);
  });

  it("ek sahne ve kaynak satırlarını da toplar", () => {
    const plan = buildHotkeyPlan({
      obs: {
        hotkeys: { mic: "F5" },
        micInput: "Mikrofon",
        sceneSwitchHotkeys: [{ id: "a", scene: "Oyun 2", hotkey: "F6" }],
        sourceMuteHotkeys: [{ id: "b", input: "Müzik", hotkey: "F7" }],
      },
      sfxPads: [{ id: "p", hotkey: "F8" }],
      clearChatHk: "F9",
    });
    expect(plan.bindings.map((b) => b.id)).toEqual([
      "sceneSwitch:a",
      "mic",
      "srcMute:b",
      "sfx:p",
      "clearChat",
    ]);
    expect(plan.bindings.find((b) => b.id === "mic")?.input).toBe("Mikrofon");
    expect(plan.bindings.find((b) => b.id === "sceneSwitch:a")?.scene).toBe("Oyun 2");
  });

  it("sahnesi olmayan ek satır elenir", () => {
    const plan = buildHotkeyPlan({
      obs: { sceneSwitchHotkeys: [{ id: "a", scene: "  ", hotkey: "F6" }] },
    });
    expect(plan.bindings).toEqual([]);
  });
});

describe("migrateHotkeyDefaults", () => {
  it("ilk çalıştırmada eski varsayılanları diske yazar", () => {
    const patch = migrateHotkeyDefaults({ hotkeys: {} });
    expect(patch).toEqual({
      hotkeys: { starting: "F1", ending: "F2", brb: "F3", game: "F4" },
      hotkeyDefaultsApplied: true,
    });
  });

  it("kullanıcının kendi atamasını ezmez", () => {
    const patch = migrateHotkeyDefaults({ hotkeys: { starting: "Ctrl+1" } });
    expect(patch?.hotkeys.starting).toBe("Ctrl+1");
    expect(patch?.hotkeys.ending).toBe("F2");
  });

  it("bir kez uygulandıktan sonra tekrar etmez", () => {
    expect(migrateHotkeyDefaults({ hotkeyDefaultsApplied: true, hotkeys: {} })).toBeNull();
  });

  it("göçten sonra temizlenen kısayol geri gelmez", () => {
    // Bayrak yazıldığı için ikinci turda boş kalanlar doldurulmaz.
    const ilk = migrateHotkeyDefaults({ hotkeys: {} });
    const sonra = migrateHotkeyDefaults({ ...ilk, hotkeys: {} });
    expect(sonra).toBeNull();
  });
});

describe("conflictFailures", () => {
  it("çakışmayı Rust'ın failed biçimine ve okunur sebebe çevirir", () => {
    const plan = buildHotkeyPlan({
      obs: { hotkeys: { brb: "CTRL+F3" } },
      sfxPads: [{ id: "p1", name: "Alkış", hotkey: "Ctrl+F3" }],
    });
    expect(conflictFailures(plan)).toEqual([
      {
        id: "sfx:p1",
        spec: "Ctrl+F3",
        reason: "Ctrl+F3 tuşu zaten Mola sahnesi için kullanılıyor",
      },
    ]);
  });

  it("çakışma yoksa boş liste", () => {
    expect(conflictFailures(buildHotkeyPlan({ obs: { hotkeys: { brb: "F3" } } }))).toEqual([]);
  });

  it("aynı tuşu isteyen birden çok satırın hepsi raporlanır", () => {
    const plan = buildHotkeyPlan({
      obs: { hotkeys: { brb: "F3", mic: "F3", muteAll: "f3" } },
    });
    expect(conflictFailures(plan).map((f) => f.id)).toEqual(["mic", "muteAll"]);
  });
});

describe("bindingName", () => {
  it("sabit kimlikler ve etiketli binding okunur ad alır", () => {
    expect(bindingName("starting", [])).toBe("Giriş sahnesi");
    expect(bindingName("music", [])).toBe("Müzik");
    expect(bindingName("act:1", [{ id: "act:1", spec: "F5", label: "Kamera" }])).toBe("«Kamera»");
    expect(bindingName("sfx:9", [])).toBe("bir ses efekti");
    expect(bindingName("act:9", [])).toBe("bir OBS eylemi");
  });
});

describe("tüm sesleri durdur kısayolu", () => {
  it("atanınca sfxStop binding'i olarak plana girer", () => {
    const plan = buildHotkeyPlan({ obs: {}, sfxStopHk: "ctrl+shift+s" });
    expect(plan.bindings.map((b) => b.id)).toEqual(["sfxStop"]);
    expect(plan.bindings[0].kind).toBe("sfxStop");
    expect(plan.bindings[0].spec).toBe("Ctrl+Shift+S");
  });

  it("boşsa plana girmez", () => {
    expect(buildHotkeyPlan({ obs: {}, sfxStopHk: "  " }).bindings).toEqual([]);
  });

  it("bir ses tuşuyla çakışırsa çakışma olarak raporlanır", () => {
    const plan = buildHotkeyPlan({
      obs: {},
      sfxPads: [{ id: "p", name: "Alkış", hotkey: "Ctrl+H" }],
      sfxStopHk: "CTRL+H",
    });
    expect(plan.conflicts[0].loserIds).toEqual(["sfxStop"]);
  });

  it("çakışma mesajında okunur ad kullanılır", () => {
    expect(bindingName("sfxStop", [])).toBe("Tüm sesleri durdur");
  });
});
