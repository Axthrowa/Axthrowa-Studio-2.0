import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import GlobalErrorBoundary from "./components/axthrowa/GlobalErrorBoundary";
import { ObsProvider } from "./lib/obs/ObsContext";
import { EmoteProvider } from "./lib/emotes/EmoteContext";
import { ThemeProvider } from "./lib/theme/ThemeContext";
import { applyPlatformTheme } from "./lib/platformTheme";
import { oku as erisimOku, uygula as erisimUygula } from "./lib/erisilebilirlik";
import { anaPencereyiHatirla } from "./lib/anaPencere";
import { analitikBaslat } from "./lib/analitik";
// Üst şerit yazı tipi: yerel paket, ağdan yükleme yok
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./styles/index.css";
import "./styles/ust-serit.css";
import "./styles/desktop.css";
import "./styles/overlay.css";

applyPlatformTheme();
// Erişilebilirlik renkleri (OBS dock'ları da bu girişten açılır)
erisimUygula(erisimOku());
// Ana pencerenin konum/boyutu (yalnız masaüstü uygulamasının ana penceresinde)
void anaPencereyiHatirla();
// Anonim analitik: yalnız masaüstünde, derlemede anahtar ve kullanıcı izni varsa (yoksa kütüphane hiç yüklenmez)
void analitikBaslat();

/**
 * Panel + OBS HTTP (`http://127.0.0.1:8843/...`) — BrowserRouter.
 * Hash bookmark’ları `index.html` içindeki script path’e çevirir.
 * `vite base: '/'` ile /widgets/cup altında asset yolları kırılmaz.
 */
// Güncellemeden sonra açık kalan sayfa, artık sunucuda olmayan eski parçayı isterse kendini bir kez yeniler
window.addEventListener("vite:preloadError", (e) => {
  const anahtar = "yya.parcaYenilendi";
  try {
    if (sessionStorage.getItem(anahtar) === __YYA_SURUM__) return;
    sessionStorage.setItem(anahtar, __YYA_SURUM__);
  } catch {
    return;
  }
  e.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
        <EmoteProvider>
          <ObsProvider>
            <App />
          </ObsProvider>
        </EmoteProvider>
      </ThemeProvider>
    </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>
);
