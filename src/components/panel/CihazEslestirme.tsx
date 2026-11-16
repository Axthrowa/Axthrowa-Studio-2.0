import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { API_BASE, patchSettings, okJson } from "../../lib/api";
import { botApi, type EslesmisCihaz } from "../../lib/api/botApi";

/** Cihaza verilebilen izinler (sunucu: `CIHAZ_IZINLERI`); ayar, yayın anahtarı ve kullanıcı yönetimi yok */
const IZINLER: Array<[string, string]> = [
  ["scene.switch", "Sahne değiştir"],
  ["audio.control", "Ses aç/kapa"],
  ["alerts.control", "Uyarıları duraklat"],
  ["music.control", "Müzik"],
  ["broadcast.replay", "Tekrar kaydı"],
  ["broadcast.read", "Yayın durumunu gör"],
  ["broadcast.record", "Kaydı başlat/durdur"],
  ["broadcast.stream", "Yayını başlat/durdur"],
];

/** T8: telefonu tek kullanımlık kodla eşleştir; cihazları listele ve iptal et. */
export default function CihazEslestirme({ onToast }: { onToast: (m: string) => void }) {
  const [izinler, setIzinler] = useState<string[]>(["scene.switch", "audio.control", "broadcast.read"]);
  const [kod, setKod] = useState<{ kod: string; bitis: number; adres: string | null } | null>(null);
  const [qr, setQr] = useState("");
  const [kalan, setKalan] = useState(0);
  const [cihazlar, setCihazlar] = useState<EslesmisCihaz[]>([]);
  const [lan, setLan] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/server`).then(okJson).then((d) => setLan(d.bindLan === true)).catch(() => {});
  }, []);
  /** Yerel ağa açılma açık onayla; dinleme adresi yeniden başlatınca değişir */
  const lanDegistir = async (ac: boolean) => {
    if (ac && !confirm("Studio yerel ağdaki cihazlara açılsın mı? Eşleşmemiş cihazlar hiçbir uca giremez (401), ama aynı ağdaki herkes giriş sayfasını görür. Uygulama yeniden başlatılınca geçerli olur.")) return;
    await patchSettings("panel", { remote: { bindLan: ac } } as never);
    setLan(ac);
    onToast(ac ? "Yerel ağ erişimi açık — Studio'yu yeniden başlatın" : "Yerel ağ erişimi kapalı — Studio'yu yeniden başlatın");
  };

  const yenile = () => void botApi.cihazlar().then((r) => setCihazlar(r.cihazlar)).catch(() => {});
  useEffect(yenile, []);
  useEffect(() => {
    if (!kod) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((kod.bitis - Date.now()) / 1000));
      setKalan(s);
      if (s === 0) {
        setKod(null);
        yenile();
      }
    }, 500);
    // Telefon eşleşince listede hemen görünsün
    const l = setInterval(yenile, 2000);
    return () => {
      clearInterval(t);
      clearInterval(l);
    };
  }, [kod]);

  const baslat = async () => {
    try {
      const r = await botApi.eslestirmeBaslat(izinler);
      setKod({ kod: r.kod, bitis: Date.now() + r.gecerlilikSn * 1000, adres: r.adres ?? null });
      setKalan(r.gecerlilikSn);
    } catch (e) {
      onToast(String((e as Error).message || e));
    }
  };
  // Telefon bilgisayarın yerel ağ adresini açar; Studio yerel ağa kapalıyken adres yoktur, QR da çizilmez
  const yerelden = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const kok = kod?.adres ?? (yerelden ? null : location.origin);
  const baglanti = kod ? `${kok ?? `${location.protocol}//<bilgisayar-adresi>:${location.port}`}/remote?eslestir=${kod.kod}` : "";
  useEffect(() => {
    setQr("");
    if (!kod || !kok) return;
    QRCode.toDataURL(baglanti, { margin: 1, width: 192 }).then(setQr).catch(() => {});
  }, [kod, kok, baglanti]);

  return (
    <div className="studio-card space-y-3">
      <h3 className="font-display text-sm font-semibold text-white">Telefon eşleştir</h3>
      <p className="text-[11px] text-panel-muted">
        Kod tek kullanımlıktır ve 60 sn geçerlidir. Telefon yalnız seçtiğin izinleri alır; ayarlara, OBS şifresine ve yayın anahtarına erişemez.
      </p>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={lan === true} disabled={lan === null} onChange={(e) => void lanDegistir(e.target.checked)} />
        Yerel ağdan erişime izin ver (yeniden başlatınca)
      </label>
      <fieldset className="grid grid-cols-2 gap-1 text-xs">
        <legend className="sr-only">Telefonun izinleri</legend>
        {IZINLER.map(([id, ad]) => (
          <label key={id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={izinler.includes(id)}
              onChange={(e) => setIzinler(e.target.checked ? [...izinler, id] : izinler.filter((x) => x !== id))}
            />
            {ad}
          </label>
        ))}
      </fieldset>
      <button type="button" className="studio-btn-primary" disabled={!izinler.length} onClick={() => void baslat()}>
        Eşleştirme kodu üret
      </button>
      {kod && (
        <div role="status" className="rounded-xl bg-black/30 p-3 text-xs">
          <p>
            Kod: <strong className="font-mono text-base tracking-widest text-white">{kod.kod}</strong> · {kalan} sn
          </p>
          {qr ? (
            <img src={qr} alt={`Telefonla okut: ${baglanti}`} width={192} height={192} className="mt-2 rounded-md bg-white" />
          ) : (
            <p className="mt-1 text-amber-200">QR için önce "Yerel ağdan erişime izin ver"i açıp Studio'yu yeniden başlatın.</p>
          )}
          <p className="mt-1 break-all text-panel-muted">
            Telefonda aç: <code className="text-panel-accent">{baglanti}</code>
          </p>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xs font-semibold">Eşleşmiş cihazlar</p>
          {cihazlar.length > 1 && (
            <button
              type="button"
              className="studio-btn-ghost !px-2 !py-0.5 text-xs"
              onClick={() => {
                if (!confirm(`${cihazlar.length} cihazın hepsi iptal edilsin mi? Yeniden eşleştirmek gerekir.`)) return;
                void Promise.allSettled(cihazlar.map((c) => botApi.cihazSil(c.id))).then((r) => {
                  const basarisiz = r.filter((x) => x.status === "rejected").length;
                  onToast(basarisiz ? `${basarisiz} cihaz iptal edilemedi` : "Tüm cihazlar iptal edildi");
                  yenile();
                });
              }}
            >
              Tümünü iptal et
            </button>
          )}
        </div>
        {cihazlar.length === 0 ? (
          <p className="text-[11px] text-panel-muted">Henüz yok.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {cihazlar.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1 text-xs">
                <span className="flex-1">
                  <strong>{c.ad}</strong>
                  <span className="ml-2 text-panel-muted">
                    {c.sonGorulme ? `son: ${new Date(c.sonGorulme).toLocaleString("tr-TR")}` : "hiç bağlanmadı"} · {c.izinler.join(", ") || "izin yok"}
                  </span>
                </span>
                <button
                  type="button"
                  className="studio-btn-ghost !px-2 !py-0.5"
                  onClick={() =>
                    void botApi
                      .cihazSil(c.id)
                      .then(() => {
                        onToast(`${c.ad} iptal edildi`);
                        yenile();
                      })
                      .catch((e) => onToast(String(e.message || e)))
                  }
                >
                  İptal et
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
