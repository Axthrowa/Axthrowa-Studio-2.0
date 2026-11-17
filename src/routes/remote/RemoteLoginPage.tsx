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
  // T8: panelin ürettiği tek kullanımlık kodla gelindiyse parola yerine eşleştirme
  const eslestirKodu = new URLSearchParams(window.location.search).get("eslestir") || "";
  const [cihaz, setCihaz] = useState("Telefon");

  const eslestir = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await botApi.eslestirmeTamamla(eslestirKodu, cihaz.trim());
      localStorage.setItem(TOKEN_KEY, r.token);
      localStorage.setItem("studio.bot.remoteUser", JSON.stringify({ username: r.cihaz, role: "cihaz", permissions: r.izinler }));
      nav("/remote", { replace: true });
    } catch (e) {
      setErr(String((e as Error).message || "Eşleştirme başarısız"));
    } finally {
      setBusy(false);
    }
  };

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

  if (eslestirKodu) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ui-bg px-4 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-ui-s1 p-6 shadow-xl">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Cihazı eşleştir</h1>
            <p className="mt-1 text-xs text-white/50">Kod tek kullanımlık; bu cihaz yalnız panelde seçilen izinleri alır.</p>
          </div>
          <label className="block text-xs text-white/60">
            Cihaz adı
            <input className="studio-input mt-1 w-full" maxLength={40} value={cihaz} onChange={(e) => setCihaz(e.target.value)} />
          </label>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button type="button" disabled={busy} className="studio-btn w-full" onClick={() => void eslestir()}>
            {busy ? "Eşleştiriliyor…" : "Eşleştir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ui-bg px-4 text-white">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-ui-s1 p-6 shadow-xl">
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
