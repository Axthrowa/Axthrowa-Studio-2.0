/**
 * Projektör (OBS "Projector"): bir tuvalin programını ya da Studio Mode önizlemesini ayrı pencerede, siyah zemin
 * üzerinde en-boy oranı korunarak gösterir. `?tuval=ana|dikey|studyo-ana|studyo-dikey`; sahne/kaynak projektörü
 * `?kaynak=<kimlik>&ad=<ad>` (motor kaynağı kendi tuvalinde işler, pencere kapanınca tuval bırakılır). Kareler `/ws/motor`
 * akışından (en çok 15 kare/sn); bağlantı yoksa PNG yoklaması. Esc ya da çift tık pencereyi kapatır.
 */
import { videoDestekli } from "../lib/canliVideo";
import { CanliVideo } from "../components/broadcast/CanliVideo";
import { EK_TUVAL, tuvalAdi } from "../lib/tuvaller";
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { API_BASE } from "../lib/api";
import { motorApi } from "../lib/api/motor";
import { useMotorCanli } from "../lib/motorCanli";
import { clearVisibleInterval, setVisibleInterval } from "../lib/visibleInterval";

const GECERLI = ["ana", "dikey", "studyo-ana", "studyo-dikey"];

export function projektorTuvali(arama: string): string {
  const t = new URLSearchParams(arama).get("tuval") ?? "ana";
  const taban = t.startsWith("studyo-") ? t.slice(7) : t;
  return GECERLI.includes(t) || EK_TUVAL.test(taban) ? t : "ana";
}

/** `?kaynak=` geçerliyse sahne/kaynak kimliği (motor kimliği kuralı: küçük harf, rakam, tire; en çok 48) */
export function projektorKaynagi(arama: string): string | null {
  const k = new URLSearchParams(arama).get("kaynak");
  return k && /^[a-z0-9-]{1,48}$/.test(k) ? k : null;
}

/** Kaynak projektörü tuvalinin gecikmeli kapatılması (yeniden bağlanırsa iptal) */
const bekleyenKapat = new Map<string, number>();

async function kapat() {
  if (isTauri()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } else {
    window.close();
  }
}

