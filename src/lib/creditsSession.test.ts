import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ patchSettings: () => Promise.resolve({}) }));

import { canliOturum, mergeAutoCreditSections } from "./creditsSession";

const bos = { donors: [], subscribers: [], followers: [] };

describe("canlı jenerik", () => {
  it("yalnız bu yayında gelen türler görünür, elle başlık korunur", () => {
    const elle = [
      { title: "Yeni Aboneler ✨", lines: ["eski"] },
      { title: "Teşekkürler", lines: ["herkes"] },
    ];
    const s = mergeAutoCreditSections(elle, { ...bos, subscribers: ["ali"] }, true, true);
    expect(s).toEqual([{ title: "Yeni Aboneler ✨", lines: ["ali"] }]);
  });

  it("hiçbiri gelmediyse jenerik boş kalır", () => {
    expect(mergeAutoCreditSections([{ title: "Destekçiler", lines: ["x"] }], bos, true, true)).toEqual([]);
  });

  it("kapalıyken eski davranış: elle bölümler + otomatik isimler", () => {
    const s = mergeAutoCreditSections([{ title: "Teşekkürler", lines: ["herkes"] }], { ...bos, followers: ["veli"] }, true, false);
    expect(s.map((x) => x.title)).toEqual(["Teşekkürler", "Yeni Takipçiler"]);
  });

  it("OBS sayfası ayardaki canlı listeyi kullanır", () => {
    expect(canliOturum({ donors: ["Ali · 50 TL"] }, bos).donors).toEqual(["Ali · 50 TL"]);
    expect(canliOturum(undefined, { ...bos, followers: ["veli"] }).followers).toEqual(["veli"]);
  });
});
