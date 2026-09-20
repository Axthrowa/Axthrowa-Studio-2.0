import { Link } from "react-router-dom";
import { useOAuthCallback } from "./useOAuthCallback";

/**
 * OAuth 2.0 callback — URL’den `code` (ve `state` / `error`) yakalar.
 * Gerçek uygulamada burada token exchange (backend) yapılır.
 */
export default function Callback() {
  const { code, state, error, errorDescription, platform, ready } =
    useOAuthCallback();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0c0d10] px-4">
      <div className="w-full max-w-[420px] rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          OAuth callback
        </p>
        <h1 className="mt-2 text-[18px] font-semibold text-white/95">
          {error ? "Yetkilendirme başarısız" : ready ? "Kod alındı" : "Bekleniyor…"}
        </h1>
        <p className="mt-1 text-[13px] text-white/50">
          {platform
            ? `${platform[0].toUpperCase()}${platform.slice(1)} oturumu`
            : "Platform bilgisi state üzerinden çözülecek"}
        </p>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <p className="text-[13px] font-medium text-red-300">{error}</p>
            {errorDescription && (
              <p className="mt-1 text-[12px] text-red-200/70">{errorDescription}</p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-0 divide-y divide-white/5 rounded-lg border border-white/[0.05] bg-black/20">
            <Row label="code" value={code} mono />
            <Row label="state" value={state} mono />
            <Row label="platform" value={platform} />
          </div>
        )}

        {code && (
          <p className="mt-3 text-[12px] leading-relaxed text-white/50">
            Bu <code className="text-emerald-400/80">code</code> değeri sunucuda{" "}
            <code className="text-white/50">client_secret</code> ile access token’a
            çevrilmelidir — client-side’da secret tutmayın.
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Link
            to="/login"
            className="inline-flex h-8 items-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
          >
            Girişe dön
          </Link>
          <Link
            to="/panel"
            className="inline-flex h-8 items-center rounded-md bg-emerald-500 px-3 text-xs font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Panele git
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <span
        className={[
          "max-w-[70%] break-all text-right text-[12px] text-white/85",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value || "—"}
      </span>
    </div>
  );
}
