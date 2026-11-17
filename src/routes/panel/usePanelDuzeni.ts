/** PanelPage'den ayrıldı (TEK-4, davranış aynı): bölüm sırası, gizli bölümler ve görünen sekmeler. */
import { useCallback, useEffect, useMemo } from "react";
import { ScreenId } from "../../lib/api";
import { DEFAULT_TABS, LEFT_SECTIONS_CHAT, LEFT_SECTIONS_SCENE, RIGHT_SECTIONS, visibleOrdered, type NavId, type PanelLayout } from "../../lib/panelLayout";

export type UsePanelDuzeniGirdisi = {
  activeNav: NavId | ScreenId;
  forceNavRef: React.RefObject<NavId | null>;
  kurulumGoster: boolean;
  layout: PanelLayout;
  screen: ScreenId;
  setActiveNav: React.Dispatch<React.SetStateAction<NavId | ScreenId>>;
  setScreen: React.Dispatch<React.SetStateAction<ScreenId>>;
};

export function usePanelDuzeni({ activeNav, forceNavRef, kurulumGoster, layout, screen, setActiveNav, setScreen }: UsePanelDuzeniGirdisi) {

  const sectionHidden = useCallback(
    (id: string) => {
      const key =
        screen === "chat" || screen === "ending" || screen === "brb" || screen === "starting"
          ? screen
          : "starting";
      const side =
        id === "obsUrl" ||
        id === "resonance" ||
        id === "obsWs" ||
        id === "sosyal";
      const oh = side ? layout.sections.side : layout.sections[key];
      return (oh?.hidden || []).includes(id);
    },
    [layout, screen]
  );

  const leftSectionOrder = useMemo(() => {
    const defs =
      screen === "chat"
        ? LEFT_SECTIONS_CHAT
        : screen === "ending"
          ? LEFT_SECTIONS_SCENE
          : LEFT_SECTIONS_SCENE.filter((s) => s.id !== "jenerik");
    const key =
      screen === "chat" || screen === "ending" || screen === "brb" || screen === "starting"
        ? screen
        : "starting";
    return visibleOrdered(layout.sections[key] || { order: [], hidden: [] }, defs.map((d) => d.id));
  }, [layout.sections, screen]);

  const rightSectionOrder = useMemo(
    () =>
      visibleOrdered(
        layout.sections.side || { order: [], hidden: [] },
        RIGHT_SECTIONS.map((d) => d.id)
      ),
    [layout.sections.side]
  );

  const secOrder = useCallback(
    (id: string, side = false) => {
      const list = side ? rightSectionOrder : leftSectionOrder;
      const i = list.indexOf(id);
      return { order: i < 0 ? 999 : i };
    },
    [leftSectionOrder, rightSectionOrder]
  );

  const visibleTabs = useMemo(() => {
    const v = visibleOrdered(layout.tabs, DEFAULT_TABS.map((t) => t.id));
    return kurulumGoster ? ["kurulum", ...v] : v;
  }, [layout.tabs, kurulumGoster]);

  // Açık sayfa menüde gizlendiyse ilk görünen sayfaya geç
  useEffect(() => {
    if (activeNav === "obs" || visibleTabs.includes(String(activeNav))) return;
    const next = visibleTabs[0];
    if (!next) return;
    setActiveNav(next as NavId);
    if (next === "starting" || next === "ending" || next === "brb" || next === "chat") setScreen(next);
  }, [activeNav, visibleTabs]);

  useEffect(() => {
    if (activeNav === "obs") {
      setActiveNav("profile");
    }
  }, [activeNav]);

  useEffect(() => {
    if (forceNavRef.current && visibleTabs.includes(forceNavRef.current)) {
      forceNavRef.current = null;
    }
  }, [visibleTabs]);
  return { secOrder, sectionHidden, visibleTabs };
}
