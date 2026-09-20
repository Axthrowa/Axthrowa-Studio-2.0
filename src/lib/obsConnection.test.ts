import { describe, expect, it } from "vitest";
import { pickObsConnection, sameObsConnection } from "./obsConnection";

describe("pickObsConnection", () => {
  it("panel ayarı (Bağlantılar kartı) ekran dilimindeki eski adresi ezer", () => {
    // Gerçek durum: kart 192.168.1.109 + şifre yazmış, dilimde şifresiz .100 kalmış.
    const c = pickObsConnection({
      panel: { host: "192.168.1.109", port: 4455, password: "gizli" },
      slice: { host: "192.168.1.100", port: 4455 },
      saved: { host: "127.0.0.1", port: 4455, password: "" },
    });
    expect(c).toEqual({ host: "192.168.1.109", port: 4455, password: "gizli" });
  });

  it("panel boşsa yerel yedeğe, o da yoksa dilime düşer", () => {
    expect(pickObsConnection({ saved: { host: "10.0.0.5", port: 4460, password: "x" }, slice: { host: "1.1.1.1" } })).toEqual({
      host: "10.0.0.5",
      port: 4460,
      password: "x",
    });
    expect(pickObsConnection({ slice: { host: "1.1.1.1", port: 4455 } }).host).toBe("1.1.1.1");
  });

  it("hiç kaynak yoksa yerel varsayılan", () => {
    expect(pickObsConnection({})).toEqual({ host: "127.0.0.1", port: 4455, password: "" });
    expect(pickObsConnection({ panel: null, saved: undefined, slice: { host: "  " } })).toEqual({
      host: "127.0.0.1",
      port: 4455,
      password: "",
    });
  });

  it("şifre yalnız AYNI adresin kaynağından alınır", () => {
    const c = pickObsConnection({
      panel: { host: "192.168.1.109", port: 4455 }, // şifresi yok
      saved: { host: "192.168.1.109", port: 4455, password: "yerel-yedek" },
      slice: { host: "192.168.1.100", port: 4455, password: "baska-makinenin" },
    });
    expect(c.password).toBe("yerel-yedek");
    const d = pickObsConnection({
      panel: { host: "192.168.1.109", port: 4455 },
      slice: { host: "192.168.1.100", password: "baska-makinenin" },
    });
    expect(d.password).toBe("");
  });

  it("boşlukları kırpar, port metin olarak gelse de sayıya çevirir", () => {
    expect(pickObsConnection({ panel: { host: " obs.lan ", port: "4456", password: " p " } })).toEqual({
      host: "obs.lan",
      port: 4456,
      password: "p",
    });
  });

  it("port yoksa aynı adresli başka kaynaktan, o da yoksa 4455", () => {
    expect(pickObsConnection({ panel: { host: "a" }, saved: { host: "a", port: 4470 } }).port).toBe(4470);
    expect(pickObsConnection({ panel: { host: "a" } }).port).toBe(4455);
  });
});

describe("sameObsConnection", () => {
  it("aynıysa true, herhangi bir alan farklıysa false", () => {
    const c = { host: "a", port: 4455, password: "p" };
    expect(sameObsConnection({ host: "a", port: 4455, password: "p" }, c)).toBe(true);
    expect(sameObsConnection({ host: "b", port: 4455, password: "p" }, c)).toBe(false);
    expect(sameObsConnection({ host: "a", port: 4455 }, c)).toBe(false);
    expect(sameObsConnection(undefined, c)).toBe(false);
  });
});
