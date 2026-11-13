import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWS {
  static OPEN = 1;
  static all: FakeWS[] = [];
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeWS.all.push(this);
  }
  send() {}
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  fail() {
    this.readyState = 3;
    this.onclose?.();
  }
}

async function loadHub() {
  vi.resetModules();
  return import("./overlaySyncHub");
}

describe("overlaySyncHub", () => {
  beforeEach(() => {
    FakeWS.all = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWS);
    vi.spyOn(Math, "random").mockReturnValue(0.5); // sapma çarpanı 1.0
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("N abone için tek soket açar ve mesajı hepsine dağıtır", async () => {
    const hub = await loadHub();
    const got: string[] = [];
    const offs = [1, 2, 3].map((i) =>
      hub.subscribeOverlaySync({ onMessage: (ev) => got.push(`${i}:${ev.data}`) })
    );
    expect(FakeWS.all).toHaveLength(1);
    FakeWS.all[0].open();
    FakeWS.all[0].onmessage?.({ data: "x" });
    expect(got).toEqual(["1:x", "2:x", "3:x"]);
    offs.forEach((off) => off());
  });

  it("geç gelen abone açık soketin onOpen'ını hemen alır", async () => {
    const hub = await loadHub();
    const off1 = hub.subscribeOverlaySync({});
    FakeWS.all[0].open();
    const onOpen = vi.fn();
    const off2 = hub.subscribeOverlaySync({ onOpen });
    expect(onOpen).toHaveBeenCalledOnce();
    expect(FakeWS.all).toHaveLength(1);
    off1();
    off2();
  });

  it("son abone ayrılınca kapanır, yeniden bağlanmaz", async () => {
    const hub = await loadHub();
    const off1 = hub.subscribeOverlaySync({});
    const off2 = hub.subscribeOverlaySync({});
    off1();
    expect(FakeWS.all[0].closed).toBe(false);
    off2();
    expect(FakeWS.all[0].closed).toBe(true);
    vi.advanceTimersByTime(120_000);
    expect(FakeWS.all).toHaveLength(1);
  });

  it("geri çekilme 2 sn'den 30 sn'ye büyür, açılınca sıfırlanır", async () => {
    const hub = await loadHub();
    const off = hub.subscribeOverlaySync({});
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      const n = FakeWS.all.length;
      FakeWS.all[n - 1].fail();
      let t = 0;
      while (FakeWS.all.length === n) {
        vi.advanceTimersByTime(500);
        t += 500;
      }
      waits.push(t);
    }
    expect(waits).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);

    FakeWS.all[FakeWS.all.length - 1].open();
    const n = FakeWS.all.length;
    FakeWS.all[n - 1].fail();
    vi.advanceTimersByTime(2000);
    expect(FakeWS.all).toHaveLength(n + 1);
    off();
  });
});
