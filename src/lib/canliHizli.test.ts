import { describe, expect, it } from "vitest";
import { VARSAYILAN_HIZLI, hizliOku } from "./canliHizli";

describe("hızlı işlem listesi", () => {
  it("kayıt yoksa ya da bozuksa varsayılan döner", () => {
    expect(hizliOku(null)).toBe(VARSAYILAN_HIZLI);
    expect(hizliOku("{bozuk")).toBe(VARSAYILAN_HIZLI);
    expect(hizliOku('[{"id":"<script>","ad":"x"}]')).toBe(VARSAYILAN_HIZLI);
  });

  it("geçerli kayıtları korur, yineleneni ve tanınmayanı atar; boş liste boş kalır", () => {
    const ham = JSON.stringify([
      { id: "bot:timers", ad: "Zamanlayıcılar" },
      { id: "bot:timers", ad: "yine" },
      { id: "eylem:replay.save", ad: "Tekrarı kaydet" },
      { id: "kötü kimlik", ad: "x" },
    ]);
    expect(hizliOku(ham)).toEqual([
      { id: "bot:timers", ad: "Zamanlayıcılar" },
      { id: "eylem:replay.save", ad: "Tekrarı kaydet" },
    ]);
    expect(hizliOku("[]")).toEqual([]);
  });
});
