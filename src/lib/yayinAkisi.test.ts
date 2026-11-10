/**
 * Yayın akışı provası: sahte OBS ile "yayını bitir" ve süre sonu kuralları.
 * Gerçek yayında yaşanan iki hata burada kalıcı olarak yakalanır:
 *  1. Yerel dizi başarısız olunca yayın çıkış ekranı gösterilmeden HEMEN kapanıyordu.
 *  2. Geçmişte kalmış hedef tarih çıkış sayacını "çoktan bitti" yapıyor, yayın hemen kapanıyordu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const cagrilar: string[] = [];
const yerelDizi = { calisir: true };

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (komut: string) => {
    cagrilar.push(`invoke:${komut}`);
    if (!yerelDizi.calisir) throw new Error("yerel OBS bağlı değil");
    return { scenes: ["Giriş", "Oyun", "Çıkış"], currentScene: "Çıkış", streaming: true };
  }),
}));

vi.mock("./obs", () => ({
  connectObs: vi.fn(),
  disconnectObs: vi.fn(),
  getInputMute: vi.fn(),
  getObs: () => ({
    call: async (istek: string) => {
      cagrilar.push(`obs:${istek}`);
      if (istek === "GetSceneList") return { scenes: [{ sceneName: "Giriş" }, { sceneName: "Oyun" }, { sceneName: "Çıkış" }], currentProgramSceneName: "Çıkış" };
      if (istek === "GetStreamStatus") return { outputActive: true };
      return {};
    },
  }),
  isObsConnected: () => true,
  listInputs: vi.fn(),
  setInputMute: vi.fn(),
  startStream: vi.fn(async () => cagrilar.push("startStream")),
  stopStream: vi.fn(async () => cagrilar.push("stopStream")),
  switchScene: vi.fn(async (o: { sceneName: string }) => cagrilar.push(`sahne:${o.sceneName}`)),
}));

import { obsControl } from "./obsControl";
import { resolveEndingScene } from "./streamAutomation";
import { resolveEndRule } from "./endRules";

beforeEach(() => {
  cagrilar.length = 0;
  yerelDizi.calisir = true;
});

describe("yayını bitir", () => {
  it("yerel dizi çalışırsa JS tarafı yayını kapatmaz (kapatmayı dizi yapar)", async () => {
    await obsControl.stopStreamSequence("Çıkış");
    expect(cagrilar).toContain("invoke:obs_stop_stream_sequence");
    expect(cagrilar).not.toContain("stopStream");
  });

  it("yerel dizi başarısız olunca çıkış sahnesine geçer ama yayını HEMEN kapatmaz", async () => {
    yerelDizi.calisir = false;
    await obsControl.stopStreamSequence("Çıkış");
    expect(cagrilar).toContain("sahne:Çıkış");
    expect(cagrilar).not.toContain("stopStream");
    expect(cagrilar).not.toContain("obs:StopStream");
  });

  it("çıkış sahnesi seçili değilse hiçbir şeyi kapatmadan döner", async () => {
    yerelDizi.calisir = false;
    await obsControl.stopStreamSequence();
    expect(cagrilar.filter((c) => c.startsWith("sahne:") || c === "stopStream")).toEqual([]);
  });
});

describe("çıkış sahnesi adı", () => {
  it("Rust'taki sırayla çözülür", () => {
    expect(resolveEndingScene({ sceneMap: { ending: "A" }, endingScene: "B" })).toBe("A");
    expect(resolveEndingScene({ endingScene: "B", endingEndScene: "C" })).toBe("B");
    expect(resolveEndingScene({ endingEndScene: " C " })).toBe("C");
    expect(resolveEndingScene(undefined)).toBe("");
  });
});

describe("çıkış sayacı kullanıcının gerçek ayarıyla", () => {
  // Gerçek ayar: hedef tarih 2026-09-08'de kalmış, endingMinutes 2
  const simdi = new Date("2026-11-11T12:00").getTime();
  it("eski hedef tarih yok sayılır, 2 dakikalık sayaç çalışır", () => {
    const r = resolveEndRule("ending", undefined, { endingMinutes: 2, targetDate: "2026-09-08T01:28" }, simdi);
    expect(r).toMatchObject({ useTargetDate: false, minutes: 2 });
  });
});
