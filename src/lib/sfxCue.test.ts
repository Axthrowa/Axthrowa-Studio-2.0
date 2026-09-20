import { describe, expect, it } from "vitest";
import {
  CUE_MAX_AGE_MS,
  RETRIGGER_GUARD_MS,
  buildPlayCue,
  buildStopCue,
  decidePadTrigger,
  isStaleCue,
} from "./sfxCue";

/** Sunucunun derin birleştirmesinin küçük kopyası: nesneler birleşir, null ezer. */
function deepMerge(a: any, b: any): any {
  if (b === null) return null;
  if (typeof b !== "object" || Array.isArray(b) || typeof a !== "object" || a === null || Array.isArray(a)) return b;
  const out: any = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in a ? deepMerge(a[k], v) : v;
  return out;
}

describe("cue birleştirme (yapışan durdur bayrağı)", () => {
  it("durdur sonrası gelen çal komutu durdur gibi okunmaz", () => {
    let stored: any = {};
    stored = deepMerge(stored, buildPlayCue("1", "a.mp3", 80, 1000));
    stored = deepMerge(stored, buildStopCue("2", 2000));
    stored = deepMerge(stored, buildPlayCue("3", "b.mp3", 70, 3000));
    expect(stored.stop).toBe(false);
    expect(stored.file).toBe("b.mp3");
    expect(stored.id).toBe("3");
  });

  it("çal sonrası gelen durdur komutu eski dosyayı taşımaz", () => {
    let stored: any = deepMerge({}, buildPlayCue("1", "a.mp3", 80, 1000));
    stored = deepMerge(stored, buildStopCue("2", 2000));
    expect(stored.stop).toBe(true);
    expect(stored.file).toBeNull();
    expect(stored.volume).toBeNull();
  });
});

describe("isStaleCue", () => {
  it("8 sn'den eski komut bayattır, yeni değildir", () => {
    expect(isStaleCue({ t: 1000 }, 1000 + CUE_MAX_AGE_MS + 1)).toBe(true);
    expect(isStaleCue({ t: 1000 }, 1000 + CUE_MAX_AGE_MS - 1)).toBe(false);
  });
  it("zaman damgası yoksa bayat sayılmaz (mağaza komutu)", () => {
    expect(isStaleCue({}, 9e12)).toBe(false);
    expect(isStaleCue(null, 9e12)).toBe(false);
    expect(isStaleCue({ t: "x" }, 9e12)).toBe(false);
  });
});

describe("decidePadTrigger", () => {
  const base = { padId: "a", activePadId: null, queuedPadIds: [] as string[], lastTriggerAt: undefined, now: 10_000 };
  it("boştayken çalar", () => {
    expect(decidePadTrigger(base)).toBe("play");
  });
  it("çalan ses aynı tuşla durdurulur", () => {
    expect(decidePadTrigger({ ...base, activePadId: "a" })).toBe("stop");
  });
  it("kuyruktaki ses de aynı tuşla iptal edilir", () => {
    expect(decidePadTrigger({ ...base, queuedPadIds: ["b", "a"] })).toBe("stop");
  });
  it("başka ses çalarken bu ses kuyruğa girer (durdurmaz)", () => {
    expect(decidePadTrigger({ ...base, activePadId: "b" })).toBe("play");
  });
  it("basılı tutma / çift olay (kısa aralık) yok sayılır", () => {
    expect(decidePadTrigger({ ...base, lastTriggerAt: 10_000 - (RETRIGGER_GUARD_MS - 1) })).toBe("ignore");
    expect(decidePadTrigger({ ...base, activePadId: "a", lastTriggerAt: 9_900 })).toBe("ignore");
  });
  it("koruma süresi geçince normal karar verilir", () => {
    expect(decidePadTrigger({ ...base, activePadId: "a", lastTriggerAt: 10_000 - RETRIGGER_GUARD_MS })).toBe("stop");
  });
});
