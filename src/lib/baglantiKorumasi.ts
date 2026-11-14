/**
 * Y12 bağlantı koruması: bit hızı eşiğin altına düşerse ya da OBS yeniden bağlanıyorsa seçilen sahneye (Mola) geçer,
 * düzelince önceki sahneye döner; AxBoT otomasyonuna "bit hızı düştü / bağlantı düzeldi / kare düşüşü" bildirir.
 * Karar saf fonksiyonda (`korumaAdimi`), OBS ve bot çağrıları `baglantiKorumasiIzle`de.
 */
import { actionsApi } from "./api/actions";
import { fetchSettings } from "./api";
import { axbotBase } from "./axbot";
import { getObs, getStreamHealth, isObsConnected, type StreamHealth } from "./obs";
import { bitHiziKbps } from "./yayinSagligi";

export type KorumaAyari = { acik: boolean; sahne: string; esikKbps: number; sohbet: string; kareEsigi: number };
export const VARSAYILAN_KORUMA: KorumaAyari = { acik: false, sahne: "", esikKbps: 1500, sohbet: "Bağlantı sorunu var, birazdan döneceğim.", kareEsigi: 5 };

export type KorumaDurumu = { kotuBas: number | null; iyiBas: number | null; korumada: boolean; oncekiSahne: string | null; kareBildirildi: boolean };
export const BOS_DURUM: KorumaDurumu = { kotuBas: null, iyiBas: null, korumada: false, oncekiSahne: null, kareBildirildi: false };

export type Ornek = { aktif: boolean; yenidenBaglaniyor: boolean; kbps: number | null; yogunluk: number; kareOrani: number | null; sahne: string };
export type KorumaAdimi = { tur: "dustu"; sahne: string | null } | { tur: "duzeldi"; sahne: string | null } | { tur: "kare"; oran: number };

/** Kötü durum bu kadar sürünce korumaya geçilir; iyi durum bu kadar sürünce dönülür (dalgalanmada gidip gelmesin) */
export const KOTU_MS = 5_000;
export const IYI_MS = 10_000;

export function korumaAyari(v: unknown): KorumaAyari {
  const a = (v && typeof v === "object" ? v : {}) as Partial<KorumaAyari>;
  const sayi = (n: unknown, d: number, en: number, cok: number) => (Number.isFinite(Number(n)) ? Math.min(cok, Math.max(en, Number(n))) : d);
  return {
    acik: a.acik === true,
    sahne: typeof a.sahne === "string" ? a.sahne.slice(0, 200) : "",
    esikKbps: sayi(a.esikKbps, VARSAYILAN_KORUMA.esikKbps, 100, 100_000),
    sohbet: typeof a.sohbet === "string" ? a.sohbet.slice(0, 200) : VARSAYILAN_KORUMA.sohbet,
    kareEsigi: sayi(a.kareEsigi, VARSAYILAN_KORUMA.kareEsigi, 1, 100),
  };
}

