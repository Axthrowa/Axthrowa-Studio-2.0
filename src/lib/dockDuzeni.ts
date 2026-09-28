/**
 * Yayın çalışma alanının dock düzeni (OBS varsayılanı gibi alt sıra: Sahneler | Kaynaklar | Ses Mikseri |
 * Geçişler | Denetimler; ek docklar varsayılan kapalı). Görünürlük, oranlar, alt sıra yüksekliği, kilit ve sekme
 * grupları bu görüntüleyicinin tarayıcısında saklanır (yalnız görünüm tercihi).
 *
 * Sekme grubu (OBS'te dock'u başka bir dock'un üstüne bırakmak gibi): `sekme[cocuk] = ev` — çocuk dock, görünür ev
 * dock'unun yuvasında sekme olur. Ev gizlenirse çocuk kendi yuvasına döner. Zincir yoktur (ev başka bir dock'un
 * çocuğu olamaz).
 */

export type DockKimligi =
  | "sahneler"
  | "kaynaklar"
  | "mikser"
  | "gecisler"
  | "denetimler"
  | "hedefler"
  | "istatistik"
  | "sohbet"
  | "etkinlik"
  | "deste";

export const DOCKLAR: { id: DockKimligi; ad: string; varsayilan: boolean; oran: number; kontrolMerkezi?: boolean }[] = [
  { id: "sahneler", ad: "Sahneler", varsayilan: true, oran: 1 },
  { id: "kaynaklar", ad: "Kaynaklar", varsayilan: true, oran: 1.25 },
  { id: "mikser", ad: "Ses Mikseri", varsayilan: true, oran: 1.7 },
  { id: "gecisler", ad: "Sahne Geçişleri", varsayilan: true, oran: 0.8 },
  { id: "denetimler", ad: "Denetimler", varsayilan: true, oran: 0.8 },
  { id: "hedefler", ad: "Hedefler", varsayilan: false, oran: 1.6 },
  { id: "istatistik", ad: "İstatistikler", varsayilan: false, oran: 1 },
  { id: "sohbet", ad: "Çoklu Sohbet", varsayilan: false, oran: 1.4, kontrolMerkezi: true },
  { id: "etkinlik", ad: "Etkinlik Akışı", varsayilan: false, oran: 1.2, kontrolMerkezi: true },
  { id: "deste", ad: "Hızlı Eylemler", varsayilan: false, oran: 1.2, kontrolMerkezi: true },
];

export type DockDuzeni = {
  surum: 1;
  gorunur: DockKimligi[];
  oranlar: Partial<Record<DockKimligi, number>>;
  /** Alt dock sırasının yüksekliği (px) */
  yukseklik: number;
  kilitli: boolean;
  /** Sekme grupları: çocuk → ev dock'u */
  sekme: Partial<Record<DockKimligi, DockKimligi>>;
  /** Ev dock'u → öndeki sekme */
  etkinSekme: Partial<Record<DockKimligi, DockKimligi>>;
};

export const ANAHTAR = "yya.yayin.docklar.v1";
export const EN_AZ_YUKSEKLIK = 160;
export const EN_COK_YUKSEKLIK = 640;

export function varsayilanDuzen(): DockDuzeni {
  return {
    surum: 1,
    gorunur: DOCKLAR.filter((d) => d.varsayilan).map((d) => d.id),
    oranlar: Object.fromEntries(DOCKLAR.map((d) => [d.id, d.oran])),
    yukseklik: 280,
    kilitli: false,
    sekme: {},
    etkinSekme: {},
  };
}

const BILINEN = new Set<string>(DOCKLAR.map((x) => x.id));
const bilinen = (x: unknown): x is DockKimligi => typeof x === "string" && BILINEN.has(x);

/** Sekme eşlemesini doğrular: bilinmeyen/kendine/zincirli kayıtlar düşer */
function sekmeleriTemizle(ham: unknown): Partial<Record<DockKimligi, DockKimligi>> {
  const s: Partial<Record<DockKimligi, DockKimligi>> = {};
  if (!ham || typeof ham !== "object") return s;
  for (const [c, e] of Object.entries(ham as Record<string, unknown>)) {
    if (bilinen(c) && bilinen(e) && c !== e) s[c] = e;
  }
  // Ev başka bir dock'un çocuğuysa (zincir) çocuk bağı kopar
  for (const c of Object.keys(s) as DockKimligi[]) {
    const e = s[c]!;
    if (s[e]) delete s[c];
  }
  return s;
}

