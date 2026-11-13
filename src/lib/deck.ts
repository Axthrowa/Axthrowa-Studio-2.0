/**
 * Yerleşik dokunmatik deste (Stream Deck benzeri yazılım destesi) — yapılandırma modeli (saf).
 *
 * Her düğme eylem kayıt defterindeki bir eylemi (kimlik + parametreler) çağırır; izin, onay ve denetim günlüğü
 * sunucuda uygulanır. Yapılandırma panel ayarlarında `controlDeck` altında, sürümlü (`version`) saklanır —
 * uzak/mobil arayüz aynı yapılandırmayı kullanabilir. Bozuk ya da bilinmeyen alanlar ayıklanır.
 */

export const DECK_VERSION = 1 as const;
export const DECK_MAX_PAGES = 8;
export const DECK_MAX_BUTTONS = 24;
export const DECK_COLORS = ["slate", "sky", "emerald", "amber", "rose", "violet"] as const;
export type DeckColor = (typeof DECK_COLORS)[number];

export type DeckButton = {
  id: string;
  label: string;
  actionId: string;
  params: Record<string, string>;
  color: DeckColor;
};

export type DeckPage = { id: string; name: string; buttons: DeckButton[] };
/** `rev`: sunucudaki kayıt sürümü (T6 kilidi); kayıt eski sürümle gelirse sunucu 409 döner */
export type DeckConfig = { version: typeof DECK_VERSION; rev?: number; pages: DeckPage[] };

const ID_RE = /^[a-z0-9-]{1,40}$/;
const ACTION_RE = /^[a-z][a-zA-Z]*\.[a-zA-Z]+$/;

function metin(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
}

