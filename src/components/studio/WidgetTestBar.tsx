/** BotAxt widget test bar — önizleme altında, ikonlu aksiyonlar. */

import { useState, type ReactNode } from "react";
import {
  FlaskConical,
  Gift,
  Heart,
  MessageSquare,
  Music2,
  Smile,
  Radio,
  Target,
  UserPlus,
  Volume2,
  Vote,
} from "lucide-react";
import { testWidgetSfx, unlockWidgetAudio } from "../../lib/widgets/widgetBus";
import { widgetsTest } from "../../lib/widgets/useWidgetSync";
import { cn } from "../../lib/cn";

type Props = {
  kind: string;
  busy?: boolean;
  onToast: (m: string) => void;
  onAfterTest?: () => void;
};

type TestAction = {
  id: string;
  label: string;
  event?: string;
  icon: ReactNode;
};

function actionsForKind(kind: string): TestAction[] {
  const k = kind.toLowerCase();
  const base: TestAction[] = [
    {
      id: "generic",
      label: "Test Et",
      icon: <FlaskConical className="h-3.5 w-3.5" />,
    },
  ];

  if (k === "emotewall" || k === "cup" || k === "chat" || k === "emotecombo") {
    return [
      ...base,
      {
        id: "msg",
        label: "Test Mesajı",
        event: "chat",
        icon: <MessageSquare className="h-3.5 w-3.5" />,
      },
      {
        id: "tip",
        label: "Test Bağışı",
        event: "tip",
        icon: <Gift className="h-3.5 w-3.5" />,
      },
      {
        id: "emote",
        label: "Emoji Fırlat",
        event: "chat",
        icon: <Smile className="h-3.5 w-3.5" />,
      },
      {
        id: "sub",
        label: "Test Abonelik",
        event: "sub",
        icon: <Heart className="h-3.5 w-3.5" />,
      },
    ];
  }

  if (k === "goal" || k === "goals") {
    return [
      ...base,
      {
        id: "goal_bump",
        label: "Hedefi Artır (Test)",
        event: "goal_bump",
        icon: <Target className="h-3.5 w-3.5" />,
      },
      {
        id: "sfx_test",
        label: "SFX Test",
        event: "sfx_test",
        icon: <Volume2 className="h-3.5 w-3.5" />,
      },
      {
        id: "tip",
        label: "Test Bağışı",
        event: "tip",
        icon: <Gift className="h-3.5 w-3.5" />,
      },
      {
        id: "follow",
        label: "Takip",
        event: "follow",
        icon: <UserPlus className="h-3.5 w-3.5" />,
      },
    ];
  }

  if (k === "kicksubs" || k === "kick-subs" || k === "kick_subs") {
    return [
      ...base,
      {
        id: "sub",
        label: "Test Abone",
        event: "sub",
        icon: <Heart className="h-3.5 w-3.5" />,
      },
      {
        id: "gift",
        label: "Hediye Abone",
        event: "sub",
        icon: <Gift className="h-3.5 w-3.5" />,
      },
    ];
  }

  if (k === "subathon" || k === "hypetrain" || k === "activity") {
    return [
      ...base,
      {
        id: "tip",
        label: "Test Bağışı",
        event: "tip",
        icon: <Gift className="h-3.5 w-3.5" />,
      },
      {
        id: "sub",
        label: "Test Abonelik",
        event: "sub",
        icon: <Heart className="h-3.5 w-3.5" />,
      },
      {
        id: "follow",
        label: "Takip",
        event: "follow",
        icon: <UserPlus className="h-3.5 w-3.5" />,
      },
      {
        id: "kick",
        label: "Kick / Host",
        event: "kick",
        icon: <Radio className="h-3.5 w-3.5" />,
      },
      {
        id: "sfx_test",
        label: "SFX Test",
        event: "sfx_test",
        icon: <Volume2 className="h-3.5 w-3.5" />,
      },
    ];
  }

  if (k === "poll" || k === "polls") {
    return [
      ...base,
      {
        id: "vote",
        label: "Oy Gönder",
        event: "vote",
        icon: <Vote className="h-3.5 w-3.5" />,
      },
    ];
  }

  if (k === "songrequest" || k === "now-playing") {
    return [
      ...base,
      {
        id: "song",
        label: "Şarkı Ekle",
        event: "tip",
        icon: <Music2 className="h-3.5 w-3.5" />,
      },
    ];
  }

  return [
    ...base,
    {
      id: "tip",
      label: "Test Bağışı",
      event: "tip",
      icon: <Gift className="h-3.5 w-3.5" />,
    },
    {
      id: "sub",
      label: "Test Abonelik",
      event: "sub",
      icon: <Heart className="h-3.5 w-3.5" />,
    },
    {
      id: "msg",
      label: "Test Mesajı",
      event: "chat",
      icon: <MessageSquare className="h-3.5 w-3.5" />,
    },
  ];
}

export default function WidgetTestBar({
  kind,
  busy: busyProp,
  onToast,
  onAfterTest,
}: Props) {
  const [localBusy, setLocalBusy] = useState(false);
  const busy = busyProp || localBusy;
  const actions = actionsForKind(kind);

  const run = async (event?: string) => {
    setLocalBusy(true);
    try {
      if (event === "sfx_test") {
        await unlockWidgetAudio();
        const ok = await testWidgetSfx(0.75);
        if (ok) {
          onToast("SFX test çalındı ✓");
        } else {
          onToast("SFX çalınamadı — konsolu kontrol edin");
        }
        return;
      }
      const res = await widgetsTest(kind, event);
      const n = Number((res as { broadcast?: number }).broadcast) || 0;
      onToast(
        event === "goal_bump"
          ? `Hedef +${Number((res as { bump?: number }).bump) || "?"} · ${n} olay`
          : event
            ? `${event} test · ${n}`
            : `Test · ${kind}`
      );
      onAfterTest?.();
    } catch (e) {
      onToast(String((e as Error).message || "Test başarısız"));
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={busy}
          onClick={() => void run(a.event)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10",
            "bg-white/[0.03] px-3 text-[11px] font-semibold text-white/70 transition",
            "hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-300",
            "disabled:opacity-40"
          )}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}
