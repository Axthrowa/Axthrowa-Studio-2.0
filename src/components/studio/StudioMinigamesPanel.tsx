/** Studio Minigames — heist / roulette / duel (SQLite game_settings). */

import { useCallback, useEffect, useState } from "react";
import { botaxtApi } from "../../lib/api/botaxt";
import { Btn, Check, Field, Header } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

type HeistCfg = {
  enabled: boolean;
  win_chance: number;
  multiplier: number;
  gather_sec: number;
  cooldown_sec: number;
  min_bet: number;
  max_bet: number;
};

type RouletteCfg = {
  enabled: boolean;
  cooldown_sec: number;
  color_mult: number;
  green_mult: number;
  number_mult: number;
  max_bet: number;
};

type DuelCfg = {
  enabled: boolean;
  win_chance: number;
  multiplier: number;
  cooldown_sec: number;
  accept_sec: number;
  max_bet: number;
};

const HEIST_DEF: HeistCfg = {
  enabled: true,
  win_chance: 0.5,
  multiplier: 2,
  gather_sec: 120,
  cooldown_sec: 60,
  min_bet: 10,
  max_bet: 5000,
};

const ROULETTE_DEF: RouletteCfg = {
  enabled: true,
  cooldown_sec: 15,
  color_mult: 2,
  green_mult: 14,
  number_mult: 14,
  max_bet: 5000,
};

const DUEL_DEF: DuelCfg = {
  enabled: true,
  win_chance: 0.5,
  multiplier: 2,
  cooldown_sec: 30,
  accept_sec: 60,
  max_bet: 5000,
};

function merge<T extends object>(base: T, raw: unknown): T {
  if (!raw || typeof raw !== "object") return { ...base };
  return { ...base, ...(raw as Partial<T>) };
}

