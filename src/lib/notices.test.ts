import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearNotice, getNotices, pushNotice, subscribeNotices } from "./notices";

describe("bildirim deposu", () => {
  // Depo modül düzeyinde; testler arası kalıntı bırakmayalım.
  beforeEach(() => {
    for (const n of getNotices()) clearNotice(n.id);
  });

  it("kayıt ekler ve kaldırır", () => {
    pushNotice({ id: "obs", level: "error", text: "koptu" });
    expect(getNotices()).toHaveLength(1);
    clearNotice("obs");
    expect(getNotices()).toHaveLength(0);
  });

  it("aynı kimlikle gelen kaydı üst üste yığmaz", () => {
    // Yoklama döngüleri aynı hatayı saniyede birkaç kez bildirebiliyor.
    pushNotice({ id: "obs", level: "error", text: "koptu" });
    pushNotice({ id: "obs", level: "error", text: "koptu" });
    pushNotice({ id: "obs", level: "error", text: "yine koptu" });
    const liste = getNotices();
    expect(liste).toHaveLength(1);
    expect(liste[0].text).toBe("yine koptu");
  });

  it("metin aynıysa anlık görüntü referansını değiştirmez", () => {
    // Referans her çağrıda yenilenirse `useSyncExternalStore` sonsuz render
    // döngüsüne giriyor.
    pushNotice({ id: "obs", level: "error", text: "koptu" });
    const once = getNotices();
    pushNotice({ id: "obs", level: "error", text: "koptu" });
    expect(getNotices()).toBe(once);
  });

  it("ipucu değişince kaydı günceller", () => {
    pushNotice({ id: "obs", level: "error", text: "koptu", hint: "a" });
    pushNotice({ id: "obs", level: "error", text: "koptu", hint: "b" });
    expect(getNotices()).toHaveLength(1);
    expect(getNotices()[0].hint).toBe("b");
  });

  it("farklı kimlikleri ayrı tutar", () => {
    pushNotice({ id: "obs", level: "error", text: "a" });
    pushNotice({ id: "yt-bg", level: "warn", text: "b" });
    expect(getNotices().map((n) => n.id)).toEqual(["obs", "yt-bg"]);
    clearNotice("obs");
    expect(getNotices().map((n) => n.id)).toEqual(["yt-bg"]);
  });

  it("olmayan kimliği kaldırmak aboneleri uyandırmaz", () => {
    const dinleyici = vi.fn();
    const birak = subscribeNotices(dinleyici);
    clearNotice("yok");
    expect(dinleyici).not.toHaveBeenCalled();
    birak();
  });

  it("kayıt eklenince ve kaldırılınca aboneleri uyandırır", () => {
    const dinleyici = vi.fn();
    const birak = subscribeNotices(dinleyici);
    pushNotice({ id: "obs", level: "error", text: "koptu" });
    expect(dinleyici).toHaveBeenCalledTimes(1);
    clearNotice("obs");
    expect(dinleyici).toHaveBeenCalledTimes(2);
    birak();
    pushNotice({ id: "obs", level: "error", text: "tekrar" });
    expect(dinleyici).toHaveBeenCalledTimes(2);
  });
});
