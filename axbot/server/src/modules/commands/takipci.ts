/** Kick kanal JSON'undan takipçi sayısı. */
export function kickTakipciSayisi(veri: unknown): number | null {
  const d = veri as { followers_count?: unknown; followersCount?: unknown } | null;
  const n = Number(d?.followers_count ?? d?.followersCount);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/** Twitch Helix `channels/followers` yanıtındaki total. */
export function twitchTakipciSayisi(veri: unknown): number | null {
  const n = Number((veri as { total?: unknown } | null)?.total);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}
