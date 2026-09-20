import { describe, expect, it } from "vitest";
import {
  MAX_PROFILES,
  activeProfile,
  addProfile,
  canDelete,
  captureSnapshot,
  chooseSoundboard,
  ensureState,
  removeProfile,
  renameProfile,
  screenForApply,
  screenForProfile,
  stripConnection,
  switchProfile,
  uniqueName,
} from "./settingsProfiles";

const SCREEN = {
  title: "Benim yayınım",
  accent: "#7c5cff",
  obs: {
    host: "192.168.1.109",
    port: 4455,
    password: "gizli",
    micInput: "Mic/Aux",
    hotkeys: { starting: "Ctrl+F1" },
    sceneMap: { brb: "Mola" },
  },
  _sfxCue: { id: "1", stop: true },
  _widgetEvent: { id: "x" },
};

describe("gizlilik: bağlantı ve geçici alanlar profile girmez", () => {
  it("stripConnection host/port/password'ü çıkarır, kalanı korur", () => {
    expect(stripConnection(SCREEN.obs)).toEqual({
      micInput: "Mic/Aux",
      hotkeys: { starting: "Ctrl+F1" },
      sceneMap: { brb: "Mola" },
    });
  });

  it("screenForProfile şifreyi ve geçici alanları çıkarır, kaynağı değiştirmez", () => {
    const out = screenForProfile(SCREEN);
    expect(JSON.stringify(out)).not.toContain("gizli");
    expect(JSON.stringify(out)).not.toContain("192.168");
    expect(out).not.toHaveProperty("_sfxCue");
    expect(out).not.toHaveProperty("_widgetEvent");
    expect(out.obs.micInput).toBe("Mic/Aux");
    expect(SCREEN.obs.password).toBe("gizli");
  });

  it("captureSnapshot dört ekranı, sesleri ve durdur kısayolunu alır", () => {
    const snap = captureSnapshot(
      { starting: SCREEN, ending: { title: "Bitti" } },
      { soundboard: [{ id: "p", file: "a.mp3", hotkey: "Ctrl+H" }], sfxStopHotkey: "Ctrl+S", obs: { password: "x" } }
    );
    expect(Object.keys(snap.screens).sort()).toEqual(["ending", "starting"]);
    expect(snap.soundboard[0].hotkey).toBe("Ctrl+H");
    expect(snap.sfxStopHotkey).toBe("Ctrl+S");
    expect(JSON.stringify(snap)).not.toContain("gizli");
    expect(JSON.stringify(snap)).not.toContain('"x"');
  });
});

describe("screenForApply: profil değişince OBS bağlantısı korunur", () => {
  it("hedef profilin obs'ü mevcut ekranın adres/şifresiyle birleşir", () => {
    const hedef = { title: "Diğer", obs: { micInput: "Mikrofon", hotkeys: { brb: "F3" } } };
    const out = screenForApply(hedef, SCREEN);
    expect(out.title).toBe("Diğer");
    expect(out.obs).toEqual({ micInput: "Mikrofon", hotkeys: { brb: "F3" }, host: "192.168.1.109", port: 4455, password: "gizli" });
  });

  it("hedefte obs yoksa yalnız bağlantı taşınır", () => {
    expect(screenForApply({ title: "x" }, SCREEN).obs).toEqual({ host: "192.168.1.109", port: 4455, password: "gizli" });
  });

  it("mevcutta bağlantı yoksa obs uydurulmaz", () => {
    expect(screenForApply({ title: "x" }, {})).toEqual({ title: "x" });
  });
});

describe("uniqueName", () => {
  it("boşsa varsayılan, uzunsa kırpar", () => {
    expect(uniqueName("  ", [])).toBe("Yeni profil");
    expect(uniqueName("a".repeat(80), []).length).toBe(40);
  });
  it("aynı ad varsa numara ekler, büyük/küçük harf ve Türkçe İ/ı duyarsız", () => {
    expect(uniqueName("Oyun", ["Oyun"])).toBe("Oyun (2)");
    expect(uniqueName("Oyun", ["Oyun", "Oyun (2)"])).toBe("Oyun (3)");
    expect(uniqueName("oyun", ["OYUN"])).toBe("oyun (2)");
  });
  it("yeniden adlandırmada kendi adı çakışma sayılmaz", () => {
    expect(uniqueName("Oyun", ["Oyun", "Sohbet"], "Oyun")).toBe("Oyun");
  });
});

describe("ensureState", () => {
  it("boş/bozuk girdide tek etkin profil üretir", () => {
    for (const raw of [undefined, null, {}, { profiles: "x" }, "bozuk"]) {
      const s = ensureState(raw);
      expect(s.profiles.length).toBe(1);
      expect(s.activeId).toBe(s.profiles[0].id);
      expect(s.profiles[0].data).toBeNull();
    }
  });
  it("geçersiz etkin kimliği ilk profile düşürür, etkin profilin verisini atar", () => {
    const s = ensureState({
      activeId: "yok",
      profiles: [
        { id: "a", name: "A", data: { screens: {}, soundboard: [], sfxStopHotkey: "" } },
        { id: "b", name: "B", data: { screens: {}, soundboard: [], sfxStopHotkey: "" } },
      ],
    });
    expect(s.activeId).toBe("a");
    expect(s.profiles[0].data).toBeNull();
    expect(s.profiles[1].data).not.toBeNull();
  });
  it("yinelenen kimlikleri ve geçersiz kayıtları eler", () => {
    const s = ensureState({ activeId: "a", profiles: [{ id: "a" }, { id: "a" }, null, { name: "kimliksiz" }] });
    expect(s.profiles.map((p) => p.id)).toEqual(["a"]);
  });
});

