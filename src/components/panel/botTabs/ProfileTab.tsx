/** Botaxt Profil / Alt kullanıcılar / Referanslar */

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../lib/api";
import { botaxtApi } from "../../../lib/api/botaxt";
import type { BotConfigV2 } from "../../../lib/smartBot/v2";
import { Btn, Card, Check, Field, Header } from "./ui";

type Common = {
  cfg: BotConfigV2;
  patch: (p: Partial<BotConfigV2>) => void;
  onToast: (m: string) => void;
};

export function ProfileTab({ cfg, patch }: Common) {
  const p = cfg.profile;
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Header title="Profil" sub="Kimlik, dil, platform." />
      <Card>
        <Field
          label="Görünen ad"
          value={p.displayName}
          onChange={(v) => patch({ profile: { ...p, displayName: v } })}
        />
        <Field label="Bot adı" value={cfg.botName} onChange={(v) => patch({ botName: v })} />
        <Field
          label="Kanal"
          value={cfg.channelName}
          onChange={(v) => patch({ channelName: v })}
        />
        <Field
          label="Dil"
          value={p.language}
          onChange={(v) => patch({ profile: { ...p, language: v } })}
        />
        <label className="text-xs text-white/65">
          Ana platform
          <select
            className="yya-input ml-2 inline-block w-auto"
            value={p.primaryPlatform}
            onChange={(e) =>
              patch({
                profile: {
                  ...p,
                  primaryPlatform: e.target.value as typeof p.primaryPlatform,
                },
              })
            }
          >
            <option value="kick">Kick</option>
            <option value="twitch">Twitch</option>
            <option value="youtube">YouTube</option>
          </select>
        </label>
        <Field label="Başlık" value={cfg.title} onChange={(v) => patch({ title: v })} />
        <Field label="Oyun" value={cfg.game} onChange={(v) => patch({ game: v })} />
      </Card>
    </section>
  );
}

