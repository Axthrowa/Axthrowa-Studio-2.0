/** OBS Browser Source — /overlay/alerts (şeffaf + AlertQueueEngine + AlertWidget). */

import { useEffect } from "react";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useIsWidgetPreview } from "../../lib/sohbetBot/widgetPreview";
import {
  useAlertOverlayQueue,
  useTransparentObs,
} from "../../lib/overlay/useAlertOverlay";
import { defaultAlertType } from "../../lib/alerts/types";
import AlertWidget from "../../components/widgets/AlertWidget";

export default function OverlayAlertsPage() {
  useObsKeepalive();
  useTransparentObs();
  const preview = useIsWidgetPreview();
  const { current, enqueueEvent } = useAlertOverlayQueue();

  useEffect(() => {
    if (!preview || current) return;
    void enqueueEvent({
      id: "preview",
      kind: "follow",
      user: "DemoKullanıcı",
      message: "Merhaba!",
      t: Date.now(),
    });
  }, [preview, current, enqueueEvent]);

  const fallback = defaultAlertType("follow");

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent text-white">
      <AlertWidget
        visible={!!current}
        template={current?.template || "{name}"}
        vars={{
          name: current?.user,
          amount: current?.amount,
          message: current?.message,
        }}
        config={current?.config || fallback}
        mediaUrl={current?.mediaUrl}
        soundUrl={current?.soundUrl}
      />
    </div>
  );
}
