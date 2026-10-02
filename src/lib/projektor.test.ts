import { describe, expect, it } from "vitest";
import { gorunurKonum, type Monitor } from "./projektor";
import { projektorKaynagi, projektorTuvali } from "../routes/ProjektorSayfasi";
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

describe("sahne/kaynak projektörü kimliği", () => {
  it("motor kimliği kuralına uyan kaynak kabul edilir", () => {
    expect(projektorKaynagi("?kaynak=k12&ad=Kamera")).toBe("k12");
    expect(projektorKaynagi("?kaynak=sahne-ana")).toBe("sahne-ana");
    expect(projektorKaynagi("?kaynak=../x")).toBeNull();
    expect(projektorKaynagi("?kaynak=K1")).toBeNull();
    expect(projektorKaynagi("")).toBeNull();
  });
});

describe("ana pencere durumu", () => {
  it("geçerli kayıt okunur, bozuk ya da aşırı değer yok sayılır", async () => {
    const { anaPencereOku } = await import("./projektor");
    expect(anaPencereOku('{"x":10,"y":20,"g":1280,"y2":860,"buyuk":true}')).toEqual({ x: 10, y: 20, g: 1280, y2: 860, buyuk: true });
    expect(anaPencereOku('{"x":10,"y":20,"g":100,"y2":860}')).toBeNull();
    expect(anaPencereOku('{"x":"a"}')).toBeNull();
    expect(anaPencereOku("bozuk")).toBeNull();
    expect(anaPencereOku(null)).toBeNull();
  });
});
