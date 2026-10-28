/**
 * Ayar profilleri — tüm ekran ayarlarını adlandırılmış bir profile kaydet, aralarında geç.
 *
 * ## Ne profile özel, ne ortak
 * **Profile özel:** Giriş/Çıkış/Mola/Chat ekran ayarları (görünüm, yazılar, süreler,
 * bitiş kuralları, sahne eşleşmeleri, kısayollar), ses paneli sesleri ve kısayolları,
 * "tüm sesleri durdur" kısayolu.
 * **Ortak (profile girmez):** OBS bağlantısı (adres/port/şifre), Kick/bot hesapları,
 * oturumlar. Bunlar makineye/hesaba aittir; profil değişince bağlantı kopmasın ve
 * şifre bir yedek dosyasına ya da başka profile sızmasın.
 *
 * ## Saklama
 * `panel.settingsProfiles = { activeId, profiles: [...] }`. **Etkin profilin
 * verisi saklanmaz** — canlı ayarlar zaten odur. Yalnız etkin olmayan profillerin
 * anlık görüntüsü durur; profil değişirken eski etkin profilin görüntüsü alınır.
 * Böylece her panel yamasıyla yayınlanan `panel` ayarı gereksiz büyümez.
 */

export type ScreenKey = "starting" | "ending" | "brb" | "chat";
export const PROFILE_SCREENS: ScreenKey[] = ["starting", "ending", "brb", "chat"];

type Json = Record<string, any>;

export type SoundPadLike = { id: string; name?: string; file?: string; hotkey?: string; volume?: number };

export type ProfileSnapshot = {
  screens: Partial<Record<ScreenKey, Json>>;
  soundboard: SoundPadLike[];
  sfxStopHotkey: string;
};

export type Profile = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Yalnız etkin OLMAYAN profillerde dolu. */
  data: ProfileSnapshot | null;
  /** Profile geçince OBS'te açılacak sahne (boş = sahne değişmez) */
  obsSahne?: string;
};

export type ProfilesState = { activeId: string; profiles: Profile[] };

export const MAX_PROFILES = 12;
export const MAX_NAME = 40;
export const DEFAULT_PROFILE_NAME = "Ana profil";

/** Profile girmeyen ekran-içi geçici anahtarlar (yayın olayları, ses komutu). */
const TRANSIENT_KEYS = ["_widgetEvent", "_sfxCue", "_shopSfx"];

/** OBS bağlantı alanları — makineye özel, profile girmez. */
export const CONNECTION_KEYS = ["host", "port", "password"] as const;

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** `obs` diliminden bağlantı alanlarını çıkarır. */
export function stripConnection(obs: unknown): Json | undefined {
  if (!obs || typeof obs !== "object") return undefined;
  const out: Json = clone(obs as Json);
  for (const k of CONNECTION_KEYS) delete out[k];
  return out;
}

/** Bir ekran ayarının profile girecek kopyası: bağlantı ve geçici alanlar temizlenir. */
export function screenForProfile(settings: Json | null | undefined): Json {
  const out: Json = clone(settings || {});
  for (const k of TRANSIENT_KEYS) delete out[k];
  if (out.obs !== undefined) {
    const o = stripConnection(out.obs);
    if (o === undefined) delete out.obs;
    else out.obs = o;
  }
  return out;
}

export function captureSnapshot(
  screens: Partial<Record<ScreenKey, Json>>,
  panel: Json | null | undefined,
  soundboard?: SoundPadLike[]
): ProfileSnapshot {
  const s: Partial<Record<ScreenKey, Json>> = {};
  for (const k of PROFILE_SCREENS) if (screens[k]) s[k] = screenForProfile(screens[k]);
  const pads = soundboard ?? (Array.isArray(panel?.soundboard) ? (panel!.soundboard as SoundPadLike[]) : []);
  return {
    screens: s,
    soundboard: clone(pads),
    sfxStopHotkey: String(panel?.sfxStopHotkey || ""),
  };
}

/**
 * Profilin bir ekran ayarını, o ekranın MEVCUT bağlantı bilgisiyle birleştirir:
 * profil değişince OBS adresi/şifresi korunur.
 */
export function screenForApply(snapshotScreen: Json | undefined, currentScreen: Json | null | undefined): Json {
  const out: Json = clone(snapshotScreen || {});
  const curObs = (currentScreen?.obs && typeof currentScreen.obs === "object" ? currentScreen.obs : {}) as Json;
  const conn: Json = {};
  for (const k of CONNECTION_KEYS) if (curObs[k] !== undefined) conn[k] = curObs[k];
  if (Object.keys(conn).length || out.obs !== undefined) {
    out.obs = { ...(out.obs || {}), ...conn };
  }
  return out;
}

/**
 * Anlık görüntüye girecek ses listesi: sunucudaki liste esastır; yalnızca sunucuda
 * hiç liste yoksa (`null`) yerel yedek kullanılır. Sunucudaki boş liste bilinçli
 * "ses yok" demektir ve yerelin eski kopyası onu geri getirmemeli.
 */
export function chooseSoundboard(server: SoundPadLike[] | null, local: SoundPadLike[]): SoundPadLike[] {
  return server !== null ? server : local;
}

/* ------------------------------------------------------------- durum işlemleri */

