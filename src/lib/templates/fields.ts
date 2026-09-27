/**
 * Ekran şablonları — hangi alanlar şablona girer, nasıl uygulanır.
 *
 * ## Tasarımın kalbi: beyaz liste
 * Ekran ayarı JSON'u 30-58 alan taşıyor ve içinde kişisel/gizli veri var:
 * OBS şifresi (`obs`), sosyal hesap adları (`socials`), kendi logon
 * (`logoFile`), hedef tarih, medya dosya adları. Şablon **yasak listesiyle**
 * değil **izin listesiyle** çalışır: yeni bir alan eklendiğinde şablona kendi
 * kendine sızmaz, önce buraya bilinçli olarak eklenmesi gerekir.
 *
 * ## Medya neden yok
 * Şablon, video/görsel/logo dosyasını taşımaz. Dosya yolları makineye özel;
 * taşınabilir bir şablon kırık yol yazardı. Bu yüzden şablon yalnızca
 * *görünümü* (renk, yazı tipi, yerleşim, parçacık, sayaç biçimi) uygular;
 * kullanıcının kendi videosu/logosu yerinde kalır.
 */

export type TemplateScreen = "starting" | "ending" | "brb";
export type Json = Record<string, any>;

/** Ekrandaki yazılar — ayrı grup: kullanıcı kendi başlığını korumak isteyebilir. */
export const TEXT_FIELDS = ["eyebrow", "title", "sub", "ticker", "liveText"] as const;

/** Görünümü belirleyen alanlar. */
export const STYLE_FIELDS = [
  // renk ve tipografi
  "accent",
  "textColor",
  "eyebrowColor",
  "subColor",
  "countdownColor",
  "tickerColor",
  "countdownStyle",
  "font",
  "textStyles",
  // arka plan (dosya taşımayan kısmı)
  "bgStyle",
  "particles",
  "particleTypes",
  "particleSizes",
  "particleColors",
  "particleGlow",
  "particleDensity",
  "transparent",
  // logo görünümü (dosya yolu HARİÇ)
  "logoFit",
  "logoFrame",
  "logoZoom",
  "logoPanX",
  "logoPanY",
  "logoAnim",
  // yerleşim
  "positions",
  "sizes",
  "visible",
  // kayan yazı
  "tickerFade",
  "tickerFrom",
  "tickerTo",
  "tickerWidth",
  "tickerSpeed",
  // ekrana özel görünüm
  "visualizer",
  "creditsEnabled",
  "creditsSize",
] as const;

/** İçinde alt anahtarları birleştirilen (üzerine yazılmayan) alanlar. */
const MERGED_OBJECTS = new Set(["textStyles", "positions", "sizes", "visible"]);

/** Şablonda saklanabilen `bgStyle` değerleri: dosya gerektirmeyenler. */
export const PORTABLE_BG = new Set(["mix", "accent", "dark"]);

/** Hiçbir koşulda şablona girmemesi gereken anahtar adı kalıpları. */
const SECRET_KEY = /pass|token|secret|handle|apikey|api_key/i;

const ALL_FIELDS = new Set<string>([...TEXT_FIELDS, ...STYLE_FIELDS]);

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** İç içe nesnelerden gizli görünen anahtarları düşürür (savunma katmanı). */
function stripSecrets(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripSecrets);
  if (v && typeof v === "object") {
    const out: Json = {};
    for (const [k, val] of Object.entries(v as Json)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = stripSecrets(val);
    }
    return out;
  }
  return v;
}

/**
 * Ekran ayarından şablona girebilecek alanları çeker.
 * @param includeTexts başlık/alt yazı gibi metinler de alınsın mı
 */
export function pickTemplateFields(settings: Json | null | undefined, includeTexts = true): Json {
  const src = settings || {};
  const out: Json = {};
  const fields = includeTexts ? [...TEXT_FIELDS, ...STYLE_FIELDS] : [...STYLE_FIELDS];
  for (const key of fields) {
    if (!(key in src) || src[key] === undefined) continue;
    out[key] = stripSecrets(clone(src[key]));
  }
  // Taşınamayan arka plan (video/görsel/YouTube) şablonda "mix"e iner: dosyası
  // olmayan bir makinede boş ekran çıkmasın.
  if (out.bgStyle !== undefined && !PORTABLE_BG.has(String(out.bgStyle))) out.bgStyle = "mix";
  return out;
}

