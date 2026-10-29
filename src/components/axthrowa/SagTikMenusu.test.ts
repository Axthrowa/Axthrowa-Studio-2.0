import { describe, expect, it } from "vitest";
import { menuKonumu } from "./SagTikMenusu";

describe("sağ tık menüsü konumu", () => {
  it("ekranın kenarında açılınca ekrana sığar, ortada tıklanan yerde açılır", () => {
    expect(menuKonumu(100, 100, 200, 180, 1280, 800)).toEqual({ x: 100, y: 100 });
    expect(menuKonumu(1270, 790, 200, 180, 1280, 800)).toEqual({ x: 1072, y: 612 });
    expect(menuKonumu(-5, -5, 200, 180, 1280, 800)).toEqual({ x: 8, y: 8 });
  });
});
