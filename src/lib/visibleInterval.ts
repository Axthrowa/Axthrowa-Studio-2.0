/**
 * Pencere gizliyken (küçültülmüş / başka sekme / tepsi) çalışmayan `setInterval`.
 *
 * Panel arka planda da OBS'i, Kick'i ve müziği saniyeler içinde yokluyordu;
 * görünmeyen bir pencere için boşuna iş ve yeniden çizim demekti. Pencere yeniden
 * görününce hemen bir kez çalışır (bayat veri beklemesin).
 */
export function setVisibleInterval(fn: () => void, ms: number): number {
  let last = 0;
  const id = window.setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    last = Date.now();
    fn();
  }, ms);
  const onVisible = () => {
    if (!document.hidden && Date.now() - last >= ms) {
      last = Date.now();
      fn();
    }
  };
  document.addEventListener("visibilitychange", onVisible);
  // Temizlik: clearInterval(id) ile birlikte dinleyiciyi de bırakmak için kaydet.
  registry.set(id, onVisible);
  return id;
}

const registry = new Map<number, () => void>();

export function clearVisibleInterval(id: number) {
  window.clearInterval(id);
  const l = registry.get(id);
  if (l) {
    document.removeEventListener("visibilitychange", l);
    registry.delete(id);
  }
}
