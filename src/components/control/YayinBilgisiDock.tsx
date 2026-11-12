/**
 * Yayın bilgisi dock'u (OBS "Stream Information" karşılığı): başlık, kategori ve etiketler — Kick (panel sunucusu
 * üzerinden, `channel:write`), Twitch (Helix, `channel:manage:broadcast`) ve YouTube (Data API, canlı ya da planlanmış
 * yayın). "Kanaldan oku" yalnız okur; "… güncelle" herkese açık kanalı değiştirdiği için ayrıca onay ister. Yazma izni
 * olmayan eski bağlantılarda dock yeniden bağlanmayı söyler.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { kategoriEslestir, sablonKaydet, sablonlariOku, type YayinSablonu } from "../../lib/yayinSablonlari";
import { twitchKanalGuncelle, twitchKanalOku, twitchKanalYazabilir, twitchKategoriAra, twitchWriteStatus } from "../../lib/platformAuth/twitchWrite";
import { youtubeKategoriler, youtubeWriteStatus, youtubeYayinGuncelle, youtubeYayinOku } from "../../lib/platformAuth/youtubeWrite";

function hataMetni(e: unknown): string {
  return String((e as Error)?.message || e).slice(0, 300);
}

type KickDurum = { kick: { bagli: boolean; yazabilir: boolean; kanal: string } };
type Kategori = { id: string; ad: string };
type Platform = "kick" | "twitch" | "youtube";
type Okunan = { baslik: string; kategori: Kategori | null; etiketler: string[]; not?: string; kategoriKapali?: boolean };

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${yol}`, {
    method: govde === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return (t ? JSON.parse(t) : {}) as T;
}

/** "a, b ,, c" → ["a", "b", "c"] (en çok 10; Kick ve Twitch belgeleri) */
export function etiketleriAyir(metin: string): string[] {
  return metin
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);
}

const AD: Record<Platform, string> = { kick: "Kick", twitch: "Twitch", youtube: "YouTube" };
const KONUM: Record<Platform, string> = { kick: "Kick'te", twitch: "Twitch'te", youtube: "YouTube'da" };

