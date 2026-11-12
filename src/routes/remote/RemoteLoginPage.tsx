/** Uzak moderatör girişi — Bearer session (Ngrok/Tailscale). */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { botApi } from "../../lib/api/botApi";

const TOKEN_KEY = "studio.bot.remoteToken";

export default function RemoteLoginPage() {
  const nav = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const login = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await botApi.remoteLogin(user.trim(), pass);
      const token = String((r as { token?: string }).token || "");
      if (!token) throw new Error("Token alınamadı");
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(
        "studio.bot.remoteUser",
        JSON.stringify({
          username: (r as { username?: string }).username || user,
          role: (r as { role?: string }).role,
          permissions: (r as { permissions?: unknown }).permissions,
        })
      );
      nav("/panel?nav=dashboard&remote=1", { replace: true });
    } catch (e) {
      setErr(String((e as Error).message || "Giriş başarısız"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] px-4 text-white">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#121820] p-6 shadow-xl">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Uzak Panel</h1>
          <p className="mt-1 text-xs text-white/50">
            Moderatör girişi · Bearer oturum (7 gün)
          </p>
        </div>
        <label className="block text-xs text-white/60">
          Kullanıcı adı
          <input
            className="studio-input mt-1 w-full"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-xs text-white/60">
          Şifre
          <input
            type="password"
            className="studio-input mt-1 w-full"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === "Enter") void login();
            }}
          />
        </label>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <button
          type="button"
          disabled={busy || !user.trim() || !pass}
          className="studio-btn w-full"
          onClick={() => void login()}
        >
          {busy ? "Giriş…" : "Giriş yap"}
        </button>
      </div>
    </div>
  );
}
