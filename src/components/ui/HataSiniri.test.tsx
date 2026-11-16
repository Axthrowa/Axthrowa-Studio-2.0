import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HataSiniri } from "./HataSiniri";
import { okJson } from "../../lib/api";

// H1: sunucu 503 + JSON döndürünce gövde veri sanılıp `.map` ile bütün arayüz çöküyordu
describe("okJson", () => {
  it("503 + JSON gövdesini veri diye döndürmez", async () => {
    const r = new Response(JSON.stringify({ error: "hazır değil" }), { status: 503 });
    await expect(okJson(r)).rejects.toThrow("HTTP 503");
  });
  it("200 yanıtı çözer", async () => {
    await expect(okJson(new Response("[1,2]"))).resolves.toEqual([1, 2]);
  });
});

describe("HataSiniri", () => {
  it("hata yokken çocukları çizer", () => {
    expect(renderToStaticMarkup(<HataSiniri ad="Sahne"><p>içerik</p></HataSiniri>)).toContain("içerik");
  });
  it("çöken bölüm yalnız kendi yerinde 'yüklenemedi' ve yeniden dene gösterir", () => {
    const s = new HataSiniri({ ad: "Sahne", children: null });
    s.state = { ...s.state, ...HataSiniri.getDerivedStateFromError(new TypeError("la.map is not a function")) };
    const html = renderToStaticMarkup(<>{s.render()}</>);
    expect(html).toContain("Sahne yüklenemedi");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("<button");
  });
});
