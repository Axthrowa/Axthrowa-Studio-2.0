/** OBS widget önizleme: panel “Aç” ile ?preview=1 gelir. */

export function useIsWidgetPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("preview") === "1" || q.get("demo") === "1") return true;
    // OBS dışı tarayıcı açılışı — görünür demo
    if (q.get("obs") !== "1") return true;
  } catch {
    /* */
  }
  return false;
}
