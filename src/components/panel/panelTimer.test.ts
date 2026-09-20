import { describe, expect, it } from "vitest";
import { computePanelTimer } from "./PanelTimer";

const none = () => null;

describe("computePanelTimer", () => {
  it("sayaç olmayan ekranlarda null", () => {
    expect(computePanelTimer({ screen: "chat" }, 0, none)).toBeNull();
    expect(computePanelTimer({ screen: "panel" }, 0, none)).toBeNull();
  });

  it("çıkış/mola: süre ve hedef tarih yoksa sayaç yok", () => {
    expect(computePanelTimer({ screen: "ending" }, 0, none)).toBeNull();
    expect(computePanelTimer({ screen: "brb", brbMinutes: 0 }, 0, none)).toBeNull();
  });

  it("giriş: başlangıç kaydı yoksa sabit 5 dk gösterir", () => {
    expect(computePanelTimer({ screen: "starting" }, 1000, none)).toBe("05:00");
  });

  it("çıkış: başlangıç kaydı yoksa ayarlı dakikayı gösterir", () => {
    expect(computePanelTimer({ screen: "ending", endingMinutes: 12 }, 0, none)).toBe("12:00");
  });

  it("kayıtlı bitiş anına göre geri sayar ve 0'da durur", () => {
    const end = 10_000 + 125_000;
    const read = (k: string) => (k === "starting_end_5" ? String(end) : null);
    expect(computePanelTimer({ screen: "starting" }, 10_000, read)).toBe("02:05");
    expect(computePanelTimer({ screen: "starting" }, end - 1_000, read)).toBe("00:01");
    expect(computePanelTimer({ screen: "starting" }, end + 99_000, read)).toBe("00:00");
  });

  it("hedef tarih varsa mola/çıkışta ona göre sayar", () => {
    const target = new Date(50_000).toISOString();
    expect(computePanelTimer({ screen: "brb", brbMinutes: 3, targetDate: target }, 20_000, none)).toBe("00:30");
  });

  it("anahtar ekran ve dakikaya göre değişir (ending_end_<dk>)", () => {
    const seen: string[] = [];
    computePanelTimer({ screen: "ending", endingMinutes: 7 }, 0, (k) => (seen.push(k), null));
    computePanelTimer({ screen: "brb", brbMinutes: 4 }, 0, (k) => (seen.push(k), null));
    expect(seen).toEqual(["ending_end_7", "brb_end_4"]);
  });
});
