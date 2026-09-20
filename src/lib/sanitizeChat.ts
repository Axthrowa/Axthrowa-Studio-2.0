/**
 * Chat / overlay XSS kalkanı — dış URL’ler yalnızca HTTPS CDN’lere iner.
 * Metin React text node olarak kalır; HTML enjekte edilmez.
 */

const ALLOWED_HOST_SUFFIXES = [
  "kick.com",
  "7tv.io",
  "7tv.app",
  "jtvnw.net",
  "twitchcdn.net",
  "betterttv.net",
  "frankerfacez.com",
  "ggpht.com",
  "ytimg.com",
  "googleusercontent.com",
];

function hostAllowed(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** javascript:/data:/file: ve yabancı host’ları eler. */
export function safeMediaUrl(raw: string | undefined | null): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/[\s<>"'`]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!hostAllowed(url.hostname)) return null;
  return url.toString();
}

export function sanitizePlainText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, 4000);
}
