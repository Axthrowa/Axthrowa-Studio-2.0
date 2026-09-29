import { describe, expect, it } from "vitest";
import { boyutMetni, kalanKayitSn, sureMetni } from "./kayitSuresi";

describe("kalan kayıt süresi", () => {
  it("boş alan ÷ bit hızı", () => {
    // 100 GB, 8000 kbps → 100e9*8/8e6 = 100000 sn
    expect(kalanKayitSn(100e9, 8000)).toBe(100000);
    expect(sureMetni(100000)).toBe("27 sa 46 dk");
    expect(sureMetni(1500)).toBe("25 dk");
  });
  it("ölçüm yoksa bilinmiyor", () => {
    expect(kalanKayitSn(null, 8000)).toBeNull();
    expect(kalanKayitSn(1e9, 0)).toBeNull();
    expect(sureMetni(null)).toBe("—");
    expect(boyutMetni(null)).toBe("—");
    expect(boyutMetni(512 * 1024 ** 3)).toBe("512.0 GB");
  });
});