export function korumaAdimi(d: KorumaDurumu, o: Ornek, ayar: KorumaAyari, simdi: number): { durum: KorumaDurumu; adimlar: KorumaAdimi[] } {
  if (!ayar.acik || !o.aktif) return { durum: BOS_DURUM, adimlar: [] };
  const adimlar: KorumaAdimi[] = [];
  const n = { ...d };

  if (o.kareOrani !== null && o.kareOrani >= ayar.kareEsigi) {
    if (!n.kareBildirildi) adimlar.push({ tur: "kare", oran: Math.round(o.kareOrani * 10) / 10 });
    n.kareBildirildi = true;
  } else n.kareBildirildi = false;

  if (!n.korumada) {
    const kotu = o.yenidenBaglaniyor || (o.kbps !== null && o.kbps < ayar.esikKbps);
    n.kotuBas = kotu ? (n.kotuBas ?? simdi) : null;
    if (kotu && simdi - (n.kotuBas ?? simdi) >= KOTU_MS) {
      const gec = !!ayar.sahne && o.sahne !== ayar.sahne;
      adimlar.push({ tur: "dustu", sahne: gec ? ayar.sahne : null });
      Object.assign(n, { korumada: true, kotuBas: null, iyiBas: null, oncekiSahne: gec ? o.sahne : null });
    }
    return { durum: n, adimlar };
  }

  // Korumadayken yayıncı başka sahneye geçtiyse geri dönüşü ona bırak
  if (n.oncekiSahne && o.sahne !== ayar.sahne) return { durum: { ...BOS_DURUM, kareBildirildi: n.kareBildirildi }, adimlar };
  // Mola sahnesi durağan olduğundan VBR'de bit hızı doğal olarak düşer: dönüş ağ yoğunluğuna bakar
  const iyi = !o.yenidenBaglaniyor && o.yogunluk < 0.2;
  n.iyiBas = iyi ? (n.iyiBas ?? simdi) : null;
  if (iyi && simdi - (n.iyiBas ?? simdi) >= IYI_MS) {
    adimlar.push({ tur: "duzeldi", sahne: n.oncekiSahne });
    return { durum: { ...BOS_DURUM, kareBildirildi: n.kareBildirildi }, adimlar };
  }
  return { durum: n, adimlar };
}

async function botaBildir(tur: string, govde: Record<string, unknown> = {}) {
  try {
    await fetch(`${await axbotBase()}/api/otomasyon/olay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tur, ...govde }) });
  } catch {
    /* AxBoT kapalı: sahne koruması yine çalışır */
  }
}

/** 3 sn'de bir ölçer; dönen işlev durdurur. Ayar her turda panel ayarından okunur (kapatılınca hemen durur). */
export function baglantiKorumasiIzle(bildir: (m: string) => void): () => void {
  let durum = BOS_DURUM;
  let onceki: StreamHealth | null = null;
  let iptal = false;
  const tur = async () => {
    try {
      const ayar = korumaAyari((await fetchSettings("panel")).baglantiKorumasi);
      if (!ayar.acik || !isObsConnected()) {
        durum = BOS_DURUM;
        return;
      }
      const [h, c] = await Promise.all([getStreamHealth(), getObs().call("GetCurrentProgramScene") as Promise<{ currentProgramSceneName?: string }>]);
      const toplam = onceki?.active && h.active ? h.totalFrames - onceki.totalFrames : 0;
      const ornek: Ornek = {
        aktif: h.active,
        yenidenBaglaniyor: h.reconnecting,
        kbps: bitHiziKbps(onceki, h),
        yogunluk: h.congestion,
        kareOrani: toplam > 0 ? ((h.skippedFrames - (onceki?.skippedFrames ?? 0)) / toplam) * 100 : null,
        sahne: c.currentProgramSceneName || "",
      };
      onceki = h;
      if (iptal) return;
      const r = korumaAdimi(durum, ornek, ayar, Date.now());
      durum = r.durum;
      for (const a of r.adimlar) {
        if (a.tur === "kare") void botaBildir("kare_dususu", { miktar: a.oran });
        else if (a.tur === "dustu") {
          void botaBildir("bit_hizi_dustu", { sohbet: ayar.sohbet });
          if (a.sahne) await actionsApi.run("scene.switch", { scene: a.sahne }).catch((e) => bildir(`Bağlantı koruması sahneye geçemedi: ${String((e as Error).message || e).slice(0, 120)}`));
          bildir("Bağlantı zayıf: koruma devrede");
        } else {
          void botaBildir("baglanti_duzeldi");
          if (a.sahne) await actionsApi.run("scene.switch", { scene: a.sahne }).catch(() => {});
          bildir("Bağlantı düzeldi");
        }
      }
    } catch {
      /* OBS geçici olarak yanıt vermedi */
    }
  };
  const t = setInterval(() => void tur(), 3000);
  return () => {
    iptal = true;
    clearInterval(t);
  };
}
