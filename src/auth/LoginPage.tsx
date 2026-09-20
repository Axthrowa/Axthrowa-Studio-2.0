import { useEffect } from "react";
import AuthCard from "./AuthCard";
import { applyPlatformTheme } from "../lib/platformTheme";

/** Botrix.live benzeri ortalanmış OAuth giriş — platform → bot bağlantısı */
export default function LoginPage() {
  useEffect(() => {
    applyPlatformTheme(null);
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c0d10] px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(20,184,166,0.16), transparent 55%), radial-gradient(ellipse 40% 30% at 90% 70%, rgba(88,101,242,0.08), transparent 50%)",
        }}
      />
      <div className="relative z-10 w-full max-w-[400px]">
        <AuthCard />
      </div>
    </div>
  );
}
