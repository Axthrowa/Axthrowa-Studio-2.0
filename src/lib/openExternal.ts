/** Tarayıcıda URL aç — Tauri → yerel API → window.open → panoya düş. */

import { API_BASE } from "./api";

export async function openExternal(url: string): Promise<"opened" | "copied" | "failed"> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_in_browser", { url });
    return "opened";
  } catch {
    /* panel WebView / tarayıcı */
  }

  try {
    const res = await fetch(`${API_BASE}/api/open-external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) return "opened";
  } catch {
    /* */
  }

  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) return "opened";

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