export default function StudioMinigamesPanel({ onToast }: Props) {
  const [heist, setHeist] = useState<HeistCfg>(HEIST_DEF);
  const [roulette, setRoulette] = useState<RouletteCfg>(ROULETTE_DEF);
  const [duel, setDuel] = useState<DuelCfg>(DUEL_DEF);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const s = await botaxtApi.gamesSettings();
      const cfg =
        typeof s === "object" && s && "config_json" in s
          ? (() => {
              try {
                return JSON.parse(String((s as { config_json: string }).config_json || "{}"));
              } catch {
                return {};
              }
            })()
          : (s as Record<string, unknown>) || {};
      setHeist(merge(HEIST_DEF, cfg.heist));
      setRoulette(merge(ROULETTE_DEF, cfg.roulette));
      setDuel(merge(DUEL_DEF, cfg.duel));
    } catch (e) {
      onToast(String((e as Error).message || "Oyun ayarları yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await botaxtApi.putGamesSettings({
        heist: {
          ...heist,
          win_chance: Math.min(1, Math.max(0, heist.win_chance)),
        },
        roulette,
        duel: {
          ...duel,
          win_chance: Math.min(1, Math.max(0, duel.win_chance)),
        },
      });
      onToast("Minigame ayarları kaydedildi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header
          title="Minigames"
          sub="!heist · !roulette · !duel — şans, çarpan, bekleme"
        />
        <div className="flex gap-2">
          <Btn tone="ghost" disabled={busy} onClick={() => void load()}>
            Yenile
          </Btn>
          <Btn disabled={busy} onClick={() => void save()}>
            Kaydet
          </Btn>
        </div>
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Heist (Soygun)</div>
          <Check
            label="Açık"
            checked={heist.enabled}
            onChange={(v) => setHeist({ ...heist, enabled: v })}
          />
        </div>
        <p className="text-[11px] text-panel-muted">
          Toplanma süresi dolunca RNG; chat loop <code>tokio::spawn</code> ile
          bloklanmaz.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field
            label="Kazanma şansı (0–1)"
            type="number"
            value={String(heist.win_chance)}
            onChange={(v) => setHeist({ ...heist, win_chance: Number(v) || 0 })}
          />
          <Field
            label="Çarpan"
            type="number"
            value={String(heist.multiplier)}
            onChange={(v) => setHeist({ ...heist, multiplier: Number(v) || 2 })}
          />
          <Field
            label="Toplanma (sn)"
            type="number"
            value={String(heist.gather_sec)}
            onChange={(v) => setHeist({ ...heist, gather_sec: Number(v) || 120 })}
          />
          <Field
            label="Min bahis"
            type="number"
            value={String(heist.min_bet)}
            onChange={(v) => setHeist({ ...heist, min_bet: Number(v) || 10 })}
          />
          <Field
            label="Max bahis"
            type="number"
            value={String(heist.max_bet)}
            onChange={(v) => setHeist({ ...heist, max_bet: Number(v) || 5000 })}
          />
          <Field
            label="Cooldown (sn)"
            type="number"
            value={String(heist.cooldown_sec)}
            onChange={(v) => setHeist({ ...heist, cooldown_sec: Number(v) || 60 })}
          />
        </div>
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Roulette</div>
          <Check
            label="Açık"
            checked={roulette.enabled}
            onChange={(v) => setRoulette({ ...roulette, enabled: v })}
          />
        </div>
        <p className="text-[11px] text-panel-muted">
          !roulette &lt;puan&gt; &lt;red|black|green|0-36&gt;
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field
            label="Renk çarpanı"
            type="number"
            value={String(roulette.color_mult)}
            onChange={(v) =>
              setRoulette({ ...roulette, color_mult: Number(v) || 2 })
            }
          />
          <Field
            label="Yeşil çarpan"
            type="number"
            value={String(roulette.green_mult)}
            onChange={(v) =>
              setRoulette({ ...roulette, green_mult: Number(v) || 14 })
            }
          />
          <Field
            label="Sayı çarpan"
            type="number"
            value={String(roulette.number_mult)}
            onChange={(v) =>
              setRoulette({ ...roulette, number_mult: Number(v) || 14 })
            }
          />
          <Field
            label="Max bahis"
            type="number"
            value={String(roulette.max_bet)}
            onChange={(v) =>
              setRoulette({ ...roulette, max_bet: Number(v) || 5000 })
            }
          />
          <Field
            label="Cooldown (sn)"
            type="number"
            value={String(roulette.cooldown_sec)}
            onChange={(v) =>
              setRoulette({ ...roulette, cooldown_sec: Number(v) || 15 })
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-white">Duel</div>
          <Check
            label="Açık"
            checked={duel.enabled}
            onChange={(v) => setDuel({ ...duel, enabled: v })}
          />
        </div>
        <p className="text-[11px] text-panel-muted">
          !duel @kullanıcı &lt;puan&gt; · kabul: !accept
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field
            label="A kazanç şansı"
            type="number"
            value={String(duel.win_chance)}
            onChange={(v) => setDuel({ ...duel, win_chance: Number(v) || 0.5 })}
          />
          <Field
            label="Çarpan"
            type="number"
            value={String(duel.multiplier)}
            onChange={(v) => setDuel({ ...duel, multiplier: Number(v) || 2 })}
          />
          <Field
            label="Kabul süresi (sn)"
            type="number"
            value={String(duel.accept_sec)}
            onChange={(v) => setDuel({ ...duel, accept_sec: Number(v) || 60 })}
          />
          <Field
            label="Max bahis"
            type="number"
            value={String(duel.max_bet)}
            onChange={(v) => setDuel({ ...duel, max_bet: Number(v) || 5000 })}
          />
          <Field
            label="Cooldown (sn)"
            type="number"
            value={String(duel.cooldown_sec)}
            onChange={(v) => setDuel({ ...duel, cooldown_sec: Number(v) || 30 })}
          />
        </div>
      </div>
    </section>
  );
}
