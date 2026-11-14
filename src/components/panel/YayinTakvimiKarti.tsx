/** Y11: planlı yayınlar; isteğe bağlı Twitch takvimine yazılır, Giriş/Çıkış ekranında "sıradaki yayın" olarak görünür */
import { useEffect, useState } from "react";
import { fetchSettings, patchSettings } from "../../lib/api";
import { takvimAyari, type PlanliYayin, type TakvimAyari } from "../../lib/yayinTakvimi";
import { twitchKategoriAra, twitchTakvimEkle, twitchTakvimSil, twitchTakvimYazabilir } from "../../lib/platformAuth/twitchWrite";
import { Switch } from "../axthrowa/switch";

const ALAN = "w-full rounded-md border border-panel-border bg-[#1c2030] px-2 py-1.5 text-xs text-white";

export function YayinTakvimiKarti() {
  const [ayar, setAyar] = useState<TakvimAyari | null>(null);
  const [yeni, setYeni] = useState({ zaman: "", baslik: "", kategori: "", sureDk: 120, twitch: true });
  const [mesaj, setMesaj] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const twitch = twitchTakvimYazabilir();

  useEffect(() => {
    fetchSettings("panel")
      .then((s) => setAyar(takvimAyari(s.yayinTakvimi)))
      .catch(() => setMesaj("Ayar okunamadı"));
  }, []);

  if (!ayar) return mesaj ? <p className="text-xs text-red-300">{mesaj}</p> : null;
  const kaydet = async (a: TakvimAyari) => {
    setAyar(a);
    await patchSettings("panel", { yayinTakvimi: a } as never);
  };

  const ekle = async () => {
    if (!yeni.zaman) return setMesaj("Tarih ve saat seçin");
    setMesgul(true);
    setMesaj("");
    const y: PlanliYayin = { id: `y${Date.now().toString(36)}`, zaman: new Date(yeni.zaman).toISOString(), baslik: yeni.baslik.trim(), kategori: yeni.kategori.trim(), sureDk: yeni.sureDk };
    try {
      if (twitch && yeni.twitch) {
        const kategoriId = y.kategori ? ((await twitchKategoriAra(y.kategori))[0]?.id ?? null) : null;
        y.twitchId = await twitchTakvimEkle({ zaman: y.zaman, sureDk: y.sureDk, baslik: y.baslik, kategoriId });
      }
      await kaydet(takvimAyari({ ...ayar, liste: [...ayar.liste, y] }));
      setYeni((n) => ({ ...n, zaman: "", baslik: "" }));
    } catch (e) {
      setMesaj(`Eklenemedi: ${String((e as Error).message || e).slice(0, 140)}`);
    } finally {
      setMesgul(false);
    }
  };

  const sil = async (y: PlanliYayin) => {
    setMesaj("");
    try {
      if (y.twitchId) await twitchTakvimSil(y.twitchId);
    } catch (e) {
      setMesaj(`Twitch takviminden silinemedi (Studio'dan siliniyor): ${String((e as Error).message || e).slice(0, 100)}`);
    }
    await kaydet({ ...ayar, liste: ayar.liste.filter((x) => x.id !== y.id) }).catch(() => setMesaj("Kaydedilemedi"));
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Yayın takvimi</h3>
      <p className="text-xs font-medium text-white/75">
        Planlı yayınlar Giriş ve Çıkış ekranında &quot;Sıradaki yayın&quot; olarak görünür; yayından 5 dk önce hatırlatılır.
        {twitch ? " Twitch takvimine de yazılabilir." : " Twitch takvimine yazmak için Twitch'i yeniden bağlayın (takvim izni)."}
      </p>
      <label className="flex items-center gap-2 text-xs text-white">
        <Switch checked={ayar.goster} onCheckedChange={(v: boolean) => void kaydet({ ...ayar, goster: v }).catch(() => setMesaj("Kaydedilemedi"))} aria-label="Ekranlarda göster" />
        Giriş ve Çıkış ekranında göster
      </label>
      <ul className="space-y-1">
        {ayar.liste.map((y) => (
          <li key={y.id} className="flex items-center gap-2 rounded-md border border-panel-border px-2 py-1 text-xs text-white">
            <span className="shrink-0 font-mono">{new Date(y.zaman).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="min-w-0 flex-1 truncate">{y.baslik || "Başlıksız"}{y.kategori ? ` · ${y.kategori}` : ""}</span>
            {y.twitchId && <span className="shrink-0 text-[10px] text-purple-300">Twitch</span>}
            <button type="button" className="shrink-0 rounded px-1.5 text-white/70 hover:bg-white/10 hover:text-white" onClick={() => void sil(y)} aria-label={`Sil: ${y.baslik || y.zaman}`}>
              Sil
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-white/70">
          Tarih ve saat
          <input className={ALAN} type="datetime-local" value={yeni.zaman} onChange={(e) => setYeni({ ...yeni, zaman: e.target.value })} />
        </label>
        <label className="text-[11px] text-white/70">
          Süre (dk)
          <input className={ALAN} type="number" min={30} max={1380} value={yeni.sureDk} onChange={(e) => setYeni({ ...yeni, sureDk: Number(e.target.value) || 120 })} />
        </label>
        <label className="text-[11px] text-white/70">
          Başlık
          <input className={ALAN} maxLength={140} value={yeni.baslik} onChange={(e) => setYeni({ ...yeni, baslik: e.target.value })} />
        </label>
        <label className="text-[11px] text-white/70">
          Kategori
          <input className={ALAN} maxLength={100} value={yeni.kategori} onChange={(e) => setYeni({ ...yeni, kategori: e.target.value })} placeholder="Just Chatting" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        {twitch && (
          <label className="flex items-center gap-2 text-xs text-white">
            <Switch checked={yeni.twitch} onCheckedChange={(v: boolean) => setYeni({ ...yeni, twitch: v })} aria-label="Twitch takvimine yaz" />
            Twitch takvimine yaz
          </label>
        )}
        <button type="button" disabled={mesgul} className="ml-auto rounded-md bg-panel-accent px-3 py-1.5 text-xs font-bold text-[var(--panel-cta-ink)] disabled:opacity-50" onClick={() => void ekle()}>
          {mesgul ? "…" : "Ekle"}
        </button>
      </div>
      {mesaj && <p className="text-xs text-red-300">{mesaj}</p>}
    </div>
  );
}
