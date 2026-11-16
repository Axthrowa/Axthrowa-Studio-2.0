/**
 * Y15 İngilizce arayüz: dil "en" iken panel sayfasındaki Türkçe metinleri `sozluk.en.json`dan çevirir.
 * Bileşenler değişmez; React metni güncelleyince gözcü yeniden çevirir. Yalnız tam eşleşen metin çevrilir,
 * `{0}` içeren kalıplar şablon dizgiler içindir. `data-ceviri="yok"` altındaki içerik (sohbet iletileri, OBS
 * ekran önizlemesi, kullanıcı metinleri) çevrilmez. Eksik metinler: `node scripts/ceviri-cikar.mjs`.
 */
import sozluk from "./sozluk.en.json";
import { en as enTablo, tr as trTablo } from "./messages";

const tam = new Map<string, string>();
const kaliplar: { re: RegExp; en: string }[] = [];
for (const [tr, en] of Object.entries(sozluk as Record<string, string>)) {
  if (!en) continue;
  if (/\{\d+\}/.test(tr)) {
    const kacis = tr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{(\d+)\\\}/g, "(.+?)");
    kaliplar.push({ re: new RegExp(`^${kacis}$`, "s"), en });
  } else tam.set(tr, en);
}
// Tablodaki anahtarlı metinler de: dil iki yerde tutulduğu için (uygulama tercihi ve panel ayarı) Türkçe çizilen kalmasın
for (const [k, v] of Object.entries(trTablo)) {
  const e = enTablo[k as keyof typeof trTablo];
  if (e && !tam.has(v)) tam.set(v, e);
}

/** Metnin İngilizcesi; baştaki/sondaki boşluk korunur. Karşılığı yoksa null. */
export function cevir(metin: string): string | null {
  const t = metin.replace(/\s+/g, " ").trim();
  if (!t) return null;
  let en = tam.get(t);
  if (en === undefined) {
    for (const k of kaliplar) {
      const m = k.re.exec(t);
      if (m) {
        // Yer tutucuya gelen parça da çevrilir ("Eklenemedi: {0}" içindeki sunucu hatası gibi); parça hep daha kısa, döngü olmaz
        en = k.en.replace(/\{(\d+)\}/g, (_, i) => {
          const p = m[Number(i) + 1] ?? "";
          return (p !== t && cevir(p)) || p;
        });
        break;
      }
    }
  }
  if (en === undefined) return null;
  const bas = metin.match(/^\s*/)?.[0] ?? "";
  const son = metin.match(/\s*$/)?.[0] ?? "";
  return bas + en + son;
}

const NITELIKLER = ["title", "aria-label", "placeholder", "alt"];
/** Çevrilen düğüm → [Türkçe asıl, yazılan İngilizce]; dil geri alınınca asıl yerine konur */
const metinler = new Map<Text, [string, string]>();
const nitelikler = new Map<Element, Map<string, [string, string]>>();

function haric(n: Node): boolean {
  const e = n.nodeType === 1 ? (n as Element) : n.parentElement;
  return !e || !!e.closest('[data-ceviri="yok"], script, style, textarea, [contenteditable="true"]');
}

function metinCevir(t: Text) {
  // Akan sohbet gibi silinen düğümler birikmesin
  if (metinler.size > 5000) for (const d of metinler.keys()) if (!d.isConnected) metinler.delete(d);
  const kayit = metinler.get(t);
  if (kayit && t.data === kayit[1]) return; // kendi yazdığımız
  const en = cevir(t.data);
  if (en === null || en === t.data) return void metinler.delete(t);
  metinler.set(t, [t.data, en]);
  t.data = en;
}

function nitelikCevir(e: Element, ad: string) {
  const v = e.getAttribute(ad);
  if (v === null) return;
  const m = nitelikler.get(e) ?? new Map<string, [string, string]>();
  const kayit = m.get(ad);
  if (kayit && v === kayit[1]) return;
  const en = cevir(v);
  if (en === null || en === v) return;
  m.set(ad, [v, en]);
  nitelikler.set(e, m);
  e.setAttribute(ad, en);
}

function agacCevir(kok: Node) {
  if (haric(kok)) return;
  if (kok.nodeType === 3) return metinCevir(kok as Text);
  if (kok.nodeType !== 1) return;
  const w = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) => (n.nodeType === 1 && (n as Element).matches('[data-ceviri="yok"], script, style, textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n: Node | null = kok; n; n = w.nextNode()) {
    if (n.nodeType === 3) metinCevir(n as Text);
    else for (const a of NITELIKLER) nitelikCevir(n as Element, a);
  }
}

let gozcu: MutationObserver | null = null;

export function domCeviriBaslat(kok: HTMLElement = document.body) {
  if (gozcu) return;
  // Büyük harfe çeviren CSS sayfa dilini izler: "tr"de "Viewers" → "VİEWERS" olurdu
  document.documentElement.lang = "en";
  agacCevir(kok);
  gozcu = new MutationObserver((kayitlar) => {
    for (const k of kayitlar) {
      if (k.type === "characterData") {
        if (!haric(k.target)) metinCevir(k.target as Text);
      } else if (k.type === "attributes") {
        if (!haric(k.target)) nitelikCevir(k.target as Element, k.attributeName!);
      } else k.addedNodes.forEach(agacCevir);
    }
  });
  gozcu.observe(kok, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: NITELIKLER });
}

export function domCeviriDurdur() {
  gozcu?.disconnect();
  gozcu = null;
  document.documentElement.lang = "tr";
  for (const [t, [tr, en]] of metinler) if (t.isConnected && t.data === en) t.data = tr;
  for (const [e, m] of nitelikler) for (const [ad, [tr, en]] of m) if (e.isConnected && e.getAttribute(ad) === en) e.setAttribute(ad, tr);
  metinler.clear();
  nitelikler.clear();
}
