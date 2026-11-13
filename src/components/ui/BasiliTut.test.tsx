import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASILI_TUT_MS, BasiliTutDugme, basiliTutBaslat, basiliTutTusuMu } from "./BasiliTut";

describe("basılı tut onayı (A8)", () => {
  afterEach(() => vi.useRealTimers());

  it("600 ms dolmadan bırakılırsa eylem çalışmaz, dolunca bir kez çalışır", () => {
    vi.useFakeTimers();
    const eylem = vi.fn();
    const iptal = basiliTutBaslat(eylem);
    vi.advanceTimersByTime(BASILI_TUT_MS - 1);
    iptal();
    vi.advanceTimersByTime(BASILI_TUT_MS);
    expect(eylem).not.toHaveBeenCalled();

    basiliTutBaslat(eylem);
    vi.advanceTimersByTime(BASILI_TUT_MS);
    expect(eylem).toHaveBeenCalledTimes(1);
    expect(BASILI_TUT_MS).toBe(600);
  });

  it("Boşluk ve Enter basılı tutulabilir, diğer tuşlar değil", () => {
    expect(basiliTutTusuMu(" ")).toBe(true);
    expect(basiliTutTusuMu("Enter")).toBe(true);
    expect(basiliTutTusuMu("a")).toBe(false);
  });

  it("canlıda dolum çubuğu ve ipucu çizilir; kapalıyken sıradan düğme", () => {
    const canli = renderToStaticMarkup(<BasiliTutDugme basiliTut onOnay={() => {}} title="Yayını bitir">Yayını bitir</BasiliTutDugme>);
    expect(canli).toContain("onay için basılı tut");
    expect(canli).toContain("width:0%");
    const kapali = renderToStaticMarkup(<BasiliTutDugme basiliTut={false} onOnay={() => {}}>Yayını başlat</BasiliTutDugme>);
    expect(kapali).not.toContain("basılı tut");
  });
});
