import { beforeEach, describe, expect, it, vi } from "vitest";

// U1/D1: sihirbazın son adımı birleşik overlay'i bir kez ekler; ikinci çalıştırmada çoğaltmaz
const durum = vi.hoisted(() => ({ girdiler: [] as { inputName: string; inputKind: string; url: string }[], cagrilar: [] as string[] }));

vi.mock("obs-websocket-js", () => ({
  default: class {
    on() {}
    async call(istek: string, p: any) {
      durum.cagrilar.push(istek);
      if (istek === "GetInputList") return { inputs: durum.girdiler.map(({ inputName, inputKind }) => ({ inputName, inputKind })) };
      if (istek === "GetInputSettings") return { inputSettings: { url: durum.girdiler.find((g) => g.inputName === p.inputName)?.url } };
      if (istek === "GetCurrentProgramScene") return { currentProgramSceneName: "Oyun" };
      if (istek === "CreateInput") durum.girdiler.push({ inputName: p.inputName, inputKind: p.inputKind, url: p.inputSettings.url });
      return {};
    }
  },
}));

const { birlesikOverlayEkle } = await import("./obs");
const URL = "http://127.0.0.1:8843/overlay/master?obs=1";

describe("birlesikOverlayEkle", () => {
  beforeEach(() => {
    durum.girdiler = [{ inputName: "Kamera", inputKind: "dshow_input", url: "" }];
    durum.cagrilar = [];
  });

  it("açık sahneye bir kez ekler, ikinci çalıştırmada zaten-var döner", async () => {
    expect(await birlesikOverlayEkle(URL, "AxthrowA Overlay")).toEqual({ durum: "eklendi", sahne: "Oyun" });
    expect(await birlesikOverlayEkle(URL, "AxthrowA Overlay")).toEqual({ durum: "zaten-var", kaynak: "AxthrowA Overlay" });
    expect(durum.cagrilar.filter((c) => c === "CreateInput")).toHaveLength(1);
  });

  it("kullanıcı kaynağı yeniden adlandırdıysa adresinden tanır (sorgu kısmı farklı olsa da)", async () => {
    durum.girdiler.push({ inputName: "Benim katmanım", inputKind: "browser_source", url: "http://127.0.0.1:8843/overlay/master" });
    expect(await birlesikOverlayEkle(URL, "AxthrowA Overlay")).toEqual({ durum: "zaten-var", kaynak: "Benim katmanım" });
    expect(durum.cagrilar).not.toContain("CreateInput");
  });
});
