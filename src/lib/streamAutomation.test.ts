import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./obs", () => ({
  connectObs: vi.fn(async () => undefined),
  stopStreamWithRetry: vi.fn(async () => undefined),
  switchScene: vi.fn(async () => undefined),
}));

import { requestEnd } from "./streamAutomation";

type Cagri = { url: string; body: any };

function sahteFetch(yanit: (url: string) => Response | Promise<Response>) {
  const cagrilar: Cagri[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      cagrilar.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return yanit(url);
    }),
  );
  return cagrilar;
}

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestEnd — bitiş eylemini tek görünüm yapar", () => {
  it("kilit alınırsa eylem çalışır", async () => {
    const cagrilar = sahteFetch(() => json({ ok: true }));
    const eylem = vi.fn(async () => "Oyun");
    await expect(requestEnd("starting", eylem)).resolves.toEqual({ done: true, result: "Oyun" });
    expect(eylem).toHaveBeenCalledOnce();
    expect(cagrilar[0].url).toContain("/api/automation/claim");
    expect(cagrilar[0].body.key).toBe("starting-end");
  });

  it("başka görünüm kilitliyse eylem ÇALIŞMAZ", async () => {
    sahteFetch(() => json({ ok: false }));
    const eylem = vi.fn(async () => "Oyun");
    await expect(requestEnd("ending", eylem)).resolves.toEqual({ done: false, reason: "other-view" });
    expect(eylem).not.toHaveBeenCalled();
  });

  it("uç yoksa (eski exe) ya da sunucu yoksa eski davranış: eylem engellenmez", async () => {
    sahteFetch(() => new Response("yok", { status: 404 }));
    const e1 = vi.fn(async () => 1);
    await expect(requestEnd("ending", e1)).resolves.toEqual({ done: true, result: 1 });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("bağlantı yok"))));
    const e2 = vi.fn(async () => 2);
    await expect(requestEnd("ending", e2)).resolves.toEqual({ done: true, result: 2 });
  });

  it("eylem başarısız olursa kilit bırakılır ve hata yukarı iletilir", async () => {
    const cagrilar = sahteFetch(() => json({ ok: true }));
    await expect(
      requestEnd("ending", async () => {
        throw new Error("OBS bağlı değil");
      }),
    ).rejects.toThrow("OBS bağlı değil");
    expect(cagrilar.map((c) => c.url.split("/").pop())).toEqual(["claim", "release"]);
    expect(cagrilar[1].body.owner).toBe(cagrilar[0].body.owner);
  });
});
