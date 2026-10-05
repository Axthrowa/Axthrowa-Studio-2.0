import { describe, expect, it } from "vitest";
import { Box, Folder, Palette } from "./obsSimgeler";
import type { MotorSahneOgesi } from "../../lib/api/motor";
import { kaynakSimgesi } from "./KaynaklarDock";

const oge = (x: Partial<MotorSahneOgesi>) => ({ oge: "s/k", kaynak: "k", konum: [0, 0], olcek: [1, 1], gorunur: true, ...x }) as MotorSahneOgesi;

describe("kaynak simgeleri", () => {
  it("türe göre simge, grupta klasör, bilinmeyende kutu", () => {
    expect(kaynakSimgesi(oge({ tur: "renk" }))).toBe(Palette);
    expect(kaynakSimgesi(oge({ grup: true }))).toBe(Folder);
    expect(kaynakSimgesi(oge({ tur: "obs" }))).toBe(Box);
  });
});
