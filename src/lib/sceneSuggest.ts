/**
 * Sahne-rol eşleşmesi önerisi.
 *
 * Sahne kısayolları (Giriş/Çıkış/Mola/Oyun) hedef sahneyi `obs.sceneMap`'ten
 * okur. Eşleşme boş kaldığında kısayol tuşu kayıtlı görünüp hiçbir şey yapmıyordu
 * — kullanıcı sahne listesinin de gelmediğini düşününce ne olduğunu anlamıyordu.
 * OBS'ten sahne listesi gelince, **yalnız boş rolleri** ad benzerliğiyle doldurur.
 * Kullanıcının seçtiği hiçbir eşleşmeyi ezmez.
 */

export type SceneRole = "starting" | "ending" | "brb" | "game";

const PATTERNS: Record<SceneRole, RegExp> = {
  starting: /(giri[sş]|start|intro|a[cç][iı]l[iı][sş]|ba[sş]lang[iı][cç])/i,
  ending: /([cç][iı]k[iı][sş]|biti[sş]|\bend|outro|kapan[iı][sş])/i,
  brb: /(mola|brb|be right back)/i,
  game: /(oyun|game|gameplay)/i,
};

/** Alan adları — panelin geri kalanı hem `sceneMap` hem eski alanları okuyor. */
const LEGACY_FIELD: Record<SceneRole, string> = {
  starting: "startingScene",
  ending: "endingScene",
  brb: "brbScene",
  game: "sceneOnEnd",
};

const ROLES: SceneRole[] = ["starting", "ending", "brb", "game"];

type ObsLike = {
  sceneMap?: Partial<Record<SceneRole, unknown>>;
  startingScene?: unknown;
  endingScene?: unknown;
  brbScene?: unknown;
  sceneOnEnd?: unknown;
} | null | undefined;

const has = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Rolün şu an bir sahneye bağlı olup olmadığı (sceneMap ya da eski alan). */
function currentScene(obs: ObsLike, role: SceneRole): string {
  const m = obs?.sceneMap?.[role];
  if (has(m)) return String(m);
  const legacy = (obs as Record<string, unknown> | null | undefined)?.[LEGACY_FIELD[role]];
  return has(legacy) ? String(legacy) : "";
}

/**
 * @returns `obs` için yama (`sceneMap` + eski alanlar) ya da doldurulacak boş rol yoksa `null`.
 */
export function suggestSceneMap(
  scenes: string[],
  obs: ObsLike
): { patch: Record<string, unknown>; filled: SceneRole[] } | null {
  const list = scenes.filter((s) => has(s));
  if (!list.length) return null;

  const used = new Set<string>(ROLES.map((r) => currentScene(obs, r)).filter(Boolean));
  const map: Record<string, string> = {};
  const patch: Record<string, unknown> = {};
  const filled: SceneRole[] = [];

  for (const role of ROLES) {
    if (currentScene(obs, role)) continue; // kullanıcı seçmiş
    // Rol için ilk uygun ve başka role verilmemiş sahne. "Çıkış" ile "Giriş"
    // birbirinin adına benzemesin diye önce kendi kalıbına bakılır.
    const hit = list.find((s) => !used.has(s) && PATTERNS[role].test(s));
    if (!hit) continue;
    used.add(hit);
    map[role] = hit;
    patch[LEGACY_FIELD[role]] = hit;
    filled.push(role);
  }
  if (!filled.length) return null;
  patch.sceneMap = { ...(obs?.sceneMap || {}), ...map };
  return { patch, filled };
}
