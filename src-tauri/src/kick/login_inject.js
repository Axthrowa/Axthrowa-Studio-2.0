(function () {
  // Cloudflare Turnstile / Kick login iframe’lerine DOKUNMA.
  // Eski inject iframe siliyordu → "bilinmeyen bir hata, tekrar deneyin".

  try {
    Object.defineProperty(navigator, "webdriver", {
      get: function () {
        return undefined;
      },
    });
  } catch (_) {}

  function isLoginContext() {
    try {
      var host = (location.hostname || "").toLowerCase();
      var path = (location.pathname || "").toLowerCase();
      var href = (location.href || "").toLowerCase();
      if (host.indexOf("id.kick.com") >= 0) return true;
      if (path.indexOf("/login") >= 0 || path.indexOf("/sign") >= 0) return true;
      if (href.indexOf("turnstile") >= 0 || href.indexOf("challenge") >= 0) return true;
      if (href.indexOf("cloudflare") >= 0) return true;
      return false;
    } catch (_) {
      return true;
    }
  }

  function muteStreamPlayersOnly() {
    if (isLoginContext()) return;
    try {
      document.querySelectorAll("video").forEach(function (el) {
        try {
          // Sadece büyük oynatıcılar (canlı yayın) — küçük captcha medyasına dokunma
          var w = el.clientWidth || 0;
          var h = el.clientHeight || 0;
          if (w >= 240 && h >= 140) {
            el.muted = true;
            el.volume = 0;
            el.pause();
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  function looksLoggedIn() {
    try {
      if (
        localStorage.getItem("user") ||
        localStorage.getItem("session_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("accessToken")
      ) {
        return true;
      }
    } catch (_) {}
    try {
      var host = (location.hostname || "").toLowerCase();
      var path = (location.pathname || "").toLowerCase();
      if (host === "kick.com" || host.endsWith(".kick.com")) {
        if (host.indexOf("id.kick.com") >= 0) return false;
        if (path.indexOf("/login") >= 0 || path.indexOf("/sign") >= 0) return false;
        if (
          path === "/" ||
          path.indexOf("/dashboard") >= 0 ||
          path.indexOf("/settings") >= 0
        ) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function signal() {
    if (window.__yyaKickSignaled) return;
    window.__yyaKickSignaled = true;
    try {
      location.href = "http://127.0.0.1:8843/api/kick/auth-signal";
    } catch (_) {}
  }

  // Giriş ekranında agresif media/iframe müdahalesi YOK.
  // Yalnızca giriş sonrası (anasayfa) büyük videoları sustur.
  setInterval(function () {
    if (!isLoginContext()) muteStreamPlayersOnly();
    if (looksLoggedIn()) signal();
  }, 2800);
})();