export default function ProjektorSayfasi() {
  const kaynak = projektorKaynagi(window.location.search);
  const kaynakAdi = new URLSearchParams(window.location.search).get("ad") ?? kaynak ?? "";
  const tuval = kaynak ? `kaynak-${kaynak}` : projektorTuvali(window.location.search);
  // Kaynak projektöründe önce motor tuvali açılır (boyutu en-boy oranını verir)
  const [kaynakBoyu, setKaynakBoyu] = useState<[number, number] | null>(null);
  const [kaynakHata, setKaynakHata] = useState<string | null>(null);
  useEffect(() => {
    if (!kaynak) return;
    // Bileşen hemen yeniden bağlanırsa (geliştirme kipinde çift çalışma) bekleyen kapatma iptal edilir: aksi halde
    // "kapat" isteği ikinci "aç"tan sonra işlenip tuvali kapatabilir
    window.clearTimeout(bekleyenKapat.get(kaynak));
    bekleyenKapat.delete(kaynak);
    motorApi.kaynakTuvali(kaynak, "ac").then(
      (r) => setKaynakBoyu([r.genislik, r.yukseklik]),
      (e) => setKaynakHata(String((e as Error).message || e))
    );
    const birak = () =>
      void fetch(`${API_BASE}/api/motor/kaynak-tuvali`, {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: kaynak, eylem: "kapat" }),
      }).catch(() => {});
    window.addEventListener("pagehide", birak);
    return () => {
      window.removeEventListener("pagehide", birak);
      bekleyenKapat.set(
        kaynak,
        window.setTimeout(() => {
          bekleyenKapat.delete(kaynak);
          void motorApi.kaynakTuvali(kaynak, "kapat").catch(() => {});
        }, 1500)
      );
    };
  }, [kaynak]);
  // Ek tuvalin en-boy oranı motor durumundan (taban boyutu koleksiyonda)
  const [ekBoyu, setEkBoyu] = useState<[number, number] | null>(null);
  useEffect(() => {
    const t = tuval.replace(/^studyo-/, "");
    if (!kaynak && EK_TUVAL.test(t))
      motorApi.durum().then(
        (d) => setEkBoyu(d.tuvalBoyutlari?.[t] ?? null),
        () => {}
      );
  }, [tuval, kaynak]);
  const hazir = !kaynak || !!kaynakBoyu;
  const boyu = kaynakBoyu ?? ekBoyu;
  const dikey = boyu ? boyu[1] > boyu[0] : tuval.endsWith("dikey");
  const oran = boyu ? `${boyu[0]} / ${boyu[1]}` : dikey ? "9 / 16" : "16 / 9";
  // Donanım H.264 çözücüsüyle akıcı görüntü; yoksa JPEG/PNG
  const [videoYok, setVideoYok] = useState(() => !videoDestekli());
  const canli = useMotorCanli(hazir && videoYok, { seviye: false, kare: hazir && videoYok ? { tuval, genislik: 1280, fps: 15 } : null });
  const [yedek, setYedek] = useState<string | null>(null);
  const [imlec, setImlec] = useState(true);

  // Canlı akış yoksa yedek: saniyede bir PNG
  useEffect(() => {
    if (canli.bagli || !hazir || !videoYok) return;
    let onceki: string | null = null;
    const cek = () =>
      motorApi
        .onizleme(tuval, 960)
        .then((b) => {
          if (!b) return;
          const u = URL.createObjectURL(b);
          if (onceki) URL.revokeObjectURL(onceki);
          onceki = u;
          setYedek(u);
        })
        .catch(() => {});
    void cek();
    const id = setVisibleInterval(cek, 1000);
    return () => {
      clearVisibleInterval(id);
      if (onceki) URL.revokeObjectURL(onceki);
    };
  }, [canli.bagli, tuval, hazir, videoYok]);

  useEffect(() => {
    document.title = kaynak ? `Projektör — ${kaynakAdi}` : `Projektör — ${tuvalAdi(tuval)}`;
    const tus = (e: KeyboardEvent) => e.key === "Escape" && void kapat();
    window.addEventListener("keydown", tus);
    // İmleç 2 sn hareketsizse gizlenir (tam ekran projektörde)
    let z: number | undefined;
    const hareket = () => {
      setImlec(true);
      window.clearTimeout(z);
      z = window.setTimeout(() => setImlec(false), 2000);
    };
    window.addEventListener("mousemove", hareket);
    hareket();
    return () => {
      window.removeEventListener("keydown", tus);
      window.removeEventListener("mousemove", hareket);
      window.clearTimeout(z);
    };
  }, [tuval, dikey, kaynak, kaynakAdi]);

  const kare = canli.bagli && canli.kare?.tuval === tuval ? canli.kare.url : yedek;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{ cursor: imlec ? "default" : "none" }}
      onDoubleClick={() => void kapat()}
      role="img"
      aria-label={`Projektör: ${tuval}`}
    >
      {hazir && !videoYok ? (
        <div className="relative h-full w-full" style={{ aspectRatio: oran, maxHeight: "100%", maxWidth: "100%" }}>
          <CanliVideo tuval={tuval} className="absolute inset-0 h-full w-full" onDesteksiz={() => setVideoYok(true)} />
        </div>
      ) : kare ? (
        <img src={kare} alt="" className="max-h-full max-w-full" style={{ aspectRatio: oran, objectFit: "contain" }} draggable={false} />
      ) : (
        <span className="text-[13px] text-white/70">{kaynakHata ? `Projektör açılamadı: ${kaynakHata}` : "Motor görüntüsü bekleniyor…"}</span>
      )}
    </div>
  );
}
