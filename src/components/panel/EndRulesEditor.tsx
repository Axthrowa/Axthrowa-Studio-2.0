import { useMemo } from "react";
import {
  END_MODES,
  MAX_LOOPS,
  MIN_LOOPS,
  clampLoops,
  describeRule,
  resolveEndRule,
  type EndMode,
  type EndRule,
  type EndScreen,
} from "../../lib/endRules";

/**
 * Ekran başına "bu ekran ne zaman bitsin?" seçimi.
 *
 * OBS WebSocket kartında duruyor çünkü bitiş, OBS'te sahne geçişini de
 * tetikliyor. Kural `obs.endRules` altına yazılıyor; `obs` bloğu tüm ekranlar
 * arasında paylaşıldığı için Giriş/Çıkış/Mola aynı kaynaktan okuyor.
 */

type Rules = Partial<Record<EndScreen, EndRule | null>>;
type LegacyFields = { endingMinutes?: unknown; brbMinutes?: unknown; targetDate?: unknown };

type Props = {
  /** `settings.obs` — yalnız `endRules` okunur */
  obs: { endRules?: Rules } | null | undefined;
  /**
   * Her ekranın **kendi** eski alanları (kural yokken varsayılanı göstermek
   * için). Dashboard'daki `settings` yalnız aktif ekrana ait olduğundan Çıkış ve
   * Mola'nın dakika/tarihi buradan ayrı ayrı gelmeli.
   */
  legacy: Partial<Record<EndScreen, LegacyFields>>;
  /** OBS'ten okunan sahne adları — bağlı değilse boş, serbest yazıma izin verilir. */
  scenes?: string[];
  /** Tüm kural nesnesini geri yazar — kısmi değil, bütün. */
  onChange: (next: Rules) => void;
};

const SCREENS: { id: EndScreen; label: string }[] = [
  { id: "starting", label: "Giriş" },
  { id: "ending", label: "Çıkış" },
  { id: "brb", label: "Mola" },
];

const field =
  "yya-input mt-0.5 h-8 w-full text-xs";

export default function EndRulesEditor({ obs, legacy, scenes = [], onChange }: Props) {
  const rules: Rules = useMemo(() => obs?.endRules || {}, [obs?.endRules]);

  const patch = (screen: EndScreen, part: Partial<EndRule>) => {
    const cur = rules[screen];
    // Kural ilk kez düzenleniyorsa, ekranın şu anki davranışından başla:
    // kullanıcı bir alanı değiştirince diğerleri sıfırlanmasın.
    const resolved = resolveEndRule(screen, obs, legacy[screen] || {});
    const base: EndRule = cur || {
      mode: resolved.mode,
      minutes: resolved.minutes || undefined,
      targetDate: resolved.targetDate || undefined,
    };
    onChange({ ...rules, [screen]: { ...base, ...part } });
  };

  const reset = (screen: EndScreen) => {
    // Anahtarı silmiyoruz, `null` yazıyoruz: `obs` ekranlar arasında birleştirme
    // (deep_merge) ile yansıtılıyor ve birleştirme silinen anahtarı diğer
    // ekranlarda geri getirirdi. `null` değeri ezer; çözümleyici bunu
    // "kural yok" sayıp eski davranışa döner.
    onChange({ ...rules, [screen]: null });
  };

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-panel-border/70 bg-black/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold text-white">Bitiş kuralı</h4>
        <span className="text-[10px] text-panel-muted">Ekran ne zaman bitsin?</span>
      </div>

      {SCREENS.map(({ id, label }) => {
        const rule = rules[id];
        const r = resolveEndRule(id, obs, legacy[id] || {});
        const mode: EndMode | "" = rule?.mode || "";
        const hint = END_MODES.find((m) => m.id === mode)?.hint;

        return (
          <div key={id} className="rounded-md border border-white/[0.06] bg-black/20 p-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-10 shrink-0 text-[11px] font-medium text-white">{label}</span>
              <select
                className={field}
                value={mode}
                onChange={(e) => {
                  const v = e.target.value as EndMode | "";
                  if (!v) reset(id);
                  else patch(id, { mode: v });
                }}
                aria-label={`${label} bitiş koşulu`}
              >
                <option value="">Varsayılan (eski ayarlar)</option>
                {END_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {(mode === "minutes" || mode === "minutesOrMediaEnd") && (
              <label className="mt-1 block text-[11px] text-panel-muted">
                Süre (dakika)
                <input
                  className={field}
                  type="number"
                  min={1}
                  value={rule?.minutes ?? (r.minutes || "")}
                  onChange={(e) =>
                    patch(id, { minutes: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </label>
            )}

            {mode === "mediaLoops" && (
              <label className="mt-1 block text-[11px] text-panel-muted">
                Video kaç kez dönünce bitsin? ({MIN_LOOPS}–{MAX_LOOPS})
                <input
                  className={field}
                  type="number"
                  min={MIN_LOOPS}
                  max={MAX_LOOPS}
                  value={rule?.loops ?? 2}
                  onChange={(e) => patch(id, { loops: clampLoops(e.target.value) })}
                />
              </label>
            )}

            {mode === "targetDate" && (
              <label className="mt-1 block text-[11px] text-panel-muted">
                Hedef tarih ve saat
                <input
                  className={field}
                  type="datetime-local"
                  value={rule?.targetDate ?? r.targetDate ?? ""}
                  onChange={(e) => patch(id, { targetDate: e.target.value })}
                />
              </label>
            )}

            {mode !== "" && mode !== "manual" && (
              <label className="mt-1 block text-[11px] text-panel-muted">
                Bitince geçilecek OBS sahnesi
                <input
                  className={field}
                  list={`end-scenes-${id}`}
                  value={rule?.thenScene ?? ""}
                  placeholder="Boş = ekranın varsayılan sahnesi"
                  onChange={(e) => patch(id, { thenScene: e.target.value })}
                />
                <datalist id={`end-scenes-${id}`}>
                  {scenes.map((sc) => (
                    <option key={sc} value={sc} />
                  ))}
                </datalist>
              </label>
            )}

            {id === "ending" && mode !== "" && mode !== "manual" && (
              <label className="mt-1 block text-[11px] text-panel-muted">
                Bitince yayın
                <select
                  className={field}
                  value={typeof rule?.stopStream === "boolean" ? String(rule.stopStream) : ""}
                  onChange={(e) =>
                    patch(id, {
                      stopStream: e.target.value === "" ? undefined : e.target.value === "true",
                    })
                  }
                >
                  <option value="">Varsayılan (kapat)</option>
                  <option value="true">Kapatılsın</option>
                  <option value="false">Açık kalsın</option>
                </select>
              </label>
            )}

            <p className="mt-1 text-[10px] leading-snug text-panel-muted">
              {hint ? `${hint} ` : ""}
              <span className="text-white/80">
                {rule ? describeRule(r) : `Şu an: ${describeRule(r)}`}
              </span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
