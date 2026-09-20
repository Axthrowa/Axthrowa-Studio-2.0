/**
 * Ekran bitiş kuralları — Giriş / Çıkış / Mola ne zaman bitsin?
 *
 * Eskiden bitiş koşulu üç ayrı yerde, dağınık alanlardan çıkarılıyordu:
 * `endingMinutes`, `brbMinutes`, `targetDate`, giriş için kodda sabit 5 dk ve
 * bir de "medya bitişi". "Dakika" ile "medya bitişi" birbirini dışlıyordu ve
 * "video N kez tekrar edince" seçeneği hiç yoktu.
 *
 * Bu modül tek bir bildirimsel kural tanımlar (`obs.endRules[ekran]`) ve eski
 * alanlardan **diske dokunmadan** aynı kuralı türetir; böylece mevcut ayarlar
 * birebir eski davranışı korur.
 *
 * Saf fonksiyonlardan oluşuyor — React ve tarayıcı gerektirmez, testlenebilir.
 */

export type EndScreen = "starting" | "ending" | "brb";

export type EndMode =
  /** Belirli dakika dolunca */
  | "minutes"
  /** Belirli tarih/saate kadar */
  | "targetDate"
  /** Video (veya müzik) bir kez bitince */
  | "mediaEnd"
  /** Video N kez tekrar edince */
  | "mediaLoops"
  /** Süre ya da video bitişi — hangisi önce olursa */
  | "minutesOrMediaEnd"
  /** Kendiliğinden bitmez; kullanıcı elle geçer */
  | "manual";

export type EndRule = {
  mode: EndMode;
  minutes?: number;
  loops?: number;
  /** `targetDate` modunda hedef (yerel `YYYY-MM-DDTHH:mm`). Boşsa ekranın kendi tarihi. */
  targetDate?: string;
  /** Bitişte geçilecek OBS sahnesi (boşsa ekranın mevcut varsayılanı) */
  thenScene?: string;
  /** Çıkış ekranında bitişte yayını kapat */
  stopStream?: boolean;
};

export const END_MODES: { id: EndMode; label: string; hint: string }[] = [
  { id: "minutes", label: "Dakika dolunca", hint: "Belirlenen süre sayılır, dolunca ekran biter." },
  { id: "targetDate", label: "Hedef saate kadar", hint: "Belirli bir tarih/saate kadar geri sayar." },
  { id: "mediaEnd", label: "Video bitince", hint: "Arka plan videosu (veya müzik) sona erince biter." },
  { id: "mediaLoops", label: "Video N kez dönünce", hint: "Video seçtiğin sayıda tekrarlanınca biter." },
  {
    id: "minutesOrMediaEnd",
    label: "Süre veya video bitişi",
    hint: "İkisinden hangisi önce gerçekleşirse ekran o anda biter.",
  },
  { id: "manual", label: "Elle geç", hint: "Kendiliğinden bitmez; sahneyi sen değiştirirsin." },
];

/** Giriş ekranının eski sabit süresi (dk). */
export const STARTING_DEFAULT_MINUTES = 5;
export const MIN_LOOPS = 1;
export const MAX_LOOPS = 99;

/** Overlay'in kullandığı çözümlenmiş, tekdüze görünüm. */
export type ResolvedRule = {
  /** Kural kullanıcı tarafından açıkça seçildi mi? Değilse eski davranış geçerli. */
  explicit: boolean;
  mode: EndMode;
  /** Etkin dakika; 0 = süre sayacı yok */
  minutes: number;
  /** Hedef tarih kullanılacak mı */
  useTargetDate: boolean;
  /** Etkin hedef tarih (yalnız `useTargetDate` iken dolu) */
  targetDate: string;
  /** Medya bitişi ekranı bitirebilir mi (yalnız `explicit` iken anlamlı) */
  usesMedia: boolean;
  /** Kaç tur sonra biteceği (1 = ilk bitişte) */
  loops: number;
  thenScene: string;
  stopStream: boolean | undefined;
};

type LegacyFields = {
  endingMinutes?: unknown;
  brbMinutes?: unknown;
  targetDate?: unknown;
};

type ObsLike = { endRules?: Partial<Record<EndScreen, EndRule | null>> | null } | null | undefined;

const VALID_MODES = new Set<EndMode>(END_MODES.map((m) => m.id));

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Tur sayısını güvenli aralığa çeker. */
export function clampLoops(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return MIN_LOOPS;
  return Math.min(MAX_LOOPS, Math.max(MIN_LOOPS, n));
}

/**
 * Bir ekranın bitiş kuralını çözer.
 *
 * `obs.endRules[screen]` geçerliyse onu kullanır. Yoksa (eski kayıtlar) eski
 * alanlardan türetir ve `explicit: false` döner; çağıran taraf o durumda
 * mevcut medya-bitişi mantığını olduğu gibi sürdürür.
 */
