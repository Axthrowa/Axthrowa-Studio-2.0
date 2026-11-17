/**
 * Widget kind → React bileşeni (OBS overlay + panel canlı önizleme ortak).
 */

import { lazy, Suspense, type ReactNode } from "react";
import AlertsWidget from "../../components/widgets/AlertsWidget";
import ChatWidget from "../../components/widgets/ChatWidget";
import EmoteComboWidget from "../../components/widgets/EmoteComboWidget";
import GoalWidget from "../../components/widgets/GoalWidget";
import KickSubsWidget from "../../components/widgets/KickSubsWidget";
import SubathonWidget from "../../components/widgets/SubathonWidget";
import WidgetStage from "../../components/widgets/WidgetStage";
import {
  ActivityWidget,
  CreditsWidget,
  HypeTrainWidget,
  LabelsWidget,
  PollWidget,
  RafflesWidget,
  ShoutoutWidget,
  SongRequestWidget,
  TtsWidget,
  ViewersWidget,
  WheelWidget,
} from "../../components/widgets/EnterpriseWidgets";

// Fizik motoru (matter-js) büyük: yalnız bu iki widget açılınca yüklenir, diğer overlay'ler taşımaz
const CupWidget = lazy(() => import("../../components/widgets/CupWidget"));
const EmoteWallWidget = lazy(() => import("../../components/widgets/EmoteWallWidget"));

/** Önizleme için demo config yaması (chat boş görünmesin vb.) */
export function previewDemoPatch(kind: string, config: Record<string, unknown>): Record<string, unknown> {
  const k = kind.toLowerCase();
  if (k === "chat") {
    return {
      ...config,
      _previewDemo: true,
    };
  }
  if (k === "poll" || k === "polls") {
    return {
      ...config,
      question: String(config.question || "Bugün ne oynayalım?"),
      options:
        Array.isArray(config.options) && (config.options as unknown[]).length > 0
          ? config.options
          : ["Evet", "Hayır", "Belki"],
    };
  }
  return config;
}

function wrap(kind: string, config: Record<string, unknown>, node: ReactNode): ReactNode {
  return (
    <WidgetStage kind={kind} config={config}>
      <Suspense fallback={null}>{node}</Suspense>
    </WidgetStage>
  );
}

export function renderWidgetByKind(
  kind: string,
  config: Record<string, unknown>
): ReactNode {
  const cfg = previewDemoPatch(kind, config);
  const k = kind.toLowerCase();
  let inner: ReactNode;
  switch (k) {
    case "goal":
    case "goals":
      inner = <GoalWidget config={cfg} />;
      break;
    case "kicksubs":
    case "kick-subs":
    case "kick_subs":
      inner = <KickSubsWidget config={cfg} />;
      break;
    case "subathon":
      inner = <SubathonWidget config={cfg} />;
      break;
    case "viewers":
      inner = <ViewersWidget config={cfg} />;
      break;
    case "labels":
    case "label":
      inner = <LabelsWidget config={cfg} />;
      break;
    case "emotewall":
    case "emotes":
      inner = <EmoteWallWidget config={cfg} />;
      break;
    case "emotecombo":
    case "emote-combo":
      inner = <EmoteComboWidget config={cfg} />;
      break;
    case "cup":
    case "glass":
      inner = <CupWidget config={cfg} />;
      break;
    case "chat":
      inner = <ChatWidget config={cfg} />;
      break;
    case "alerts":
    case "alert":
      inner = <AlertsWidget config={cfg} />;
      break;
    case "activity":
    case "activityfeed":
      inner = <ActivityWidget config={cfg} />;
      break;
    case "shoutout":
    case "shoutouts":
      inner = <ShoutoutWidget config={cfg} />;
      break;
    case "wheel":
    case "fortunewheel":
      inner = <WheelWidget config={cfg} />;
      break;
    case "poll":
    case "polls":
      inner = <PollWidget config={cfg} />;
      break;
    case "raffles":
    case "giveaway":
      inner = <RafflesWidget config={cfg} />;
      break;
    case "hypetrain":
    case "hype":
      inner = <HypeTrainWidget config={cfg} />;
      break;
    case "songrequest":
    case "now-playing":
      inner = <SongRequestWidget config={cfg} />;
      break;
    case "tts":
    case "cloudtts":
      inner = <TtsWidget config={cfg} />;
      break;
    case "credits":
    case "moviecredits":
      inner = <CreditsWidget config={cfg} />;
      break;
    default:
      inner = (
        <div className="flex h-full w-full items-center justify-center bg-transparent">
          <div className="rounded-xl border border-white/20 bg-black/70 px-5 py-3 text-sm text-white">
            Widget: <strong className="text-ui-warn">{kind || "?"}</strong>
          </div>
        </div>
      );
  }
  return wrap(k, cfg, inner);
}
