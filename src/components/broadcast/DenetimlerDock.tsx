/**
 * Denetimler dock'u (OBS "Controls"): yayını başlat (ön kontrol penceresiyle) / bitir, kaydı başlat/durdur +
 * duraklat/sürdür + böl, tekrar arabelleği, sanal kamera, Studio Mode, ayarlar, motoru durdur. Yayın yalnız
 * kullanıcının açık eylemiyle başlar.
 */
import { Circle, Clapperboard, MonitorPlay, Pause, Play, Radio, Save, Scissors, Settings, Square, Video } from "lucide-react";

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
  return (
    <section className="dt-dock h-full" aria-label="Denetimler">
      <div className="dt-dock-baslik">Denetimler</div>
      <div className="dt-dock-govde flex flex-col gap-1.5 p-2">
        <button
          type="button"
          className={canli > 0 ? "dt-btn-danger w-full" : "dt-btn-primary w-full"}
          disabled={meşgul || (canli === 0 && canliToplam === 0)}
          title={canliToplam === 0 ? "Etkin ve anahtarlı hedef yok (Hedefler)" : canli > 0 ? "Tüm motor hedeflerini durdur" : "Ön kontrol, sonra tüm etkin hedeflere yayın"}
          onClick={onYayin}
        >
          <Radio className="h-3.5 w-3.5" />
          {canli > 0 ? `Yayını bitir (${canli}/${canliToplam})` : "Yayını başlat"}
        </button>
        <div className="flex gap-1">
          <button type="button" className="dt-btn min-w-0 flex-1" disabled={meşgul} onClick={onKayit}>
            {kayitta ? <Square className="h-3.5 w-3.5" style={{ color: "var(--dt-rec)" }} /> : <Circle className="h-3.5 w-3.5" />}
            {kayitta ? (duraklatildi ? "Kayıt duraklatıldı" : "Kaydı durdur") : "Kaydı başlat"}
          </button>
          {kayitta && (
            <>
              <button
                type="button"
                className="dt-btn"
                aria-pressed={duraklatildi}
                aria-label={duraklatildi ? "Kaydı sürdür" : "Kaydı duraklat"}
                title={duraklatildi ? "Kaydı sürdür" : "Kaydı duraklat (kayıt yayınla aynı kodlayıcıyı paylaşıyorsa Ayarlar › Kayıt › ayrı kodlayıcı gerekir)"}
                disabled={meşgul}
                onClick={onDuraklat}
              >
                {duraklatildi ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button type="button" className="dt-btn" aria-label="Kayıt dosyasını böl" title="Kayıt dosyasını böl (yeni dosya bir sonraki anahtar karede başlar)" disabled={meşgul} onClick={onBol}>
                <Scissors className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
        <div className="flex gap-1">
          <button type="button" className="dt-btn min-w-0 flex-1" aria-pressed={tekrarAcik} disabled={meşgul} onClick={onTekrar}>
            <Clapperboard className="h-3.5 w-3.5" />
            {tekrarAcik ? "Tekrar: açık" : "Tekrar arabelleği"}
          </button>
          <button type="button" className="dt-btn" aria-label="Tekrarı kaydet" title="Tekrarı kaydet" disabled={meşgul || !tekrarAcik} onClick={onTekrarKaydet}>
            <Save className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="dt-btn min-w-0 flex-1"
            aria-pressed={sanalKamera}
            disabled={meşgul}
            onClick={onSanalKamera}
            title={`Görüntüyü sanal kamera aygıtı olarak ver (kurulu OBS'in sanal kamera sürücüsü) · hedef: ${sanalKameraHedefAdi ?? "Program"}`}
          >
            <Video className="h-3.5 w-3.5" />
            {sanalKamera ? "Sanal kamerayı durdur" : "Sanal kamerayı başlat"}
          </button>
          {onSanalKameraHedef && (
            <button
              type="button"
              className="dt-btn"
              aria-label="Sanal kamera hedefi"
              title={`Sanal kamera hedefi: ${sanalKameraHedefAdi ?? "Program"}`}
              disabled={meşgul || sanalKamera}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                onSanalKameraHedef({ clientX: r.left, clientY: r.bottom });
              }}
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <button type="button" className="dt-btn w-full" aria-pressed={studyo} onClick={onStudyo}>
          <MonitorPlay className="h-3.5 w-3.5" />
          {studyo ? "Studio Mode: açık" : "Studio Mode"}
        </button>
        <button type="button" className="dt-btn w-full" onClick={onAyarlar}>
          <Settings className="h-3.5 w-3.5" />
          Ayarlar
        </button>
        <button type="button" className="dt-btn w-full" disabled={meşgul} onClick={onMotorDurdur}>
          Motoru durdur
        </button>
      </div>
    </section>
  );
}
