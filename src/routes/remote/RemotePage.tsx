/**
 * U11: telefon kumandası (`/remote`). Eşleşmiş cihazın Bearer belirteciyle yalnız eylem kayıt defterini kullanır:
 * izin, onay ve denetim (`via: remote`) sunucuda. Belirteç yoksa ya da sunucu 401 dönerse eşleştirme ekranı.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/api";
import { parseDeck, type DeckConfig } from "../../lib/deck";
import type { ActionInfo } from "../../lib/api/actions";
import RemoteLoginPage from "./RemoteLoginPage";

const TOKEN_KEY = "studio.bot.remoteToken";
const BASILI_TUT_MS = 600;

export type Sekme = "deste" | "sahneler" | "ses" | "kuyruk";
const SEKMELER: { id: Sekme; ad: string; izinler: string[] }[] = [
  { id: "deste", ad: "Deste", izinler: ["actions.read"] },
  { id: "sahneler", ad: "Sahneler", izinler: ["scene.switch"] },
  // Giriş listesi kumanda ucundan gelir (scene.switch); susturma audio.control ister
  { id: "ses", ad: "Ses", izinler: ["scene.switch", "audio.control"] },
  { id: "kuyruk", ad: "Kuyruk", izinler: ["alerts.control"] },
];

/** İzni olmayan sekme hiç görünmez; "*" (yönetici) hepsini açar */
export function kumandaSekmeleri(izinler: string[]): Sekme[] {
  const var_ = (p: string) => izinler.includes("*") || izinler.includes(p);
  return SEKMELER.filter((s) => s.izinler.every(var_)).map((s) => s.id);
}

type Kumanda = { scenes: string[]; currentScene: string | null; streaming: boolean; inputs: { name: string; muted: boolean }[] };

class Yetkisiz extends Error {}

