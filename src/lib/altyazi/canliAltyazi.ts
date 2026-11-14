/**
 * Y13 canlı altyazı denetleyicisi: mikrofon → bölütleyici → Whisper işçisi → `/api/altyazi` (katman + isteğe bağlı
 * OBS CEA-608). Panel sayfası açık kaldıkça çalışır; ayarlar kartı kapansa da sürer (modül düzeyi durum).
 */
import { API_BASE } from "../api";
import { Bolutleyici, VARSAYILAN, type Istek } from "./bolutleyici";
import type { IsciGelen, IsciGiden } from "./tanima.worker";

export const MODELLER = [
  { id: "onnx-community/whisper-base", ad: "Hızlı (Whisper base)", boyut: "yaklaşık 150 MB" },
  { id: "onnx-community/whisper-small", ad: "Daha doğru (Whisper small)", boyut: "yaklaşık 500 MB" },
] as const;

export type AltyaziAyar = { model: string; mikrofon: string; obs: boolean; esik: number };
export type AltyaziDurum = {
  asama: "kapali" | "yukleniyor" | "dinliyor" | "hata";
  ilerleme: number | null;
  aygit: string;
  ara: string;
  satirlar: string[];
  mesaj: string;
};

// Whisper sessizlikte ya da müzikte bu kalıpları uydurur (Türkçe altyazı verisinden kalma)
const UYDURMA = [/^altyaz[ıi]( |$)/i, /^[iİ]zledi[ğg]iniz i[çc]in te[şs]ekk[üu]r ederim[.!]?$/i, /^[[(]?\s*m[üu]zik\s*[\])]?$/i, /^abone olmay[ıi] unutmay[ıi]n/i];

/** Tanınan metni temizler; boş ya da uydurma ise "" */
export function temizle(metin: string): string {
  // Art arda üçten çok yinelenen kelime ya da kelime öbeği tek sefere iner
  const t = metin.replace(/\s+/g, " ").trim().replace(/(?<![\p{L}\p{N}])([\p{L}\p{N}'’]+(?: [\p{L}\p{N}'’]+){0,2})(?:[ ,]+\1(?![\p{L}\p{N}])){3,}/giu, "$1");
  if (!/\p{L}/u.test(t)) return "";
  return UYDURMA.some((r) => r.test(t)) ? "" : t;
}

let durum: AltyaziDurum = { asama: "kapali", ilerleme: null, aygit: "", ara: "", satirlar: [], mesaj: "" };
const dinleyiciler = new Set<(d: AltyaziDurum) => void>();
function guncelle(p: Partial<AltyaziDurum>) {
  durum = { ...durum, ...p };
  dinleyiciler.forEach((f) => f(durum));
}
export const altyaziDurumu = () => durum;
export function altyaziAbone(f: (d: AltyaziDurum) => void): () => void {
  dinleyiciler.add(f);
  return () => void dinleyiciler.delete(f);
}

let isci: Worker | null = null;
let yuklenenModel = "";
let akis: MediaStream | null = null;
let ctx: AudioContext | null = null;
// Chromium başvurusu tutulmayan ScriptProcessor'ı çöpe atar ve ses akışı sessizce durur
let dugumler: AudioNode[] = [];
let sonYuzde = -1;
let obsGonder = false;
let mesgul = false;
let bekleyen: Istek | null = null;
let sira = 0;

