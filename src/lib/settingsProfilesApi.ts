/**
 * Ayar profilleri — sunucu katmanı (saf mantık `settingsProfiles.ts`'te).
 */

import { API_BASE, fetchSettings, saveSettings, type OverlaySettings } from "./api";
import { loadSoundboard, saveSoundboard } from "./soundboard";
import {
  PROFILE_SCREENS,
  chooseSoundboard,
  activeProfile,
  addProfile,
  captureSnapshot,
  ensureState,
  removeProfile,
  renameProfile,
  screenForApply,
  switchProfile,
  type ProfileSnapshot,
  type ProfilesState,
  type ScreenKey,
} from "./settingsProfiles";

async function patchPanel(patch: OverlaySettings): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/patch?screen=panel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`sunucu reddetti (${res.status})`);
}

/** Kayıtlı profil durumunu okur; yoksa tek profilli varsayılanı kaydeder. */
export async function loadProfilesState(): Promise<ProfilesState> {
  const panel = await fetchSettings("panel");
  const state = ensureState(panel.settingsProfiles);
  if (!panel.settingsProfiles) await persistProfilesState(state).catch(() => {});
  return state;
}

export async function persistProfilesState(state: ProfilesState): Promise<void> {
  // Diziler sunucuda bütünüyle değişir: silinen profil geri dirilmez.
  await patchPanel({ settingsProfiles: state });
}

/** Şu anki canlı ayarların anlık görüntüsü. */
export async function captureCurrent(): Promise<ProfileSnapshot> {
  const screens: Partial<Record<ScreenKey, OverlaySettings>> = {};
  await Promise.all(
    PROFILE_SCREENS.map(async (k) => {
      try {
        screens[k] = await fetchSettings(k);
      } catch {
        /* o ekran okunamadıysa profile girmez */
      }
    })
  );
  const panel = await fetchSettings("panel");
  // Ses listesinin doğrusu SUNUCUDAKİ `panel.soundboard`. Yerel depo (`loadSoundboard`)
  // her tarayıcıda ayrı: boş bir tarayıcıdan profil almak/uygulamak kullanıcının
  // gerçek seslerini siliyordu. Yerel yalnız sunucuda hiç yoksa yedek olarak kullanılır.
  const server = Array.isArray(panel.soundboard) ? panel.soundboard : null;
  return captureSnapshot(screens, panel, chooseSoundboard(server, loadSoundboard()));
}

/** Bir anlık görüntüyü canlı ayarlara yazar (OBS bağlantısı korunarak). */
export async function applySnapshot(snap: ProfileSnapshot): Promise<void> {
  for (const k of PROFILE_SCREENS) {
    const target = snap.screens[k];
    if (!target) continue;
    let current: OverlaySettings = {};
    try {
      current = await fetchSettings(k);
    } catch {
      /* mevcut okunamazsa bağlantı taşınamaz; profil yine de uygulanır */
    }
    await saveSettings(k, screenForApply(target, current));
  }
  await patchPanel({ soundboard: snap.soundboard, sfxStopHotkey: snap.sfxStopHotkey });
  saveSoundboard(snap.soundboard as never); // yerel yedeği de aynı listeyle hizala
}

/** Geçerli ayarlardan yeni profil oluşturur (etkin profil değişmez). */
export async function createProfileFromCurrent(name: string): Promise<ProfilesState> {
  const state = await loadProfilesState();
  const r = addProfile(state, name, await captureCurrent());
  if ("error" in r) throw new Error(r.error);
  await persistProfilesState(r.state);
  return r.state;
}

/** Profile geçer: eski etkin profil kaydedilir, hedef uygulanır. Sayfa sonra yenilenmeli. */
export async function switchToProfile(targetId: string): Promise<ProfilesState> {
  const state = await loadProfilesState();
  const now = await captureCurrent();
  const r = switchProfile(state, targetId, now);
  if (!r) throw new Error("Bu profilin verisi bulunamadı");
  await applySnapshot(r.apply);
  await persistProfilesState(r.state);
  return r.state;
}

export async function renameProfileApi(id: string, name: string): Promise<ProfilesState> {
  const next = renameProfile(await loadProfilesState(), id, name);
  await persistProfilesState(next);
  return next;
}

export async function deleteProfileApi(id: string): Promise<ProfilesState> {
  const next = removeProfile(await loadProfilesState(), id);
  await persistProfilesState(next);
  return next;
}

export { activeProfile };
