/**
 * Eklenti Yöneticisi — kurulu OBS eklentileri, uyumluluk, konumlar, karantina, sürümler ve geliştirici ayrıntısı.
 * Yayın çalışma alanından, menü çubuğundan (Eklentiler) ve ayarlar penceresinden açılır.
 *
 * Dürüstlük kuralları: "muhtemelen uyumlu" ile "uyumlu" ayrı gösterilir; imzasız dosya "İmzasız" yazar; etkinleştirme
 * "sonraki motor başlatmada" geçerlidir (sahte anında boşaltma yok); sınama eklenti kodunu çalıştırır ve önce onay ister.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  acikOnayGerekli,
  boyutMetni,
  DURUM_BILGISI,
  durumSayilari,
  eklentiApi,
  etkinlestirilebilir,
  KONUM_ADI,
  kodMetni,
  type Aday,
  type Eklenti,
  type EklentiDurumu,
  type EklentiListesi,
  type PaketIncelemesi,
  type TaramaSonucu,
} from "../../lib/api/eklentiler";
import { useBaglamMenusu, type MenuOgesi } from "../ui/BaglamMenusu";

export type EklentiSekmesi = "kurulu" | "uyumluluk" | "konumlar" | "karantina" | "surumler" | "gelistirici";

type Props = {
  onKapat: () => void;
  onToast: (m: string) => void;
  baslangic?: EklentiSekmesi;
  /** Açılışta doğrudan "Paket kur" iletişim kutusu */
  paketKur?: boolean;
};

const SEKMELER: { id: EklentiSekmesi; ad: string }[] = [
  { id: "kurulu", ad: "Kurulu" },
  { id: "uyumluluk", ad: "Uyumluluk" },
  { id: "konumlar", ad: "Konumlar" },
  { id: "karantina", ad: "Karantina" },
  { id: "surumler", ad: "Sürümler" },
  { id: "gelistirici", ad: "Geliştirici" },
];

function hata(e: unknown): string {
  return String((e as Error)?.message || e).slice(0, 300);
}

function Durum({ d }: { d: EklentiDurumu }) {
  const b = DURUM_BILGISI[d];
  return (
    <span className="dt-durum" data-ton={b.ton} title={b.aciklama}>
      {b.etiket}
    </span>
  );
}

