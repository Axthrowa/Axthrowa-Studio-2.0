import { describe, expect, it } from "vitest";
import { GeriAlYigini } from "./geriAl";

describe("geri al / yinele", () => {
  it("sırayla geri alır, yineler; yeni işlem yineleyi temizler; sınır", async () => {
    let deger = 0;
    const y = new GeriAlYigini(3);
    let bildirim = 0;
    y.abone(() => bildirim++);
    const ekle = (n: number) => {
      const once = deger;
      deger = n;
      y.kaydet({ ad: `=${n}`, geri: async () => void (deger = once), ileri: async () => void (deger = n) });
    };
    ekle(1);
    ekle(2);
    expect(y.geriAdi).toBe("=2");
    expect(await y.geriAl()).toBe("=2");
    expect(deger).toBe(1);
    expect(y.ileriAdi).toBe("=2");
    expect(await y.yinele()).toBe("=2");
    expect(deger).toBe(2);
    await y.geriAl();
    ekle(5);
    expect(y.ileriAdi).toBeNull();
    ekle(6);
    ekle(7);
    ekle(8);
    // Sınır 3: en eski düşer
    await y.geriAl();
    await y.geriAl();
    await y.geriAl();
    expect(await y.geriAl()).toBeNull();
    expect(deger).toBe(5);
    expect(bildirim).toBeGreaterThan(5);
  });

  it("başarısız geri alma işlemi yığında bırakır", async () => {
    const y = new GeriAlYigini();
    y.kaydet({ ad: "x", geri: async () => Promise.reject(new Error("motor kapalı")), ileri: async () => undefined });
    await expect(y.geriAl()).rejects.toThrow("motor kapalı");
    expect(y.geriAdi).toBe("x");
  });
});
