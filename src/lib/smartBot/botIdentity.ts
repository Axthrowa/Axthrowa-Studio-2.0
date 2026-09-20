/** Kick sohbetinde görünen bot kimliği — Botrix’teki `botrixlive` karşılığı. */
export const DEFAULT_BOT_NAME = "BotAxT";

const KNOWN = new Set(["botaxt", "sesbot", "bot axt"]);

export function isLocalBotUser(user: string, botName?: string): boolean {
  const u = String(user || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (!u) return false;
  if (KNOWN.has(u)) return true;
  const configured = String(botName || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  return Boolean(configured) && u === configured;
}
