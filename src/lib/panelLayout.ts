/** Panel üst sekmeleri + sol/sağ ayar kategorilerinin görünürlük/sırası. — AxthrowA */

export type NavId =
  | "profile"
  | "yayin"
  | "control"
  | "starting"
  | "ending"
  | "brb"
  | "chat"
  | "bot"
  | "obs"
  | "music"
  | "sounds"
  | "hotkeys"
  | "settings";

export type SectionId =
  | "metin"
  | "yaziStilleri"
  | "geriSayim"
  | "arkaPlan"
  | "video"
  | "youtube"
  | "fonMuzigi"
  | "logo"
  | "boyutlar"
  | "gorunurluk"
  | "parcacik"
  | "jenerik"
  | "chatAyarlari"
  | "obsUrl"
  | "resonance"
  | "obsWs"
  | "sosyal";

export type SettingsSectionId = "general" | "help" | "about";

export type OrderHidden = { order: string[]; hidden: string[] };

export type PanelLayout = {
  tabs: OrderHidden;
  sections: Record<string, OrderHidden>;
};

export const DEFAULT_TABS: { id: NavId; labelKey: string; label: string }[] = [
  { id: "profile", labelKey: "nav.profile", label: "Dashboard" },
  { id: "yayin", labelKey: "nav.yayin", label: "OBS Studio" },
  { id: "control", labelKey: "nav.control", label: "Kontrol Merkezi" },
  { id: "starting", labelKey: "nav.starting", label: "Giriş" },
  { id: "ending", labelKey: "nav.ending", label: "Çıkış" },
  { id: "brb", labelKey: "nav.brb", label: "Mola (BRB)" },
  { id: "chat", labelKey: "nav.chat", label: "Canlı Chat" },
  { id: "bot", labelKey: "nav.bot", label: "Bot" },
  { id: "music", labelKey: "nav.music", label: "Müzik" },
  { id: "sounds", labelKey: "nav.sounds", label: "Ses Paneli" },
  { id: "hotkeys", labelKey: "nav.hotkeys", label: "Kısayollar" },
  { id: "settings", labelKey: "nav.settings", label: "Ayarlar" },
];

export const LEFT_SECTIONS_SCENE: { id: SectionId; labelKey: string; label: string }[] = [
  { id: "metin", labelKey: "sec.metin", label: "Başlık / metin" },
  { id: "geriSayim", labelKey: "sec.geriSayim", label: "Geri sayım" },
  { id: "arkaPlan", labelKey: "sec.arkaPlan", label: "Arka plan" },
  { id: "video", labelKey: "sec.video", label: "Yerel video" },
  { id: "youtube", labelKey: "sec.youtube", label: "YouTube" },
  { id: "fonMuzigi", labelKey: "sec.fonMuzigi", label: "Fon müziği" },
  { id: "logo", labelKey: "sec.logo", label: "Kanal logosu" },
  { id: "boyutlar", labelKey: "sec.boyutlar", label: "Öğe boyutu" },
  { id: "gorunurluk", labelKey: "sec.gorunurluk", label: "Görünürlük" },
  { id: "parcacik", labelKey: "sec.parcacik", label: "Parçacık efekti" },
  { id: "jenerik", labelKey: "sec.jenerik", label: "Jenerik" },
];

export const LEFT_SECTIONS_CHAT: { id: SectionId; labelKey: string; label: string }[] = [
  { id: "chatAyarlari", labelKey: "sec.chatAyarlari", label: "Chat ayarları" },
];

export const RIGHT_SECTIONS: { id: SectionId; labelKey: string; label: string }[] = [
  { id: "obsUrl", labelKey: "sec.obsUrl", label: "OBS Browser Source" },
  { id: "resonance", labelKey: "sec.resonance", label: "Müzik (Resonance) URL" },
  { id: "obsWs", labelKey: "sec.obsWs", label: "OBS WebSocket" },
  { id: "sosyal", labelKey: "sec.sosyal", label: "Sosyal medya" },
];

