import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadObsSaved, saveObsSaved } from "./obsPersist";

const depo = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => depo.get(k) ?? null,
  setItem: (k: string, v: string) => void depo.set(k, v),
});

describe("obsPersist", () => {
  beforeEach(() => depo.clear());

  it("şifreyi yerel depoya yazmaz, eski kayıttaki şifreyi de üzerine yazarak temizler", () => {
    depo.set("studio.obs.connection", JSON.stringify({ host: "10.0.0.5", port: 4460, password: "eski" }));
    expect(loadObsSaved()?.password).toBe("eski"); // kasaya taşınabilsin diye bir kez okunur

    saveObsSaved({ host: "10.0.0.5", port: 4460, password: "yeni" } as never);

    expect(depo.get("studio.obs.connection")).not.toContain("password");
    expect(loadObsSaved()).toEqual({ host: "10.0.0.5", port: 4460, password: "" });
  });
});
