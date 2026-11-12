/** OBS widget olayları — panel settings üzerinden overlay-sync. */

import { patchSettings } from "../api";

export type WidgetEventKind =
  | "follow"
  | "sub"
  | "raid"
  | "bits"
  | "superchat"
  | "membership"
  | "donation"
  | "redeem"
  | "poll"
  | "prediction"
  | "test"
  | "tts"
  | "emotecombo"
  | "shoutout"
  | "emote"
  | "giveaway"
  | "wheel"
  | "hypetrain"
  | "viewers"
  | "cup"
  | "subathon"
  | "label";

export type WidgetEvent = {
  id: string;
  kind: WidgetEventKind;
  user: string;
  message?: string;
  amount?: string;
  platform?: string;
  meta?: Record<string, unknown>;
  t: number;
};

/** Overlay’lere anında düşer (SFX cue ile aynı kanal). */
export async function emitWidgetEvent(
  partial: Omit<WidgetEvent, "id" | "t"> & { id?: string; t?: number }
): Promise<WidgetEvent> {
  const ev: WidgetEvent = {
    id: partial.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    t: partial.t || Date.now(),
    kind: partial.kind,
    user: partial.user,
    message: partial.message,
    amount: partial.amount,
    platform: partial.platform,
    meta: partial.meta,
  };
  try {
    await patchSettings("panel", { _widgetEvent: ev });
  } catch {
    /* */
  }
  // SQLite events_log (dashboard)
  try {
    const { logBotEvent } = await import("../api/botApi");
    void logBotEvent({
      kind: ev.kind,
      platform: ev.platform || "local",
      user_name: ev.user,
      amount: ev.amount ? Number(String(ev.amount).replace(/[^\d.]/g, "")) || undefined : undefined,
      message: ev.message,
    });
  } catch {
    /* */
  }
  try {
    window.dispatchEvent(new CustomEvent("sohbet-bot-widget-olayi", { detail: ev }));
    window.dispatchEvent(new CustomEvent("trigger_alert", { detail: ev }));
  } catch {
    /* */
  }
  // Tauri panel webview (OBS Browser Source bunu almaz — WS kullanır)
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit("trigger_alert", ev);
  } catch {
    /* */
  }
  return ev;
}