export const SETTINGS_SECTIONS: { id: SettingsSectionId; labelKey: string; label: string }[] = [
  { id: "general", labelKey: "settings.general", label: "Genel" },
  { id: "help", labelKey: "settings.help", label: "Yardım" },
  { id: "about", labelKey: "settings.about", label: "Hakkında" },
];

const STORAGE_KEY = "panel.layout";

function defaultOrderHidden(ids: string[]): OrderHidden {
  return { order: [...ids], hidden: [] };
}

export function defaultPanelLayout(): PanelLayout {
  return {
    tabs: defaultOrderHidden(DEFAULT_TABS.map((t) => t.id)),
    sections: {
      starting: defaultOrderHidden(
        LEFT_SECTIONS_SCENE.filter((s) => s.id !== "jenerik").map((s) => s.id)
      ),
      ending: defaultOrderHidden(LEFT_SECTIONS_SCENE.map((s) => s.id)),
      brb: defaultOrderHidden(
        LEFT_SECTIONS_SCENE.filter((s) => s.id !== "jenerik").map((s) => s.id)
      ),
      chat: defaultOrderHidden(LEFT_SECTIONS_CHAT.map((s) => s.id)),
      side: defaultOrderHidden(RIGHT_SECTIONS.map((s) => s.id)),
      settings: defaultOrderHidden(SETTINGS_SECTIONS.map((s) => s.id)),
    },
  };
}

export function loadPanelLayout(): PanelLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPanelLayout();
    const parsed = JSON.parse(raw) as PanelLayout;
    const base = defaultPanelLayout();
    const tabs = mergeOH(base.tabs, parsed.tabs, DEFAULT_TABS.map((t) => t.id));
    const obsWasVisible =
      (parsed.tabs?.order || []).includes("obs") &&
      !(parsed.tabs?.hidden || []).includes("obs");
    if (obsWasVisible) {
      tabs.hidden = (tabs.hidden || []).filter((id) => id !== "profile");
    }
    return {
      tabs,
      sections: {
        ...base.sections,
        ...Object.fromEntries(
          Object.keys(base.sections).map((k) => [
            k,
            mergeOH(
              base.sections[k],
              parsed.sections?.[k],
              base.sections[k].order
            ),
          ])
        ),
      },
    };
  } catch {
    return defaultPanelLayout();
  }
}

export function mergeOH(
  base: OrderHidden,
  patch: OrderHidden | undefined,
  knownIds: string[]
): OrderHidden {
  if (!patch) return base;
  const known = new Set(knownIds);
  const order = (patch.order || []).filter((id) => known.has(id));
  // Kayıtlı düzende olmayan (sonradan eklenen) sekme sona atılmıyor: varsayılan
  // sıradaki bir önceki komşusunun hemen arkasına konur.
  knownIds.forEach((id, i) => {
    if (order.includes(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = order.indexOf(knownIds[j]);
      if (k >= 0) {
        at = k + 1;
        break;
      }
    }
    order.splice(at, 0, id);
  });
  const hidden = (patch.hidden || []).filter((id) => known.has(id));
  return { order, hidden };
}

export function savePanelLayout(layout: PanelLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* */
  }
}

/** Bilinen id’leri sırayla, gizli olanları atlayarak döndürür. */
export function visibleOrdered(oh: OrderHidden, knownIds: string[]): string[] {
  const known = new Set(knownIds);
  const hidden = new Set(oh.hidden || []);
  const ordered = [
    ...(oh.order || []).filter((id) => known.has(id)),
    ...knownIds.filter((id) => !(oh.order || []).includes(id)),
  ];
  return ordered.filter((id) => !hidden.has(id));
}

export function moveInOrder(order: string[], id: string, dir: -1 | 1): string[] {
  const i = order.indexOf(id);
  if (i < 0) return order;
  const j = i + dir;
  if (j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Sürükle-bırak: dragId’yi dropId konumuna taşı. */
export function reorderByDrop(order: string[], dragId: string, dropId: string): string[] {
  if (dragId === dropId) return order;
  const next = [...order];
  const from = next.indexOf(dragId);
  const to = next.indexOf(dropId);
  if (from < 0 || to < 0) return order;
  next.splice(from, 1);
  next.splice(to, 0, dragId);
  return next;
}

