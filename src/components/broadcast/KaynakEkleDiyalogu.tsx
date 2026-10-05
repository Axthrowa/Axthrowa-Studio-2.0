/**
 * Kaynak ekle (OBS "Create/Select Source"): tür seçildikten sonra açılır. "Yeni oluştur" ya da "Var olanı ekle"
 * (aynı türden bir kaynağı bu sahneye de koyar — ayarlar ortak). Yalnız o türün gerektirdiği alanlar görünür;
 * ayrıntılı ayarlar eklendikten sonra Özellikler'dedir.
 */
import { useEffect, useRef, useState } from "react";
import { KAYNAK_TURLERI, motorApi, type MotorKaynak, type MotorKaynakTuru, type MotorSecenek } from "../../lib/api/motor";

type Props = {
  tur: MotorKaynakTuru;
  /** tur === "eklenti" iken: eklentinin kaydettiği libobs kaynak kimliği ve adı */
  eklentiTuru?: { id: string; ad: string };
  /** Eklenecek sahne */
  sahne: { id: string; ad: string; tuval: string };
  /** Koleksiyondaki kaynaklar ("Var olanı ekle" için aynı türdekiler süzülür) */
  kaynaklar: MotorKaynak[];
  onEklendi: (sonuc: { ad: string; oge?: string; varOlan: boolean }) => void;
  onKapat: () => void;
};

/** Yalnız ses taşıyan türler (görüntüsü yok) */
const YALNIZ_SES: MotorKaynakTuru[] = ["mikrofon", "masaustu", "uygulama_sesi"];

