/**
 * Yayını başlat / bitir: üst şeritte tek biçim (DENETIM sorun 2). Düğme yalnız onay penceresini açar;
 * akışın kendisi (`runMasterStream`) PanelPage'de, değişmedi. Başlatma: ön kontrol + onay (primary);
 * bitirme: `tone="danger"`, odak Vazgeç'te.
 */
import { CirclePower, Square, Unplug } from "lucide-react";
import { useI18n } from "../../i18n";
import { Button, ConfirmDialog, StatusPill } from "@/components/ui";

export function YayinDugmesi({ canli, mesgul, onClick }: { canli: boolean; mesgul: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant={canli ? "danger" : "primary"} loading={mesgul} onClick={onClick} className="min-w-28">
      {mesgul ? null : canli ? <Square aria-hidden /> : <CirclePower aria-hidden />}
      {mesgul ? t("kabuk.isleniyor") : canli ? t("brand.endLive") : t("brand.goLive")}
    </Button>
  );
}

type OnayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canli: boolean;
  mesgul: boolean;
  obsBagli: boolean;
  onConfirm: () => Promise<void>;
};

export function YayinOnayi({ open, onOpenChange, canli, mesgul, obsBagli, onConfirm }: OnayProps) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone={canli ? "danger" : "primary"}
      loading={mesgul}
      title={canli ? t("kabuk.bitirBaslik") : t("kabuk.baslatBaslik")}
      description={canli ? t("kabuk.bitirAciklama") : t("kabuk.baslatAciklama")}
      confirmLabel={canli ? t("brand.endLive") : t("brand.goLive")}
      onConfirm={async () => {
        await onConfirm();
        onOpenChange(false);
      }}
    >
      {canli ? null : (
        <div className="flex flex-col gap-1">
          <p className="text-ui-1 font-semibold uppercase tracking-[0.05em] text-ui-fg2">{t("kabuk.onKontrol")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {obsBagli ? (
              <StatusPill tone="ok">{t("status.obsOn")}</StatusPill>
            ) : (
              <>
                <StatusPill tone="neutral" icon={Unplug}>
                  {t("status.obsOff")}
                </StatusPill>
                <span className="text-ui-2 text-ui-fg2">{t("kabuk.obsBagliDegilNot")}</span>
              </>
            )}
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
