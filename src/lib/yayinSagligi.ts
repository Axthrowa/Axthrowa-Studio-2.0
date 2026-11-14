/**
 * Yayın sağlığı uyarıları — panel hangi sekmedeyse (ve pencere arkadayken) çalışır.
 * Karar saf fonksiyonda (`saglikDegerlendir`), zamanlama ve bildirim `yayinSagligiIzle`de.
 */
import type { StreamHealth } from "./obs";

export type SaglikDurumu = {
  /** Önceki örnek (kare farkı ve yayın durmasını görmek için) */
  onceki: StreamHealth | null;
  /** Ağ yoğunluğu eşiğin üstünde başladığı an (null = değil) */
  yogunBas: number | null;
};

export type Uyari = { id: string; seviye: "error" | "warn"; metin: string; ipucu: string } | { id: string; temizle: true };

export const ESIK = {
  /** Son örnekler arasında düşen kare oranı (%) */
  kareDususu: 2,
  /** Ağ yoğunluğu (0-1) ve bu kadar süre sürerse uyar */
  yogunluk: 0.5,
  yogunlukMs: 10_000,
  /** Y4: YouTube 12 saat sınırından 30 dk önce */
  uzunYayinMs: 11.5 * 3_600_000,
};

/** İki örnek arasındaki bit hızı (kbps). Süre OBS'ten gelir: önbellekten dönen örnek hesabı bozmaz. Hesaplanamıyorsa null. */
export function bitHiziKbps(o: StreamHealth | null, h: StreamHealth): number | null {
  if (!o?.active || !h.active) return null;
  const ms = h.durationMs - o.durationMs;
  const bayt = h.bytes - o.bytes;
  return ms > 0 && bayt >= 0 ? Math.round((bayt * 8) / ms) : null;
}

/** Bir örnekten uyarılar ve yeni durum. Aralıklı ölçüm: oranlar iki örnek arasındaki farktan hesaplanır. */
export function saglikDegerlendir(d: SaglikDurumu, h: StreamHealth, simdi: number, bilerek = false): { durum: SaglikDurumu; uyarilar: Uyari[] } {
  const uyarilar: Uyari[] = [];
  const o = d.onceki;
  let yogunBas = d.yogunBas;

  if (h.reconnecting) {
    uyarilar.push({ id: "saglik-baglanti", seviye: "error", metin: "Yayın bağlantısı koptu, OBS yeniden bağlanıyor", ipucu: "İnternet bağlantını ve yayın sunucusunu denetle" });
  } else {
    uyarilar.push({ id: "saglik-baglanti", temizle: true });
  }

  if (h.active && o?.active) {
    const toplam = h.totalFrames - o.totalFrames;
    const dusen = h.skippedFrames - o.skippedFrames;
    const oran = toplam > 0 ? (dusen / toplam) * 100 : 0;
    if (oran >= ESIK.kareDususu) {
      uyarilar.push({ id: "saglik-kare", seviye: "warn", metin: `Kare düşüşü: son ölçümde %${oran.toFixed(1)}`, ipucu: "Bit hızını düşür ya da kodlayıcı ön ayarını hafiflet" });
    } else {
      uyarilar.push({ id: "saglik-kare", temizle: true });
    }
  } else if (!h.active) {
    // Yayın bitti: son ölçümün kare uyarısı ekranda takılı kalmasın
    uyarilar.push({ id: "saglik-kare", temizle: true });
  }

  if (h.active && h.congestion >= ESIK.yogunluk) {
    if (yogunBas === null) yogunBas = simdi;
    if (simdi - yogunBas >= ESIK.yogunlukMs) {
      uyarilar.push({ id: "saglik-ag", seviye: "warn", metin: `Ağ yoğun (%${Math.round(h.congestion * 100)}) — izleyiciler takılma yaşayabilir`, ipucu: "Arka plandaki indirmeleri durdur ya da bit hızını düşür" });
    }
  } else {
    yogunBas = null;
    uyarilar.push({ id: "saglik-ag", temizle: true });
  }

  // Yayın beklenmedik şekilde durdu (yeniden bağlanma değil, çıktı kapandı). Studio'nun kendi durdurması uyarı değil;
  // beklenmedik duruş uyarısı yayın yeniden başlayana dek kalır (oyundan dönünce görülsün).
  if (o?.active && !h.active && !h.reconnecting && !bilerek) {
    uyarilar.push({ id: "saglik-durdu", seviye: "warn", metin: "Yayın durdu", ipucu: "Sen durdurmadıysan OBS'i ve internet bağlantını denetle" });
  }
  if (h.active) uyarilar.push({ id: "saglik-durdu", temizle: true });

  // Y4: YouTube 12 saati aşan yayını arşivlemeyebilir; yarım saat önceden uyar
  if (h.active && h.durationMs >= ESIK.uzunYayinMs) {
    uyarilar.push({ id: "saglik-youtube12", seviye: "warn", metin: "Yayın 11,5 saati geçti: YouTube 12 saati aşan yayını arşivlemeyebilir", ipucu: "VOD'u saklamak istiyorsan yayını bölmeyi ya da yerel kaydı düşün" });
  } else if (!h.active) {
    uyarilar.push({ id: "saglik-youtube12", temizle: true });
  }

  return { durum: { onceki: h, yogunBas }, uyarilar };
}

