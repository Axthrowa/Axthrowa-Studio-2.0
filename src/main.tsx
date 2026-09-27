import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ObsProvider } from "./lib/obs/ObsContext";
import { EmoteProvider } from "./lib/emotes/EmoteContext";
import { ThemeProvider } from "./lib/theme/ThemeContext";
import { applyPlatformTheme } from "./lib/platformTheme";
import "./styles/index.css";
import "./styles/desktop.css";
import "./styles/overlay.css";

applyPlatformTheme();

/**
 * Panel + OBS HTTP (`http://127.0.0.1:8843/...`) — BrowserRouter.
 * Hash bookmark’ları `index.html` içindeki script path’e çevirir.
 * `vite base: '/'` ile /widgets/cup altında asset yolları kırılmaz.
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <EmoteProvider>
          <ObsProvider>
            <App />
          </ObsProvider>
        </EmoteProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
