/**
 * Yayın çalışma alanının dock düzeni (OBS varsayılanı gibi alt sıra: Sahneler | Kaynaklar | Ses Mikseri |
 * Geçişler | Denetimler; ek docklar varsayılan kapalı). Görünürlük, oranlar, alt sıra yüksekliği ve kilit bu
 * görüntüleyicinin tarayıcısında saklanır (yalnız görünüm tercihi).
 */

export type DockKimligi = "sahneler" | "kaynaklar" | "mikser" | "gecisler" | "denetimler" | "hedefler" | "istatistik";

export const DOCKLAR: { id: DockKimligi; ad: string; varsayilan: boolean; oran: number }[] = [
  { id: "sahneler", ad: "Sahneler", varsayilan: true, oran: 1 },
  { id: "kaynaklar", ad: "Kaynaklar", varsayilan: true, oran: 1.25 },
  { id: "mikser", ad: "Ses Mikseri", varsayilan: true, oran: 1.7 },
  { id: "gecisler", ad: "Sahne Geçişleri", varsayilan: true, oran: 0.8 },
  { id: "denetimler", ad: "Denetimler", varsayilan: true, oran: 0.8 },
  { id: "hedefler", ad: "Hedefler", varsayilan: false, oran: 1.6 },
  { id: "istatistik", ad: "İstatistikler", varsayilan: false, oran: 1 },
];

export type DockDuzeni = {
  surum: 1;
  gorunur: DockKimligi[];
  oranlar: Partial<Record<DockKimligi, number>>;
  /** Alt dock sırasının yüksekliği (px) */
  yukseklik: number;
  kilitli: boolean;
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
  };
}

/** Kayıtlı düzeni doğrular; bozuksa varsayılan */
export function duzenOku(metin: string | null): DockDuzeni {
  const v = varsayilanDuzen();
  if (!metin) return v;
  try {
    const d = JSON.parse(metin) as Partial<DockDuzeni>;
    const bilinen = new Set(DOCKLAR.map((x) => x.id));
    const gorunur = Array.isArray(d.gorunur) ? d.gorunur.filter((x): x is DockKimligi => bilinen.has(x as DockKimligi)) : v.gorunur;
    const oranlar = { ...v.oranlar };
    for (const [k, o] of Object.entries(d.oranlar ?? {})) {
      if (bilinen.has(k as DockKimligi) && typeof o === "number" && Number.isFinite(o) && o > 0.1 && o < 20) oranlar[k as DockKimligi] = o;
    }
    const y = typeof d.yukseklik === "number" && Number.isFinite(d.yukseklik) ? d.yukseklik : v.yukseklik;
    return { surum: 1, gorunur: [...new Set(gorunur)], oranlar, yukseklik: Math.min(EN_COK_YUKSEKLIK, Math.max(EN_AZ_YUKSEKLIK, y)), kilitli: !!d.kilitli };
  } catch {
    return v;
  }
}

/** Görünür docklar DOCKLAR sırasıyla */
export function siraliGorunur(d: DockDuzeni): DockKimligi[] {
  return DOCKLAR.map((x) => x.id).filter((id) => d.gorunur.includes(id));
}

export function dockDegistir(d: DockDuzeni, id: DockKimligi): DockDuzeni {
  const gorunur = d.gorunur.includes(id) ? d.gorunur.filter((x) => x !== id) : [...d.gorunur, id];
  return { ...d, gorunur };
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
