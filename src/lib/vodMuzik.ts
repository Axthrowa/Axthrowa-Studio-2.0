/**
 * Y14 VOD için müzik denetimi: OBS'te Twitch VOD izi açıksa ve müzik kaynağı o ize de gidiyorsa uyarır; düzeltme
 * müziği yalnız VOD izinden çıkarır (canlı yayında çalmaya devam eder). Ayar adları OBS'in kendi kaydettiği
 * `[AdvOut] VodTrackEnabled / VodTrackIndex` ve `[SimpleOutput] VodTrackEnabled`.
 */
import { getObs } from "./obs";

const MUZIK_ADI = /m[uü]zik|music|spotify|şarkı|sarki|song|playlist|resonance/i;
const MUZIK_PROGRAMI = /spotify|music|tidal|deezer|foobar|aimp|vlc|itunes|winamp|musicbee|resonance/i;

/** Ad, uygulama sesi yakalamanın penceresi ya da tarayıcı kaynağının adresi müziği gösteriyor mu */
export function muzikGirisiMi(g: { ad: string; tur: string; ayar?: Record<string, unknown> }): boolean {
  if (MUZIK_ADI.test(g.ad)) return true;
  if (g.tur.startsWith("wasapi_process_output_capture")) return MUZIK_PROGRAMI.test(String(g.ayar?.window ?? ""));
  if (g.tur === "browser_source") return /resonance|:8850\b/i.test(String(g.ayar?.url ?? ""));
  return false;
}

export type VodAyari = { mod: string; acik: boolean; iz: number };

/** VOD izi (1-6) ya da kapalıysa null. Basit kipte OBS VOD için 2. izi kullanır. */
export function vodIzi(a: VodAyari): number | null {
  if (!a.acik) return null;
  // shortcut: basit kipte iz 2 varsayılır (OBS arayüzü orada iz seçtirmiyor); farklı çıkarsa okunan değer eklenir
  if (a.mod !== "Advanced") return 2;
  return a.iz >= 1 && a.iz <= 6 ? a.iz : null;
}

/** Müzik kaynakları arasında VOD izine de gidenler */
export function vodaGidenMuzik(iz: number | null, girisler: { ad: string; izler: Record<string, boolean> }[]): string[] {
  if (iz === null) return [];
  return girisler.filter((g) => g.izler[String(iz)] === true).map((g) => g.ad);
}

type ObsCagri = (istek: string, veri?: Record<string, unknown>) => Promise<any>;
const cagir: ObsCagri = (istek, veri) => (getObs() as unknown as { call: ObsCagri }).call(istek, veri);

async function ayarOku(kategori: string, ad: string): Promise<string> {
  const r = await cagir("GetProfileParameter", { parameterCategory: kategori, parameterName: ad });
  return String(r?.parameterValue ?? r?.defaultParameterValue ?? "");
}

export async function vodMuzikDenetle(): Promise<{ iz: number | null; sorunlu: string[] }> {
  const mod = await ayarOku("Output", "Mode");
  const bolum = mod === "Advanced" ? "AdvOut" : "SimpleOutput";
  const iz = vodIzi({ mod, acik: (await ayarOku(bolum, "VodTrackEnabled")) === "true", iz: Number(await ayarOku("AdvOut", "VodTrackIndex")) });
  if (iz === null) return { iz, sorunlu: [] };
  const { inputs } = (await cagir("GetInputList")) as { inputs: { inputName: string; inputKind: string }[] };
  const muzik: { ad: string; izler: Record<string, boolean> }[] = [];
  for (const i of inputs) {
    const ayarGerek = i.inputKind.startsWith("wasapi_process_output_capture") || i.inputKind === "browser_source";
    const ayar = ayarGerek ? ((await cagir("GetInputSettings", { inputName: i.inputName }).catch(() => null))?.inputSettings as Record<string, unknown>) : undefined;
    if (!muzikGirisiMi({ ad: i.inputName, tur: i.inputKind, ayar })) continue;
    const t = await cagir("GetInputAudioTracks", { inputName: i.inputName }).catch(() => null);
    if (t?.inputAudioTracks) muzik.push({ ad: i.inputName, izler: t.inputAudioTracks });
  }
  return { iz, sorunlu: vodaGidenMuzik(iz, muzik) };
}

/** Müziği yalnız VOD izinden çıkarır */
export async function vodMuzikDuzelt(iz: number, girisler: string[]): Promise<void> {
  for (const ad of girisler) await cagir("SetInputAudioTracks", { inputName: ad, inputAudioTracks: { [String(iz)]: false } });
}
