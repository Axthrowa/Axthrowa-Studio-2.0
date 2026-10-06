import { describe, expect, it } from "vitest";
import { anaPencereOku, gorunurKonum, type Monitor } from "./anaPencere";

describe("ana pencere", () => {
  it("ekran dışı pencere ana monitöre alınır", () => {
    const m: Monitor[] = [
      { ad: "A", x: 0, y: 0, genislik: 1920, yukseklik: 1080, olcek: 1 },
      { ad: "B", x: -1920, y: 360, genislik: 1920, yukseklik: 1080, olcek: 1 },
    ];
    expect(gorunurKonum({ x: -500, y: 500 }, m)).toEqual({ x: -500, y: 500 });
    expect(gorunurKonum({ x: 5000, y: 100 }, m)).toEqual({ x: 80, y: 80 });
    expect(gorunurKonum({ x: 5, y: 5 }, [])).toEqual({ x: 5, y: 5 });
  });

  it("geçerli kayıt okunur, bozuk ya da aşırı değer yok sayılır", () => {
    expect(anaPencereOku('{"x":10,"y":20,"g":1280,"y2":860,"buyuk":true}')).toEqual({ x: 10, y: 20, g: 1280, y2: 860, buyuk: true });
    expect(anaPencereOku('{"x":10,"y":20,"g":100,"y2":860}')).toBeNull();
    expect(anaPencereOku('{"x":"a"}')).toBeNull();
    expect(anaPencereOku("bozuk")).toBeNull();
    expect(anaPencereOku(null)).toBeNull();
  });
});
