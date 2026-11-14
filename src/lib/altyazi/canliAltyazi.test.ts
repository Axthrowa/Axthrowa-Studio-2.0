import { describe, expect, it } from "vitest";
import { temizle } from "./canliAltyazi";

describe("temizle", () => {
  it("boşlukları sadeleştirir", () => expect(temizle("  merhaba   dünya ")).toBe("merhaba dünya"));
  it("harfsiz ve uydurma metni atar", () => {
    expect(temizle(" ... ")).toBe("");
    expect(temizle("Altyazı M.K.")).toBe("");
    expect(temizle("İzlediğiniz için teşekkür ederim.")).toBe("");
    expect(temizle("[Müzik]")).toBe("");
  });
  it("tekrar döngüsünü keser, olağan yinelemeyi bırakır", () => {
    expect(temizle("Bugün bir yukarı yukarı yukarı yukarı yukarı yukarı")).toBe("Bugün bir yukarı");
    expect(temizle("hadi gel hadi gel hadi gel hadi gel")).toBe("hadi gel");
    expect(temizle("evet evet tamam")).toBe("evet evet tamam");
  });
});
