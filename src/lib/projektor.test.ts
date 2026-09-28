import { describe, expect, it } from "vitest";
import { gorunurKonum, type Monitor } from "./projektor";
import { projektorTuvali } from "../routes/ProjektorSayfasi";
import { dockKimligi } from "../routes/BagimsizDockSayfasi";

describe("projektör", () => {
  it("tuval sorgusu doğrulanır", () => {
    expect(projektorTuvali("?tuval=dikey")).toBe("dikey");
    expect(projektorTuvali("?tuval=studyo-ana")).toBe("studyo-ana");
    expect(projektorTuvali("?tuval=../x")).toBe("ana");
    expect(projektorTuvali("")).toBe("ana");
  });

  it("ayrı dock kimliği doğrulanır", () => {
    expect(dockKimligi("?id=sahneler")).toBe("sahneler");
    expect(dockKimligi("?id=x")).toBe("mikser");
    expect(dockKimligi("?id=sohbet")).toBe("sohbet");
  });

  it("ekran dışı pencere ana monitöre alınır", () => {
    const m: Monitor[] = [
      { ad: "A", x: 0, y: 0, genislik: 1920, yukseklik: 1080, olcek: 1 },
      { ad: "B", x: -1920, y: 360, genislik: 1920, yukseklik: 1080, olcek: 1 },
    ];
    expect(gorunurKonum({ x: -500, y: 500 }, m)).toEqual({ x: -500, y: 500 });
    expect(gorunurKonum({ x: 5000, y: 100 }, m)).toEqual({ x: 80, y: 80 });
    expect(gorunurKonum({ x: 5, y: 5 }, [])).toEqual({ x: 5, y: 5 });
  });
});
