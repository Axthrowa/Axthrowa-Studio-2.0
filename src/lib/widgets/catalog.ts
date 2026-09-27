/** Enterprise widget katalog meta — Rust `WidgetGroup` ile hizalı. */

export type WidgetGroupId =
  | "goals_trackers"
  | "physics_visuals"
  | "chat_events"
  | "gamification"
  | "media_tts"
  | "utility"
  | "other";

export type WidgetGroupMeta = {
  id: WidgetGroupId;
  label: string;
  accent: string;
  kinds: string[];
};

export const WIDGET_GROUPS: WidgetGroupMeta[] = [
  {
    id: "goals_trackers",
    label: "Hedefler ve Sayaçlar",
    accent: "#3ecfcf",
    kinds: ["goal", "kicksubs", "subathon", "viewers", "labels"],
  },
  {
    id: "physics_visuals",
    label: "Fizik ve Görsel",
    accent: "#f59e0b",
    kinds: ["emotewall", "emotecombo", "cup"],
  },
  {
    id: "chat_events",
    label: "Sohbet ve Olaylar",
    accent: "#38bdf8",
    kinds: ["chat", "activity", "shoutout"],
  },
  {
    id: "gamification",
    label: "Oyunlaştırma",
    accent: "#fb7185",
    kinds: ["wheel", "poll", "raffles", "hypetrain"],
  },
  {
    id: "media_tts",
    label: "Medya ve TTS",
    accent: "#22d3ee",
    kinds: ["songrequest", "tts", "now-playing"],
  },
  {
    id: "utility",
    label: "Yayın Sonu",
    accent: "#94a3b8",
    kinds: ["credits", "redeems", "alerts"],
  },
];

export function groupIdForKind(kind: string): WidgetGroupId {
  const k = kind.toLowerCase();
  for (const g of WIDGET_GROUPS) {
    if (g.kinds.includes(k)) return g.id;
  }
  return "other";
}

export function groupMeta(id: WidgetGroupId): WidgetGroupMeta {
  return (
    WIDGET_GROUPS.find((g) => g.id === id) || {
      id: "other",
      label: "Diğer",
      accent: "#64748b",
      kinds: [],
    }
  );
}

export function accentForKind(kind: string): string {
  return groupMeta(groupIdForKind(kind)).accent;
}
