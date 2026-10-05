/**
 * Denetimler dock'u (OBS "Controls"): yayını başlat (ön kontrol penceresiyle) / bitir, kaydı başlat/durdur +
 * duraklat/sürdür + böl, tekrar arabelleği, sanal kamera, Studio Mode, ayarlar, motoru durdur. Yayın yalnız
 * kullanıcının açık eylemiyle başlar.
 */
import { Pause, Play, Save, Settings } from "./obsSimgeler";

export function DenetimlerDock({
  canli,
  canliToplam,
  kayitta,
  duraklatildi,
  sanalKamera,
  tekrarAcik,
  studyo,
  meşgul,
  onYayin,
  onKayit,
  onDuraklat,
  onBol,
  onSanalKamera,
  onSanalKameraHedef,
  sanalKameraHedefAdi,
  onTekrar,
  onTekrarKaydet,
  onStudyo,
  onAyarlar,
  onMotorDurdur,
}: {
  canli: number;
  canliToplam: number;
  kayitta: boolean;
  duraklatildi: boolean;
  sanalKamera: boolean;
  tekrarAcik: boolean;
  studyo: boolean;
  meşgul: boolean;
  onYayin: () => void;
  onKayit: () => void;
  onDuraklat: () => void;
  onBol: () => void;
  onSanalKamera: () => void;
  /** Sanal kamera hedef menüsü (dişli); verilmezse gösterilmez */
  onSanalKameraHedef?: (e: { clientX: number; clientY: number }) => void;
  sanalKameraHedefAdi?: string;
  onTekrar: () => void;
  onTekrarKaydet: () => void;
  onStudyo: () => void;
  onAyarlar: () => void;
  onMotorDurdur: () => void;
}) {
  // OBS "Kontroller" dock'u: yalnız metinli düğmeler, etkin çıktı mavi (Yami "state-active"); metinler OBS tr-TR çevirisi
  return (
    <section className="dt-dock h-full" aria-label="Kontroller">
      <div className="dt-dock-baslik">Kontroller</div>
      <div className="dt-dock-govde flex flex-col gap-1 p-1">
        <button
          type="button"
          className="dt-btn w-full"
          data-etkin={canli > 0 || undefined}
          disabled={meşgul || (canli === 0 && canliToplam === 0)}
          title={
            canliToplam === 0
              ? "Etkin ve anahtarlı hedef yok (Hedefler)"
              : canli > 0
                ? `Tüm motor hedeflerini durdur (${canli}/${canliToplam} canlı)`
                : "Ön kontrol, sonra tüm etkin hedeflere yayın"
          }
          onClick={onYayin}
        >
          {canli > 0 ? "Yayını Durdur" : "Yayını Başlat"}
        </button>
        <div className="flex gap-1">
          <button type="button" className="dt-btn min-w-0 flex-1" data-etkin={kayitta || undefined} disabled={meşgul} onClick={onKayit}>
            {kayitta ? "Kaydı Durdur" : "Kaydı Başlat"}
          </button>
          {kayitta && (
            <button
              type="button"
              className="dt-btn !px-2"
              data-etkin={duraklatildi || undefined}
              aria-label={duraklatildi ? "Kaydı Devam Ettir" : "Kaydı Duraklat"}
              title={
                duraklatildi ? "Kaydı Devam Ettir" : "Kaydı Duraklat (kayıt yayınla aynı kodlayıcıyı paylaşıyorsa Ayarlar › Kayıt › ayrı kodlayıcı gerekir)"
              }
              disabled={meşgul}
              onClick={onDuraklat}
            >
              {duraklatildi ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
        </div>
        <div className="flex gap-1">
          <button type="button" className="dt-btn min-w-0 flex-1" data-etkin={tekrarAcik || undefined} disabled={meşgul} onClick={onTekrar}>
            <span className="truncate">{tekrarAcik ? "Tekrar Oynatma Arabelleğini Durdur" : "Tekrar Oynatma Arabelleğini Başlat"}</span>
          </button>
          {tekrarAcik && (
            <button
              type="button"
              className="dt-btn !px-2"
              aria-label="Yeniden Oynatmayı Kaydet"
              title="Yeniden Oynatmayı Kaydet"
              disabled={meşgul}
              onClick={onTekrarKaydet}
            >
              <Save className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="dt-btn min-w-0 flex-1"
            data-etkin={sanalKamera || undefined}
            disabled={meşgul}
            onClick={onSanalKamera}
            title={`Görüntüyü sanal kamera aygıtı olarak ver (kurulu OBS'in sanal kamera sürücüsü) · hedef: ${sanalKameraHedefAdi ?? "Program"}`}
          >
            {sanalKamera ? "Sanal Kamerayı Durdur" : "Sanal Kamerayı Başlat"}
          </button>
          {onSanalKameraHedef && (
            <button
              type="button"
              className="dt-btn !px-2"
              aria-label="Sanal Kamerayı Yapılandır"
              title={`Sanal Kamerayı Yapılandır (hedef: ${sanalKameraHedefAdi ?? "Program"})`}
              disabled={meşgul || sanalKamera}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onSanalKameraHedef({ clientX: r.left, clientY: r.bottom });
              }}
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="button" className="dt-btn w-full" data-etkin={studyo || undefined} aria-pressed={studyo} onClick={onStudyo}>
          Stüdyo Modu
        </button>
        <button type="button" className="dt-btn w-full" onClick={onAyarlar}>
          Ayarlar
        </button>
        <button
          type="button"
          className="dt-btn w-full"
          disabled={meşgul}
          onClick={onMotorDurdur}
          title="Yayın motorunu kapatır (yayın, kayıt ve tekrar arabelleği biter)"
        >
          Motoru Durdur
        </button>
      </div>
    </section>
  );
}
