import { describe, expect, it } from "vitest";
import {
  ACTION_KINDS,
  actionBindingId,
  cycleIndex,
  missingField,
  nextVolumeDb,
  normalizeRecordMode,
  sourceEnabledAfter,
  type ActionRow,
} from "./obsActions";
import { buildHotkeyPlan } from "./hotkeyPlan";

// Bu testler Rust'taki hotkeys.rs testleriyle AYNI sözleşmeyi sabitler:
// iki tarafın davranışı ayrışırsa biri kırılır.
describe("nextVolumeDb (Rust next_volume_db ile aynı sözleşme)", () => {
  it("farkı ekler ve OBS sınırlarına sıkıştırır", () => {
    expect(nextVolumeDb(-20, 5)).toBe(-15);
    expect(nextVolumeDb(-20, -5)).toBe(-25);
    expect(nextVolumeDb(24, 10)).toBe(26);
    expect(nextVolumeDb(-98, -10)).toBe(-100);
  });

  it("tam sessizden (-inf) artırma sonsuzla işlem yapmaz", () => {
    expect(nextVolumeDb(-Infinity, 5)).toBe(-95);
    expect(Number.isFinite(nextVolumeDb(NaN, 3))).toBe(true);
    expect(nextVolumeDb(-20, NaN)).toBe(-20);
  });
});

describe("cycleIndex (Rust cycle_index ile aynı sözleşme)", () => {
  it("uçlarda sarar", () => {
    expect(cycleIndex(3, 0, true)).toBe(1);
    expect(cycleIndex(3, 2, true)).toBe(0);
    expect(cycleIndex(3, 0, false)).toBe(2);
    expect(cycleIndex(3, 2, false)).toBe(1);
  });

  it("mevcut sahne listede yoksa ileri ilke, geri sona gider", () => {
    expect(cycleIndex(4, null, true)).toBe(0);
    expect(cycleIndex(4, null, false)).toBe(3);
    expect(cycleIndex(4, -1, true)).toBe(0);
  });

  it("boş listede sahne yok, tek sahnede kendine döner", () => {
    expect(cycleIndex(0, null, true)).toBeNull();
    expect(cycleIndex(1, 0, true)).toBe(0);
    expect(cycleIndex(1, 0, false)).toBe(0);
  });
});

describe("normalizeRecordMode", () => {
  it("bilinmeyen kip toggle olur", () => {
    expect(normalizeRecordMode("start")).toBe("start");
    expect(normalizeRecordMode(" STOP ")).toBe("stop");
    expect(normalizeRecordMode("pause")).toBe("pause");
    expect(normalizeRecordMode(undefined)).toBe("toggle");
    expect(normalizeRecordMode("uydurma")).toBe("toggle");
  });
});

describe("missingField", () => {
  const satir = (p: Partial<ActionRow>): ActionRow => ({ id: "x", kind: "srcToggle", ...p });

  it("kaynak aç/kapa kaynak ister, sahne boş olabilir (aktif sahne)", () => {
    expect(missingField(satir({}))).toBe("kaynak");
    expect(missingField(satir({ source: "Kamera" }))).toBeNull();
  });

  it("ses seviyesi giriş ister", () => {
    expect(missingField(satir({ kind: "volume" }))).toBe("ses girişi");
    expect(missingField(satir({ kind: "volume", input: "Müzik" }))).toBeNull();
  });

  it("filtre önce kaynağı sonra filtreyi ister", () => {
    expect(missingField(satir({ kind: "filter" }))).toBe("kaynak");
    expect(missingField(satir({ kind: "filter", source: "K" }))).toBe("filtre");
    expect(missingField(satir({ kind: "filter", source: "K", filter: "F" }))).toBeNull();
  });

  it("OBS kısayolu ad ister; kayıt ve sahne gezme alan istemez", () => {
    expect(missingField(satir({ kind: "obsHotkey" }))).toBe("OBS kısayol adı");
    expect(missingField(satir({ kind: "record" }))).toBeNull();
    expect(missingField(satir({ kind: "sceneNext" }))).toBeNull();
    expect(missingField(satir({ kind: "scenePrev" }))).toBeNull();
  });
});

describe("kısayol planına entegrasyon", () => {
  it("aksiyon satırı act:<id> kimliğiyle ve alanlarıyla plana girer", () => {
    const plan = buildHotkeyPlan({
      obs: {
        actionHotkeys: [
          { id: "r1", kind: "volume", hotkey: "ctrl+F5", input: "Müzik", delta: -3 },
        ],
      },
    });
    expect(plan.bindings).toHaveLength(1);
    expect(plan.bindings[0]).toMatchObject({
      id: actionBindingId("r1"),
      spec: "Ctrl+F5",
      kind: "volume",
      input: "Müzik",
      delta: -3,
    });
  });

  it("kısayolu boş ya da alanı eksik satır plana girmez", () => {
    // Eksik alanlı kısayolu kaydedip her basışta hata vermek yerine elenir.
    const plan = buildHotkeyPlan({
      obs: {
        actionHotkeys: [
          { id: "a", kind: "volume", hotkey: "", input: "Müzik" },
          { id: "b", kind: "volume", hotkey: "F5" },
          { id: "c", kind: "filter", hotkey: "F6", source: "K" },
          { id: "d", kind: "record", hotkey: "F7" },
        ],
      },
    });
    expect(plan.bindings.map((b) => b.id)).toEqual(["act:d"]);
  });

  it("aksiyon kısayolu da çakışma tespitine dahil", () => {
    const plan = buildHotkeyPlan({
      obs: {
        hotkeys: { brb: "F3" },
        actionHotkeys: [{ id: "r", kind: "record", hotkey: "f3" }],
      },
    });
    expect(plan.conflicts).toEqual([{ spec: "F3", winnerId: "brb", loserIds: ["act:r"] }]);
  });

  it("bozuk actionHotkeys değeri planı bozmaz", () => {
    expect(buildHotkeyPlan({ obs: { actionHotkeys: "bozuk" } }).bindings).toEqual([]);
    expect(buildHotkeyPlan({ obs: { actionHotkeys: [null, {}] } }).bindings).toEqual([]);
  });
});

describe("ACTION_KINDS", () => {
  it("her tür için okunur ad ve açıklama var, kimlikler tekil", () => {
    const ids = ACTION_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const k of ACTION_KINDS) {
      expect(k.label.length).toBeGreaterThan(2);
      expect(k.hint.length).toBeGreaterThan(10);
    }
    // Kullanıcının istediği dört yetenek ve kaçış kapısı
    for (const gerekli of ["srcToggle", "record", "volume", "filter", "obsHotkey"]) {
      expect(ids).toContain(gerekli);
    }
  });
});

describe("sourceEnabledAfter", () => {
  it("show/hide sabitler, toggle ve bilinmeyen tersler (Rust ile aynı sözleşme)", () => {
    expect(sourceEnabledAfter("show", false)).toBe(true);
    expect(sourceEnabledAfter("show", true)).toBe(true);
    expect(sourceEnabledAfter("hide", true)).toBe(false);
    expect(sourceEnabledAfter("hide", false)).toBe(false);
    expect(sourceEnabledAfter("toggle", true)).toBe(false);
    expect(sourceEnabledAfter(undefined, false)).toBe(true);
    expect(sourceEnabledAfter(" SHOW ", false)).toBe(true);
  });
});