let sayac = 0;
export function newId(prefix: string): string {
  sayac = (sayac + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${sayac.toString(36)}`.slice(0, 40);
}

export function defaultDeck(): DeckConfig {
  return {
    version: DECK_VERSION,
    pages: [
      {
        id: "ana",
        name: "Ana",
        buttons: [
          { id: "b-pause", label: "Uyarıları duraklat", actionId: "alert.pause", params: {}, color: "amber" },
          { id: "b-resume", label: "Uyarıları sürdür", actionId: "alert.resume", params: {}, color: "emerald" },
          { id: "b-skip", label: "Uyarıyı atla", actionId: "alert.skip", params: {}, color: "slate" },
          { id: "b-replay", label: "Tekrarı kaydet", actionId: "replay.save", params: {}, color: "sky" },
        ],
      },
    ],
  };
}

function parseButton(raw: unknown): DeckButton | null {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = metin(b.id, 40);
  const actionId = metin(b.actionId, 60);
  if (!ID_RE.test(id) || !ACTION_RE.test(actionId)) return null;
  const params: Record<string, string> = {};
  if (b.params && typeof b.params === "object") {
    for (const [k, v] of Object.entries(b.params as Record<string, unknown>).slice(0, 4)) {
      if (/^[a-z]{1,20}$/.test(k)) {
        const t = metin(v, 256);
        if (t) params[k] = t;
      }
    }
  }
  const color = (DECK_COLORS as readonly string[]).includes(String(b.color)) ? (b.color as DeckColor) : "slate";
  return { id, label: metin(b.label, 40) || actionId, actionId, params, color };
}

/** Kayıtlı yapılandırmayı doğrular. Geçersiz kayıt → varsayılan deste (kullanıcı boş ekranla karşılaşmaz). */
export function parseDeck(raw: unknown): DeckConfig {
  const d = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!d || !Array.isArray(d.pages)) return defaultDeck();
  const gorulen = new Set<string>();
  const pages: DeckPage[] = [];
  for (const p of d.pages.slice(0, DECK_MAX_PAGES)) {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const id = metin(o.id, 40);
    if (!ID_RE.test(id) || gorulen.has(id)) continue;
    gorulen.add(id);
    const buttons: DeckButton[] = [];
    const bGorulen = new Set<string>();
    for (const b of Array.isArray(o.buttons) ? o.buttons.slice(0, DECK_MAX_BUTTONS) : []) {
      const x = parseButton(b);
      if (x && !bGorulen.has(x.id)) {
        bGorulen.add(x.id);
        buttons.push(x);
      }
    }
    pages.push({ id, name: metin(o.name, 30) || "Sayfa", buttons });
  }
  const rev = Number(d.rev);
  const deste = pages.length ? { version: DECK_VERSION, pages } : defaultDeck();
  return Number.isInteger(rev) && rev > 0 ? { ...deste, rev } : deste;
}

export function addButton(deck: DeckConfig, pageId: string, b: Omit<DeckButton, "id">): DeckConfig {
  return {
    ...deck,
    pages: deck.pages.map((p) =>
      p.id === pageId && p.buttons.length < DECK_MAX_BUTTONS ? { ...p, buttons: [...p.buttons, { ...b, id: newId("b") }] } : p
    ),
  };
}

/** Düğmenin etiket, eylem, parametre ya da rengini değiştirir (sağ tık Düzenle / Renk) */
export function updateButton(deck: DeckConfig, pageId: string, buttonId: string, patch: Partial<Omit<DeckButton, "id">>): DeckConfig {
  return { ...deck, pages: deck.pages.map((p) => (p.id === pageId ? { ...p, buttons: p.buttons.map((b) => (b.id === buttonId ? { ...b, ...patch } : b)) } : p)) };
}

/** Düğmenin kopyası hemen arkasına (sağ tık Kopyala); sayfa doluysa değişmez */
export function duplicateButton(deck: DeckConfig, pageId: string, buttonId: string): DeckConfig {
  return {
    ...deck,
    pages: deck.pages.map((p) => {
      const i = p.buttons.findIndex((b) => b.id === buttonId);
      if (p.id !== pageId || i < 0 || p.buttons.length >= DECK_MAX_BUTTONS) return p;
      const buttons = [...p.buttons];
      buttons.splice(i + 1, 0, { ...p.buttons[i], params: { ...p.buttons[i].params }, id: newId("b") });
      return { ...p, buttons };
    }),
  };
}

/** Yer olan ilk sayfaya ekler (sahnenin "Desteye ekle"si); hiçbir sayfada yer yoksa null */
export function addToFirstFree(deck: DeckConfig, b: Omit<DeckButton, "id">): { deck: DeckConfig; page: string } | null {
  const p = deck.pages.find((x) => x.buttons.length < DECK_MAX_BUTTONS);
  return p ? { deck: addButton(deck, p.id, b), page: p.name } : null;
}

export function nextColor(c: DeckColor): DeckColor {
  return DECK_COLORS[(DECK_COLORS.indexOf(c) + 1) % DECK_COLORS.length];
}

export function removeButton(deck: DeckConfig, pageId: string, buttonId: string): DeckConfig {
  return { ...deck, pages: deck.pages.map((p) => (p.id === pageId ? { ...p, buttons: p.buttons.filter((b) => b.id !== buttonId) } : p)) };
}

export function moveButton(deck: DeckConfig, pageId: string, buttonId: string, delta: -1 | 1): DeckConfig {
  return {
    ...deck,
    pages: deck.pages.map((p) => {
      if (p.id !== pageId) return p;
      const i = p.buttons.findIndex((b) => b.id === buttonId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= p.buttons.length) return p;
      const buttons = [...p.buttons];
      [buttons[i], buttons[j]] = [buttons[j], buttons[i]];
      return { ...p, buttons };
    }),
  };
}

export function addPage(deck: DeckConfig, name: string): DeckConfig {
  if (deck.pages.length >= DECK_MAX_PAGES) return deck;
  return { ...deck, pages: [...deck.pages, { id: newId("p"), name: metin(name, 30) || "Sayfa", buttons: [] }] };
}

export function removePage(deck: DeckConfig, pageId: string): DeckConfig {
  const pages = deck.pages.filter((p) => p.id !== pageId);
  return pages.length ? { ...deck, pages } : deck;
}
