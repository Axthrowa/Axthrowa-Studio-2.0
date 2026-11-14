import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOnizlemeTaslagi } from "./onizlemeTaslagi";

describe("önizlemede dene taslağı (A8b)", () => {
  beforeEach(() => useOnizlemeTaslagi.setState({ acik: true, bekleyen: null, uygulayici: null }));

  it("uygulayınca son taslak bir kez yazılır", async () => {
    const yaz = vi.fn(async () => {});
    useOnizlemeTaslagi.setState({ uygulayici: yaz });
    useOnizlemeTaslagi.getState().beklet({ ekran: "starting", veri: { a: 1 } });
    useOnizlemeTaslagi.getState().beklet({ ekran: "starting", veri: { a: 2 } });
    await useOnizlemeTaslagi.getState().uygula();
    await useOnizlemeTaslagi.getState().uygula();
    expect(yaz).toHaveBeenCalledTimes(1);
    expect(yaz).toHaveBeenCalledWith({ ekran: "starting", veri: { a: 2 } });
  });

  it("yazılamazsa taslak geri konur; anahtar kapanınca uygulanır", async () => {
    useOnizlemeTaslagi.setState({ uygulayici: async () => Promise.reject(new Error("kapalı")) });
    useOnizlemeTaslagi.getState().beklet({ ekran: "brb", veri: 1 });
    await expect(useOnizlemeTaslagi.getState().uygula()).rejects.toThrow();
    expect(useOnizlemeTaslagi.getState().bekleyen).toEqual({ ekran: "brb", veri: 1 });
    const yaz = vi.fn(async () => {});
    useOnizlemeTaslagi.setState({ uygulayici: yaz });
    useOnizlemeTaslagi.getState().ac(false);
    await Promise.resolve();
    expect(yaz).toHaveBeenCalledOnce();
  });
});
