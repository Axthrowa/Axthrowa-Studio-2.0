import { describe, expect, it } from "vitest";
import { restoreBackupSecrets, stripBackupSecrets } from "./backupSecrets";

describe("stripBackupSecrets", () => {
  it("OBS şifresini çıkarır, kalanı korur, kaynağı değiştirmez", () => {
    const src = { title: "x", obs: { host: "127.0.0.1", password: "gizli", startingScene: "Giriş" } };
    const out = stripBackupSecrets(src);
    expect(out.obs).toEqual({ host: "127.0.0.1", startingScene: "Giriş" });
    expect(src.obs.password).toBe("gizli");
    expect(JSON.stringify(out)).not.toContain("gizli");
  });

  it("obs yoksa ya da girdi boşsa patlamaz", () => {
    expect(stripBackupSecrets({ a: 1 })).toEqual({ a: 1 });
    expect(stripBackupSecrets(null)).toEqual({});
  });
});

describe("restoreBackupSecrets", () => {
  it("yedekte şifre yoksa mevcut şifreyi korur", () => {
    const out = restoreBackupSecrets({ obs: { host: "h" } }, { obs: { password: "eski" } });
    expect(out.obs).toEqual({ host: "h", password: "eski" });
  });

  it("yedekte obs bloğu hiç yoksa bile şifre ayakta kalır", () => {
    expect(restoreBackupSecrets({ title: "t" }, { obs: { password: "eski" } }).obs).toEqual({
      password: "eski",
    });
  });

  it("yedekteki açık şifre (eski yedek) kazanır", () => {
    const out = restoreBackupSecrets({ obs: { password: "yeni" } }, { obs: { password: "eski" } });
    expect(out.obs.password).toBe("yeni");
  });

  it("mevcut ayarda şifre yoksa alan uydurmaz", () => {
    expect(restoreBackupSecrets({ obs: { host: "h" } }, {}).obs).toEqual({ host: "h" });
    expect(restoreBackupSecrets({ title: "t" }, null)).toEqual({ title: "t" });
  });
});
