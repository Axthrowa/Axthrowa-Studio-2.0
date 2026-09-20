import { describe, expect, it } from "vitest";
import { suggestSceneMap } from "./sceneSuggest";

describe("suggestSceneMap", () => {
  it("gerçek sahne adlarıyla giriş/çıkış/mola eşleşir, bulunamayan rol boş kalır", () => {
    const r = suggestSceneMap(["Giriş sahnesi…", "Çıkış Sahnesi", "Mola", "Sahne 2"], {
      sceneMap: { starting: "", ending: "", brb: "", game: "" },
    });
    expect(r?.filled).toEqual(["starting", "ending", "brb"]);
    // Var olan (boş) game alanı korunur, üzerine yazılmaz.
    expect(r?.patch.sceneMap).toEqual({ starting: "Giriş sahnesi…", ending: "Çıkış Sahnesi", brb: "Mola", game: "" });
    expect(r?.patch.startingScene).toBe("Giriş sahnesi…");
    expect(r?.patch.brbScene).toBe("Mola");
    expect(r?.patch).not.toHaveProperty("sceneOnEnd");
  });

  it("kullanıcının seçtiği eşleşmeyi ezmez", () => {
    const r = suggestSceneMap(["Giriş", "Çıkış", "Mola"], { sceneMap: { starting: "Özel Açılış" } });
    expect(r?.filled).toEqual(["ending", "brb"]);
    expect((r?.patch.sceneMap as any).starting).toBe("Özel Açılış");
  });

  it("eski alandaki (sceneMap dışı) seçimi de kullanıcı seçimi sayar", () => {
    const r = suggestSceneMap(["Giriş", "Mola"], { brbScene: "Benim Mola" });
    expect(r?.filled).toEqual(["starting"]);
  });

  it("aynı sahne iki role verilmez", () => {
    const r = suggestSceneMap(["Oyun Başlangıç"], {});
    // hem 'starting' (başlangıç) hem 'game' (oyun) kalıbına uyar; ilk rol alır
    expect(r?.filled).toEqual(["starting"]);
  });

  it("zaten seçilmiş sahne başka role önerilmez", () => {
    const r = suggestSceneMap(["Mola"], { sceneMap: { ending: "Mola" } });
    expect(r).toBeNull();
  });

  it("boş liste ya da uyan sahne yoksa null", () => {
    expect(suggestSceneMap([], {})).toBeNull();
    expect(suggestSceneMap(["Kamera", "Sahne 2"], {})).toBeNull();
    expect(suggestSceneMap(["", "  "], {})).toBeNull();
  });

  it("obs undefined olsa da çalışır", () => {
    expect(suggestSceneMap(["Mola"], undefined)?.filled).toEqual(["brb"]);
  });
});
