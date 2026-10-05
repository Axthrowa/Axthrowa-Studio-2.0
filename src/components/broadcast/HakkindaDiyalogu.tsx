/**
 * Yardım › Hakkında ve lisanslar (ADR-005): ürün GPL-2.0-or-later; lisans metni ve üçüncü taraf bildirimleri
 * uygulamayla gelen dosyalardan (`LICENSE.txt`, `THIRD_PARTY_NOTICES.txt`) okunur. Marka notu burada.
 */
import { useEffect, useState } from "react";
import { Pencere } from "./ortak";

type Sekme = "hakkinda" | "lisans" | "bildirimler";

export function HakkindaDiyalogu({ libobs, onKapat }: { libobs?: string; onKapat: () => void }) {
  const [sekme, setSekme] = useState<Sekme>("hakkinda");
  const [metin, setMetin] = useState<string | null>(null);
  const [ara, setAra] = useState("");

  useEffect(() => {
    if (sekme === "hakkinda") return;
    let iptal = false;
    setMetin(null);
    fetch(sekme === "lisans" ? "/LICENSE.txt" : "/THIRD_PARTY_NOTICES.txt")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(
        (t) => !iptal && setMetin(t),
        () => !iptal && setMetin("Dosya bu kurulumda bulunamadı (sürüm derlemesi üretir: scripts/ucuncu-taraf-bildirimleri.mjs).")
      );
    return () => {
      iptal = true;
    };
  }, [sekme]);

  const gosterilen = (() => {
    if (!metin || sekme !== "bildirimler" || !ara.trim()) return metin;
    const q = ara.trim().toLocaleLowerCase("tr");
    // Bileşen başlığına göre süz: boş satırla ayrılmış bloklardan eşleşenler
    return metin
      .split(/\n(?=\S[^\n]* \[(?:cargo|npm);)/)
      .filter((b) => b.slice(0, 200).toLocaleLowerCase("tr").includes(q))
      .join("\n");
  })();

  return (
    <Pencere baslik="Hakkında ve lisanslar" genis onKapat={onKapat}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="dt-sekmeler" role="tablist" aria-label="Hakkında">
          {(
            [
              ["hakkinda", "Hakkında"],
              ["lisans", "Lisans (GPL-2.0-or-later)"],
              ["bildirimler", "Üçüncü taraf bildirimleri"],
            ] as const
          ).map(([id, ad]) => (
            <button key={id} type="button" role="tab" aria-selected={sekme === id} className="dt-sekme" onClick={() => setSekme(id)}>
              {ad}
            </button>
          ))}
        </div>
        {sekme === "hakkinda" ? (
          <div className="space-y-2 p-3 text-[13px]">
            <p className="font-semibold">Yayın Yönetim Aracı</p>
            <p>
              Bu program özgür yazılımdır: GNU Genel Kamu Lisansı'nın 2. sürümü ya da (tercihinize göre) daha sonraki bir sürümü koşullarıyla dağıtabilir ve
              değiştirebilirsiniz. Program yararlı olacağı umuduyla, ancak <strong>hiçbir garanti olmaksızın</strong> dağıtılır. İkili sürümü alan herkes
              karşılık gelen kaynak kodunu da aynı lisansla alma hakkına sahiptir.
            </p>
            <p>
              Yayın motoru, bilgisayarınızda kurulu OBS Studio'nun libobs kütüphanesini{libobs ? ` (${libobs})` : ""} çalışma anında yükler; libobs ve OBS
              eklentileri bu pakete dahil değildir.
            </p>
            <p className="dt-soluk">
              OBS Studio, OBS Project'in markasıdır; bu ürün onunla bağlantılı değildir. Platform adları yalnız uyumluluğu tarif etmek için geçer.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
            {sekme === "bildirimler" && (
              <input
                className="dt-input"
                placeholder="Bileşen ara (ad, lisans)…"
                aria-label="Bileşen ara"
                value={ara}
                onChange={(e) => setAra(e.target.value)}
              />
            )}
            <pre
              className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-[11px] leading-snug"
              tabIndex={0}
              aria-label={sekme === "lisans" ? "Lisans metni" : "Üçüncü taraf bildirimleri"}
            >
              {gosterilen ?? "Yükleniyor…"}
            </pre>
          </div>
        )}
      </div>
    </Pencere>
  );
}
