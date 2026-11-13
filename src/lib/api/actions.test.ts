import { describe, expect, it } from "vitest";
import { actionParams, missingActionParam, quickActions, type ActionInfo } from "./actions";

const a = (id: string, category: string, params: ActionInfo["params"] = []): ActionInfo => ({
  id,
  label: id,
  category,
  perm: "x.y",
  confirm: false,
  requires: "obs",
  params,
  available: true,
  reason: null,
});

describe("quickActions", () => {
  it("yalnız parametresiz eylemleri, uyarı → tekrar → kayıt → yayın → çoklu yayın sırasıyla verir", () => {
    const liste = [
      a("destinations.stopAll", "outputs"),
      a("scene.switch", "scene", [{ name: "scene", kind: "scene" }]),
      a("record.start", "recording"),
      a("alert.pause", "alerts"),
      a("stream.stop", "stream"),
      a("replay.save", "replay"),
      a("audio.mute", "audio", [{ name: "input", kind: "input" }]),
    ];
    expect(quickActions(liste).map((x) => x.id)).toEqual(["alert.pause", "replay.save", "record.start", "stream.stop", "destinations.stopAll"]);
  });
});

describe("kısayol satırından eylem parametreleri", () => {
  const spec = (params: ActionInfo["params"]) => ({ params });
  it("Rust eylem_parametreleri ile aynı alan adları", () => {
    expect(actionParams({ scene: "Oyun", source: "Kamera", delta: -3, target: "h1" })).toEqual({
      scene: "Oyun",
      input: "",
      source: "Kamera",
      delta: -3,
      id: "h1",
      filter: "",
      transition: "",
      text: "",
      percent: -3,
      playlist: "",
    });
  });
  it("eksik zorunlu parametreyi adlandırır; isteğe bağlı sahne boş kalabilir", () => {
    const kaynak = spec([
      { name: "scene", kind: "optionalScene" },
      { name: "source", kind: "source" },
    ]);
    expect(missingActionParam(kaynak, {})).toBe("kaynak");
    expect(missingActionParam(kaynak, { source: "Kamera" })).toBeNull();
    expect(missingActionParam(spec([{ name: "delta", kind: "db" }]), { delta: 0 })).toBe("dB farkı");
    expect(missingActionParam(spec([{ name: "id", kind: "destination" }]), { target: " " })).toBe("hedef");
    expect(missingActionParam(spec([{ name: "playlist", kind: "playlist" }]), {})).toBeNull();
    expect(missingActionParam(spec([{ name: "percent", kind: "percent" }]), { delta: 0 })).toBeNull();
    expect(missingActionParam(spec([{ name: "percent", kind: "percent" }]), {})).toBe("yüzde (0–100)");
    expect(actionParams({ filter: "Renk", text: "Gece", delta: 40 })).toMatchObject({ filter: "Renk", percent: 40, playlist: "Gece" });
  });
});