/** Studio yayını kendisi durdurduğunda (Yayını bitir, bitiş kuralı): bu süre içindeki duruş uyarı sayılmaz */
const BILEREK_MS = 30_000;
let bilerekDurdurma = 0;
export function yayinBilerekDurduruluyor(): void {
  bilerekDurdurma = Date.now();
}

/** Kısa uyarı sesi (oyun tam ekrandayken de duyulsun) */
export function uyariSesi(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {
    /* ses yok */
  }
}

/**
 * Arka planda izler: 3 sn'de bir OBS'ten okur, uyarıları panel bildirimine yazar, yeni uyarıda ses çalar.
 * (Kart yalnız görünürken ölçüyordu; oyun tam ekrandayken kimse uyarılmıyordu.) Durdurmak için dönen işlevi çağır.
 */
let sonAktif: StreamHealth | null = null;

/** U7b: yayın açıkken okunan son kare sayaçları; bir kez alınır (sonraki yayına eskisi taşınmasın) */
export function sonYayinKareleriniAl(): { dusen: number; toplam: number } | null {
  const h = sonAktif;
  sonAktif = null;
  return h && h.totalFrames > 0 ? { dusen: h.skippedFrames, toplam: h.totalFrames } : null;
}

export function yayinSagligiIzle(
  oku: () => Promise<StreamHealth | null>,
  bildir: (u: Uyari) => void,
  sesli: () => boolean = () => true
): () => void {
  let durum: SaglikDurumu = { onceki: null, yogunBas: null };
  const etkin = new Set<string>();
  let iptal = false;
  const tur = async () => {
    try {
      const h = await oku();
      if (iptal || !h) return;
      if (h.active) sonAktif = h;
      const simdi = Date.now();
      const r = saglikDegerlendir(durum, h, simdi, simdi - bilerekDurdurma < BILEREK_MS);
      durum = r.durum;
      let yeni = false;
      for (const u of r.uyarilar) {
        if ("temizle" in u) {
          if (etkin.delete(u.id)) bildir(u);
        } else {
          if (!etkin.has(u.id)) yeni = true;
          etkin.add(u.id);
          bildir(u);
        }
      }
      if (yeni && sesli()) uyariSesi();
    } catch {
      /* OBS geçici olarak yanıt vermedi */
    }
  };
  const t = setInterval(() => void tur(), 5000);
  return () => {
    iptal = true;
    clearInterval(t);
  };
}
