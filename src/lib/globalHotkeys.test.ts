import { describe, expect, it } from "vitest";
import { eventToSpec, toAccelerator } from "./globalHotkeys";

/**
 * Hızlandırıcı, `global-hotkey` ayrıştırıcısına gidiyor. O taraf jetonları
 * büyük harfe çevirip `KEYA` / `DIGIT1` / `F1` biçiminde bekliyor; yanlış bir
 * jeton sessiz bir kayıt hatasına dönüşüyor, o yüzden burada sabitliyoruz.
 */
describe("toAccelerator", () => {
  it("işlev tuşlarını olduğu gibi bırakır", () => {
    expect(toAccelerator("F1")).toBe("F1");
    expect(toAccelerator("f12")).toBe("F12");
    expect(toAccelerator("F24")).toBe("F24");
  });

  it("harf ve rakamları tuş koduna çevirir", () => {
    expect(toAccelerator("Ctrl+1")).toBe("Control+Digit1");
    expect(toAccelerator("ctrl+shift+a")).toBe("Control+Shift+KeyA");
    expect(toAccelerator("Alt+9")).toBe("Alt+Digit9");
  });

  it("tüm değiştirici adlarını tanır", () => {
    expect(toAccelerator("control+alt+shift+win+k")).toBe("Control+Alt+Shift+Super+KeyK");
    expect(toAccelerator("cmd+s")).toBe("Super+KeyS");
    expect(toAccelerator("option+s")).toBe("Alt+KeyS");
  });

  it("yinelenen değiştiriciyi tekilleştirir", () => {
    expect(toAccelerator("Ctrl+Ctrl+A")).toBe("Control+KeyA");
  });

  it("adlandırılmış tuşları eşler", () => {
    expect(toAccelerator("ctrl+space")).toBe("Control+Space");
    expect(toAccelerator("alt+up")).toBe("Alt+ArrowUp");
    expect(toAccelerator("esc")).toBe("Escape");
    expect(toAccelerator("shift+pageup")).toBe("Shift+PageUp");
  });

  it("boşlukları ve harf büyüklüğünü tolere eder", () => {
    expect(toAccelerator("  ctrl +  F5 ")).toBe("Control+F5");
  });

  it("anlaşılmayan girdide null döner", () => {
    expect(toAccelerator("")).toBeNull();
    expect(toAccelerator("   ")).toBeNull();
    expect(toAccelerator("Ctrl")).toBeNull();
    expect(toAccelerator("Ctrl+Shift")).toBeNull();
    expect(toAccelerator("Ctrl+A+B")).toBeNull();
    expect(toAccelerator("Ctrl+PrintScreen")).toBeNull();
    expect(toAccelerator("F25")).toBeNull();
  });
});

describe("eventToSpec", () => {
  function key(
    k: string,
    mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}
  ) {
    return {
      key: k,
      ctrlKey: !!mods.ctrlKey,
      altKey: !!mods.altKey,
      shiftKey: !!mods.shiftKey,
      metaKey: !!mods.metaKey,
    } as KeyboardEvent;
  }

  it("modifier + tuş üretir", () => {
    expect(eventToSpec(key("a", { ctrlKey: true }))).toBe("Ctrl+A");
    expect(eventToSpec(key("F5", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+F5");
    expect(eventToSpec(key("1", { altKey: true }))).toBe("Alt+1");
  });

  it("yalnız modifier veya Escape null", () => {
    expect(eventToSpec(key("Control"))).toBeNull();
    expect(eventToSpec(key("Escape"))).toBeNull();
  });
});
