/**
 * İlk kurulum sihirbazının saf kuralları (U1). Bileşen: components/panel/KurulumSihirbazi.tsx.
 * Bitti bilgisi sunucudaki panel ayarlarında (`kurulumBitti`) durur: temiz veri klasörü sihirbazı yeniden gösterir.
 */
import type { OverlaySettings } from "./api";

export const KURULUM_ADIMLARI = ["obs", "platform", "sahne", "test"] as const;
export type KurulumAdimi = (typeof KURULUM_ADIMLARI)[number];

/** OBS'e eklenen tek birleşik katmanın kaynak adı */
export const OVERLAY_KAYNAK_ADI = "AxthrowA Overlay";

/** Kurulum satırı görünsün mü: bitmediyse ve kullanıcı OBS'i daha önce elle ayarlamadıysa (eski kurulumlar) */
export function kurulumGerekli(panel: OverlaySettings | null | undefined): boolean {
  if (!panel) return false;
  if (panel.kurulumBitti === true) return false;
  const obs = (panel.obs || {}) as Record<string, unknown>;
  const elleAyarli = Boolean(String(obs.host || "").trim() && (obs.password || (obs.port && Number(obs.port) !== 4455)));
  return !elleAyarli;
}

export type SahneEslemesi = { giris?: string; oyun?: string; mola?: string };

/**
 * Seçilen sahneleri ekran ayarlarına yazan yamalar (sunucu derin birleştirir). Alan adları Ekranlar sayfasındaki
 * seçicilerle aynıdır; boş seçim o alana dokunmaz.
 */
export function sahneYamalari(e: SahneEslemesi): { starting?: OverlaySettings; brb?: OverlaySettings } {
  const starting: Record<string, unknown> = {};
  const brb: Record<string, unknown> = {};
  if (e.giris) Object.assign(starting, { startingScene: e.giris, sceneMap: { starting: e.giris } });
  if (e.oyun) {
    starting.sceneOnEnd = e.oyun;
    starting.returnScene = e.oyun;
    starting.sceneMap = { ...((starting.sceneMap as object) || {}), game: e.oyun };
    Object.assign(brb, { brbEndScene: e.oyun, returnScene: e.oyun });
  }
  if (e.mola) Object.assign(brb, { brbScene: e.mola, sceneMap: { brb: e.mola } });
  return {
    ...(Object.keys(starting).length ? { starting: { obs: starting } } : {}),
    ...(Object.keys(brb).length ? { brb: { obs: brb } } : {}),
  };
}

/** Sahne adlarından tahmin: "Başlıyor", "Mola", "Oyun" gibi adları önceden seçer */
export function sahneTahmini(sahneler: string[]): SahneEslemesi {
  const bul = (re: RegExp) => sahneler.find((s) => re.test(s));
  return {
    giris: bul(/ba[sş]l[ıi]yor|giri[sş]|start|intro/i),
    mola: bul(/mola|brb|ara\b|break|pause/i),
    oyun: bul(/oyun|game|canl[ıi]|live|main|^ana\b/i),
  };
}
