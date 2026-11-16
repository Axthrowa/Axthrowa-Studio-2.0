import { API_BASE, okJson } from "../api";
import { builtinFor } from "./builtin";
import { parseStoredTemplates, type ScreenTemplate, type TemplateScreen } from "./fields";

/**
 * Kullanıcı şablonları — `panel` ayarında `screenTemplates` olarak durur
 * (yeni Rust komutu gerekmez, eski exe ile de çalışır) ve localStorage'da
 * yedeklenir. Diziler `deep_merge`'de bütünüyle değiştiği için silme =
 * kısaltılmış listeyi yazmak.
 */

const KEY = "panel.screenTemplates";
const MAX_USER_TEMPLATES = 60;

function readLocal(): ScreenTemplate[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseStoredTemplates(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: ScreenTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* depolama kapalı olabilir */
  }
}

/** Sunucu + yerel listeyi birleştirir (aynı id'de sunucu kazanır). */
export function mergeTemplateLists(remote: ScreenTemplate[], local: ScreenTemplate[]): ScreenTemplate[] {
  const map = new Map<string, ScreenTemplate>();
  for (const t of local) map.set(t.id, t);
  for (const t of remote) map.set(t.id, t);
  return [...map.values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function loadUserTemplates(): Promise<ScreenTemplate[]> {
  const local = readLocal();
  try {
    const res = await fetch(`${API_BASE}/api/settings?screen=panel`, { cache: "no-store" });
    if (!res.ok) return local;
    const data = await res.json();
    const merged = mergeTemplateLists(parseStoredTemplates(data?.screenTemplates), local);
    writeLocal(merged);
    return merged;
  } catch {
    return local;
  }
}

/**
 * Listeyi sunucuya yazar ve yanıtı doğrular. Eskiden `patchSettings` yanıtın
 * durumuna bakmıyordu: sunucu reddetse de "kaydedildi" deniyordu.
 * Yerel yedek her durumda yazılır; sunucu hatasında çağıran haberdar edilir
 * (`TemplateSaveError.localOk` = en azından bu bilgisayarda duruyor).
 */
export class TemplateSaveError extends Error {
  localOk: boolean;
  constructor(message: string, localOk: boolean) {
    super(message);
    this.localOk = localOk;
  }
}

async function persist(list: ScreenTemplate[]) {
  const trimmed = list.slice(-MAX_USER_TEMPLATES);
  writeLocal(trimmed);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/settings/patch?screen=panel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenTemplates: trimmed }),
    });
  } catch (e) {
    throw new TemplateSaveError(`sunucuya ulaşılamadı (${String((e as Error)?.message || e)})`, true);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 120);
    throw new TemplateSaveError(`sunucu reddetti (${res.status}${body ? `: ${body}` : ""})`, true);
  }
  // Yazıldığını geri okuyarak doğrula.
  try {
    const back = await fetch(`${API_BASE}/api/settings?screen=panel`, { cache: "no-store" }).then(okJson);
    const ids = new Set(parseStoredTemplates(back?.screenTemplates).map((t) => t.id));
    if (trimmed.some((t) => !ids.has(t.id))) {
      throw new TemplateSaveError("sunucu şablonu kalıcı yazmadı", true);
    }
  } catch (e) {
    if (e instanceof TemplateSaveError) throw e;
    /* geri okuma başarısızsa yazma başarılı sayılır */
  }
  return trimmed;
}

export async function saveUserTemplate(t: ScreenTemplate): Promise<ScreenTemplate[]> {
  const list = await loadUserTemplates();
  return persist([...list.filter((x) => x.id !== t.id), t]);
}

/**
 * Silme: sunucudaki liste de yerel yedek de kısalır. `loadUserTemplates`
 * birleştirme yaptığı için önce yerel yedeği temizleyip sonra yazıyoruz;
 * yoksa silinen şablon yerel kopyadan geri dirilirdi.
 */
export async function deleteUserTemplate(id: string): Promise<ScreenTemplate[]> {
  const list = await loadUserTemplates();
  const kalan = list.filter((x) => x.id !== id);
  writeLocal(kalan);
  return persist(kalan);
}

/** Bir ekranın gösterilecek listesi: hazırlar önce, sonra kullanıcınınkiler. */
export function templatesFor(screen: TemplateScreen, user: ScreenTemplate[]): ScreenTemplate[] {
  return [...builtinFor(screen), ...user.filter((t) => t.screen === screen)];
}