export function newProfileId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `pf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Adı kırpar; boşsa varsayılan; aynı ad varsa " (2)", " (3)"… ekler. */
export function uniqueName(raw: string, existing: string[], selfName?: string): string {
  const base = (raw || "").trim().slice(0, MAX_NAME) || "Yeni profil";
  const taken = new Set(existing.map((n) => n.toLocaleLowerCase("tr")));
  if (selfName) taken.delete(selfName.toLocaleLowerCase("tr"));
  if (!taken.has(base.toLocaleLowerCase("tr"))) return base;
  for (let i = 2; i < 100; i++) {
    const cand = `${base.slice(0, MAX_NAME - 5)} (${i})`;
    if (!taken.has(cand.toLocaleLowerCase("tr"))) return cand;
  }
  return `${base.slice(0, MAX_NAME - 8)} ${Date.now() % 100000}`;
}

/** Sunucudan/depodan gelen ham durumu doğrular; bozuksa tek profilli varsayılan üretir. */
export function ensureState(raw: unknown, now = Date.now()): ProfilesState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Json;
  const list: Profile[] = [];
  const seen = new Set<string>();
  for (const p of Array.isArray(r.profiles) ? r.profiles : []) {
    if (!p || typeof p !== "object" || typeof p.id !== "string" || seen.has(p.id)) continue;
    seen.add(p.id);
    list.push({
      id: p.id,
      name: String(p.name || "Profil").slice(0, MAX_NAME),
      createdAt: Number(p.createdAt) || now,
      updatedAt: Number(p.updatedAt) || now,
      data: p.data && typeof p.data === "object" ? (p.data as ProfileSnapshot) : null,
      ...(typeof p.obsSahne === "string" && p.obsSahne.trim() ? { obsSahne: p.obsSahne.trim().slice(0, 100) } : {}),
    });
  }
  if (!list.length) {
    const id = newProfileId();
    return { activeId: id, profiles: [{ id, name: DEFAULT_PROFILE_NAME, createdAt: now, updatedAt: now, data: null }] };
  }
  const activeId = list.some((p) => p.id === r.activeId) ? String(r.activeId) : list[0].id;
  // Etkin profilin verisi tutulmaz (canlı ayar odur).
  return { activeId, profiles: list.map((p) => (p.id === activeId ? { ...p, data: null } : p)) };
}

/** Profilin OBS sahnesini ayarlar (boş metin kaldırır) */
export function setProfileScene(state: ProfilesState, id: string, sahne: string): ProfilesState {
  const temiz = sahne.trim().slice(0, 100);
  return {
    ...state,
    profiles: state.profiles.map((p) => {
      if (p.id !== id) return p;
      const { obsSahne: _eski, ...kalan } = p;
      return temiz ? { ...kalan, obsSahne: temiz } : kalan;
    }),
  };
}

export function activeProfile(state: ProfilesState): Profile {
  return state.profiles.find((p) => p.id === state.activeId) || state.profiles[0];
}

/**
 * Yeni profil: verilen anlık görüntüden (genelde geçerli ayarlar) türetilir ve
 * etkin olmaz — kullanıcı isterse geçer.
 */
export function addProfile(
  state: ProfilesState,
  name: string,
  snapshot: ProfileSnapshot,
  now = Date.now()
): { state: ProfilesState; id: string } | { error: string } {
  if (state.profiles.length >= MAX_PROFILES) return { error: `En fazla ${MAX_PROFILES} profil` };
  const id = newProfileId();
  const nm = uniqueName(name, state.profiles.map((p) => p.name));
  return {
    id,
    state: {
      ...state,
      profiles: [...state.profiles, { id, name: nm, createdAt: now, updatedAt: now, data: clone(snapshot) }],
    },
  };
}

export function renameProfile(state: ProfilesState, id: string, name: string, now = Date.now()): ProfilesState {
  const cur = state.profiles.find((p) => p.id === id);
  if (!cur) return state;
  const nm = uniqueName(name, state.profiles.map((p) => p.name), cur.name);
  return { ...state, profiles: state.profiles.map((p) => (p.id === id ? { ...p, name: nm, updatedAt: now } : p)) };
}

/** Etkin profil ve son profil silinemez. */
export function canDelete(state: ProfilesState, id: string): boolean {
  return state.profiles.length > 1 && id !== state.activeId && state.profiles.some((p) => p.id === id);
}

export function removeProfile(state: ProfilesState, id: string): ProfilesState {
  if (!canDelete(state, id)) return state;
  return { ...state, profiles: state.profiles.filter((p) => p.id !== id) };
}

/**
 * Profil değiştirme: eski etkin profilin verisi `currentSnapshot` olarak saklanır,
 * hedefin verisi çıkarılıp uygulanmak üzere döner ve hedef etkin olur.
 * Hedefin verisi yoksa (bozuk kayıt) `null` döner: çağıran değişiklik yapmaz.
 */
export function switchProfile(
  state: ProfilesState,
  targetId: string,
  currentSnapshot: ProfileSnapshot,
  now = Date.now()
): { state: ProfilesState; apply: ProfileSnapshot } | null {
  if (targetId === state.activeId) return null;
  const target = state.profiles.find((p) => p.id === targetId);
  if (!target || !target.data) return null;
  const apply = target.data;
  return {
    apply,
    state: {
      activeId: targetId,
      profiles: state.profiles.map((p) => {
        if (p.id === state.activeId) return { ...p, data: clone(currentSnapshot), updatedAt: now };
        if (p.id === targetId) return { ...p, data: null, updatedAt: now };
        return p;
      }),
    },
  };
}
