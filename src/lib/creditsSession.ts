import { CreditSection } from "../components/overlay/CreditsRoller";

export type CreditsBucket = "donors" | "subscribers" | "followers";

export type CreditsSession = {
  donors: string[];
  subscribers: string[];
  followers: string[];
};

const STORAGE_KEY = "yya-credits-session-v1";
const MAX_PER = 80;

const listeners = new Set<() => void>();

function empty(): CreditsSession {
  return { donors: [], subscribers: [], followers: [] };
}

function load(): CreditsSession {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return {
      donors: Array.isArray(parsed.donors) ? parsed.donors.map(String) : [],
      subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers.map(String) : [],
      followers: Array.isArray(parsed.followers) ? parsed.followers.map(String) : [],
    };
  } catch {
    return empty();
  }
}

let state: CreditsSession = load();

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* */
  }
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      /* */
    }
  }
}

export function getCreditsSession(): CreditsSession {
  return {
    donors: state.donors.slice(),
    subscribers: state.subscribers.slice(),
    followers: state.followers.slice(),
  };
}

export function clearCreditsSession() {
  state = empty();
  persist();
}

export function subscribeCreditsSession(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function normKey(s: string) {
  return s.trim().toLocaleLowerCase("tr");
}

/** İsmi ilgili kovaya ekler (büyük/küçük harf duyarsız tekilleştirme). */
export function pushCredit(bucket: CreditsBucket, name: string) {
  const line = String(name || "").trim();
  if (!line) return;
  const key = normKey(line);
  const list = state[bucket];
  if (list.some((x) => normKey(x) === key)) return;
  state = {
    ...state,
    [bucket]: [...list, line].slice(-MAX_PER),
  };
  persist();
}

const TITLE_MATCH: Record<CreditsBucket, RegExp[]> = {
  donors: [/destek/i, /bağış/i, /bagis/i, /donat/i, /super\s*chat/i, /cheer/i, /bits/i],
  subscribers: [/abone/i, /üyelik/i, /uyelik/i, /sub/i, /member/i],
  followers: [/takip/i, /follow/i, /raid/i],
};

const DEFAULT_TITLES: Record<CreditsBucket, string> = {
  donors: "Destekçiler",
  subscribers: "Yeni Aboneler",
  followers: "Yeni Takipçiler",
};

function findSectionIndex(sections: CreditSection[], bucket: CreditsBucket): number {
  const patterns = TITLE_MATCH[bucket];
  return sections.findIndex((s) => patterns.some((re) => re.test(String(s.title || ""))));
}

function mergeLines(manual: string[], auto: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of [...manual, ...auto]) {
    const t = String(line || "").trim();
    if (!t) continue;
    const k = normKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Manuel jenerik bölümlerine oturum boyunca toplanan isimleri ekler.
 * Eşleşen başlık yoksa varsayılan bölümü oluşturur.
 */
export function mergeAutoCreditSections(
  base: CreditSection[],
  session: CreditsSession,
  enabled = true
): CreditSection[] {
  if (!enabled) return base;
  const sections = base.map((s) => ({
    ...s,
    lines: [...(s.lines || [])],
  }));

  (Object.keys(DEFAULT_TITLES) as CreditsBucket[]).forEach((bucket) => {
    const auto = session[bucket] || [];
    if (!auto.length) return;
    let idx = findSectionIndex(sections, bucket);
    if (idx < 0) {
      sections.push({ title: DEFAULT_TITLES[bucket], lines: [] });
      idx = sections.length - 1;
    }
    sections[idx] = {
      ...sections[idx],
      lines: mergeLines(sections[idx].lines || [], auto),
    };
  });

  return sections;
}

export function creditsSessionCounts(session: CreditsSession = getCreditsSession()) {
  return {
    donors: session.donors.length,
    subscribers: session.subscribers.length,
    followers: session.followers.length,
  };
}