export function KaynakEkleDiyalogu({ tur, eklentiTuru, sahne, kaynaklar, onEklendi, onKapat }: Props) {
  const tanim =
    tur === "eklenti"
      ? { tur, ad: eklentiTuru?.ad ?? "Eklenti kaynağı", deger: "yok" as const, ses: false, yakalar: undefined }
      : KAYNAK_TURLERI.find((k) => k.tur === tur)!;
  const benzerler = kaynaklar.filter((k) => !k.eksik && k.tur === tur && (tur !== "eklenti" || k.obs_turu === eklentiTuru?.id));
  const [kip, setKip] = useState<"yeni" | "var">("yeni");
  const [varOlan, setVarOlan] = useState(benzerler[0]?.id ?? "");
  const [ad, setAd] = useState(() => {
    // OBS gibi benzersiz varsayılan ad: "Renk", "Renk 2"…
    const adlar = new Set(kaynaklar.map((k) => k.ad));
    if (!adlar.has(tanim.ad)) return tanim.ad;
    for (let i = 2; ; i++) if (!adlar.has(`${tanim.ad} ${i}`)) return `${tanim.ad} ${i}`;
  });
  const [deger, setDeger] = useState(tur === "renk" ? "#1e1e2e" : tur === "tarayici" ? "https://" : "");
  const [oyunKipi, setOyunKipi] = useState<"tam" | "pencere">("tam");
  const [secenekler, setSecenekler] = useState<MotorSecenek[] | null>(null);
  const [hata, setHata] = useState("");
  const [yuk, setYuk] = useState(false);
  const ilk = useRef<HTMLInputElement>(null);
  const secimGerekli = tanim.deger === "secim" || (tur === "oyun" && oyunKipi === "pencere");

  useEffect(() => {
    ilk.current?.focus();
    if (!secimGerekli || secenekler) return;
    motorApi
      .secenekler(tur)
      .then((s) => {
        setSecenekler(s);
        if (s[0]) setDeger(String(s[0].deger));
      })
      .catch((e) => setHata(String((e as Error).message || e).slice(0, 200)));
  }, [tur, secimGerekli, secenekler]);

  const dikeyeSes = YALNIZ_SES.includes(tur) && sahne.tuval !== "ana";

  const ekle = async () => {
    setYuk(true);
    setHata("");
    try {
      if (kip === "var") {
        const r = await motorApi.ogeIslem({ eylem: "ekle", sahne: sahne.id, kaynak: varOlan });
        onEklendi({ ad: benzerler.find((k) => k.id === varOlan)?.ad ?? varOlan, oge: r.oge, varOlan: true });
      } else {
        const d = tur === "eklenti" ? (eklentiTuru?.id ?? "") : tur === "oyun" && oyunKipi === "tam" ? "" : deger;
        await motorApi.kaynakEkle(tur, d, ad, [], sahne.id);
        onEklendi({ ad, varOlan: false });
      }
      onKapat();
    } catch (e) {
      setHata(String((e as Error).message || e).slice(0, 300));
    } finally {
      setYuk(false);
    }
  };

  const eksik =
    kip === "var"
      ? !varOlan
      : (tanim.deger === "renk" && !deger) ||
        (tanim.deger === "yazi" && !deger.trim()) ||
        ((tanim.deger === "dosya" || tanim.deger === "klasor") && !deger.trim()) ||
        (tur === "tarayici" && !/^(https?:\/\/.+|[A-Za-z]:\\.+\.html?)$/i.test(deger.trim())) ||
        (secimGerekli && tur !== "ekran" && tur !== "mikrofon" && tur !== "masaustu" && !deger);

  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && onKapat()}>
      <div
        className="dt-modal"
        role="dialog"
        aria-label={`Kaynak ekle: ${tanim.ad}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onKapat();
          if (e.key === "Enter" && !eksik && !yuk && !dikeyeSes && (e.target as HTMLElement).tagName !== "SELECT") void ekle();
        }}
      >
        <div className="dt-dock-baslik">
          Kaynak ekle — {tanim.ad} <span className="dt-soluk font-normal">· {sahne.ad}</span>
        </div>
        {benzerler.length > 0 && (
          <div className="flex gap-4 px-3 pt-2 text-[12px]" role="radiogroup" aria-label="Oluşturma biçimi">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={kip === "yeni"} onChange={() => setKip("yeni")} />
              Yeni oluştur
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={kip === "var"} onChange={() => setKip("var")} />
              Var olanı ekle
            </label>
          </div>
        )}
        {kip === "var" ? (
          <div className="dt-form">
            <label htmlFor="ke-var">Kaynak</label>
            <select id="ke-var" className="dt-input" value={varOlan} onChange={(e) => setVarOlan(e.target.value)}>
              {benzerler.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.ad}
                </option>
              ))}
            </select>
            <span />
            <span className="text-[11px] dt-soluk">Aynı kaynak: ayarları ve filtreleri her sahnede ortaktır.</span>
          </div>
        ) : (
          <div className="dt-form">
            <label htmlFor="ke-ad">Ad</label>
            <input id="ke-ad" ref={ilk} className="dt-input" maxLength={60} value={ad} onChange={(e) => setAd(e.target.value)} />

            {tanim.deger === "renk" && (
              <>
                <label htmlFor="ke-renk">Renk</label>
                <input id="ke-renk" type="color" value={deger} onChange={(e) => setDeger(e.target.value)} />
              </>
            )}
            {tanim.deger === "yazi" && tur !== "tarayici" && (
              <>
                <label htmlFor="ke-yazi">Metin</label>
                <input id="ke-yazi" className="dt-input" maxLength={500} value={deger} onChange={(e) => setDeger(e.target.value)} />
              </>
            )}
            {tur === "tarayici" && (
              <>
                <label htmlFor="ke-url">Adres</label>
                <input
                  id="ke-url"
                  className="dt-input"
                  maxLength={2048}
                  placeholder="https://… ya da C:\…\sayfa.html"
                  value={deger}
                  onChange={(e) => setDeger(e.target.value)}
                />
                <span />
                <span className="text-[11px] dt-soluk">Sayfa 1920×1080 açılır; boyut, CSS ve kare hızı Özellikler'de. Sayfanın sesi mikserde görünür.</span>
              </>
            )}
            {tanim.deger === "dosya" && (
              <>
                <label htmlFor="ke-dosya">Dosya</label>
                <input
                  id="ke-dosya"
                  className="dt-input"
                  placeholder={tur === "gorsel" ? "C:\\…\\görsel.png" : "C:\\…\\video.mp4"}
                  value={deger}
                  onChange={(e) => setDeger(e.target.value)}
                />
              </>
            )}
            {tanim.deger === "klasor" && (
              <>
                <label htmlFor="ke-klasor">Klasör</label>
                <input id="ke-klasor" className="dt-input" placeholder="C:\…\Görseller" value={deger} onChange={(e) => setDeger(e.target.value)} />
                <span />
                <span className="text-[11px] dt-soluk">
                  Klasördeki görseller 5 sn arayla, soldurarak döner; süre, geçiş, döngü ve rastgele sıra Özellikler'de.
                </span>
              </>
            )}
            {tur === "oyun" && (
              <>
                <label htmlFor="ke-oyun-kip">Kip</label>
                <select id="ke-oyun-kip" className="dt-input" value={oyunKipi} onChange={(e) => setOyunKipi(e.target.value as "tam" | "pencere")}>
                  <option value="tam">Tam ekran uygulamayı yakala</option>
                  <option value="pencere">Belirli pencereyi yakala</option>
                </select>
              </>
            )}
            {secimGerekli && (
              <>
                <label htmlFor="ke-secim">
                  {tur === "pencere" || tur === "oyun" ? "Pencere" : tur === "uygulama_sesi" ? "Uygulama" : tur === "ekran" ? "Ekran" : "Aygıt"}
                </label>
                {secenekler === null ? (
                  <span className="dt-soluk">{hata ? "—" : "Liste alınıyor…"}</span>
                ) : secenekler.length === 0 ? (
                  <span className="dt-uyari-metni">Seçenek bulunamadı</span>
                ) : (
                  <select id="ke-secim" className="dt-input" value={deger} onChange={(e) => setDeger(e.target.value)}>
                    {secenekler.map((s) => (
                      <option key={String(s.deger)} value={String(s.deger)}>
                        {s.ad || String(s.deger)}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        )}
        {kip === "yeni" && tanim.yakalar && <p className="px-3 pb-2 text-[12px] dt-soluk">Bu kaynak {tanim.yakalar} yakalar.</p>}
        {kip === "yeni" && tur === "uygulama_sesi" && (
          <p className="px-3 pb-2 text-[12px] dt-soluk">
            Yalnız seçilen uygulamanın sesi alınır. Masaüstü sesi de açıksa bu uygulama iki kez duyulabilir; mikser uyarır.
          </p>
        )}
        {kip === "yeni" && tur === "eklenti" && (
          <p className="px-3 pb-2 text-[12px] dt-soluk">Üçüncü taraf eklenti kaynağı. Ayarlarını ekledikten sonra Özellikler'den yapabilirsiniz.</p>
        )}
        {dikeyeSes && (
          <p className="px-3 pb-2 text-[12px] dt-uyari-metni">Ses kaynağı yalnız ana (yatay) tuvalin karışımına girer. Ana tuvaldeki bir sahneye ekleyin.</p>
        )}
        {hata && <p className="px-3 pb-2 text-[12px] dt-hata-metni">{hata}</p>}
        <div className="flex justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={eksik || yuk || dikeyeSes} onClick={() => void ekle()}>
            {yuk ? "Ekleniyor…" : "Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