function tarih(sn: number | undefined | null): string {
  if (!sn) return "—";
  return new Date(sn * 1000).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

type Onay = { baslik: string; metin: string; eylem: string; tehlikeli?: boolean; yap: () => Promise<unknown> };

export function EklentiYoneticisi({ onKapat, onToast, baslangic = "kurulu", paketKur = false }: Props) {
  const [liste, setListe] = useState<EklentiListesi | null>(null);
  const [sekme, setSekme] = useState<EklentiSekmesi>(baslangic);
  const [secili, setSecili] = useState<string | null>(null);
  const [ara, setAra] = useState("");
  const [onay, setOnay] = useState<Onay | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [paket, setPaket] = useState(paketKur);
  const [ice, setIce] = useState(false);
  const [gunluk, setGunluk] = useState<string[] | null>(null);
  const menu = useBaglamMenusu();

  const yenile = useCallback(async () => {
    try {
      setListe(await eklentiApi.liste());
    } catch (e) {
      onToast(`Eklenti listesi alınamadı: ${hata(e)}`);
    }
  }, [onToast]);

  useEffect(() => {
    void yenile();
  }, [yenile]);

  const yap = async (etiket: string, f: () => Promise<unknown>, basari?: (r: unknown) => string | null) => {
    setMesgul(etiket);
    try {
      const r = await f();
      const m = basari?.(r);
      if (m) onToast(m);
    } catch (e) {
      onToast(`${etiket}: ${hata(e)}`);
    } finally {
      setMesgul(null);
      void yenile();
    }
  };

  const eklentiler = liste?.eklentiler ?? [];
  const sayilar = useMemo(() => durumSayilari(eklentiler), [eklentiler]);
  const suzulmus = useMemo(() => {
    const q = ara.trim().toLowerCase();
    return eklentiler.filter((e) => !q || e.ad.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || (e.satici ?? "").toLowerCase().includes(q));
  }, [eklentiler, ara]);
  const sec = eklentiler.find((e) => e.id === secili) ?? null;

  useEffect(() => {
    setGunluk(null);
  }, [secili]);

  // ── Eylemler ──
  const sinaOnay = (e: Eklenti) =>
    setOnay({
      baslik: `Sına: ${e.ad}`,
      metin:
        "Eklentinin kodu ayrı bir süreçte libobs'a yüklenecek. Bu bir sanal alan değildir: eklenti sizin kullanıcı yetkilerinizle çalışır. Yalnız güvendiğiniz eklentileri sınayın. Süreç çökerse yalnız o süreç kapanır.",
      eylem: "Sına",
      yap: () =>
        eklentiApi.sina(e.id).then((r) => {
          onToast(`${e.ad}: ${DURUM_BILGISI[r.eklenti.arayuz].etiket}${r.yoklama.turler.length ? ` · ${r.yoklama.turler.length} tür` : ""}`);
        }),
    });

  const etkinDegistir = (e: Eklenti, etkin: boolean) => {
    if (etkin) {
      const k = etkinlestirilebilir(e);
      if (!k.olur) {
        onToast(k.neden ?? "Etkinleştirilemez");
        return;
      }
      if (acikOnayGerekli(e)) {
        setOnay({
          baslik: `Etkinleştir: ${e.ad}`,
          metin: `${e.nedenler.join(" ")} Yine de motora yüklensin mi? Sorun çıkarsa motor açılışta çökme istemi gösterir ve eklentiyi devre dışı bırakabilirsiniz.`,
          eylem: "Yine de etkinleştir",
          yap: () => eklentiApi.etkin(e.id, true, true),
        });
        return;
      }
    }
    void yap(etkin ? "Etkinleştirilemedi" : "Devre dışı bırakılamadı", () => eklentiApi.etkin(e.id, etkin), (r) => (r as { not: string | null }).not);
  };

  const kaldirOnay = (e: Eklenti) =>
    setOnay({
      baslik: `Kaldır: ${e.ad}`,
      metin:
        e.konum === "yonetilen"
          ? "Eklenti klasörü silinmez, yedek klasörüne taşınır. Kaynaklarınızda bu eklentinin türü varsa ayarları korunur ve yer tutucu olarak görünür."
          : `Bu eklenti ${KONUM_ADI[e.konum]} içinde; dosyasına dokunulmaz, yalnız bu listeden çıkarılır.`,
      eylem: "Kaldır",
      tehlikeli: true,
      yap: () => eklentiApi.kaldir(e.id),
    });

  const satirMenusu = (e: Eklenti): MenuOgesi[] => {
    const k = etkinlestirilebilir(e);
    return [
      e.etkin
        ? { etiket: "Devre dışı bırak", eylem: () => etkinDegistir(e, false) }
        : { etiket: "Etkinleştir", devreDisi: !k.olur, eylem: () => etkinDegistir(e, true) },
      { etiket: "Yalıtılmış süreçte sına…", devreDisi: Boolean(e.motorNotu), eylem: () => sinaOnay(e) },
      "ayirici",
      e.karantina
        ? { etiket: "Karantinadan çıkar", eylem: () => void yap("Karantina", () => eklentiApi.karantina(e.id, "cikar")) }
        : { etiket: "Karantinaya al", devreDisi: Boolean(e.motorNotu), eylem: () => void yap("Karantina", () => eklentiApi.karantina(e.id, "al")) },
      { etiket: "Önceki sürüme dön", devreDisi: !(e.konum === "yonetilen" && e.oncekiSurumler.length), eylem: () => void yap("Geri alınamadı", () => eklentiApi.geriAl(e.id), () => `${e.ad} önceki sürüme döndü`) },
      { etiket: "Dosya yolunu kopyala", eylem: () => void navigator.clipboard?.writeText(e.dll) },
      { etiket: "Günlüğü göster", eylem: () => { setSecili(e.id); setSekme("gelistirici"); } },
      "ayirici",
      { etiket: "Kaldır…", tehlikeli: true, eylem: () => kaldirOnay(e) },
    ];
  };

  const baslikSatiri = liste?.motorCalisiyor
    ? liste.guvenliKip
      ? "Motor güvenli kipte çalışıyor: üçüncü taraf eklentiler yüklenmedi."
      : "Motor çalışıyor: etkinleştirme ve kaldırma sonraki motor başlatmada geçerli olur."
    : "Motor kapalı: etkin eklentiler motor başlatıldığında yüklenir.";

  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && onKapat()}>
      <div
        className="dt-modal dt-modal-genis"
        role="dialog"
        aria-label="Eklentiler"
        onKeyDown={(e) => e.key === "Escape" && !onay && !paket && !ice && onKapat()}
        style={{ color: "var(--dt-text)", fontSize: 13 }}
      >
        <div className="dt-dock-baslik">
          <span>Eklentiler</span>
          <span className="dt-bosluk" />
          <span className="dt-soluk text-[11px]">OBS {liste?.obsSurumu ?? "?"} · libobs uyumluluk katmanı</span>
        </div>
        <div className="dt-arac-cubugu gap-2 px-2">
          <button type="button" className="dt-btn-primary" onClick={() => setPaket(true)}>
            Paket kur…
          </button>
          <button type="button" className="dt-btn" onClick={() => setIce(true)}>
            OBS'ten içe aktar…
          </button>
          <button type="button" className="dt-btn" disabled={mesgul !== null} onClick={() => void yenile()}>
            Yenile
          </button>
          <span className="dt-bosluk" />
          <input className="dt-input w-56" placeholder="Ad, modül ya da yayıncı ara" aria-label="Eklenti ara" value={ara} onChange={(e) => setAra(e.target.value)} />
        </div>
        <p className="px-3 py-1 text-[12px] dt-soluk" aria-live="polite">
          {mesgul ? `${mesgul}…` : baslikSatiri}
        </p>
        <div className="dt-sekmeler" role="tablist">
          {SEKMELER.map((s) => (
            <button key={s.id} type="button" role="tab" className="dt-sekme" aria-selected={sekme === s.id} onClick={() => setSekme(s.id)}>
              {s.ad}
              {s.id === "karantina" && sayilar.QUARANTINED + sayilar.BLOCKED > 0 ? ` (${sayilar.QUARANTINED + sayilar.BLOCKED})` : ""}
              {s.id === "kurulu" ? ` (${eklentiler.length})` : ""}
            </button>
          ))}
        </div>

        {sekme === "kurulu" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="dt-kaydir">
              {eklentiler.length === 0 ? (
                <div className="p-4">
                  <p className="font-semibold">Henüz eklenti yok.</p>
                  <p className="mt-1 dt-soluk text-[12px]">
                    Bir eklentinin zip paketini ya da klasörünü "Paket kur…" ile ekleyin, ya da bilgisayarınızdaki OBS'in eklentilerini "OBS'ten içe aktar…" ile
                    listeye alın. OBS'in klasörleri yalnız okunur; hiçbir dosya kopyalanmaz.
                  </p>
                </div>
              ) : (
                <table className="dt-table" aria-label="Kurulu eklentiler">
                  <thead>
                    <tr>
                      <th style={{ width: 54 }}>Etkin</th>
                      <th>Eklenti</th>
                      <th>Sürüm</th>
                      <th>Konum</th>
                      <th>İmza</th>
                      <th>Durum</th>
                      <th>Türler</th>
                      <th>Son yükleme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suzulmus.map((e) => (
                      <tr
                        key={e.id}
                        aria-selected={e.id === secili}
                        tabIndex={0}
                        onClick={() => setSecili(e.id)}
                        onDoubleClick={() => {
                          setSecili(e.id);
                          setSekme("gelistirici");
                        }}
                        onContextMenu={(ev) => {
                          ev.preventDefault();
                          setSecili(e.id);
                          menu.ac(ev, satirMenusu(e));
                        }}
                        onKeyDown={(ev) => {
                          if (ev.key === "ContextMenu" || (ev.shiftKey && ev.key === "F10")) {
                            ev.preventDefault();
                            const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                            menu.ac({ clientX: r.left + 40, clientY: r.bottom }, satirMenusu(e));
                          } else if (ev.key === " ") {
                            ev.preventDefault();
                            etkinDegistir(e, !e.etkin);
                          }
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${e.ad} etkin`}
                            checked={e.etkin}
                            disabled={mesgul !== null || (!e.etkin && !etkinlestirilebilir(e).olur)}
                            title={etkinlestirilebilir(e).neden}
                            onChange={(ev) => etkinDegistir(e, ev.target.checked)}
                            onClick={(ev) => ev.stopPropagation()}
                          />
                        </td>
                        <td>
                          <div className="font-semibold">{e.ad}</div>
                          <div className="dt-soluk text-[11px]">
                            {e.id}
                            {e.beklemede ? ` · ${e.beklemede}` : e.oturumdaYuklu ? " · şu an yüklü" : ""}
                          </div>
                        </td>
                        <td className="dt-sayi">{e.surum ?? "—"}</td>
                        <td>{KONUM_ADI[e.konum]}</td>
                        <td>{e.imza === "Gecerli" ? e.imzalayan : e.imza === "Imzasiz" ? "İmzasız" : e.imza}</td>
                        <td>
                          <Durum d={e.arayuz} />
                        </td>
                        <td className="dt-sayi">{e.turler.length || "—"}</td>
                        <td className="dt-soluk">{e.sonYukleme ? `${e.sonYukleme.sonuc} · ${tarih(e.sonYukleme.zaman)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {sec && <Ayrinti e={sec} onSina={() => sinaOnay(sec)} onMenu={(ev) => menu.ac(ev, satirMenusu(sec))} />}
          </div>
        )}

        {sekme === "uyumluluk" && (
          <div className="dt-kaydir">
            <table className="dt-table" aria-label="Uyumluluk">
              <thead>
                <tr>
                  <th>Eklenti</th>
                  <th>Durum</th>
                  <th>Neden</th>
                  <th>Gereken libobs</th>
                  <th>Ön yüz / Qt</th>
                  <th>Önerilen adım</th>
                </tr>
              </thead>
              <tbody>
                {suzulmus.map((e) => (
                  <tr key={e.id} aria-selected={e.id === secili} onClick={() => setSecili(e.id)}>
                    <td className="font-semibold">{e.ad}</td>
                    <td>
                      <Durum d={e.arayuz} />
                    </td>
                    <td className="whitespace-normal py-1" style={{ whiteSpace: "normal", maxWidth: 360 }}>
                      {e.motorNotu ?? e.nedenler[0] ?? "—"}
                    </td>
                    <td className="dt-sayi">{e.gerekliLibobs ?? "sınanmadı"}</td>
                    <td>{[e.onYuz && "ön yüz", e.qt && "Qt", e.tarayici && "CEF"].filter(Boolean).join(", ") || "—"}</td>
                    <td className="whitespace-normal py-1" style={{ whiteSpace: "normal", maxWidth: 300 }}>
                      {e.oneri || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="p-3 text-[12px] dt-soluk">
              "Muhtemelen uyumlu", dosya denetimlerinin (x64, OBS modül dışa aktarımları, bağımlılıklar) geçtiği ama eklentinin henüz yüklenmediği
              anlamına gelir; "Uyumlu" için yalıtılmış sınama ya da gerçek bir motor yüklemesi gerekir.
            </p>
          </div>
        )}

        {sekme === "konumlar" && liste && <Konumlar liste={liste} yap={yap} />}

        {sekme === "karantina" && (
          <div className="dt-kaydir">
            {eklentiler.filter((e) => e.arayuz === "QUARANTINED" || e.arayuz === "BLOCKED").length === 0 ? (
              <p className="p-4 dt-soluk">Karantinada ya da engellenmiş eklenti yok.</p>
            ) : (
              <table className="dt-table">
                <thead>
                  <tr>
                    <th>Eklenti</th>
                    <th>Durum</th>
                    <th>Neden</th>
                    <th>Çökmeler</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {eklentiler
                    .filter((e) => e.arayuz === "QUARANTINED" || e.arayuz === "BLOCKED")
                    .map((e) => (
                      <tr key={e.id}>
                        <td className="font-semibold">{e.ad}</td>
                        <td>
                          <Durum d={e.arayuz} />
                        </td>
                        <td style={{ whiteSpace: "normal", maxWidth: 380 }}>{e.karantina ?? e.nedenler[0]}</td>
                        <td className="dt-sayi">
                          {e.cokmeler.length ? `${e.cokmeler.length} · son ${kodMetni(e.cokmeler[e.cokmeler.length - 1].kod)}` : "—"}
                        </td>
                        <td className="text-right">
                          {e.karantina && (
                            <button type="button" className="dt-btn" onClick={() => void yap("Karantina", () => eklentiApi.karantina(e.id, "cikar"))}>
                              Karantinadan çıkar
                            </button>
                          )}{" "}
                          <button type="button" className="dt-btn" onClick={() => sinaOnay(e)}>
                            Yeniden sına…
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {sekme === "surumler" && (
          <div className="dt-kaydir p-3">
            <p className="text-[12px] dt-soluk">
              Güncelleme: eklentinin yeni sürümünün paketini "Paket kur…" ile seçin; kurulu sürüm silinmez, yedeğe taşınır ve buradan geri
              alınabilir. İnternette güncelleme aranmaz, dosya indirilmez.
            </p>
            <table className="dt-table mt-2">
              <thead>
                <tr>
                  <th>Eklenti</th>
                  <th>Kurulu sürüm</th>
                  <th>Önceki sürümler</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {eklentiler
                  .filter((e) => e.konum === "yonetilen")
                  .map((e) => (
                    <tr key={e.id}>
                      <td className="font-semibold">{e.ad}</td>
                      <td className="dt-sayi">{e.surum ?? "—"}</td>
                      <td>{e.oncekiSurumler.length ? e.oncekiSurumler.map((y) => `${y.surum ?? "?"} (${tarih(y.zaman)})`).join(", ") : "—"}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="dt-btn"
                          disabled={!e.oncekiSurumler.length || mesgul !== null}
                          onClick={() => void yap("Geri alınamadı", () => eklentiApi.geriAl(e.id), () => `${e.ad} önceki sürüme döndü`)}
                        >
                          Önceki sürüme dön
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {sekme === "gelistirici" && (
          <div className="dt-kaydir p-3">
            {!sec ? (
              <p className="dt-soluk">Ayrıntı için "Kurulu" sekmesinden bir eklenti seçin.</p>
            ) : (
              <Gelistirici e={sec} gunluk={gunluk} gunlukOku={() => void eklentiApi.gunluk(sec.id).then((r) => setGunluk(r.satirlar)).catch((x) => onToast(hata(x)))} />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">
          <button type="button" className="dt-btn" onClick={onKapat}>
            Kapat
          </button>
        </div>
      </div>

      {paket && (
        <PaketDiyalogu
          onKapat={() => setPaket(false)}
          onKuruldu={(m) => {
            onToast(m);
            setPaket(false);
            void yenile();
          }}
        />
      )}
      {ice && liste && (
        <IceAktarDiyalogu
          liste={liste}
          onKapat={() => setIce(false)}
          onBitti={(m) => {
            onToast(m);
            setIce(false);
            void yenile();
          }}
        />
      )}
      {onay && (
        <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && setOnay(null)}>
          <div className="dt-modal" role="alertdialog" aria-label={onay.baslik} onKeyDown={(e) => e.key === "Escape" && setOnay(null)}>
            <div className="dt-dock-baslik">{onay.baslik}</div>
            <p className="p-3 text-[13px]">{onay.metin}</p>
            <div className="flex justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">
              <button type="button" className="dt-btn" autoFocus onClick={() => setOnay(null)}>
                Vazgeç
              </button>
              <button
                type="button"
                className={onay.tehlikeli ? "dt-btn-danger" : "dt-btn-primary"}
                onClick={() => {
                  const o = onay;
                  setOnay(null);
                  void yap(o.baslik, o.yap);
                }}
              >
                {onay.eylem}
              </button>
            </div>
          </div>
        </div>
      )}
      {menu.menu}
    </div>
  );
}

function Ayrinti({ e, onSina, onMenu }: { e: Eklenti; onSina: () => void; onMenu: (ev: { clientX: number; clientY: number }) => void }) {
  return (
    <div className="dt-ayrinti" style={{ height: 190 }}>
      <div className="flex items-center gap-2 px-3 pt-2">
        <span className="font-semibold">{e.ad}</span>
        <Durum d={e.arayuz} />
        <span className="dt-bosluk" />
        <button type="button" className="dt-btn" disabled={Boolean(e.motorNotu)} onClick={onSina}>
          Sına…
        </button>
        <button type="button" className="dt-btn" onClick={(ev) => onMenu(ev)}>
          Eylemler ▾
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-2 text-[12px]">
        <div>
          {(e.motorNotu ? [e.motorNotu] : e.nedenler).map((n, i) => (
            <p key={i} className={i === 0 ? "" : "dt-soluk"}>
              {n}
            </p>
          ))}
          {e.oneri && <p className="mt-1 dt-soluk">Öneri: {e.oneri}</p>}
        </div>
        <dl className="grid grid-cols-[110px_1fr] gap-y-0.5">
          <dt className="dt-soluk">Yayıncı</dt>
          <dd>{e.satici ?? "bilinmiyor"}</dd>
          <dt className="dt-soluk">İmza</dt>
          <dd>{e.imza === "Gecerli" ? `Geçerli · ${e.imzalayan}` : e.imza === "Imzasiz" ? "İmzasız (yayıncı doğrulanamıyor)" : e.imza}</dd>
          <dt className="dt-soluk">Mimari / boyut</dt>
          <dd>
            {e.mimari} · {boyutMetni(e.boyut)}
          </dd>
          <dt className="dt-soluk">Türler</dt>
          <dd>{e.turler.length ? e.turler.map((t) => `${t.ad || t.id} (${t.tur})`).join(", ") : "sınanmadı"}</dd>
          <dt className="dt-soluk">Eksik</dt>
          <dd>{e.eksikBagimliliklar.length ? e.eksikBagimliliklar.join(", ") : "yok"}</dd>
          <dt className="dt-soluk">OBS'te</dt>
          <dd>{e.obsEtkin === null ? "OBS'in listesinde yok" : e.obsEtkin ? "etkin" : "devre dışı"}</dd>
        </dl>
      </div>
    </div>
  );
}

function Gelistirici({ e, gunluk, gunlukOku }: { e: Eklenti; gunluk: string[] | null; gunlukOku: () => void }) {
  return (
    <div className="space-y-3 text-[12px]">
      <dl className="grid grid-cols-[150px_1fr] gap-y-1">
        <dt className="dt-soluk">Modül</dt>
        <dd className="dt-kod">{e.id}</dd>
        <dt className="dt-soluk">DLL</dt>
        <dd className="dt-kod">{e.dll}</dd>
        <dt className="dt-soluk">Veri klasörü</dt>
        <dd className="dt-kod">{e.veri ?? "—"}</dd>
        <dt className="dt-soluk">SHA-256</dt>
        <dd className="dt-kod">{e.sha256}</dd>
        <dt className="dt-soluk">Diller</dt>
        <dd>{e.diller.join(", ") || "—"}</dd>
        <dt className="dt-soluk">Bağımlılıklar</dt>
        <dd className="dt-kod">
          {e.bagimliliklar.map((b) => (
            <span key={b} className={e.eksikBagimliliklar.includes(b) ? "dt-hata-metni" : ""}>
              {b}{" "}
            </span>
          ))}
        </dd>
        <dt className="dt-soluk">Son sınama</dt>
        <dd>
          {e.yoklama
            ? `${e.yoklama.sonuc} · libobs ${e.yoklama.libobs || "?"} · ${e.yoklama.sureMs} ms${e.yoklama.cikisKodu ? ` · ${kodMetni(e.yoklama.cikisKodu)}` : ""}`
            : "yok"}
        </dd>
        <dt className="dt-soluk">Uygulama sürümü</dt>
        <dd>{e.sonTestSurumu ?? "—"}</dd>
        <dt className="dt-soluk">Çökme geçmişi</dt>
        <dd>{e.cokmeler.length ? e.cokmeler.map((c) => `${c.asama} ${kodMetni(c.kod)} (${tarih(c.zaman)})`).join(" · ") : "yok"}</dd>
      </dl>
      {e.yoklama?.ayrinti && <pre className="dt-kod whitespace-pre-wrap rounded border border-[color:var(--dt-line)] p-2">{e.yoklama.ayrinti}</pre>}
      <div>
        <button type="button" className="dt-btn" onClick={gunlukOku}>
          Motor günlüğündeki satırlar
        </button>
        {gunluk && (
          <pre className="dt-kod mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-[color:var(--dt-line)] p-2">
            {gunluk.length ? gunluk.join("\n") : "Bu eklentiye ait satır yok (son motor oturumu)."}
          </pre>
        )}
      </div>
    </div>
  );
}

function Konumlar({ liste, yap }: { liste: EklentiListesi; yap: (etiket: string, f: () => Promise<unknown>, b?: (r: unknown) => string | null) => Promise<void> }) {
  const [yol, setYol] = useState("");
  return (
    <div className="dt-kaydir p-3 text-[12px]">
      <p className="dt-soluk">
        OBS'in bilinen konumları yalnız "OBS'ten içe aktar" taramasında, izninizle ve salt-okunur taranır. Bu uygulamanın kurduğu eklentiler kendi
        klasöründedir; OBS'in klasörlerine hiçbir şey yazılmaz.
      </p>
      <table className="dt-table mt-2">
        <thead>
          <tr>
            <th>Konum</th>
            <th>Tür</th>
            <th>Durum</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="dt-kod">{liste.yonetilenKlasor}</td>
            <td>Bu uygulama (kurulum hedefi)</td>
            <td>—</td>
            <td />
          </tr>
          {liste.bilinenKonumlar.map((k) => (
            <tr key={k.yol}>
              <td className="dt-kod">{k.yol}</td>
              <td>{KONUM_ADI[k.tur]}</td>
              <td>{k.var ? "var" : "bulunamadı"}</td>
              <td />
            </tr>
          ))}
          {liste.konumlar.map((k) => (
            <tr key={k.yol}>
              <td className="dt-kod">{k.yol}</td>
              <td>Özel klasör</td>
              <td>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={k.etkin} onChange={(e) => void yap("Konum", () => eklentiApi.konum("etkin", k.yol, e.target.checked))} />
                  taramaya dahil
                </label>
              </td>
              <td className="text-right">
                <button type="button" className="dt-btn" onClick={() => void yap("Konum kaldırılamadı", () => eklentiApi.konum("kaldir", k.yol))}>
                  Listeden çıkar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-2">
        <input className="dt-input min-w-0 flex-1" placeholder="Eklenti klasörü (mutlak yol)" aria-label="Eklenecek klasör" value={yol} onChange={(e) => setYol(e.target.value)} />
        {isTauri() && (
          <button
            type="button"
            className="dt-btn"
            onClick={async () => {
              const s = await open({ directory: true, multiple: false });
              if (typeof s === "string") setYol(s);
            }}
          >
            Gözat…
          </button>
        )}
        <button
          type="button"
          className="dt-btn-primary"
          disabled={!yol.trim()}
          onClick={() =>
            void yap("Konum eklenemedi", () => eklentiApi.konum("ekle", yol.trim())).then(() => setYol(""))
          }
        >
          Konum ekle
        </button>
      </div>
      {liste.obsModulDosyasi && (
        <p className="mt-3 dt-soluk">OBS'in kendi eklenti yöneticisinin durum dosyası bulundu; içe aktarmada OBS'teki etkin/devre dışı bilgisi gösterilir.</p>
      )}
    </div>
  );
}

function PaketDiyalogu({ onKapat, onKuruldu }: { onKapat: () => void; onKuruldu: (m: string) => void }) {
  const [yol, setYol] = useState("");
  const [inc, setInc] = useState<PaketIncelemesi | null>(null);
  const [secim, setSecim] = useState<string[]>([]);
  const [etkinlestir, setEtkinlestir] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [hataMetni, setHataMetni] = useState("");

  // Sürükle-bırak: masaüstü penceresinde dosya yolu yalnız Tauri olayıyla gelir
  useEffect(() => {
    if (!isTauri()) return;
    let birak: (() => void) | undefined;
    void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
      getCurrentWebview()
        .onDragDropEvent((ev) => {
          if (ev.payload.type === "drop" && ev.payload.paths[0]) setYol(ev.payload.paths[0]);
        })
        .then((f) => (birak = f))
    );
    return () => birak?.();
  }, []);

  const incele = async () => {
    setMesgul(true);
    setHataMetni("");
    try {
      const r = await eklentiApi.paketIncele(yol.trim());
      setInc(r);
      setSecim(r.adaylar.filter((a) => !a.hata && a.arayuz !== "ARCHITECTURE_MISMATCH" && a.arayuz !== "UNSUPPORTED").map((a) => a.modul ?? a.id ?? ""));
    } catch (e) {
      setHataMetni(hata(e));
    } finally {
      setMesgul(false);
    }
  };

  const vazgec = () => {
    if (inc) void eklentiApi.paketVazgec(inc.kimlik).catch(() => undefined);
    onKapat();
  };

  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && vazgec()}>
      <div className="dt-modal" role="dialog" aria-label="Eklenti paketi kur" style={{ width: 760 }} onKeyDown={(e) => e.key === "Escape" && vazgec()}>
        <div className="dt-dock-baslik">Eklenti paketi kur</div>
        <div className="space-y-2 p-3 text-[12px]">
          <p className="dt-soluk">
            Zip dosyası, eklenti klasörü ya da tek bir .dll seçin (pencereye sürükleyip bırakabilirsiniz). Paket önce incelenir; kurulum programları
            çalıştırılmaz, yalnız eklenti dosyaları bu uygulamanın eklenti klasörüne kopyalanır.
          </p>
          <div className="flex gap-2">
            <input className="dt-input min-w-0 flex-1" aria-label="Paket yolu" placeholder="C:\…\eklenti.zip" value={yol} onChange={(e) => setYol(e.target.value)} />
            {isTauri() && (
              <>
                <button
                  type="button"
                  className="dt-btn"
                  onClick={async () => {
                    const s = await open({ multiple: false, filters: [{ name: "Eklenti paketi", extensions: ["zip", "dll"] }] });
                    if (typeof s === "string") setYol(s);
                  }}
                >
                  Dosya…
                </button>
                <button
                  type="button"
                  className="dt-btn"
                  onClick={async () => {
                    const s = await open({ directory: true, multiple: false });
                    if (typeof s === "string") setYol(s);
                  }}
                >
                  Klasör…
                </button>
              </>
            )}
            <button type="button" className="dt-btn-primary" disabled={!yol.trim() || mesgul} onClick={() => void incele()}>
              {mesgul && !inc ? "İnceleniyor…" : "İncele"}
            </button>
          </div>
          {hataMetni && <p className="dt-hata-metni">{hataMetni}</p>}
          {inc && (
            <>
              <p>
                {inc.dosyaSayisi} dosya · {inc.adaylar.length} OBS eklentisi · {inc.digerKitaplik} yardımcı kitaplık
              </p>
              {inc.uyarilar.kurulumProgrami && (
                <p className="dt-uyari-metni">
                  {inc.uyarilar.kurulumProgrami} ({inc.kurulumProgramlari.join(", ")})
                </p>
              )}
              {inc.uyarilar.betik && <p className="dt-uyari-metni">{inc.uyarilar.betik}</p>}
              {inc.adaylar.length === 0 ? (
                <p className="dt-hata-metni">Pakette OBS eklentisi bulunamadı (obs_module_load dışa aktaran x64 DLL yok).</p>
              ) : (
                <table className="dt-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Modül</th>
                      <th>Sürüm</th>
                      <th>İmza</th>
                      <th>Durum</th>
                      <th>Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inc.adaylar.map((a: Aday) => {
                      const m = a.modul ?? a.id ?? "";
                      return (
                        <tr key={m}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`${m} kur`}
                              disabled={Boolean(a.hata)}
                              checked={secim.includes(m)}
                              onChange={(e) => setSecim((s) => (e.target.checked ? [...s, m] : s.filter((x) => x !== m)))}
                            />
                          </td>
                          <td className="font-semibold">{a.ad ?? m}</td>
                          <td className="dt-sayi">{a.surum ?? "—"}</td>
                          <td>{a.imza === "Gecerli" ? a.imzalayan : a.imza === "Imzasiz" ? "İmzasız" : (a.imza ?? "—")}</td>
                          <td>{a.arayuz ? <Durum d={a.arayuz} /> : <span className="dt-hata-metni">{a.hata}</span>}</td>
                          <td style={{ whiteSpace: "normal", maxWidth: 260 }}>
                            {a.guncelleme ? `Güncelleme (kurulu: ${a.guncelleme.eskiSurum ?? "?"}); eski sürüm yedeklenir. ` : ""}
                            {a.nedenler?.[0] ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={etkinlestir} onChange={(e) => setEtkinlestir(e.target.checked)} />
                Kurulumdan sonra etkinleştir (sonraki motor başlatmada yüklenir)
              </label>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">
          <button type="button" className="dt-btn" onClick={vazgec}>
            Vazgeç
          </button>
          <button
            type="button"
            className="dt-btn-primary"
            disabled={!inc || secim.length === 0 || mesgul}
            onClick={async () => {
              if (!inc) return;
              setMesgul(true);
              try {
                const r = await eklentiApi.paketKur(inc.kimlik, secim, etkinlestir);
                const hatalar = r.hatalar.map((h) => `${h.modul}: ${h.hata}`).join(" · ");
                onKuruldu(`${r.kurulan.length} eklenti kuruldu${hatalar ? ` · hata: ${hatalar}` : ""}${r.yenidenBaslat ? " · motor yeniden başlatılınca yüklenir" : ""}`);
              } catch (e) {
                setHataMetni(hata(e));
                setMesgul(false);
              }
            }}
          >
            Kur
          </button>
        </div>
      </div>
    </div>
  );
}

function IceAktarDiyalogu({ liste, onKapat, onBitti }: { liste: EklentiListesi; onKapat: () => void; onBitti: (m: string) => void }) {
  const [sonuc, setSonuc] = useState<TaramaSonucu | null>(null);
  const [secim, setSecim] = useState<string[]>([]);
  const [mesgul, setMesgul] = useState(false);
  const [hataMetni, setHataMetni] = useState("");
  const secilebilir = (a: Aday) => !a.hata && a.arayuz !== "ENGINE_MANAGED" && !a.kayitli;

  return (
    <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && onKapat()}>
      <div className="dt-modal dt-modal-genis" role="dialog" aria-label="OBS'ten içe aktar" onKeyDown={(e) => e.key === "Escape" && onKapat()}>
        <div className="dt-dock-baslik">OBS'ten içe aktar</div>
        {!sonuc ? (
          <div className="space-y-2 p-3 text-[12px]">
            <p>Bilgisayarınızdaki OBS eklentileri listeye alınır. Aşağıdaki klasörler yalnız okunur; hiçbir dosya kopyalanmaz, taşınmaz ya da değiştirilmez:</p>
            <ul className="dt-kod list-disc pl-5">
              {liste.bilinenKonumlar.map((k) => (
                <li key={k.yol}>
                  {k.yol} {k.var ? "" : "(bulunamadı)"}
                </li>
              ))}
              {liste.konumlar.filter((k) => k.etkin).map((k) => (
                <li key={k.yol}>{k.yol}</li>
              ))}
            </ul>
            <p className="dt-soluk">
              Her DLL'in mimarisi, OBS modül dışa aktarımları, bağımlılıkları ve imzası okunur; eklenti kodu çalıştırılmaz. İçe aktarılan eklentiler kapalı
              gelir; etkinleştirmeden önce sınayabilirsiniz.
            </p>
            {hataMetni && <p className="dt-hata-metni">{hataMetni}</p>}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[12px]">
              <span>Taranan DLL: {sonuc.sayilar.taranan}</span>
              <span>OBS eklentisi: {sonuc.sayilar.obsEklentisi}</span>
              <span>OBS ile gelen: {sonuc.sayilar.birinciTaraf}</span>
              <span>Üçüncü taraf: {sonuc.sayilar.ucuncuTaraf}</span>
              {Object.entries(sonuc.sayilar.durumlar)
                .filter(([, n]) => n > 0)
                .map(([d, n]) => (
                  <span key={d}>
                    <Durum d={d as EklentiDurumu} />: {n}
                  </span>
                ))}
            </div>
            <div className="dt-kaydir">
              <table className="dt-table">
                <thead>
                  <tr>
                    <th />
                    <th>Eklenti</th>
                    <th>Konum</th>
                    <th>İmza</th>
                    <th>Durum</th>
                    <th>OBS'te</th>
                    <th>Not</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sonuc.adaylar]
                    .sort((a, b) => Number(a.birinciTaraf) - Number(b.birinciTaraf))
                    .map((a) => (
                      <tr key={a.dll ?? a.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${a.id} içe aktar`}
                            disabled={!secilebilir(a)}
                            checked={secim.includes(a.dll ?? "")}
                            onChange={(e) => setSecim((s) => (e.target.checked ? [...s, a.dll ?? ""] : s.filter((x) => x !== a.dll)))}
                          />
                        </td>
                        <td>
                          <div className="font-semibold">{a.ad ?? a.id}</div>
                          <div className="dt-soluk text-[11px]">{a.birinciTaraf ? "OBS ile gelen" : "üçüncü taraf"}</div>
                        </td>
                        <td>{a.konum ? KONUM_ADI[a.konum] : "—"}</td>
                        <td>{a.imza === "Gecerli" ? a.imzalayan : a.imza === "Imzasiz" ? "İmzasız" : (a.imza ?? "—")}</td>
                        <td>{a.arayuz ? <Durum d={a.arayuz} /> : <span className="dt-hata-metni">{a.hata}</span>}</td>
                        <td>{a.obsYoneticisinde ? (a.obsYoneticisinde.etkin ? "etkin" : "devre dışı") : "—"}</td>
                        <td style={{ whiteSpace: "normal", maxWidth: 300 }}>{a.kayitli ? "Zaten listede" : (a.motorNotu ?? a.nedenler?.[0] ?? "")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center justify-end gap-2 border-t border-[color:var(--dt-line)] px-3 py-2">
          {sonuc && (
            <button
              type="button"
              className="dt-btn mr-auto"
              onClick={() => setSecim(sonuc.adaylar.filter((a) => secilebilir(a) && !a.birinciTaraf).map((a) => a.dll ?? ""))}
            >
              Tüm üçüncü taraf eklentileri seç
            </button>
          )}
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          {!sonuc ? (
            <button
              type="button"
              className="dt-btn-primary"
              disabled={mesgul}
              onClick={async () => {
                setMesgul(true);
                setHataMetni("");
                try {
                  const r = await eklentiApi.tara();
                  setSonuc(r);
                  setSecim(r.adaylar.filter((a) => secilebilir(a) && !a.birinciTaraf).map((a) => a.dll ?? ""));
                } catch (e) {
                  setHataMetni(hata(e));
                } finally {
                  setMesgul(false);
                }
              }}
            >
              {mesgul ? "Taranıyor…" : "Tara (salt-okunur)"}
            </button>
          ) : (
            <button
              type="button"
              className="dt-btn-primary"
              disabled={mesgul || secim.length === 0}
              onClick={async () => {
                setMesgul(true);
                try {
                  const r = await eklentiApi.iceAktar(secim);
                  onBitti(`${r.eklenen.length} eklenti listeye alındı (kapalı)${r.hatalar.length ? ` · ${r.hatalar.length} hata` : ""}`);
                } catch (e) {
                  setHataMetni(hata(e));
                  setMesgul(false);
                }
              }}
            >
              Seçilenleri içe aktar ({secim.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