function cihazIzinleri(): string[] {
  try {
    const p = JSON.parse(localStorage.getItem("studio.bot.remoteUser") || "{}").permissions;
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  const r = await fetch(`${API_BASE}${yol}`, {
    method: govde === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  if (r.status === 401) throw new Yetkisiz();
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return (t ? JSON.parse(t) : {}) as T;
}

const RENK: Record<string, string> = {
  slate: "bg-slate-700",
  sky: "bg-sky-700",
  emerald: "bg-emerald-700",
  amber: "bg-amber-700",
  rose: "bg-rose-700",
  violet: "bg-violet-700",
};

/** Onay isteyen eylem 600 ms basılı tutulunca çalışır (yanlışlıkla yayın bitirme, temizleme olmasın) */
function Dugme({ etiket, renk, onay, aktif, onCalistir }: { etiket: string; renk?: string; onay?: boolean; aktif?: boolean; onCalistir: () => void }) {
  const zaman = useRef<number | null>(null);
  const [doluyor, setDoluyor] = useState(false);
  const birak = () => {
    if (zaman.current) window.clearTimeout(zaman.current);
    zaman.current = null;
    setDoluyor(false);
  };
  return (
    <button
      type="button"
      className={`relative min-h-12 overflow-hidden rounded-xl px-2 py-3 text-sm font-semibold text-white ${renk || "bg-white/10"} ${aktif ? "ring-2 ring-red-400" : ""}`}
      onClick={onay ? undefined : onCalistir}
      onPointerDown={
        onay
          ? () => {
              setDoluyor(true);
              zaman.current = window.setTimeout(() => {
                birak();
                onCalistir();
              }, BASILI_TUT_MS);
            }
          : undefined
      }
      onPointerUp={onay ? birak : undefined}
      onPointerLeave={onay ? birak : undefined}
      onPointerCancel={onay ? birak : undefined}
    >
      {onay && (
        <span
          className="absolute inset-y-0 left-0 bg-white/25"
          style={{ width: doluyor ? "100%" : "0%", transition: doluyor ? `width ${BASILI_TUT_MS}ms linear` : "none" }}
        />
      )}
      <span className="relative">{etiket}</span>
      {onay && <span className="relative block text-[10px] font-normal opacity-70">basılı tut</span>}
    </button>
  );
}

function Kumanda() {
  const sekmeler = kumandaSekmeleri(cihazIzinleri());
  const [sekme, setSekme] = useState<Sekme | undefined>(sekmeler[0]);
  const [kumanda, setKumanda] = useState<Kumanda | null>(null);
  const [deste, setDeste] = useState<DeckConfig | null>(null);
  const [eylemler, setEylemler] = useState<ActionInfo[]>([]);
  const [bagli, setBagli] = useState(true);
  const [mesaj, setMesaj] = useState("");
  const [cikis, setCikis] = useState(false);
  const [obsHata, setObsHata] = useState("");

  const yetkiHatasi = (e: unknown) => {
    if (e instanceof Yetkisiz) {
      localStorage.removeItem(TOKEN_KEY);
      setCikis(true);
      return true;
    }
    return false;
  };

  const yenile = useCallback(async () => {
    const obs = sekmeler.includes("sahneler") || sekmeler.includes("ses");
    const sonuc = await Promise.allSettled([
      obs ? istek<Kumanda>("/api/obs/kumanda").then(setKumanda) : null,
      sekmeler.includes("deste") ? istek<{ deck: unknown }>("/api/actions/deste").then((r) => setDeste(parseDeck(r.deck))) : null,
      // Onaylı eylemleri (basılı tut) bilmek için; yetki yoksa liste boş kalır
      istek<{ actions: ActionInfo[] }>("/api/actions").then((r) => setEylemler(r.actions)),
    ]);
    const hatalar = sonuc.flatMap((x) => (x.status === "rejected" ? [x.reason] : []));
    if (hatalar.some(yetkiHatasi)) return;
    // Yalnız ağ hatası bağlantı kopması sayılır; OBS kapalıyken (409) Studio yine bağlıdır
    setBagli(!hatalar.some((e) => e instanceof TypeError));
    const obsSonuc = sonuc[0];
    if (obsSonuc.status === "rejected") setKumanda(null);
    setObsHata(obsSonuc.status === "rejected" && !(obsSonuc.reason instanceof TypeError) ? String((obsSonuc.reason as Error).message || "OBS okunamadı") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sekmeler.join(",")]);

  useEffect(() => {
    void yenile();
    const t = window.setInterval(() => void yenile(), 3000);
    // Telefon uykudan dönünce bekletmeden tazele
    const gorunur = () => document.visibilityState === "visible" && void yenile();
    document.addEventListener("visibilitychange", gorunur);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", gorunur);
    };
  }, [yenile]);

  const calistir = async (id: string, params: Record<string, string> = {}) => {
    const spec = eylemler.find((a) => a.id === id);
    try {
      // Basılı tutma onaydır; listede olmayan onaylı eylemi sunucu 428 ile geri çevirir
      await istek("/api/actions/run", { id, params, confirm: onayli(id) });
      setMesaj(`${spec?.label || id}: tamam`);
      void yenile();
    } catch (e) {
      if (!yetkiHatasi(e)) setMesaj(String((e as Error).message || e).slice(0, 160));
    }
  };
  const onayli = (id: string) => !!eylemler.find((a) => a.id === id)?.confirm || id === "alert.clear";

  if (cikis) return <RemoteLoginPage />;

  const butonlar = deste?.pages.flatMap((p) => p.buttons) ?? [];
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0b0f14] text-white">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-sm">
        {kumanda?.streaming ? <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold">CANLI</span> : <span className="text-xs text-white/50">Yayında değil</span>}
        <span className="flex-1 truncate text-xs text-white/60">{obsHata || kumanda?.currentScene || ""}</span>
        <span className={`h-2.5 w-2.5 rounded-full ${bagli ? "bg-emerald-400" : "bg-amber-400"}`} aria-label={bagli ? "Bağlı" : "Bağlantı yok"} />
      </header>

      <main className={`flex-1 overflow-y-auto p-3 ${bagli ? "" : "opacity-40"}`}>
        {!sekme && <p className="text-sm text-white/60">Bu cihazın kumanda izni yok. Bilgisayardaki Cihazlar sayfasından izin verin.</p>}
        {/* Dikeyde 2–3, yatayda 5 sütun */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 landscape:grid-cols-5">
          {sekme === "deste" &&
            butonlar.map((b) => (
              <Dugme key={b.id} etiket={b.label} renk={RENK[b.color]} onay={onayli(b.actionId)} onCalistir={() => void calistir(b.actionId, b.params)} />
            ))}
          {sekme === "sahneler" &&
            kumanda?.scenes.map((s) => (
              <Dugme key={s} etiket={s} aktif={s === kumanda.currentScene} onCalistir={() => void calistir("scene.switch", { scene: s })} />
            ))}
          {sekme === "ses" &&
            kumanda?.inputs.map((g) => (
              <Dugme key={g.name} etiket={g.muted ? `${g.name} (kapalı)` : g.name} renk={g.muted ? "bg-rose-800" : undefined} onCalistir={() => void calistir("audio.toggle", { input: g.name })} />
            ))}
          {sekme === "kuyruk" &&
            (
              [
                ["alert.pause", "Duraklat"],
                ["alert.resume", "Sürdür"],
                ["alert.skip", "Atla"],
                ["alert.mute", "Sesi kapat"],
                ["alert.unmute", "Sesi aç"],
                ["alert.clear", "Kuyruğu temizle"],
              ] as const
            ).map(([id, ad]) => <Dugme key={id} etiket={ad} onay={onayli(id)} renk={id === "alert.clear" ? "bg-rose-700" : undefined} onCalistir={() => void calistir(id)} />)}
        </div>
        {sekme === "deste" && deste && butonlar.length === 0 && <p className="text-sm text-white/60">Deste boş. Bilgisayardaki Deste panelinden düğme ekleyin.</p>}
        {mesaj && <p className="mt-3 text-xs text-white/70">{mesaj}</p>}
      </main>

      {!bagli && <div className="pointer-events-none fixed inset-x-0 top-12 text-center text-sm font-semibold text-amber-300">Yeniden bağlanıyor…</div>}

      {sekmeler.length > 1 && (
        <nav className="grid border-t border-white/10" style={{ gridTemplateColumns: `repeat(${sekmeler.length}, 1fr)` }}>
          {SEKMELER.filter((s) => sekmeler.includes(s.id)).map((s) => (
            <button key={s.id} type="button" className={`min-h-12 text-sm ${sekme === s.id ? "text-white" : "text-white/50"}`} onClick={() => setSekme(s.id)}>
              {s.ad}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export default function RemotePage() {
  const eslestir = new URLSearchParams(window.location.search).has("eslestir");
  if (eslestir || !localStorage.getItem(TOKEN_KEY)) return <RemoteLoginPage />;
  return <Kumanda />;
}
