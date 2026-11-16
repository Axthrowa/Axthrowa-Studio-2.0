/**
 * Bölüm hata sınırı: bir sayfa ya da Canlı kutusu çökerse yalnız o bölge "yüklenemedi, yeniden dene" gösterir;
 * menü ve diğer kutular çalışmaya devam eder. Genel sınır (GlobalErrorBoundary) son çare olarak kalır.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { gunluk } from "../../lib/gunluk";
import { ErrorState } from "./Geribildirim";

type Props = { ad: string; children: ReactNode };
type Durum = { hata: Error | null; deneme: number };

export class HataSiniri extends Component<Props, Durum> {
  state: Durum = { hata: null, deneme: 0 };

  static getDerivedStateFromError(hata: Error): Partial<Durum> {
    return { hata };
  }

  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    gunluk.error(`Bölüm çöktü (${this.props.ad}): ${hata.name}: ${hata.message}\n${hata.stack || ""}\nBileşen:${bilgi.componentStack || ""}`);
  }

  render() {
    const { hata, deneme } = this.state;
    if (!hata) return <HataSiniriIcerik key={deneme}>{this.props.children}</HataSiniriIcerik>;
    return (
      <ErrorState
        live
        title={`${this.props.ad} yüklenemedi`}
        description="Bu bölüm bir hatayla durdu; uygulamanın geri kalanı çalışıyor."
        error={hata}
        onRetry={() => this.setState((d) => ({ hata: null, deneme: d.deneme + 1 }))}
      />
    );
  }
}

// Yeniden denemede alt ağaç sıfırdan takılsın (eski durum aynı hatayı tekrarlamasın)
function HataSiniriIcerik({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