/** Kayıtlı düzeni doğrular; bozuksa varsayılan */
export function duzenOku(metin: string | null): DockDuzeni {
  const v = varsayilanDuzen();
  if (!metin) return v;
  try {
    const d = JSON.parse(metin) as Partial<DockDuzeni>;
    const gorunur = Array.isArray(d.gorunur) ? d.gorunur.filter(bilinen) : v.gorunur;
    const oranlar = { ...v.oranlar };
    for (const [k, o] of Object.entries(d.oranlar ?? {})) {
      if (bilinen(k) && typeof o === "number" && Number.isFinite(o) && o > 0.1 && o < 20) oranlar[k] = o;
    }
    const y = typeof d.yukseklik === "number" && Number.isFinite(d.yukseklik) ? d.yukseklik : v.yukseklik;
    const sekme = sekmeleriTemizle(d.sekme);
    const etkinSekme: Partial<Record<DockKimligi, DockKimligi>> = {};
    for (const [e, c] of Object.entries(d.etkinSekme ?? {})) {
      if (bilinen(e) && bilinen(c) && (c === e || sekme[c] === e)) etkinSekme[e] = c;
    }
    return {
      surum: 1,
      gorunur: [...new Set(gorunur)],
      oranlar,
      yukseklik: Math.min(EN_COK_YUKSEKLIK, Math.max(EN_AZ_YUKSEKLIK, y)),
      kilitli: !!d.kilitli,
      sekme,
      etkinSekme,
    };
  } catch {
    return v;
  }
}

/** Çocuk dock görünür bir evin sekmesi mi (öyleyse kendi yuvası yoktur) */
function sekmede(d: DockDuzeni, id: DockKimligi): boolean {
  const ev = d.sekme[id];
  return !!ev && d.gorunur.includes(ev);
}

/** Alt sıradaki yuvalar (DOCKLAR sırasıyla): görünür ve başka bir dock'un sekmesi olmayan docklar */
export function siraliGorunur(d: DockDuzeni): DockKimligi[] {
  return DOCKLAR.map((x) => x.id).filter((id) => d.gorunur.includes(id) && !sekmede(d, id));
}

/** Yuvanın sekmeleri: ev + görünür çocukları (DOCKLAR sırasıyla). Tek elemanlıysa sekme çubuğu gösterilmez. */
export function sekmeGrubu(d: DockDuzeni, ev: DockKimligi): DockKimligi[] {
  return [ev, ...DOCKLAR.map((x) => x.id).filter((id) => id !== ev && d.sekme[id] === ev && d.gorunur.includes(id))];
}

/** Yuvada öndeki sekme */
export function oneCikan(d: DockDuzeni, ev: DockKimligi): DockKimligi {
  const grup = sekmeGrubu(d, ev);
  const e = d.etkinSekme[ev];
  return e && grup.includes(e) ? e : ev;
}

export function dockDegistir(d: DockDuzeni, id: DockKimligi): DockDuzeni {
  const gorunur = d.gorunur.includes(id) ? d.gorunur.filter((x) => x !== id) : [...d.gorunur, id];
  return { ...d, gorunur };
}

/**
 * `cocuk` dock'u `ev` dock'unun yuvasına sekme olarak alır (ikisi de görünür olur). Ev zaten bir sekmeyse onun
 * evine eklenir; çocuğun kendi sekmeleri de yeni eve taşınır (zincir oluşmaz).
 */
export function sekmeyeEkle(d: DockDuzeni, cocuk: DockKimligi, ev: DockKimligi): DockDuzeni {
  const gercekEv = d.sekme[ev] ?? ev;
  if (gercekEv === cocuk) return d;
  const sekme = { ...d.sekme };
  for (const [c, e] of Object.entries(sekme) as [DockKimligi, DockKimligi][]) if (e === cocuk) sekme[c] = gercekEv;
  sekme[cocuk] = gercekEv;
  const etkinSekme = { ...d.etkinSekme, [gercekEv]: cocuk };
  delete etkinSekme[cocuk];
  const gorunur = [...new Set([...d.gorunur, cocuk, gercekEv])];
  return { ...d, sekme, etkinSekme, gorunur };
}

/** Sekmeyi kendi yuvasına ayırır */
export function sekmeyiAyir(d: DockDuzeni, cocuk: DockKimligi): DockDuzeni {
  const ev = d.sekme[cocuk];
  if (!ev) return d;
  const sekme = { ...d.sekme };
  delete sekme[cocuk];
  const etkinSekme = { ...d.etkinSekme };
  if (etkinSekme[ev] === cocuk) delete etkinSekme[ev];
  return { ...d, sekme, etkinSekme };
}

export function sekmeSec(d: DockDuzeni, ev: DockKimligi, id: DockKimligi): DockDuzeni {
  return { ...d, etkinSekme: { ...d.etkinSekme, [ev]: id } };
}

/**
 * İki komşu dock arasındaki ayırıcı `dx` px kaydırılınca oranlar (toplam korunur, her dock en az ~%4).
 * `genislik`: alt sıranın toplam genişliği.
 */
export function ayiriciKaydir(d: DockDuzeni, sol: DockKimligi, sag: DockKimligi, dx: number, genislik: number): DockDuzeni {
  const gor = siraliGorunur(d);
  const toplam = gor.reduce((t, id) => t + (d.oranlar[id] ?? 1), 0);
  const birim = toplam / Math.max(1, genislik);
  const a = d.oranlar[sol] ?? 1;
  const b = d.oranlar[sag] ?? 1;
  const en_az = toplam * 0.04;
  let delta = dx * birim;
  delta = Math.max(-(a - en_az), Math.min(b - en_az, delta));
  return { ...d, oranlar: { ...d.oranlar, [sol]: a + delta, [sag]: b - delta } };
}
