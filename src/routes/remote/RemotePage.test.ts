import { describe, expect, it } from "vitest";
import { kumandaSekmeleri } from "./RemotePage";

describe("telefon kumandası sekmeleri (U11)", () => {
  it("izni olmayan sekme görünmez", () => {
    expect(kumandaSekmeleri(["scene.switch"])).toEqual(["sahneler"]);
    expect(kumandaSekmeleri(["scene.switch", "audio.control", "alerts.control"])).toEqual(["sahneler", "ses", "kuyruk"]);
    expect(kumandaSekmeleri([])).toEqual([]);
  });
  it("yönetici hepsini görür", () => {
    expect(kumandaSekmeleri(["*"])).toEqual(["deste", "sahneler", "ses", "kuyruk"]);
  });
});