export function YayinBilgisiDock({ onToast }: { onToast: (m: string) => void }) {
  const [platform, setPlatform] = useState<Platform>(() => {
    try {
      const p = localStorage.getItem("studio.yayinBilgisi.platform");
      return p === "twitch" || p === "youtube" ? p : "kick";
    } catch {
      return "kick";
    }
  });
  const [kick, setKick] = useState<KickDurum["kick"] | null>(null);
  const [baslik, setBaslik] = useState("");
  const [kategori, setKategori] = useState<Kategori | null>(null);
  const [kategoriKapali, setKategoriKapali] = useState(false);
  const [arama, setArama] = useState("");
  const [sonuclar, setSonuclar] = useState<Kategori[]>([]);
  const [ytKategoriler, setYtKategoriler] = useState<Kategori[]>([]);
  const [etiketler, setEtiketler] = useState("");
  const [not, setNot] = useState<string | null>(null);
  const [onay, setOnay] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const zamanlayici = useRef<number | undefined>(undefined);
  const [sablonlar, setSablonlar] = useState<YayinSablonu[]>([]);
  const [seciliSablon, setSeciliSablon] = useState("");
  const [sablonOnay, setSablonOnay] = useState(false);
  const [sablonSonuc, setSablonSonuc] = useState<string[]>([]);
  const [yeniSablonAdi, setYeniSablonAdi] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings("panel").then(
      (p) => setSablonlar(sablonlariOku((p as Record<string, unknown>).yayinSablonlari)),
      () => {}
    );
  }, []);

  const sablonlariYaz = async (yeni: YayinSablonu[]) => {
    try {
      await patchSettings("panel", { yayinSablonlari: yeni });
      setSablonlar(yeni);
      return true;
    } catch (e) {
      onToast(`Şablon kaydedilemedi: ${hataMetni(e)}`);
      return false;
    }
  };

  const yukle = useCallback(
    () =>
      istek<KickDurum>("/api/yayin-bilgisi").then(
        (d) => setKick(d.kick),
        (e) => onToast(`Yayın bilgisi: ${hataMetni(e)}`)
      ),
    [onToast]
  );
  useEffect(() => void yukle(), [yukle]);

  const tw = twitchWriteStatus();
  const yt = youtubeWriteStatus();
  const bagli = platform === "kick" ? !!kick?.bagli : platform === "twitch" ? tw.connected : yt.connected;
  const yazabilir = platform === "kick" ? !!kick?.yazabilir : platform === "twitch" ? twitchKanalYazabilir() : yt.connected;

  // Şablonun gideceği yerler: bağlı ve yazma izni olan platformlar
  const sablonHedefleri = (Object.keys(AD) as Platform[]).filter((p) =>
    p === "kick" ? !!kick?.bagli && !!kick?.yazabilir : p === "twitch" ? tw.connected && twitchKanalYazabilir() : yt.connected
  );

  const sablonUygula = async () => {
    const s = sablonlar.find((x) => x.ad === seciliSablon);
    setSablonOnay(false);
    if (!s) return;
    setMesgul(true);
    const sonuc: string[] = [];
    const b = s.baslik || undefined;
    const et = s.etiketler.length ? s.etiketler : undefined;
    for (const p of sablonHedefleri) {
      try {
        let kat: Kategori | null = null;
        if (s.kategori) {
          const adaylar =
            p === "kick"
              ? (await istek<{ kategoriler: { id: number; name: string }[] }>(`/api/yayin-bilgisi/kategoriler?q=${encodeURIComponent(s.kategori)}`)).kategoriler.map((k) => ({ id: String(k.id), ad: k.name }))
              : p === "twitch"
                ? await twitchKategoriAra(s.kategori)
                : await youtubeKategoriler();
          kat = kategoriEslestir(s.kategori, adaylar, p !== "youtube");
        }
        let ek = s.kategori && !kat ? " (kategori bulunamadı, değişmedi)" : kat ? ` · ${kat.ad}` : "";
        if (p === "kick") await istek("/api/yayin-bilgisi", { baslik: b, kategori_id: kat ? Number(kat.id) : undefined, etiketler: et, confirm: true });
        else if (p === "twitch") await twitchKanalGuncelle({ baslik: b, kategoriId: kat?.id, etiketler: et });
        else if ((await youtubeYayinGuncelle({ baslik: b, kategoriId: kat?.id, etiketler: et })) === "yayin") ek = " (yalnız başlık)";
        sonuc.push(`${AD[p]}: güncellendi${ek}`);
      } catch (e) {
        sonuc.push(`${AD[p]}: ${hataMetni(e)}`);
      }
    }
    setSablonSonuc(sonuc);
    setMesgul(false);
    onToast(`"${s.ad}" şablonu uygulandı`);
  };

  const sablonuKaydet = async () => {
    const ad = (yeniSablonAdi ?? "").trim().slice(0, 60);
    if (!ad) return;
    const yeni = sablonKaydet(sablonlar, { ad, baslik: baslik.trim().slice(0, 140), kategori: kategori?.ad ?? "", etiketler: etiketleriAyir(etiketler) });
    if (await sablonlariYaz(yeni)) {
      setYeniSablonAdi(null);
      setSeciliSablon(ad);
      onToast(`"${ad}" şablonu kaydedildi`);
    }
  };

  const sablonuSil = async () => {
    if (await sablonlariYaz(sablonlar.filter((x) => x.ad !== seciliSablon))) setSeciliSablon("");
  };

  const platformSec = (p: Platform) => {
    setPlatform(p);
    try {
      localStorage.setItem("studio.yayinBilgisi.platform", p);
    } catch {
      /* yalnız bu oturumda */
    }
    setBaslik("");
    setKategori(null);
    setKategoriKapali(false);
    setEtiketler("");
    setNot(null);
    setOnay(false);
    setArama("");
    setSonuclar([]);
  };

  // YouTube kategorileri sabit bir listedir (bölge: TR); bağlanınca bir kez alınır
  useEffect(() => {
    if (platform !== "youtube" || !yt.connected || ytKategoriler.length) return;
    youtubeKategoriler().then(setYtKategoriler, (e) => onToast(`YouTube kategorileri: ${hataMetni(e)}`));
  }, [platform, yt.connected, ytKategoriler.length, onToast]);

  // Kick/Twitch kategori araması: yazmayı bırakınca (400 ms), en az 2 karakter
  useEffect(() => {
    window.clearTimeout(zamanlayici.current);
    const q = arama.trim();
    if (q.length < 2 || !bagli || platform === "youtube") return setSonuclar([]);
    zamanlayici.current = window.setTimeout(() => {
      const ara =
        platform === "kick"
          ? istek<{ kategoriler: { id: number; name: string }[] }>(`/api/yayin-bilgisi/kategoriler?q=${encodeURIComponent(q)}`).then((r) =>
              r.kategoriler.map((k) => ({ id: String(k.id), ad: k.name }))
            )
          : twitchKategoriAra(q);
      ara.then(setSonuclar, (e) => (setSonuclar([]), onToast(`Kategori araması: ${hataMetni(e)}`)));
    }, 400);
    return () => window.clearTimeout(zamanlayici.current);
  }, [arama, bagli, platform, onToast]);

  const okuyucu = async (): Promise<Okunan> => {
    if (platform === "kick") {
      const r = await istek<{ baslik: string | null; kategori: { id: number | null; ad: string | null } }>("/api/yayin-bilgisi/oku", {});
      return {
        baslik: r.baslik ?? "",
        kategori: r.kategori.id ? { id: String(r.kategori.id), ad: r.kategori.ad ?? String(r.kategori.id) } : null,
        etiketler: [],
      };
    }
    if (platform === "twitch") {
      const r = await twitchKanalOku();
      return { baslik: r.baslik, kategori: r.kategori, etiketler: r.etiketler };
    }
    const r = await youtubeYayinOku();
    const kat = r.video ? (ytKategoriler.find((k) => k.id === r.video!.kategoriId) ?? { id: r.video.kategoriId, ad: r.video.kategoriId }) : null;
    return {
      baslik: r.baslik,
      kategori: kat,
      etiketler: r.video?.etiketler ?? [],
      kategoriKapali: !r.video,
      not: `${r.durum === "active" ? "Canlı" : "Planlanmış"} yayın${r.video ? "" : " — videosu doğrulanamadı: yalnız başlık değiştirilebilir"}`,
    };
  };

  const oku = async () => {
    setMesgul(true);
    try {
      const r = await okuyucu();
      setBaslik(r.baslik);
      setKategori(r.kategori);
      setEtiketler(r.etiketler.join(", "));
      setKategoriKapali(!!r.kategoriKapali);
      setNot(r.not ?? null);
    } catch (e) {
      onToast(`${AD[platform]} okunamadı: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
    }
  };

  const guncelle = async () => {
    setOnay(false);
    setMesgul(true);
    const b = baslik.trim() || undefined;
    const et = etiketler.trim()
      ? etiketler
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : undefined;
    try {
      if (platform === "kick") {
        await istek("/api/yayin-bilgisi", {
          baslik: b,
          kategori_id: kategori ? Number(kategori.id) : undefined,
          etiketler: et ? etiketleriAyir(etiketler) : undefined,
          confirm: true,
        });
      } else if (platform === "twitch") {
        await twitchKanalGuncelle({ baslik: b, kategoriId: kategori?.id, etiketler: et });
      } else {
        const yol = await youtubeYayinGuncelle(kategoriKapali ? { baslik: b } : { baslik: b, kategoriId: kategori?.id, etiketler: et });
        if (yol === "yayin") setNot("Yalnız başlık güncellendi (yayın videosu doğrulanamadı)");
      }
      onToast(`${AD[platform]} yayın bilgisi güncellendi`);
    } catch (e) {
      onToast(`Güncellenemedi: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
    }
  };

  const izinNotu =
    platform === "kick"
      ? "yazma izni (channel:write) yok: güncellemek için Kick'i yeniden bağlayın"
      : "yazma izni (channel:manage:broadcast) yok: güncellemek için Twitch'i yeniden bağlayın";
  const hesap = platform === "kick" ? kick?.kanal : platform === "twitch" ? tw.login : yt.email;
  const degisiklikVar = !!baslik.trim() || !!kategori || !!etiketler.trim();
  const secili = sablonlar.find((x) => x.ad === seciliSablon);
  return (
    <section className="dt-dock h-full" aria-label="Yayın bilgisi">
      <div className="dt-dock-baslik">Yayın Bilgisi</div>
      <div className="dt-dock-govde flex flex-col gap-1.5 overflow-auto p-2 text-[12px]">
        <div className="flex flex-col gap-1 border-b border-white/10 pb-1.5" aria-label="Yayın şablonları" role="group">
          <div className="flex gap-1">
            <select
              className="dt-input min-w-0 flex-1"
              aria-label="Yayın şablonu"
              value={seciliSablon}
              onChange={(e) => (setSeciliSablon(e.target.value), setSablonOnay(false), setSablonSonuc([]))}
            >
              <option value="">{sablonlar.length ? "Şablon seç…" : "Şablon yok"}</option>
              {sablonlar.map((x) => (
                <option key={x.ad} value={x.ad}>
                  {x.ad}
                </option>
              ))}
            </select>
            {secili && (
              <button type="button" className="dt-btn" onClick={() => void sablonuSil()} aria-label={`Şablonu sil: ${secili.ad}`}>
                Sil
              </button>
            )}
          </div>
          {secili && (
            <p className="dt-soluk">
              {secili.baslik || "(başlık yok)"}
              {secili.kategori ? ` · ${secili.kategori}` : ""}
              {secili.etiketler.length ? ` · ${secili.etiketler.join(", ")}` : ""}
            </p>
          )}
          {secili &&
            (sablonOnay ? (
              <div className="flex flex-col gap-1" role="alertdialog" aria-label="Şablon onayı">
                <span>{sablonHedefleri.map((p) => AD[p]).join(", ")} kanal bilgisi herkese açık olarak değişecek. Emin misiniz?</span>
                <div className="flex gap-1">
                  <button type="button" className="dt-btn-primary" onClick={() => void sablonUygula()}>
                    Uygula
                  </button>
                  <button type="button" className="dt-btn" onClick={() => setSablonOnay(false)}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="dt-btn-primary" disabled={mesgul || !sablonHedefleri.length} onClick={() => setSablonOnay(true)}>
                {sablonHedefleri.length ? `Bağlı platformlara uygula (${sablonHedefleri.map((p) => AD[p]).join(", ")})…` : "Yazılabilir bağlı platform yok"}
              </button>
            ))}
          {sablonSonuc.length > 0 && (
            <ul className="dt-soluk" aria-label="Şablon sonucu">
              {sablonSonuc.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Platform">
          {(Object.keys(AD) as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={platform === p}
              className={platform === p ? "dt-btn-primary" : "dt-btn"}
              onClick={() => platformSec(p)}
            >
              {AD[p]}
            </button>
          ))}
        </div>
        {platform === "kick" && !kick ? (
          <p className="dt-soluk">Yükleniyor…</p>
        ) : !bagli ? (
          <p className="dt-soluk">{AD[platform]} bağlı değil — hesabı uygulamanın giriş (platform bağlantısı) ekranından bağlayın.</p>
        ) : (
          <>
            <p className="dt-soluk">
              {AD[platform]}
              {hesap ? ` · ${hesap}` : ""}
              {!yazabilir && ` — ${izinNotu}`}
            </p>
            <button type="button" className="dt-btn" disabled={mesgul} onClick={() => void oku()}>
              Kanaldan oku
            </button>
            {not && <p className="dt-soluk">{not}</p>}
            <label className="dt-etiket" htmlFor="yb-baslik">
              Başlık
            </label>
            <input aria-label="Başlık"
              id="yb-baslik"
              className="dt-input"
              value={baslik}
              maxLength={platform === "twitch" ? 140 : undefined}
              onChange={(e) => setBaslik(e.target.value)}
            />
            <span className="dt-etiket">Kategori{kategori ? `: ${kategori.ad}` : ""}</span>
            {platform === "youtube" ? (
              <select
                className="dt-input"
                aria-label="Kategori"
                disabled={kategoriKapali}
                value={kategori?.id ?? ""}
                onChange={(e) => setKategori(ytKategoriler.find((k) => k.id === e.target.value) ?? null)}
              >
                <option value="">—</option>
                {ytKategoriler.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="dt-input"
                value={arama}
                placeholder="Kategori ara (en az 2 harf)"
                aria-label="Kategori ara"
                onChange={(e) => setArama(e.target.value)}
              />
            )}
            {sonuclar.length > 0 && (
              <ul className="flex max-h-32 flex-col gap-0.5 overflow-auto" aria-label="Kategori sonuçları">
                {sonuclar.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="dt-btn w-full truncate text-left"
                      aria-pressed={kategori?.id === s.id}
                      onClick={() => (setKategori(s), setArama(""), setSonuclar([]))}
                    >
                      {s.ad}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="dt-etiket" htmlFor="yb-etiket">
              Etiketler (virgülle{platform === "youtube" ? "" : ", en çok 10"}
              {platform === "twitch" ? "; yalnız harf/rakam" : ""})
            </label>
            <input id="yb-etiket" className="dt-input" value={etiketler} disabled={kategoriKapali} onChange={(e) => setEtiketler(e.target.value)} />
            {onay ? (
              <div className="flex flex-col gap-1" role="alertdialog" aria-label="Onay">
                <span>{AD[platform]} kanalınızın bilgisi herkese açık olarak değişecek. Emin misiniz?</span>
                <div className="flex gap-1">
                  <button type="button" className="dt-btn-primary" onClick={() => void guncelle()}>
                    Güncelle
                  </button>
                  <button type="button" className="dt-btn" onClick={() => setOnay(false)}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="dt-btn-primary" disabled={mesgul || !yazabilir || !degisiklikVar} onClick={() => setOnay(true)}>
                {KONUM[platform]} güncelle…
              </button>
            )}
            {yeniSablonAdi === null ? (
              <button type="button" className="dt-btn" disabled={!degisiklikVar} onClick={() => setYeniSablonAdi("")}>
                Şablon olarak kaydet…
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  className="dt-input min-w-0 flex-1"
                  aria-label="Şablon adı"
                  placeholder="Şablon adı"
                  maxLength={60}
                  autoFocus
                  value={yeniSablonAdi}
                  onChange={(e) => setYeniSablonAdi(e.target.value)}
                  onKeyDown={(e) => (e.key === "Enter" ? void sablonuKaydet() : e.key === "Escape" ? setYeniSablonAdi(null) : undefined)}
                />
                <button type="button" className="dt-btn-primary" disabled={!yeniSablonAdi.trim()} onClick={() => void sablonuKaydet()}>
                  Kaydet
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
