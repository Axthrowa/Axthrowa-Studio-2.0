import { describe, it, expect } from "vitest";
import { eskiAnahtarlariTasi, panelBotu } from "./eskiAdlar";

function bellekDepo(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

describe("eski adlar", () => {
  it("eski anahtarlar bir kez kopyalanır, yeni değer ezilmez, eskisi kalır", () => {
    const d = bellekDepo();
    d.setItem("yya.chat.fontSize", "18");
    d.setItem("yya-platform-theme", "kick");
    d.setItem("botaxt.remoteToken", "t");
    d.setItem("panel.smartBot", "{}");
    d.setItem("studio.panel.menuGizli", "yeni");
    d.setItem("yya.panel.menuGizli", "eski");
    expect(eskiAnahtarlariTasi(d)).toBe(4);
    expect(d.getItem("studio.chat.fontSize")).toBe("18");
    expect(d.getItem("studio-platform-theme")).toBe("kick");
    expect(d.getItem("studio.bot.remoteToken")).toBe("t");
    expect(d.getItem("panel.sohbetBot")).toBe("{}");
    expect(d.getItem("studio.panel.menuGizli")).toBe("yeni");
    expect(d.getItem("yya.chat.fontSize")).toBe("18");
    d.removeItem("studio.chat.fontSize");
    expect(eskiAnahtarlariTasi(d)).toBe(0);
  });
  it("panel botu eski alandan da okunur", () => {
    expect(panelBotu({ smartBot: { a: 1 } })).toEqual({ a: 1 });
    expect(panelBotu({ sohbetBot: 1, smartBot: 2 })).toBe(1);
  });
});