describe("profil işlemleri", () => {
  const snapA = captureSnapshot({ starting: { title: "A" } }, {});
  const snapB = captureSnapshot({ starting: { title: "B" } }, {});
  const base = ensureState({ activeId: "a", profiles: [{ id: "a", name: "Ana" }] });

  it("yeni profil geçerli ayarlardan türer, etkin olmaz", () => {
    const r = addProfile(base, "Oyun", snapB);
    if ("error" in r) throw new Error(r.error);
    expect(r.state.activeId).toBe("a");
    expect(r.state.profiles.find((p) => p.id === r.id)?.data?.screens.starting?.title).toBe("B");
  });

  it("üst sınırı aşamaz", () => {
    let st = base;
    for (let i = 0; i < MAX_PROFILES - 1; i++) {
      const r = addProfile(st, `P${i}`, snapA);
      if ("error" in r) throw new Error(r.error);
      st = r.state;
    }
    expect(st.profiles.length).toBe(MAX_PROFILES);
    expect("error" in addProfile(st, "fazla", snapA)).toBe(true);
  });

  it("geçiş: eski etkin profilin görüntüsü saklanır, hedef uygulanır ve etkin olur", () => {
    const eklenen = addProfile(base, "Oyun", snapB);
    if ("error" in eklenen) throw new Error(eklenen.error);
    const r = switchProfile(eklenen.state, eklenen.id, snapA);
    expect(r).not.toBeNull();
    expect(r!.apply.screens.starting?.title).toBe("B");
    expect(r!.state.activeId).toBe(eklenen.id);
    expect(activeProfile(r!.state).data).toBeNull(); // etkinin verisi tutulmaz
    expect(r!.state.profiles.find((p) => p.id === "a")?.data?.screens.starting?.title).toBe("A");
  });

  it("gidip gelince ayarlar kaybolmaz (A→B→A)", () => {
    const eklenen = addProfile(base, "Oyun", snapB);
    if ("error" in eklenen) throw new Error(eklenen.error);
    const toB = switchProfile(eklenen.state, eklenen.id, snapA)!;
    // B'de kullanıcı değişiklik yaptı:
    const snapB2 = captureSnapshot({ starting: { title: "B düzenlendi" } }, {});
    const toA = switchProfile(toB.state, "a", snapB2)!;
    expect(toA.apply.screens.starting?.title).toBe("A");
    const backB = switchProfile(toA.state, eklenen.id, snapA)!;
    expect(backB.apply.screens.starting?.title).toBe("B düzenlendi");
  });

  it("aynı profile geçmek ya da verisi olmayan hedef null döner", () => {
    expect(switchProfile(base, "a", snapA)).toBeNull();
    expect(switchProfile(base, "yok", snapA)).toBeNull();
  });

  it("yeniden adlandırma benzersiz olur", () => {
    const e = addProfile(base, "Oyun", snapB);
    if ("error" in e) throw new Error(e.error);
    const r = renameProfile(e.state, e.id, "Ana");
    expect(r.profiles.find((p) => p.id === e.id)?.name).toBe("Ana (2)");
  });

  it("etkin profil ve son profil silinemez, diğerleri silinir", () => {
    expect(canDelete(base, "a")).toBe(false);
    const e = addProfile(base, "Oyun", snapB);
    if ("error" in e) throw new Error(e.error);
    expect(canDelete(e.state, "a")).toBe(false);
    expect(canDelete(e.state, e.id)).toBe(true);
    expect(removeProfile(e.state, e.id).profiles.length).toBe(1);
    expect(removeProfile(e.state, "a").profiles.length).toBe(2);
  });
});

describe("chooseSoundboard", () => {
  const pad = { id: "p", file: "a.mp3", hotkey: "Ctrl+H" };
  it("sunucudaki liste esastır: boş bir yerel depo gerçek sesleri silmez", () => {
    expect(chooseSoundboard([pad], [])).toEqual([pad]);
  });
  it("yerelde eski bir kopya olsa da sunucudaki liste kazanır", () => {
    expect(chooseSoundboard([pad], [{ id: "eski" }])).toEqual([pad]);
  });
  it("sunucuda liste hiç yoksa yerel yedek kullanılır", () => {
    expect(chooseSoundboard(null, [pad])).toEqual([pad]);
  });
  it("sunucudaki bilinçli boş liste yerelin eskisiyle doldurulmaz", () => {
    expect(chooseSoundboard([], [pad])).toEqual([]);
  });
});
