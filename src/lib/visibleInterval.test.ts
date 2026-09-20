import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearVisibleInterval, setVisibleInterval } from "./visibleInterval";

// jsdom eklemeden (proje boyutu): yalnız kullanılan yüzeyi taklit eden minimal ortam.
type Listener = () => void;
let hidden = false;
let listeners: Listener[] = [];

function setHidden(v: boolean) {
  hidden = v;
  for (const l of [...listeners]) l();
}

describe("setVisibleInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    listeners = [];
    (globalThis as any).window = {
      setInterval: (fn: () => void, ms: number) => globalThis.setInterval(fn, ms),
      clearInterval: (id: number) => globalThis.clearInterval(id),
    };
    (globalThis as any).document = {
      get hidden() {
        return hidden;
      },
      addEventListener: (_: string, l: Listener) => listeners.push(l),
      removeEventListener: (_: string, l: Listener) => {
        listeners = listeners.filter((x) => x !== l);
      },
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });

  it("görünürken düzenli çalışır", () => {
    const fn = vi.fn();
    const id = setVisibleInterval(fn, 1000);
    vi.advanceTimersByTime(3000);
    expect(fn).toHaveBeenCalledTimes(3);
    clearVisibleInterval(id);
  });

  it("pencere gizliyken çalışmaz", () => {
    const fn = vi.fn();
    const id = setVisibleInterval(fn, 1000);
    setHidden(true);
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    clearVisibleInterval(id);
  });

  it("yeniden görününce, süre dolduysa hemen bir kez çalışır", () => {
    const fn = vi.fn();
    const id = setVisibleInterval(fn, 1000);
    vi.advanceTimersByTime(1000); // bir tur çalıştı (last güncellendi)
    expect(fn).toHaveBeenCalledTimes(1);
    setHidden(true);
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1);
    setHidden(false);
    expect(fn).toHaveBeenCalledTimes(2);
    clearVisibleInterval(id);
  });

  it("temizlenince artık çalışmaz ve görünürlük olayına tepki vermez", () => {
    const fn = vi.fn();
    const id = setVisibleInterval(fn, 1000);
    clearVisibleInterval(id);
    vi.advanceTimersByTime(5000);
    setHidden(true);
    setHidden(false);
    expect(fn).not.toHaveBeenCalled();
    expect(listeners.length).toBe(0);
  });
});
