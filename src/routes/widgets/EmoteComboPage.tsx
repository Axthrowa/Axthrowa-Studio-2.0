/** OBS emote kombosu — aynı görünüm, çerçeve yok. */

import EmoteComboWidget from "../../components/widgets/EmoteComboWidget";
import { useObsKeepalive } from "../../lib/obsKeepalive";
import { useOverlayBotConfig } from "../../lib/sohbetBot/useOverlayWidgetEvents";
import { useIsWidgetPreview } from "../../lib/sohbetBot/widgetPreview";

export default function EmoteComboPage() {
  useObsKeepalive();
  const preview = useIsWidgetPreview();
  const cfg = useOverlayBotConfig();
  const combo = cfg.emoteCombo;

  if (combo?.enabled === false && !preview) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <div className="h-screen w-screen overflow-visible bg-transparent">
      <EmoteComboWidget
        config={{
          ...(combo || {}),
          threshold: combo?.minCount,
          _previewMode: preview,
        }}
      />
    </div>
  );
}
