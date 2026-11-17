import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../i18n";
import type { MsgKey } from "../../i18n/messages";
import {
  DEFAULT_TABS,
  LEFT_SECTIONS_CHAT,
  LEFT_SECTIONS_SCENE,
  RIGHT_SECTIONS,
  SETTINGS_SECTIONS,
  defaultPanelLayout,
  moveInOrder,
  type PanelLayout,
  type NavId,
} from "../../lib/panelLayout";

type Props = {
  layout: PanelLayout;
  activeScreen: string;
  activeNav?: string;
  onChange: (next: PanelLayout) => void;
  onClose: () => void;
};

function RowList({
  ids,
  labels,
  hidden,
  order,
  onToggle,
  onMove,
  minVisible = 0,
}: {
  ids: string[];
  labels: Record<string, string>;
  hidden: string[];
  order: string[];
  onToggle: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  minVisible?: number;
}) {
  const visibleCount = ids.filter((id) => !hidden.includes(id)).length;
  const sorted = [
    ...order.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !order.includes(id)),
  ];
  return (
    <ul className="space-y-1">
      {sorted.map((id) => {
        const isHidden = hidden.includes(id);
        return (
          <li
            key={id}
            className="flex items-center gap-2 rounded border border-panel-border/50 bg-black/25 px-2 py-1.5"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!isHidden}
                disabled={!isHidden && visibleCount <= minVisible}
                onChange={() => onToggle(id)}
              />
              <span className="truncate">{labels[id] || id}</span>
            </label>
            <button
              type="button"
              className="rounded bg-white/10 px-1.5 py-0.5 text-ui-2"
              onClick={() => onMove(id, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded bg-white/10 px-1.5 py-0.5 text-ui-2"
              onClick={() => onMove(id, 1)}
            >
              ↓
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function LayoutEditor({
  layout,
  activeScreen,
  activeNav,
  onChange,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [editScreen, setEditScreen] = useState(
    activeScreen === "starting" ||
      activeScreen === "ending" ||
      activeScreen === "brb" ||
      activeScreen === "chat"
      ? activeScreen
      : "starting"
  );

  const tabLabels = Object.fromEntries(
    DEFAULT_TABS.map((tab) => [tab.id, t(tab.labelKey as MsgKey) || tab.label])
  );

  const leftDefs =
    editScreen === "chat"
      ? LEFT_SECTIONS_CHAT
      : editScreen === "ending"
        ? LEFT_SECTIONS_SCENE
        : LEFT_SECTIONS_SCENE.filter((s) => s.id !== "jenerik");
  const left = layout.sections[editScreen] || {
    order: leftDefs.map((s) => s.id),
    hidden: [],
  };
  const side = layout.sections.side || { order: RIGHT_SECTIONS.map((s) => s.id), hidden: [] };
  const settingsOh = layout.sections.settings || {
    order: SETTINGS_SECTIONS.map((s) => s.id),
    hidden: [],
  };

  const leftLabels = Object.fromEntries(
    leftDefs.map((s) => [s.id, t(s.labelKey as MsgKey) || s.label])
  );
  const rightLabels = Object.fromEntries(
    RIGHT_SECTIONS.map((s) => [s.id, t(s.labelKey as MsgKey) || s.label])
  );
  const settingsLabels = Object.fromEntries(
    SETTINGS_SECTIONS.map((s) => [s.id, t(s.labelKey as MsgKey) || s.label])
  );

  const patchTabs = (fn: (oh: typeof layout.tabs) => typeof layout.tabs) =>
    onChange({ ...layout, tabs: fn(layout.tabs) });
  const patchSec = (key: string, fn: (oh: typeof left) => typeof left) =>
    onChange({
      ...layout,
      sections: { ...layout.sections, [key]: fn(layout.sections[key] || left) },
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const panel = (
    <div
      className="fixed inset-0 z-[10050] flex items-start justify-end bg-black/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.customize")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mt-12 max-h-[min(85vh,40rem)] w-[min(100%,22rem)] overflow-y-auto rounded-lg border border-panel-border bg-panel-bg p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("nav.customize")}</h3>
        <button type="button" className="text-xs text-panel-muted" onClick={onClose}>
          ✕
        </button>
      </div>

      <p className="mb-1 text-ui-2 font-medium text-panel-muted">{t("layout.tabs")}</p>
      <RowList
        ids={DEFAULT_TABS.map((x) => x.id)}
        labels={tabLabels}
        hidden={layout.tabs.hidden}
        order={layout.tabs.order}
        minVisible={1}
        onToggle={(id) =>
          patchTabs((oh) => {
            const hidden = oh.hidden.includes(id)
              ? oh.hidden.filter((h) => h !== id)
              : [...oh.hidden, id];
            return { ...oh, hidden };
          })
        }
        onMove={(id, dir) =>
          patchTabs((oh) => ({ ...oh, order: moveInOrder(oh.order as NavId[], id, dir) }))
        }
      />

      <p className="mb-1 mt-3 text-ui-2 font-medium text-panel-muted">{t("layout.screen")}</p>
      <select
        className="mb-2 w-full rounded border border-panel-border bg-black/40 px-2 py-1.5 text-xs"
        value={editScreen}
        onChange={(e) => setEditScreen(e.target.value)}
      >
        <option value="starting">{t("nav.starting")}</option>
        <option value="ending">{t("nav.ending")}</option>
        <option value="brb">{t("nav.brb")}</option>
        <option value="chat">{t("nav.chat")}</option>
      </select>
      <p className="mb-1 text-ui-2 font-medium text-panel-muted">{t("layout.left")}</p>
      <RowList
        ids={leftDefs.map((s) => s.id)}
        labels={leftLabels}
        hidden={left.hidden}
        order={left.order}
        onToggle={(id) =>
          patchSec(editScreen, (oh) => ({
            ...oh,
            hidden: oh.hidden.includes(id)
              ? oh.hidden.filter((h) => h !== id)
              : [...oh.hidden, id],
          }))
        }
        onMove={(id, dir) =>
          patchSec(editScreen, (oh) => ({ ...oh, order: moveInOrder(oh.order, id, dir) }))
        }
      />

      <p className="mb-1 mt-3 text-ui-2 font-medium text-panel-muted">{t("layout.right")}</p>
      <RowList
        ids={RIGHT_SECTIONS.map((s) => s.id)}
        labels={rightLabels}
        hidden={side.hidden}
        order={side.order}
        onToggle={(id) =>
          patchSec("side", (oh) => ({
            ...oh,
            hidden: oh.hidden.includes(id)
              ? oh.hidden.filter((h) => h !== id)
              : [...oh.hidden, id],
          }))
        }
        onMove={(id, dir) =>
          patchSec("side", (oh) => ({ ...oh, order: moveInOrder(oh.order, id, dir) }))
        }
      />

      <p className="mb-1 mt-3 text-ui-2 font-medium text-panel-muted">
        {t("layout.settings")}
      </p>
      <RowList
        ids={SETTINGS_SECTIONS.map((s) => s.id)}
        labels={settingsLabels}
        hidden={settingsOh.hidden}
        order={settingsOh.order}
        minVisible={1}
        onToggle={(id) =>
          patchSec("settings", (oh) => ({
            ...oh,
            hidden: oh.hidden.includes(id)
              ? oh.hidden.filter((h) => h !== id)
              : [...oh.hidden, id],
          }))
        }
        onMove={(id, dir) =>
          patchSec("settings", (oh) => ({
            ...oh,
            order: moveInOrder(oh.order, id, dir),
          }))
        }
      />

      <button
        type="button"
        className="mt-3 w-full rounded-md border border-panel-border py-1.5 text-xs"
        onClick={() => {
          localStorage.removeItem("panel.layout");
          onChange(defaultPanelLayout());
        }}
      >
        {t("nav.reset")}
      </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}
