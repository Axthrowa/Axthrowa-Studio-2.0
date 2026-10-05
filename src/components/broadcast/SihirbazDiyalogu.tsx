/**
 * Otomatik yapılandırma sihirbazı (OBS "Auto-Configuration Wizard" karşılığı, dürüst sürüm): bu bilgisayarın
 * kodlama gücünü mevcut sahneyle yerel olarak ölçer (5 sn geçici kayıt, yayın yok), kullanıcının ölçtüğü yükleme
 * hızından hedef başı bit hızı önerir. Platform sunucusuna bant genişliği sınaması yapılmaz. Öneri ancak
 * "Uygula" ile etkin profile yazılır.
 */
import { useState } from "react";
import { API_BASE } from "../../lib/api";
import { motorApi } from "../../lib/api/motor";
import { hataMetni, Pencere } from "./ortak";

type Sonuc = {
  sonuclar: { tur: string; ad: string; donanim: boolean; kare?: number; atlanan?: number; oran?: number; gecti: boolean; hata?: string }[];
  oneri: { kodlayici: string | null; bit_hizi_ana: number | null; bit_hizi_dikey: number | null };
  sinananBitHizi: number;
  diskDakika: number | null;
  notlar: string[];
};

export function SihirbazDiyalogu({ onToast, onKapat }: { onToast: (m: string) => void; onKapat: () => void }) {
  const [mbps, setMbps] = useState("");
  const [hedef, setHedef] = useState("1");
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const calistir = async () => {
    setCalisiyor(true);
    setSonuc(null);
    try {
      const m = Number(mbps.replace(",", "."));
      const govde: Record<string, number> = { hedef_sayisi: Math.max(1, Math.min(8, Math.round(Number(hedef)) || 1)) };
      if (mbps.trim() && Number.isFinite(m) && m > 0) govde.yukleme_kbps = Math.round(m * 1000);
      const r = await fetch(`${API_BASE}/api/motor/sihirbaz`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
      const t = await r.text();
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      setSonuc(JSON.parse(t) as Sonuc);
    } catch (e) {
      onToast(`Sınama yapılamadı: ${hataMetni(e)}`);
    } finally {
      setCalisiyor(false);
    }
  };

  const uygula = async () => {
    if (!sonuc) return;
    const cikis: Record<string, unknown> = {};
    if (sonuc.oneri.kodlayici) cikis.kodlayici = sonuc.oneri.kodlayici;
    if (sonuc.oneri.bit_hizi_ana) cikis.bit_hizi_ana = sonuc.oneri.bit_hizi_ana;
    if (sonuc.oneri.bit_hizi_dikey) cikis.bit_hizi_dikey = sonuc.oneri.bit_hizi_dikey;
    try {
      await motorApi.profilGuncelle({ cikis });
      onToast("Öneri etkin profile yazıldı");
      onKapat();
    } catch (e) {
      onToast(`Uygulanamadı: ${hataMetni(e)}`);
    }
  };

  return (
    <Pencere
      baslik="Otomatik yapılandırma sihirbazı"
      genislik={640}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Kapat
          </button>
          <button type="button" className="dt-btn" disabled={calisiyor} onClick={() => void calistir()}>
            {calisiyor ? "Sınanıyor (her kodlayıcı ~6 sn)…" : sonuc ? "Yeniden sına" : "Sınamayı başlat"}
          </button>
          <button
            type="button"
            className="dt-btn-primary"
            disabled={!sonuc || (!sonuc.oneri.kodlayici && !sonuc.oneri.bit_hizi_ana)}
            onClick={() => void uygula()}
          >
            Öneriyi uygula
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="sh-y">Yükleme hızı</label>
        <span className="flex items-center gap-1.5">
          <input id="sh-y" className="dt-input dt-sayi w-24" inputMode="decimal" placeholder="örn. 20" value={mbps} onChange={(e) => setMbps(e.target.value)} />
          <span className="dt-birim">Mbps — bir hız sınaması sitesinde kendiniz ölçüp girin (isteğe bağlı)</span>
        </span>
        <label htmlFor="sh-h">Aynı anda hedef</label>
        <input id="sh-h" className="dt-input dt-sayi w-16" inputMode="numeric" value={hedef} onChange={(e) => setHedef(e.target.value)} />
      </div>
      <p className="px-3 pb-2 text-[12px] dt-soluk">
        Sınama motor çalışırken, yayın ve kayıt yokken yapılır: programdaki sahne 5 sn geçici dosyaya kodlanır (yayın gönderilmez, dosya silinir) ve atlanan
        kare oranı ölçülür.
      </p>
      {sonuc && (
        <>
          <table className="dt-table">
            <thead>
              <tr>
                <th>Kodlayıcı</th>
                <th className="text-right">Kare</th>
                <th className="text-right">Atlanan</th>
                <th>Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {sonuc.sonuclar.map((s) => (
                <tr key={s.tur}>
                  <td>
                    {s.ad} {s.donanim && <span className="dt-soluk">· donanım</span>}
                  </td>
                  <td className="dt-sayi text-right">{s.kare ?? "—"}</td>
                  <td className="dt-sayi text-right">{s.oran != null ? `%${(s.oran * 100).toFixed(1)}` : "—"}</td>
                  <td>
                    {s.hata ? (
                      <span className="dt-hata-metni">{s.hata}</span>
                    ) : s.gecti ? (
                      <span style={{ color: "var(--dt-ok)" }}>yeterli</span>
                    ) : (
                      <span className="dt-uyari-metni">yetersiz</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dt-form">
            <span className="dt-etiket">Önerilen kodlayıcı</span>
            <span>{sonuc.oneri.kodlayici ?? "—"}</span>
            <span className="dt-etiket">Hedef başı bit hızı</span>
            <span>{sonuc.oneri.bit_hizi_ana ? `${sonuc.oneri.bit_hizi_ana} kbps` : `öneri yok (sınanan ${sonuc.sinananBitHizi} kbps)`}</span>
            <span className="dt-etiket">Kayıt için disk</span>
            <span>{sonuc.diskDakika != null ? `yaklaşık ${sonuc.diskDakika} dakika` : "okunamadı"}</span>
          </div>
          <div className="px-3 pb-3 text-[12px]">
            {sonuc.notlar.map((n, i) => (
              <p key={i} className="dt-soluk">
                {n}
              </p>
            ))}
          </div>
        </>
      )}
    </Pencere>
  );
}
