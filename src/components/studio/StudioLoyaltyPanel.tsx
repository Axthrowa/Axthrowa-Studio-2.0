/** Studio Loyalty — leaderboard + katsayılar (SQLite). */

import { useCallback, useEffect, useState } from "react";
import { botaxtApi } from "../../lib/api/botaxt";
import { Btn, Check, Field, Header } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

type User = {
  user_key: string;
  user_name: string;
  platform: string;
  points: number;
  xp: number;
  messages: number;
  watch_sec: number;
};

export default function StudioLoyaltyPanel({ onToast }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [pointsName, setPointsName] = useState("puan");
  const [perMsg, setPerMsg] = useState(1);
  const [perInterval, setPerInterval] = useState(2);
  const [intervalSec, setIntervalSec] = useState(300);
  const [subMult, setSubMult] = useState(1.5);
  const [tickEnabled, setTickEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [u, s] = await Promise.all([
        botaxtApi.loyaltyUsers(50),
        botaxtApi.loyaltySettings(),
      ]);
      setUsers((u.users || []) as User[]);
      if (s.points_name) setPointsName(String(s.points_name));
      if (s.points_per_message != null) setPerMsg(Number(s.points_per_message));
      if (s.points_per_interval != null) setPerInterval(Number(s.points_per_interval));
      if (s.interval_sec != null) setIntervalSec(Number(s.interval_sec));
      if (s.sub_multiplier != null) setSubMult(Number(s.sub_multiplier));
      if (s.tick_enabled != null)
        setTickEnabled(s.tick_enabled === true || s.tick_enabled === 1);
    } catch (e) {
      onToast(String((e as Error).message || "Sadakat yüklenemedi"));
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
      await botaxtApi.putLoyaltySettings({
        points_name: pointsName,
        points_per_message: perMsg,
        points_per_interval: perInterval,
        interval_sec: intervalSec,
        sub_multiplier: subMult,
        tick_enabled: tickEnabled,
      });
      onToast("Sadakat ayarları kaydedildi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Kayıt başarısız"));
    } finally {
      setBusy(false);
    }
  };

  const tick = async () => {
    setBusy(true);
    try {
      const r = await botaxtApi.loyaltyTick();
      onToast(
        r.ticked
          ? `Tick · ${r.users_updated || 0} kullanıcı`
          : `Tick atlandı (${r.reason || "—"})`
      );
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Tick başarısız"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header
          title="Sadakat"
          sub="Leaderboard · mesaj/izleme puanı · abone çarpanı"
        />
        <div className="flex gap-2">
          <Btn tone="ghost" disabled={busy} onClick={() => void load()}>
            Yenile
          </Btn>
          <Btn tone="accent" disabled={busy} onClick={() => void tick()}>
            Manuel tick
          </Btn>
        </div>
      </div>

      <div className="yya-card space-y-3">
        <p className="text-xs font-medium text-white">Kazanım katsayıları</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Puan birimi adı" value={pointsName} onChange={setPointsName} />
          <Field
            label="Mesaj başına"
            type="number"
            value={String(perMsg)}
            onChange={(v) => setPerMsg(Number(v) || 0)}
          />
          <Field
            label="Aralık puanı"
            type="number"
            value={String(perInterval)}
            onChange={(v) => setPerInterval(Number(v) || 0)}
          />
          <Field
            label="Aralık (sn) — varsayılan 300"
            type="number"
            value={String(intervalSec)}
            onChange={(v) => setIntervalSec(Number(v) || 300)}
          />
          <Field
            label="Abone çarpanı (örn. 2 = 2x)"
            type="number"
            value={String(subMult)}
            onChange={(v) => setSubMult(Number(v) || 1)}
          />
        </div>
        <Check
          label="Otomatik izleme tick açık (Rust döngü)"
          checked={tickEnabled}
          onChange={setTickEnabled}
        />
        <Btn disabled={busy} onClick={() => void save()}>
          Ayarları kaydet
        </Btn>
      </div>

      <div className="overflow-hidden rounded-2xl border border-panel-border/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-[color:var(--panel-bg-deep)]/80 text-[11px] uppercase tracking-wider text-panel-muted">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Kullanıcı</th>
              <th className="px-3 py-2">{pointsName}</th>
              <th className="px-3 py-2">XP</th>
              <th className="px-3 py-2">Mesaj</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.user_key} className="border-t border-panel-border/50">
                <td className="px-3 py-2 text-panel-muted">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="text-white">{u.user_name}</span>
                  <span className="ml-2 text-[11px] uppercase text-panel-muted">
                    {u.platform}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-panel-accent">{u.points}</td>
                <td className="px-3 py-2 text-panel-muted">{u.xp}</td>
                <td className="px-3 py-2 text-panel-muted">{u.messages}</td>
              </tr>
            ))}
            {!users.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-xs text-panel-muted">
                  Henüz izleyici yok — chat dinlenince dolar
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
