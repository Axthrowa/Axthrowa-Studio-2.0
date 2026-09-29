import { describe, expect, it } from "vitest";
import { tbarBirakSonucu } from "./tbar";

describe("T-bar bırakma", () => {
  it("motor hâlâ etkinse ortada kalır", () => {
    expect(tbarBirakSonucu(0.5, true)).toBe("ortada");
  });
  it("uca yakın bırakılınca tamamlanır", () => {
    expect(tbarBirakSonucu(0.99, false)).toBe("tamamlandi");
    expect(tbarBirakSonucu(1, false)).toBe("tamamlandi");
  });
  it("başa yakın bırakılınca geri alınır", () => {
    expect(tbarBirakSonucu(0.01, false)).toBe("geri-alindi");
    expect(tbarBirakSonucu(0, false)).toBe("geri-alindi");
  });
});