function gonderSunucu(metin: string, kesin: boolean) {
  void fetch(`${API_BASE}/api/altyazi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metin, kesin, obs: obsGonder }),
  })
    .then((r) => r.json())
    .then((j: { hata?: string | null }) => j.hata && guncelle({ mesaj: `OBS: ${j.hata}` }))
    .catch(() => {});
}

function isle(i: Istek) {
  // Ara sonuçlar işçi boştayken gider; kesin sonuç sıraya girer, bekleyen ara sonucun yerini alır
  if (mesgul) {
    if (i.kesin || !bekleyen?.kesin) bekleyen = i;
    return;
  }
  mesgul = true;
  isci?.postMessage({ tur: "cevir", id: ++sira, ses: i.ses, kesin: i.kesin } satisfies IsciGiden, [i.ses.buffer]);
}

function isciMesaji(e: MessageEvent<IsciGelen>) {
  const m = e.data;
  if (m.tur === "ilerleme") {
    const y = m.toplam ? Math.floor((m.yuklenen / m.toplam) * 100) : -1;
    if (y !== sonYuzde) (sonYuzde = y), guncelle({ ilerleme: y < 0 ? null : y / 100 });
  }
  else if (m.tur === "hazir") guncelle({ aygit: m.aygit === "webgpu" ? "Ekran kartı (WebGPU)" : "İşlemci (WASM)" });
  else if (m.tur === "hata") {
    // Çeviri hatası işçiyi meşgul bırakmasın: sonraki parça yine gitsin
    mesgul = false;
    guncelle({ asama: durum.asama === "yukleniyor" ? "hata" : durum.asama, mesaj: m.mesaj });
  }
  else {
    mesgul = false;
    const t = temizle(m.metin);
    if (m.kesin) {
      if (t) guncelle({ ara: "", satirlar: [...durum.satirlar, t].slice(-5) });
      else guncelle({ ara: "" });
      gonderSunucu(t, true);
    } else if (t) {
      guncelle({ ara: t });
      gonderSunucu(t, false);
    }
    const b = bekleyen;
    bekleyen = null;
    if (b && durum.asama === "dinliyor") isle(b);
  }
}

function isciHazirla(model: string): Promise<void> {
  if (isci && yuklenenModel === model) return Promise.resolve();
  isci?.terminate();
  isci = new Worker(new URL("./tanima.worker.ts", import.meta.url), { type: "module" });
  yuklenenModel = model;
  return new Promise((coz, red) => {
    const ilk = (e: MessageEvent<IsciGelen>) => {
      if (e.data.tur === "hazir") coz();
      else if (e.data.tur === "hata") {
        isci?.terminate();
        isci = null;
        yuklenenModel = "";
        red(new Error(e.data.mesaj));
      } else return;
      isci?.removeEventListener("message", ilk);
    };
    isci!.addEventListener("message", ilk);
    isci!.addEventListener("message", isciMesaji);
    isci!.postMessage({ tur: "yukle", model } satisfies IsciGiden);
  });
}

export async function altyaziBaslat(a: AltyaziAyar) {
  if (durum.asama === "dinliyor" || durum.asama === "yukleniyor") return;
  obsGonder = a.obs;
  guncelle({ asama: "yukleniyor", ilerleme: null, mesaj: "", ara: "" });
  try {
    await isciHazirla(a.model);
    akis = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: a.mikrofon ? { exact: a.mikrofon } : undefined, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    ctx = new AudioContext({ sampleRate: VARSAYILAN.ornekHizi });
    const kaynak = ctx.createMediaStreamSource(akis);
    // shortcut: ScriptProcessor kullanımdan kalkmış ama Chromium/WebView2'de çalışıyor; kaldırılırsa AudioWorklet'e geçilir
    const islemci = ctx.createScriptProcessor(2048, 1, 1);
    const b = new Bolutleyici({ ...VARSAYILAN, esik: a.esik });
    islemci.onaudioprocess = (e) => {
      const i = b.besle(new Float32Array(e.inputBuffer.getChannelData(0)));
      if (i) isle(i);
    };
    kaynak.connect(islemci);
    dugumler = [kaynak, islemci];
    islemci.connect(ctx.destination);
    guncelle({ asama: "dinliyor", ilerleme: null });
  } catch (e) {
    altyaziDurdur();
    guncelle({ asama: "hata", mesaj: String((e as Error)?.message || e).slice(0, 200) });
  }
}

export function altyaziDurdur() {
  akis?.getTracks().forEach((t) => t.stop());
  akis = null;
  void ctx?.close().catch(() => {});
  dugumler.forEach((d) => d.disconnect());
  dugumler = [];
  ctx = null;
  bekleyen = null;
  mesgul = false;
  if (durum.asama !== "kapali") gonderSunucu("", true);
  guncelle({ asama: "kapali", ara: "" });
}

export async function mikrofonlar(): Promise<{ id: string; ad: string }[]> {
  const l = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  return l.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, ad: d.label || `Mikrofon ${i + 1}` }));
}
