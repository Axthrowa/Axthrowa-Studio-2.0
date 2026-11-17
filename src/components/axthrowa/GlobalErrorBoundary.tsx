/**
 * Arayüzde yakalanmamış bir hata tüm uygulamayı beyaz ekrana düşürmesin: hata Rust günlüğüne yazılır,
 * kullanıcı günlük dosyasının yerini ve yeniden başlatma düğmesini görür.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowClockwise, Copy, WarningOctagon } from "@phosphor-icons/react";
import { Button } from "./Button";
import { gunluk } from "../../lib/gunluk";
import { API_BASE } from "../../lib/api";
import { PANEL_YOLLARI } from "../../App";

type Durum = { hata: Error | null; gunlukYolu: string };

export default class GlobalErrorBoundary extends Component<{ children: ReactNode }, Durum> {
  state: Durum = { hata: null, gunlukYolu: "" };

  static getDerivedStateFromError(hata: Error): Partial<Durum> {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    gunluk.error(`Arayüz çöktü: ${hata.name}: ${hata.message}\n${hata.stack || ""}\nBileşen:${bilgi.componentStack || ""}`);
    // Yol yalnız bu makineden okunur (OBS kaynağında/uzakta boş kalır)
    fetch(`${API_BASE}/api/gunluk`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { dosya?: string } | null) => j?.dosya && this.setState({ gunlukYolu: j.dosya }))
      .catch(() => {});
  }

  render() {
    const { hata, gunlukYolu } = this.state;
    if (!hata) return this.props.children;
    // OBS tarayıcı kaynakları (overlay, widget) yayında görünür: orada çökme kartı yerine boş (saydam) kalır
    if (!PANEL_YOLLARI.has(window.location.pathname)) return null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-axthrowa-dark bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgb(var(--ui-brand)/0.12),transparent_70%)] p-6 text-zinc-100">
        <div className="relative w-full max-w-xl rounded-2xl bg-axthrowa-card px-8 py-7 shadow-float before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:border-t before:border-white/5">
          <div className="flex items-center gap-3">
            <WarningOctagon weight="duotone" className="h-8 w-8 text-red-400" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-axthrowa-violet">AxthrowA</p>
              <h1 className="text-xl font-semibold tracking-tight">Beklenmeyen bir hata oluştu</h1>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Arayüz durdu; yayınınız ve OBS bundan etkilenmez. Hata günlüğe kaydedildi. Sorun sürerse günlük dosyasını
            destek için paylaşabilirsiniz (belirteçler gizlenmiştir).
          </p>
          <pre className="custom-scrollbar mt-5 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/60 px-4 py-3 font-mono text-xs text-red-300">
            {hata.name}: {hata.message}
          </pre>
          {gunlukYolu ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-950/40 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-400" title={gunlukYolu}>
                {gunlukYolu}
              </span>
              <button
                type="button"
                title="Yolu kopyala"
                className="text-zinc-500 transition-colors hover:text-axthrowa-cyan"
                onClick={() => void navigator.clipboard?.writeText(gunlukYolu).catch(() => {})}
              >
                <Copy weight="bold" className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end">
            {/* Arayüzü baştan yükler; arka plandaki sunucu ve OBS bağlantısı çalışmaya devam eder */}
            <Button onClick={() => window.location.reload()}>
              <ArrowClockwise weight="bold" className="h-4 w-4" />
              Uygulamayı Yeniden Başlat
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