export function SubusersTab({ cfg, patch, onToast }: Common) {
  const [users, setUsers] = useState<
    {
      id: string;
      username: string;
      role: string;
      permissions_json: string;
      enabled: number | boolean;
    }[]
  >([]);
  const [bindLan, setBindLan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [u, srv] = await Promise.all([
        botaxtApi.remoteUsers(),
        fetch(`${API_BASE}/api/server`).then((r) => r.json()).catch(() => ({})),
      ]);
      setUsers((u.users || []) as typeof users);
      setBindLan(Boolean((srv as { bindLan?: boolean }).bindLan));
      const remote = (cfg as { remote?: { bindLan?: boolean } }).remote;
      if (remote?.bindLan != null) setBindLan(!!remote.bindLan);
    } catch (e) {
      onToast(String((e as Error).message || "Kullanıcılar yüklenemedi"));
    } finally {
      setBusy(false);
    }
  }, [cfg, onToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistBind = async (v: boolean) => {
    setBindLan(v);
    patch({ ...({ remote: { bindLan: v } } as unknown as Partial<BotConfigV2>) });
    try {
      const cur = await fetch(`${API_BASE}/api/settings?screen=panel`).then((r) =>
        r.json()
      );
      await fetch(`${API_BASE}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen: "panel",
          data: { ...cur, remote: { ...(cur.remote || {}), bindLan: v } },
        }),
      });
      onToast(
        v
          ? "LAN bind açıldı — uygulamayı yeniden başlat (0.0.0.0:8843)"
          : "Yalnızca localhost — yeniden başlat"
      );
    } catch (e) {
      onToast(String((e as Error).message || "Ayar kaydedilemedi"));
    }
  };

  const createMod = async () => {
    if (!newUser.trim() || newPass.length < 4) {
      onToast("Kullanıcı + şifre (min 4)");
      return;
    }
    setBusy(true);
    try {
      if (users.length === 0) {
        await botaxtApi.remoteSetup(newUser.trim(), newPass);
        onToast("İlk admin oluşturuldu");
      } else {
        await botaxtApi.upsertRemoteUser({
          username: newUser.trim(),
          password: newPass,
          role: "moderator",
          permissions: [
            "dashboard",
            "commands",
            "alerts",
            "chat",
            "loyalty",
            "shop",
            "obs",
          ],
          enabled: true,
        });
        onToast("Moderatör eklendi");
      }
      setNewUser("");
      setNewPass("");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Oluşturulamadı"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await botaxtApi.deleteRemoteUser(id);
      onToast("Silindi");
      await load();
    } catch (e) {
      onToast(String((e as Error).message || "Silinemedi"));
    } finally {
      setBusy(false);
    }
  };

  const loginUrl = `${API_BASE}/remote/login`;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Header
        title="Alt kullanıcılar (Uzak erişim)"
        sub="SQLite remote_users · Bearer token · Ngrok/Tailscale"
      />
      <Card>
        <Check
          label="LAN / uzak bağlama (0.0.0.0:8843) — yeniden başlatma gerekir"
          checked={bindLan}
          onChange={(v) => void persistBind(v)}
        />
        <p className="mt-2 text-[11px] text-panel-muted">
          Açıkken moderatörler{" "}
          <code className="text-panel-accent">{loginUrl}</code> adresinden
          giriş yapar. Loopback (bu PC) Bearer istemez; dış IP zorunlu.
        </p>
        <Btn
          tone="ghost"
          className="mt-2"
          onClick={() => {
            void navigator.clipboard.writeText(loginUrl);
            onToast("Giriş URL kopyalandı");
          }}
        >
          URL kopyala
        </Btn>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-white">
          {users.length === 0 ? "İlk yönetici" : "Yeni moderatör"}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Kullanıcı adı" value={newUser} onChange={setNewUser} />
          <Field
            label="Şifre"
            type="password"
            value={newPass}
            onChange={setNewPass}
          />
        </div>
        <Btn className="mt-2" disabled={busy} onClick={() => void createMod()}>
          {users.length === 0 ? "Admin oluştur" : "Moderatör ekle"}
        </Btn>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-panel-border/70">
        <table className="w-full text-left text-xs">
          <thead className="bg-panel-elevated/80 text-panel-muted">
            <tr>
              <th className="px-3 py-2">Kullanıcı</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-panel-border/50">
                <td className="px-3 py-2 text-white">{u.username}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2">
                  {u.enabled === 1 || u.enabled === true ? "aktif" : "kapalı"}
                </td>
                <td className="px-3 py-2 text-right">
                  {u.role !== "admin" && (
                    <button
                      type="button"
                      className="text-red-400"
                      onClick={() => void remove(u.id)}
                    >
                      Sil
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-panel-muted"
                >
                  Henüz uzak kullanıcı yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* legacy local invites gizlendi — SQLite kaynak */}
      <p className="text-[10px] text-panel-muted">
        Eski yerel davet listesi kullanılmıyor; API yüzeyi{" "}
        <code>/api/botaxt/remote/*</code>.
      </p>
    </section>
  );
}

export function ReferralsTab({ cfg, patch, onToast }: Common) {
  const r = cfg.referrals;
  const code =
    r.code ||
    (cfg.channelName || cfg.botName || "yya")
      .toLowerCase()
      .replace(/\W+/g, "")
      .slice(0, 10) ||
    "yya";
  const link = `yya://ref/${code}`;
  const pct = Math.min(100, Math.round((r.points / Math.max(1, r.pointsToNextMonth)) * 100));
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Header
        title="Referanslar"
        sub="Yerel referans kodu ve ilerleme."
      />
      <Card>
        <Field
          label="Kod"
          value={code}
          onChange={(v) => patch({ referrals: { ...r, code: v } })}
        />
        <code className="block break-all text-[11px] text-panel-accent/90">{link}</code>
        <Btn
          onClick={() => {
            void navigator.clipboard.writeText(link);
            onToast("Referans linki kopyalandı");
          }}
        >
          Kopyala
        </Btn>
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-xs text-white/60">
            <span>Premium ayına puan</span>
            <span>
              {r.points} / {r.pointsToNextMonth}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/50">
            <div className="h-full bg-panel-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <Btn
          tone="ghost"
          onClick={() => {
            const user = window.prompt("Davet edilen kullanıcı?") || "";
            if (!user.trim()) return;
            patch({
              referrals: {
                ...r,
                invited: [...r.invited, { user: user.trim(), t: Date.now() }],
                points: r.points + 50,
              },
            });
          }}
        >
          Davet kaydı ekle (+50)
        </Btn>
        <ul className="mt-2 space-y-1 text-xs text-white/70">
          {r.invited.map((i, idx) => (
            <li key={`${i.user}-${idx}`}>{i.user}</li>
          ))}
          {!r.invited.length && <li className="text-white/50">Henüz yok</li>}
        </ul>
      </Card>
    </section>
  );
}