export function resolveEndRule(
  screen: EndScreen,
  obs: ObsLike,
  legacy: LegacyFields
): ResolvedRule {
  const raw = obs?.endRules?.[screen];

  if (raw && typeof raw === "object" && VALID_MODES.has(raw.mode)) {
    const mode = raw.mode;
    const minutes = num(raw.minutes);
    const usesTimer = mode === "minutes" || mode === "minutesOrMediaEnd";
    return {
      explicit: true,
      mode,
      // Süre modunda dakika girilmemişse eski varsayılana düşer ki ekran
      // hiç bitmeyen sessiz bir sayaca dönüşmesin.
      minutes: usesTimer ? minutes || fallbackMinutes(screen, legacy) : 0,
      useTargetDate: mode === "targetDate",
      // Kuralın kendi tarihi öncelikli; boşsa ekranın eski alanına düşer.
      targetDate:
        mode === "targetDate"
          ? String(raw.targetDate || "").trim() || String(legacy.targetDate || "").trim()
          : "",
      usesMedia: mode === "mediaEnd" || mode === "mediaLoops" || mode === "minutesOrMediaEnd",
      loops: mode === "mediaLoops" ? clampLoops(raw.loops ?? 2) : 1,
      thenScene: String(raw.thenScene || "").trim(),
      stopStream: typeof raw.stopStream === "boolean" ? raw.stopStream : undefined,
    };
  }

  // Eski davranış: alanlardan türet. Giriş ekranı targetDate'i yok sayar.
  const hasTarget = screen !== "starting" && !!String(legacy.targetDate || "").trim();
  return {
    explicit: false,
    mode: hasTarget ? "targetDate" : "minutes",
    minutes: hasTarget ? 0 : fallbackMinutes(screen, legacy),
    useTargetDate: hasTarget,
    targetDate: hasTarget ? String(legacy.targetDate || "").trim() : "",
    usesMedia: false,
    loops: 1,
    thenScene: "",
    stopStream: undefined,
  };
}

/** Kural yokken kullanılan eski dakika değeri. */
function fallbackMinutes(screen: EndScreen, legacy: LegacyFields): number {
  if (screen === "starting") return STARTING_DEFAULT_MINUTES;
  if (screen === "brb") return num(legacy.brbMinutes);
  return num(legacy.endingMinutes);
}

/**
 * Video döngü sayacı.
 *
 * `seen` = şimdiye dek tamamlanan tur, `target` = bitişi tetikleyecek tur.
 * `done` true ise kural tamam; değilse çağıran videoyu başa sarıp sürdürür.
 */
export function nextLoopState(seen: number, target: number): { seen: number; done: boolean } {
  const next = Math.max(0, Math.floor(seen)) + 1;
  return { seen: next, done: next >= clampLoops(target) };
}

/**
 * Bir turun iki kez sayılmasını engeller.
 *
 * Bazı WebView'lerde hem `timeupdate` (bitişe 0.2 sn kala) hem `ended`
 * tetikleniyor; ikisi de aynı turu bitirdi diye sayarsa video N yerine N/2
 * turda biter.
 */
export function shouldCountLoop(lastCountedAt: number, now: number, gapMs = 1500): boolean {
  return now - lastCountedAt >= gapMs;
}

/** Kuralı kullanıcıya okunur cümleyle özetler (panel önizlemesi için). */
export function describeRule(r: ResolvedRule): string {
  switch (r.mode) {
    case "minutes":
      return `${r.minutes} dakika sonra biter`;
    case "targetDate":
      return "Hedef saate kadar sayar";
    case "mediaEnd":
      return "Video bitince biter";
    case "mediaLoops":
      return r.loops === 1 ? "Video bitince biter" : `Video ${r.loops} kez dönünce biter`;
    case "minutesOrMediaEnd":
      return `${r.minutes} dakika ya da video bitişi — hangisi önce olursa`;
    case "manual":
      return "Kendiliğinden bitmez";
  }
}

/**
 * Bitişte geçilecek sahne — kuralda seçildiyse o, yoksa çağıranın eski
 * çözümü. Boş/yalnız boşluk olan değer "seçilmedi" sayılır.
 */
export function ruleThenScene(obs: ObsLike, screen: EndScreen, fallback: string): string {
  const raw = obs?.endRules?.[screen];
  const own = raw && typeof raw === "object" ? String(raw.thenScene || "").trim() : "";
  return own || fallback;
}

/**
 * Çıkış bitince yayın kapatılsın mı? Kuralda açıkça seçildiyse o, yoksa eski
 * `stopStreamOnEnd` ayarı (varsayılan: kapat).
 */
export function ruleStopStream(obs: ObsLike & { stopStreamOnEnd?: unknown }): boolean {
  const raw = obs?.endRules?.ending;
  if (raw && typeof raw === "object" && typeof raw.stopStream === "boolean") return raw.stopStream;
  return (obs as { stopStreamOnEnd?: unknown } | null | undefined)?.stopStreamOnEnd !== false;
}