/** Şablon ayarındaki bilinmeyen/izinsiz alanlar — hazır şablonların testte denetlenmesi için. */
export function forbiddenKeys(settings: Json): string[] {
  return Object.keys(settings || {}).filter((k) => !ALL_FIELDS.has(k));
}

export type MergeResult = {
  /** Uygulanacak yeni değerler (yalnız değişen alanlar) */
  next: Json;
  /** Değişen alan adları — "N alan güncellendi" özeti için */
  changed: string[];
  /** Geri almak için eski değerler; eskiden olmayan alan `undefined` */
  before: Json;
};

/**
 * Şablonu mevcut ayarın üzerine uygular.
 *
 * - Yalnız izinli alanlar geçer; şablon dosyası elle bozulmuş olsa bile
 *   `obs` gibi bir alan sızamaz.
 * - `textStyles`/`positions`/`sizes`/`visible` alt anahtar bazında birleşir:
 *   şablon yalnız bir metnin konumunu veriyorsa öbürleri bozulmaz.
 * - Metinler `includeTexts` kapalıysa korunur.
 */
export function mergeTemplate(
  current: Json | null | undefined,
  tplSettings: Json | null | undefined,
  includeTexts = false
): MergeResult {
  const cur = current || {};
  const picked = pickTemplateFields(tplSettings, includeTexts);
  const next: Json = {};
  const before: Json = {};
  const changed: string[] = [];

  for (const [key, val] of Object.entries(picked)) {
    let value = val;
    if (MERGED_OBJECTS.has(key) && val && typeof val === "object") {
      const base = cur[key] && typeof cur[key] === "object" ? cur[key] : {};
      value = { ...clone(base) };
      for (const [k, v] of Object.entries(val as Json)) {
        // textStyles gibi ikinci seviye nesneler de alt anahtar bazında birleşir.
        value[k] =
          v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object"
            ? { ...base[k], ...v }
            : v;
      }
    }
    if (JSON.stringify(value) === JSON.stringify(cur[key])) continue; // değişmedi
    before[key] = cur[key] === undefined ? undefined : clone(cur[key]);
    next[key] = value;
    changed.push(key);
  }
  return { next, changed, before };
}

/** Anlık ekran ayarından kullanıcı şablonu üretir. */
export function captureTemplate(
  screen: TemplateScreen,
  name: string,
  description: string,
  settings: Json
): ScreenTemplate {
  const cleanName = name.trim().slice(0, 40) || "Adsız şablon";
  return {
    id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    description: description.trim().slice(0, 120),
    screen,
    builtin: false,
    settings: pickTemplateFields(settings, true),
    createdAt: Date.now(),
  };
}

export type ScreenTemplate = {
  id: string;
  name: string;
  description: string;
  screen: TemplateScreen;
  builtin?: boolean;
  settings: Json;
  createdAt?: number;
};

/** Diskten/yerel depodan okunan listeyi doğrular; bozuk kayıtları eler. */
export function parseStoredTemplates(raw: unknown): ScreenTemplate[] {
  if (!Array.isArray(raw)) return [];
  const out: ScreenTemplate[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Json;
    if (typeof o.id !== "string" || typeof o.name !== "string") continue;
    if (o.screen !== "starting" && o.screen !== "ending" && o.screen !== "brb") continue;
    if (!o.settings || typeof o.settings !== "object") continue;
    out.push({
      id: o.id,
      name: String(o.name).slice(0, 40),
      description: String(o.description || "").slice(0, 120),
      screen: o.screen,
      builtin: false,
      // Elle bozulmuş dosya bile yalnız izinli alanları taşıyabilir.
      settings: pickTemplateFields(o.settings, true),
      createdAt: Number(o.createdAt) || 0,
    });
  }
  return out;
}
