import { describe, expect, it } from "vitest";
import { acikKalmali, YAKINLIK } from "./EdgePanel";

const kap = { left: 100, right: 1100, top: 50, bottom: 850 };

describe("kenar paneli yaklaşınca açılır", () => {
  it("sol kenara YAKINLIK px kala açılır, daha içeride açılmaz", () => {
    expect(acikKalmali(100 + YAKINLIK, 400, "left", kap)).toBe(true);
    expect(acikKalmali(100 + YAKINLIK + 1, 400, "left", kap)).toBe(false);
    expect(acikKalmali(105, 400, "right", kap)).toBe(false);
  });
  it("sağ kenar simetrik", () => {
    expect(acikKalmali(1100 - YAKINLIK, 400, "right", kap)).toBe(true);
    expect(acikKalmali(1100 - YAKINLIK - 1, 400, "right", kap)).toBe(false);
  });
  it("kapsayıcının dışında açılmaz (başka sekme/üst çubuk)", () => {
    expect(acikKalmali(110, 20, "left", kap)).toBe(false);
    expect(acikKalmali(90, 400, "left", kap)).toBe(false);
  });
  it("açık panelin üstündeyken kenardan uzak da olsa açık kalır", () => {
    const panel = { left: 100, right: 480, top: 66, bottom: 834 };
    expect(acikKalmali(400, 300, "left", kap, panel)).toBe(true);
    expect(acikKalmali(600, 300, "left", kap, panel)).toBe(false);
  });
});
