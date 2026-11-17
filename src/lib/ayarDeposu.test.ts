import { beforeEach, describe, expect, it } from "vitest";
import { _depoyuSifirla, ayarOku, yayinIsle } from "./ayarDeposu";

describe("ortak ayar deposu (TEK-3)", () => {
  beforeEach(() => _depoyuSifirla());

  it("aynı ekranın eşzamanlı okumaları tek isteğe iner", async () => {
    let n = 0;
    const getir = async () => (n++, { a: 1 });
    const [x, y, z] = await Promise.all([ayarOku("panel", getir, () => false), ayarOku("panel", getir, () => false), ayarOku("panel", getir, () => false)]);
    expect(n).toBe(1);
    expect([x, y, z]).toEqual([{ a: 1 }, { a: 1 }, { a: 1 }]);
  });

  it("soket açıkken depodan okur, kapalıyken sunucuya gider", async () => {
    let n = 0;
    const getir = async () => (n++, { a: n });
    await ayarOku("chat", getir, () => true);
    await ayarOku("chat", getir, () => true);
    expect(n).toBe(1);
    await ayarOku("chat", getir, () => false);
    expect(n).toBe(2);
  });

  it("soket yayını depoyu günceller; istek sürerken gelen yeni ayarı eski yanıt ezmez", async () => {
    let bitir!: (v: Record<string, unknown>) => void;
    const okuma = ayarOku("brb", () => new Promise((r) => (bitir = r)), () => true);
    yayinIsle({ type: "settings", screen: "brb", data: { yeni: true } });
    bitir({ eski: true });
    expect(await okuma).toEqual({ yeni: true });
    expect(await ayarOku("brb", async () => ({ ag: true }), () => true)).toEqual({ yeni: true });
  });

  it("açılış görüntüsü (snapshot) tüm ekranları doldurur", async () => {
    yayinIsle({ type: "snapshot", starting: { s: 1 }, chat: { c: 1 } });
    const ag = async () => ({ ag: true });
    expect(await ayarOku("starting", ag, () => true)).toEqual({ s: 1 });
    expect(await ayarOku("chat", ag, () => true)).toEqual({ c: 1 });
  });

  it("çağırana kopya verir: değiştirmek depoyu bozmaz", async () => {
    yayinIsle({ type: "settings", screen: "panel", data: { obs: { host: "a" } } });
    const a = await ayarOku("panel", async () => ({}), () => true);
    (a.obs as { host: string }).host = "bozuk";
    expect(await ayarOku("panel", async () => ({}), () => true)).toEqual({ obs: { host: "a" } });
  });
});
