/** Widget kök sarmalayıcı — transform + custom CSS. */

import { useEffect, type ReactNode } from "react";
import { injectCustomCss, transformStyle } from "../../lib/widgets/widgetBus";

type Props = {
  kind: string;
  config: Record<string, unknown>;
  children: ReactNode;
};

export default function WidgetStage({ kind, config, children }: Props) {
  useEffect(() => {
    return injectCustomCss(kind, String(config.customCss || config.custom_css || ""));
  }, [kind, config.customCss, config.custom_css]);

  return (
    <div
      className="yya-widget-stage relative h-full w-full"
      data-widget-kind={kind}
      style={transformStyle(config)}
    >
      {children}
    </div>
  );
}
