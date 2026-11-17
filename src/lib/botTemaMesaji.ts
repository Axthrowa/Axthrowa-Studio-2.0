/**
 * Gömülü AxBoT'a ve Resonance'a giden tema iletisi. Renkler Studio'nun hesaplanmış panel
 * değişkenlerinden, köşe ve başlık ölçüsü ortak tasarım dosyasından (ortak/tasarim.css) okunur.
 */

export type BotTemaRenk = {
  zemin: string;
  yuzey: string;
  yuzey2: string;
  kenar: string;
  vurgu: string;
  metin: string;
  soluk: string;
  kart: string;
  dugme: string;
  baslik: string;
  /** UI-1: düğme belirteçleri (ortak/tasarim.css); boşsa alıcı kendi varsayılanını kullanır */
  vurguMetin: string;
  tehlike: string;
  dugmeY: string;
  dugmeYaricap: string;
  dugmeBuyukY: string;
};

export function yaricapOku(kose: string | null | undefined): { kart: string; dugme: string } {
  if (kose === "keskin") return { kart: "0.25rem", dugme: "0.1875rem" };
  if (kose === "az") return { kart: "0.625rem", dugme: "0.5rem" };
  return { kart: "1rem", dugme: "0.75rem" };
}

export function renkleriOku(oku: (ad: string) => string, kose: string | null | undefined): BotTemaRenk {
  const v = (ad: string) => oku(ad).trim();
  const fg = v("--fg-rgb");
  const y = yaricapOku(kose);
  return {
    zemin: v("--panel-bg"),
    yuzey: v("--panel-card"),
    yuzey2: v("--panel-elevated"),
    kenar: v("--panel-border"),
    // Düğme vurgusu Studio'nun ortak belirteci; eski derlemede panel vurgusu
    vurgu: v("--axt-vurgu") || v("--panel-accent"),
    // Temanın kendi yazı rengi önce: --title-color sabit beyaz, açık temada (Gün Işığı) zeminde kayboluyordu
    metin: fg ? `rgb(${fg})` : v("--title-color"),
    soluk: v("--panel-muted"),
    // Ortak dosya yüklenmemişse (eski derleme, sınama) data-kose eşlemesine düşülür
    kart: v("--axt-yaricap-kart") || y.kart,
    dugme: v("--axt-yaricap-dugme") || y.dugme,
    baslik: v("--axt-yazi-baslik") || "1.25rem",
    vurguMetin: v("--axt-vurgu-metin"),
    tehlike: v("--axt-tehlike"),
    dugmeY: v("--axt-dugme-y"),
    dugmeYaricap: v("--axt-dugme-yaricap"),
    dugmeBuyukY: v("--axt-dugme-buyuk-y"),
  };
}

export function botTemaMesaji(renk: BotTemaRenk) {
  return {
    tur: "studio-tema" as const,
    tema: "studio",
    degiskenler: {
      "--axt-zemin": renk.zemin,
      "--axt-yuzey": renk.yuzey,
      "--axt-yuzey-2": renk.yuzey2,
      "--axt-kenar": renk.kenar,
      "--axt-vurgu": renk.vurgu,
      "--axt-metin": renk.metin,
      "--axt-soluk": renk.soluk,
      "--axt-yaricap-kart": renk.kart,
      "--axt-yaricap-dugme": renk.dugme,
      "--axt-yazi-baslik": renk.baslik,
      "--axt-vurgu-metin": renk.vurguMetin,
      "--axt-tehlike": renk.tehlike,
      "--axt-dugme-y": renk.dugmeY,
      "--axt-dugme-yaricap": renk.dugmeYaricap,
      "--axt-dugme-buyuk-y": renk.dugmeBuyukY,
    },
  };
}
