/* ---------------------------------------------------------
   OBS Giriş / Çıkış Ekranı (Starting Soon / Ending Soon overlay)
   body[data-obs-screen="outro"] → çıkış ekranı; aksi halde giriş.
   URL'ye ?obs=1 eklenirse ayar paneli tamamen gizlenir ve
   sayfa temiz bir OBS Browser Source çıktısı verir.
--------------------------------------------------------- */

const OBS_SCREEN = (document.body && document.body.dataset.obsScreen) === "outro" ? "outro" : "intro";
const IS_OUTRO = OBS_SCREEN === "outro";
const OBS_STORAGE_KEY = IS_OUTRO ? "ygy_obs_outro_settings" : "ygy_obs_settings";
const SETTINGS_API = IS_OUTRO ? "/api/settings?screen=outro" : "/api/settings";
const SETTINGS_META_API = IS_OUTRO ? "/api/settings/meta?screen=outro" : "/api/settings/meta";
const UPLOAD_VIDEO_API = IS_OUTRO ? "/api/upload-video?screen=outro" : "/api/upload-video";
const MAIN_DRAFT_KEY = "ygy_draft";

const SOCIAL_META = {
  twitch: {
    label: "Twitch", color: "#9146ff", mono: "Tw", iconFill: "#ffffff",
    icon: '<path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>',
  },
  youtube: {
    label: "YouTube", color: "#ff0000", mono: "Yt", iconFill: "#ffffff",
    icon: '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
  },
  kick: {
    label: "Kick", color: "#53fc18", mono: "Kk", iconFill: "#06210a",
    icon: '<path d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z"/>',
  },
  x: {
    label: "X", color: "#ffffff", mono: "X", iconFill: "#000000",
    icon: '<path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/>',
  },
  instagram: {
    label: "Instagram", color: "#e1306c", mono: "Ig", iconFill: "#ffffff",
    icon: '<path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/>',
  },
  discord: {
    label: "Discord", color: "#5865f2", mono: "Ds", iconFill: "#ffffff",
    icon: '<path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>',
  },
  tiktok: {
    label: "TikTok", color: "#25f4ee", mono: "Tt", iconFill: "#000000",
    icon: '<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>',
  },
};

function defaultSettings() {
  const socials = {};
  Object.keys(SOCIAL_META).forEach(key => {
    socials[key] = { enabled: false, handle: "" };
  });
  socials.twitch.enabled = true;
  const base = {
    eyebrow: IS_OUTRO ? "YAYIN BİTTİ" : "YAYIN BAŞLIYOR",
    title: IS_OUTRO ? "İzlediğiniz için teşekkürler!" : "Yayın Başlığı Buraya Gelecek",
    sub: IS_OUTRO ? "Bir sonraki yayında görüşmek üzere" : "Sohbete katılın, birlikte eğlenelim",
    ticker: "",
    liveText: IS_OUTRO ? "YİNE GÖRÜŞÜRÜZ" : "CANLI YAYINDA",
    targetDate: "",
    accent: "#7c5cff",
    textColor: "#ffffff",
    eyebrowColor: "#b39dff",
    subColor: "#c9cddb",
    countdownColor: "#ffffff",
    tickerColor: "#9aa0b4",
    font: "system",
    bgStyle: "mix",
    bgImage: null,
    bgVideo: null,
    bgVideoStart: 0,
    bgVideoEnd: 0,
    youtubeUrl: "",
    youtubeStart: 0,
    youtubeEnd: 0,
    particles: true,
    // Parçacık tipleri artık assets/particles/ klasöründen dinamik olarak
    // keşfediliyor; burada sabit bir liste tutmuyoruz (bkz. loadParticleManifest).
    particleTypes: {},
    particleSizes: {},
    transparent: false,
    videoSound: false,
    videoVolume: 100,
    logo: null,
    logoFit: true,
    logoFrame: true,
    logoZoom: 100,
    logoPanX: 0,
    logoPanY: 0,
    socials,
    positions: {
      logo: { x: 50, y: 22 },
      title: { x: 50, y: 44 },
      countdown: { x: 50, y: 64 },
      socials: { x: 50, y: 80 },
      ticker: { x: 50, y: 90 },
    },
    sizes: {
      logo: 100,
      title: 100,
      countdown: 100,
      socials: 100,
      ticker: 100,
    },
    visible: {
      logo: true,
      title: true,
      countdown: true,
      socials: true,
      ticker: true,
    },
    textStyles: {
      eyebrow: { font: "", size: 100, effect: "none", anim: "none" },
      title: { font: "", size: 100, effect: "none", anim: "none" },
      sub: { font: "", size: 100, effect: "none", anim: "none" },
      countdown: { font: "", size: 100, effect: "none", anim: "none" },
      ticker: { font: "", size: 100, effect: "none", anim: "none" },
    },
  };
  return base;
}

const FONT_STACKS = {
  system: '"Segoe UI", system-ui, -apple-system, sans-serif',
  pixel8: '"Press Start 2P", monospace',
  terminal: '"VT323", monospace',
  futuristic: '"Orbitron", sans-serif',
  bold: '"Bebas Neue", sans-serif',
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function mergeWithDefaults(parsed) {
  const base = defaultSettings();
  return {
    ...base,
    ...parsed,
    socials: { ...base.socials, ...(parsed.socials || {}) },
    positions: { ...base.positions, ...(parsed.positions || {}) },
    sizes: { ...base.sizes, ...(parsed.sizes || {}) },
    visible: { ...base.visible, ...(parsed.visible || {}) },
    particleTypes: { ...base.particleTypes, ...(parsed.particleTypes || {}) },
    particleSizes: { ...base.particleSizes, ...(parsed.particleSizes || {}) },
    textStyles: Object.keys(base.textStyles).reduce((acc, key) => {
      acc[key] = { ...base.textStyles[key], ...((parsed.textStyles || {})[key] || {}) };
      return acc;
    }, {}),
  };
}

function isObsMode() {
  return new URLSearchParams(window.location.search).get("obs") === "1";
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(OBS_STORAGE_KEY);
    if (!raw) return defaultSettings();
    return mergeWithDefaults(JSON.parse(raw));
  } catch (e) {
    return defaultSettings();
  }
}

function buildObsUrl() {
  return `${window.location.origin}${window.location.pathname}?obs=1`;
}

let serverSyncTimer = null;
let lastPushedJson = null;

function pushSettingsToServer() {
  clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(async () => {
    const json = JSON.stringify(settings);
    if (json === lastPushedJson) return;
    lastPushedJson = json;
    try {
      await fetch(SETTINGS_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: json });
    } catch (e) {
      // sunucu ulaşılamazsa sessizce geç, localStorage yedek olarak kalır
    }
  }, 400);
}

async function fetchSettingsFromServer() {
  try {
    const res = await fetch(SETTINGS_API, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || Object.keys(json).length === 0) return null;
    return JSON.stringify(json) === lastPushedJson ? null : json;
  } catch (e) {
    return null;
  }
}

let lastKnownMtime = null;

async function fetchSettingsMeta() {
  try {
    const res = await fetch(SETTINGS_META_API, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(OBS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    // localStorage kotası büyük logo/görsel/video ile dolabilir - sorun değil,
    // asıl kaynak sunucudaki dosya (obs-settings-data.json), aşağıda gönderiliyor.
  }
  if (!isObsMode()) pushSettingsToServer();
}

let settings = loadSettings();

function resizeImageDataUrl(dataUrl, maxDim) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------- Arka plan (gradyan + parçacıklar) ---------- */

const wrap = $("#obsCanvasWrap");
const canvas = $("#bgCanvas");
const ctx = canvas.getContext("2d");
let particles = [];
let animHandle = null;

function rand(min, max) { return Math.random() * (max - min) + min; }

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

let bgVideoDuration = 0;

$("#bgVideo").addEventListener("loadedmetadata", (e) => {
  bgVideoDuration = e.target.duration || 0;
  updateVidTrimUI();
  const start = Number(settings.bgVideoStart) || 0;
  if (start > 0 && e.target.currentTime < start) {
    e.target.currentTime = start;
  }
});

$("#bgVideo").addEventListener("timeupdate", (e) => {
  const start = Number(settings.bgVideoStart) || 0;
  const end = Number(settings.bgVideoEnd) || 0;
  if (end > start && e.target.currentTime >= end) {
    e.target.currentTime = start;
  }
});

$("#bgVideo").addEventListener("ended", (e) => {
  e.target.currentTime = Number(settings.bgVideoStart) || 0;
  e.target.play().catch(() => {});
});

function extractYoutubeId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  let url;
  try {
    url = new URL(trimmed);
  } catch (e) {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const v = url.searchParams.get("v");
      return v && /^[\w-]{11}$/.test(v) ? v : null;
    }
    const m = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/);
    if (m) return m[1];
  }
  return null;
}

/* ---------- YouTube arka plan oynatıcısı (IFrame Player API) ---------- */

let ytPlayer = null;
let ytApiLoading = false;
let ytLoopTimer = null;
let ytCurrentId = null;
let ytCurrentStart = 0;
let ytCurrentEnd = 0;
let ytDuration = 0;
let ytPendingLoad = null;

function loadYoutubeApi(cb) {
  if (window.YT && window.YT.Player) { cb(); return; }
  const prevReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prevReady === "function") prevReady();
    cb();
  };
  if (!ytApiLoading) {
    ytApiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

function hideYtBg() {
  clearTimeout(waitForRealPlayback._t);
  const wrap = $("#ytBgWrap");
  if (wrap) wrap.classList.remove("yt-ready");
}

let ytHasPlayedOnce = false;

function revealYtBgNow() {
  ytHasPlayedOnce = true;
  const wrap = $("#ytBgWrap");
  if (wrap) wrap.classList.add("yt-ready");
}

/**
 * YouTube'un embed'lerde gösterdiği başlık/marka kartının süresi
 * tahmin edilemiyor (bazen <1sn, bazen 10sn+). Sabit bir gecikme
 * tahmin etmek yerine, videonun zaman damgasının GERÇEKTEN ilerlediğini
 * (yani gerçekten oynadığını) doğrulayana kadar bekleyip öyle gösteriyoruz.
 * Marka kartı SADECE ilk yüklemede görülür; video bir kez başarıyla
 * oynadıktan sonra oluşan kısa/ara sıra buffering'lerde uzun uzun
 * beklemeye gerek yok, aksi halde video sık sık kaybolup görünür.
 */
function waitForRealPlayback() {
  clearTimeout(waitForRealPlayback._t);
  const startedAt = Date.now();
  const minWallMs = ytHasPlayedOnce ? 500 : 5500;
  const deadline = startedAt + (ytHasPlayedOnce ? 4000 : 9000);
  let refTime = null;
  const check = () => {
    if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    const now = Date.now();
    const t = ytPlayer.getCurrentTime();
    if (refTime === null) refTime = t;
    const advanced = t - refTime >= 0.3;
    const minWaited = now - startedAt >= minWallMs;
    if ((advanced && minWaited) || now > deadline) {
      revealYtBgNow();
      return;
    }
    waitForRealPlayback._t = setTimeout(check, 250);
  };
  check();
}

function scheduleYtLoop(start, end) {
  clearTimeout(ytLoopTimer);
  if (end > start) {
    ytLoopTimer = setTimeout(() => {
      if (!ytPlayer) return;
      hideYtBg();
      ytPlayer.seekTo(start, true);
      setTimeout(() => {
        if (ytPlayer && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
          ytPlayer.playVideo();
        }
      }, 500);
      waitForRealPlayback();
      scheduleYtLoop(start, end);
    }, (end - start) * 1000);
  }
}

function updateYoutubePlayer(id, start, end) {
  if (ytCurrentId === id && ytCurrentStart === start && ytCurrentEnd === end && ytPlayer) return;
  ytCurrentId = id;
  ytCurrentStart = start;
  ytCurrentEnd = end;

  if (!(window.YT && window.YT.Player)) {
    ytPendingLoad = { id, start, end };
    loadYoutubeApi(() => {
      if (ytPendingLoad) {
        createOrLoadYtPlayer(ytPendingLoad.id, ytPendingLoad.start, ytPendingLoad.end);
        ytPendingLoad = null;
      }
    });
    return;
  }
  createOrLoadYtPlayer(id, start, end);
}

function applyYtSoundState() {
  if (!ytPlayer || typeof ytPlayer.mute !== "function") return;
  if (settings.videoSound) {
    ytPlayer.unMute();
    ytPlayer.setVolume(settings.videoVolume);
  } else {
    ytPlayer.mute();
  }
}

function pollYtDuration(player) {
  const poll = setInterval(() => {
    const d = player.getDuration();
    if (d) {
      ytDuration = d;
      updateYtTrimUI();
      clearInterval(poll);
    }
  }, 300);
  setTimeout(() => clearInterval(poll), 6000);
}

function createOrLoadYtPlayer(id, start, end) {
  if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
    ytDuration = 0;
    hideYtBg();
    ytPlayer.mute();
    ytPlayer.loadVideoById({ videoId: id, startSeconds: start });
    waitForRealPlayback();
    if (settings.videoSound) setTimeout(applyYtSoundState, 400);
    scheduleYtLoop(start, end);
    pollYtDuration(ytPlayer);
    return;
  }
  ytHasPlayedOnce = false;
  ytPlayer = new YT.Player("ytPlayer", {
    videoId: id,
    playerVars: {
      autoplay: 1, mute: 1, controls: 0, rel: 0, showinfo: 0, modestbranding: 1,
      iv_load_policy: 3, disablekb: 1, playsinline: 1, start,
      origin: window.location.origin,
    },
    events: {
      onReady: (e) => {
        e.target.mute();
        e.target.playVideo();
        if (settings.videoSound) setTimeout(applyYtSoundState, 400);
        waitForRealPlayback();
        scheduleYtLoop(ytCurrentStart, ytCurrentEnd);
        ytDuration = e.target.getDuration() || 0;
        if (ytDuration) updateYtTrimUI();
        else pollYtDuration(e.target);
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.BUFFERING) {
          hideYtBg();
          waitForRealPlayback();
        }
        if (e.data === YT.PlayerState.ENDED) {
          hideYtBg();
          e.target.seekTo(ytCurrentStart, true);
          e.target.playVideo();
          waitForRealPlayback();
        }
      },
    },
  });
}

function toLocalDateTimeInputValue(date) {
  const p = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function formatTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function updateYtTrimUI() {
  const wrap = $("#ytTrimWrap");
  if (!wrap) return;
  if (!ytDuration) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const start = Number(settings.youtubeStart) || 0;
  const end = settings.youtubeEnd ? Number(settings.youtubeEnd) : ytDuration;
  const startPct = clamp((start / ytDuration) * 100, 0, 100);
  const endPct = clamp((end / ytDuration) * 100, 0, 100);
  $("#ytTrimHandleStart").style.left = `${startPct}%`;
  $("#ytTrimHandleEnd").style.left = `${endPct}%`;
  $("#ytTrimRange").style.left = `${startPct}%`;
  $("#ytTrimRange").style.width = `${Math.max(0, endPct - startPct)}%`;
  $("#ytTrimStartLabel").textContent = formatTime(start);
  $("#ytTrimEndLabel").textContent = formatTime(end);
}

function initYtTrimDrag() {
  const bar = $("#ytTrimBar");
  let dragHandle = null;

  function posToSeconds(clientX) {
    const rect = bar.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    return pct * ytDuration;
  }

  $("#ytTrimHandleStart").addEventListener("pointerdown", (e) => {
    dragHandle = "start";
    e.target.setPointerCapture(e.pointerId);
  });
  $("#ytTrimHandleEnd").addEventListener("pointerdown", (e) => {
    dragHandle = "end";
    e.target.setPointerCapture(e.pointerId);
  });

  bar.addEventListener("pointermove", (e) => {
    if (!dragHandle || !ytDuration) return;
    let t = posToSeconds(e.clientX);
    const curStart = Number($("#sYoutubeStart").value) || 0;
    const curEnd = $("#sYoutubeEnd").value ? Number($("#sYoutubeEnd").value) : ytDuration;
    if (dragHandle === "start") {
      t = clamp(t, 0, curEnd - 1);
      $("#sYoutubeStart").value = Math.round(t);
    } else {
      t = clamp(t, curStart + 1, ytDuration);
      $("#sYoutubeEnd").value = Math.round(t);
    }
    settings.youtubeStart = Number($("#sYoutubeStart").value) || 0;
    settings.youtubeEnd = Number($("#sYoutubeEnd").value) || 0;
    updateYtTrimUI();
  });

  function endDrag() {
    if (!dragHandle) return;
    dragHandle = null;
    persistAndRender();
  }
  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);
}

function updateVidTrimUI() {
  const wrap = $("#vidTrimWrap");
  if (!wrap) return;
  if (!bgVideoDuration) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  const start = Number(settings.bgVideoStart) || 0;
  const end = settings.bgVideoEnd ? Number(settings.bgVideoEnd) : bgVideoDuration;
  const startPct = clamp((start / bgVideoDuration) * 100, 0, 100);
  const endPct = clamp((end / bgVideoDuration) * 100, 0, 100);
  $("#vidTrimHandleStart").style.left = `${startPct}%`;
  $("#vidTrimHandleEnd").style.left = `${endPct}%`;
  $("#vidTrimRange").style.left = `${startPct}%`;
  $("#vidTrimRange").style.width = `${Math.max(0, endPct - startPct)}%`;
  $("#vidTrimStartLabel").textContent = formatTime(start);
  $("#vidTrimEndLabel").textContent = formatTime(end);
}

function initVidTrimDrag() {
  const bar = $("#vidTrimBar");
  let dragHandle = null;

  function posToSeconds(clientX) {
    const rect = bar.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    return pct * bgVideoDuration;
  }

  $("#vidTrimHandleStart").addEventListener("pointerdown", (e) => {
    dragHandle = "start";
    e.target.setPointerCapture(e.pointerId);
  });
  $("#vidTrimHandleEnd").addEventListener("pointerdown", (e) => {
    dragHandle = "end";
    e.target.setPointerCapture(e.pointerId);
  });

  bar.addEventListener("pointermove", (e) => {
    if (!dragHandle || !bgVideoDuration) return;
    let t = posToSeconds(e.clientX);
    const curStart = Number($("#sBgVideoStart").value) || 0;
    const curEnd = $("#sBgVideoEnd").value ? Number($("#sBgVideoEnd").value) : bgVideoDuration;
    if (dragHandle === "start") {
      t = clamp(t, 0, curEnd - 1);
      $("#sBgVideoStart").value = Math.round(t);
    } else {
      t = clamp(t, curStart + 1, bgVideoDuration);
      $("#sBgVideoEnd").value = Math.round(t);
    }
    settings.bgVideoStart = Number($("#sBgVideoStart").value) || 0;
    settings.bgVideoEnd = Number($("#sBgVideoEnd").value) || 0;
    updateVidTrimUI();
  });

  function endDrag() {
    if (!dragHandle) return;
    dragHandle = null;
    persistAndRender();
  }
  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);
}

function applyBackgroundStyle() {
  let gradient;
  wrap.style.backgroundSize = "";
  wrap.style.backgroundPosition = "";

  const videoEl = $("#bgVideo");
  videoEl.muted = !settings.videoSound;
  videoEl.volume = (settings.videoVolume || 0) / 100;
  const hasVideoTrim = (Number(settings.bgVideoStart) || 0) > 0 || (Number(settings.bgVideoEnd) || 0) > 0;
  // Kırpma aralığı yoksa videonun kendi (native) döngüsünü kullan; bu, JS
  // tarafından "ended" olayını bekleyip yeniden başlatmaktan çok daha akıcı
  // ve takılmasız çalışır. Kırpma aktifse döngüyü JS ile yönetmemiz gerekir.
  videoEl.loop = !hasVideoTrim;
  if (settings.bgStyle === "video" && settings.bgVideo) {
    if (videoEl.dataset.loadedSrc !== settings.bgVideo) {
      videoEl.dataset.loadedSrc = settings.bgVideo;
      videoEl.src = settings.bgVideo;
      videoEl.load();
    }
    videoEl.classList.remove("hidden");
    const tryPlay = () => { if (videoEl.paused) videoEl.play().catch(() => {}); };
    if (videoEl.readyState >= 2) {
      tryPlay();
    } else {
      videoEl.addEventListener("canplay", tryPlay, { once: true });
    }
  } else {
    videoEl.pause();
    videoEl.classList.add("hidden");
  }

  const ytWrap = $("#ytBgWrap");
  const ytId = settings.bgStyle === "youtube" ? extractYoutubeId(settings.youtubeUrl) : null;
  if (ytId) {
    ytWrap.classList.remove("hidden");
    updateYoutubePlayer(ytId, Number(settings.youtubeStart) || 0, Number(settings.youtubeEnd) || 0);
  } else {
    ytWrap.classList.add("hidden");
    ytCurrentId = null;
    if (ytPlayer && typeof ytPlayer.pauseVideo === "function") {
      ytPlayer.pauseVideo();
      if (typeof ytPlayer.mute === "function") ytPlayer.mute();
    }
  }

  if (settings.bgStyle === "youtube" && ytId) {
    gradient = `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35))`;
  } else if (settings.bgStyle === "video") {
    gradient = `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35))`;
  } else if (settings.bgStyle === "custom" && settings.bgImage) {
    gradient = `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${settings.bgImage})`;
    wrap.style.backgroundSize = "cover";
    wrap.style.backgroundPosition = "center";
  } else if (settings.bgStyle === "mix") {
    gradient = `radial-gradient(circle at 20% 15%, ${SOCIAL_META.twitch.color}33, transparent 55%),
                radial-gradient(circle at 85% 20%, ${SOCIAL_META.youtube.color}22, transparent 55%),
                radial-gradient(circle at 50% 90%, ${SOCIAL_META.kick.color}22, transparent 55%),
                linear-gradient(180deg, #05060a, #0b0d15)`;
  } else if (settings.bgStyle === "accent") {
    gradient = `radial-gradient(circle at 30% 20%, ${settings.accent}33, transparent 55%),
                radial-gradient(circle at 80% 80%, ${settings.accent}22, transparent 55%),
                linear-gradient(180deg, #05060a, #0b0d15)`;
  } else {
    gradient = `linear-gradient(180deg, #05060a, #0b0d15)`;
  }
  wrap.style.backgroundImage = gradient;
  wrap.classList.toggle("transparent-bg", !!settings.transparent);
}

// Parçacık şekilleri artık koda gömülü değil: assets/particles/ klasöründeki
// her PNG/WEBP dosyası sunucudan (/api/particles) listelenip otomatik olarak
// bir parçacık tipine dönüşür. Yeni bir şekil eklemek için o klasöre saydam
// arka planlı bir görsel bırakmak yeterli — kod değişikliği gerekmez.
const PARTICLE_IMAGES = {};
let PARTICLE_TYPE_KEYS = [];
// Bazı görseller doğal olarak yatay/farklı yönde durabilir; gerekirse burada
// belirli bir tip için sabit bir döndürme (radyan) tanımlanabilir.
const IMAGE_PARTICLE_ROTATION = {
  kratosaxe: Math.PI - 0.5,
};

function particleLabelFromKey(key) {
  return key
    .replace(/-cutout$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

async function loadParticleManifest() {
  try {
    const res = await fetch("/api/particles", { cache: "no-store" });
    const files = res.ok ? await res.json() : [];
    PARTICLE_TYPE_KEYS = files.map(f => f.replace(/\.(png|webp)$/i, ""));
    files.forEach((file, i) => {
      const key = PARTICLE_TYPE_KEYS[i];
      const img = new Image();
      img.src = `assets/particles/${file}`;
      PARTICLE_IMAGES[key] = img;
    });
  } catch (e) {
    PARTICLE_TYPE_KEYS = [];
  }
}

function drawImageParticle(kind, x, y, size, alpha, glowColor) {
  const img = PARTICLE_IMAGES[kind];
  if (!img || !img.complete || !img.naturalWidth) return;
  const aspect = img.naturalWidth / img.naturalHeight;
  const targetLong = size * 8;
  const width = aspect >= 1 ? targetLong : targetLong * aspect;
  const height = aspect >= 1 ? targetLong / aspect : targetLong;
  ctx.save();
  ctx.translate(x, y);
  if (IMAGE_PARTICLE_ROTATION[kind]) ctx.rotate(IMAGE_PARTICLE_ROTATION[kind]);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = glowColor || "rgba(255,255,255,0.9)";
  ctx.shadowBlur = size * 2.2;
  ctx.drawImage(img, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function getEnabledParticleTypes() {
  const enabled = PARTICLE_TYPE_KEYS.filter(k => settings.particleTypes[k]);
  return enabled.length ? enabled : PARTICLE_TYPE_KEYS;
}

function initParticles() {
  const count = Math.round((canvas.width * canvas.height) / 22000);
  const types = getEnabledParticleTypes();
  particles = Array.from({ length: Math.min(count, 90) }, () => {
    const type = types[Math.floor(Math.random() * types.length)];
    const baseR = rand(2.4, 3.8);
    const sizeMul = ((settings.particleSizes || {})[type] || 100) / 100;
    return {
      x: rand(0, canvas.width),
      y: rand(0, canvas.height),
      baseR,
      r: baseR * sizeMul,
      vy: -rand(0.15, 0.5),
      vx: rand(-0.12, 0.12),
      alpha: rand(0.25, 0.85),
      type,
    };
  });
}

function applyParticleSizes() {
  particles.forEach(p => {
    const sizeMul = ((settings.particleSizes || {})[p.type] || 100) / 100;
    p.r = p.baseR * sizeMul;
  });
}

function tickParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.y += p.vy;
    p.x += p.vx;
    if (p.y < -14) { p.y = canvas.height + 14; p.x = rand(0, canvas.width); }
    if (p.x < -14) p.x = canvas.width + 14;
    if (p.x > canvas.width + 14) p.x = -14;
    drawImageParticle(p.type, p.x, p.y, p.r, p.alpha, settings.accent);
  });
  animHandle = requestAnimationFrame(tickParticles);
}

function startBackgroundAnimation() {
  resizeCanvas();
  applyBackgroundStyle();
  if (animHandle) cancelAnimationFrame(animHandle);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (settings.particles && !settings.transparent) {
    initParticles();
    tickParticles();
  }
}

window.addEventListener("resize", () => {
  resizeCanvas();
  if (settings.particles && !settings.transparent) initParticles();
  restartTickerAnimation();
});

/* ---------- Konumlar (sürükle-bırak) ---------- */

function applyPositions() {
  $all(".draggable").forEach(el => {
    const key = el.dataset.key;
    const pos = settings.positions[key];
    if (!pos) return;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  });
}

function applySizes() {
  $all(".draggable").forEach(el => {
    const key = el.dataset.key;
    const size = settings.sizes[key];
    if (!size) return;
    el.style.setProperty("--el-scale", size / 100);
  });
}

function applyVisibility() {
  $all(".draggable").forEach(el => {
    const key = el.dataset.key;
    const visible = settings.visible[key];
    el.classList.toggle("el-off", visible === false);
  });
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function initDragging() {
  const overlay = $("#obsOverlay");
  let dragEl = null;

  $all(".draggable").forEach(el => {
    el.addEventListener("pointerdown", (e) => {
      dragEl = el;
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
    });
  });

  overlay.addEventListener("pointermove", (e) => {
    if (!dragEl) return;
    const rect = wrap.getBoundingClientRect();
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 98);
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, 2, 98);
    dragEl.style.left = `${xPct}%`;
    dragEl.style.top = `${yPct}%`;
  });

  function endDrag(e) {
    if (!dragEl) return;
    const key = dragEl.dataset.key;
    const rect = wrap.getBoundingClientRect();
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 98);
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, 2, 98);
    settings.positions[key] = { x: Math.round(xPct * 10) / 10, y: Math.round(yPct * 10) / 10 };
    saveSettings(settings);
    dragEl.classList.remove("dragging");
    dragEl = null;
  }

  overlay.addEventListener("pointerup", endDrag);
  overlay.addEventListener("pointercancel", endDrag);
}

function resetPositions() {
  settings.positions = defaultSettings().positions;
  applyPositions();
  saveSettings(settings);
  showToast("Konumlar sıfırlandı");
}

function resetSizes() {
  settings.sizes = defaultSettings().sizes;
  applySizes();
  fillSizeInputs();
  saveSettings(settings);
  showToast("Boyutlar sıfırlandı");
}

/* ---------- İçerik render ---------- */

function renderContent() {
  document.documentElement.style.setProperty("--accent", settings.accent);
  document.documentElement.style.setProperty("--title-color", settings.textColor);
  document.documentElement.style.setProperty("--eyebrow-color", settings.eyebrowColor);
  document.documentElement.style.setProperty("--sub-color", settings.subColor);
  document.documentElement.style.setProperty("--countdown-color", settings.countdownColor);
  document.documentElement.style.setProperty("--ticker-color", settings.tickerColor);
  wrap.dataset.font = settings.font || "system";

  $("#eyebrowText").textContent = settings.eyebrow || "";
  $("#streamTitleText").textContent = settings.title || "Yayın Başlığı";
  $("#streamSubText").textContent = settings.sub || "";
  $("#streamSubText").classList.toggle("hidden", !settings.sub);
  $("#tickerText").textContent = settings.ticker || "";
  $("#tickerWrap").classList.toggle("hidden", !settings.ticker);
  restartTickerAnimation();
  $("#liveBadgeText").textContent = settings.liveText || (IS_OUTRO ? "YİNE GÖRÜŞÜRÜZ" : "CANLI YAYINDA");

  if (settings.logo) {
    $("#logoImg").src = settings.logo;
    $("#logoImg").classList.remove("hidden");
    $("#logoFallback").classList.add("hidden");
  } else {
    $("#logoImg").classList.add("hidden");
    $("#logoFallback").classList.remove("hidden");
  }
  $(".logo-ring").classList.toggle("fit", settings.logoFit !== false);
  $(".logo-ring").classList.toggle("no-frame", settings.logoFrame === false);
  document.documentElement.style.setProperty("--logo-zoom", (settings.logoZoom || 100) / 100);
  document.documentElement.style.setProperty("--logo-pan-x", `${settings.logoPanX || 0}%`);
  document.documentElement.style.setProperty("--logo-pan-y", `${settings.logoPanY || 0}%`);
  const cropFields = $("#logoCropFields");
  if (cropFields) cropFields.classList.toggle("hidden", settings.logoFit !== false);

  renderSocials();
  applyPositions();
  applySizes();
  applyVisibility();
  applyTextStyles();
}

const TEXT_STYLE_TARGETS = {
  eyebrow: "#eyebrowText",
  title: "#streamTitleText",
  sub: "#streamSubText",
  countdown: "#countdownWrap",
  ticker: "#tickerText",
};

const TEXT_ANIM_TARGETS = {
  eyebrow: "#eyebrowText",
  title: "#streamTitleText",
  sub: "#streamSubText",
  countdown: "#countdownWrap",
  ticker: "#tickerWrap",
};

function applyTextStyles() {
  Object.keys(TEXT_STYLE_TARGETS).forEach(key => {
    const el = $(TEXT_STYLE_TARGETS[key]);
    if (!el) return;
    const st = (settings.textStyles && settings.textStyles[key]) || {};
    el.style.fontFamily = st.font ? FONT_STACKS[st.font] || "" : "";
    document.documentElement.style.setProperty(`--${key}-fx-scale`, (st.size || 100) / 100);
    if (st.effect && st.effect !== "none") {
      el.dataset.fx = st.effect;
    } else {
      delete el.dataset.fx;
    }
  });
  Object.keys(TEXT_ANIM_TARGETS).forEach(key => {
    const el = $(TEXT_ANIM_TARGETS[key]);
    if (!el) return;
    const st = (settings.textStyles && settings.textStyles[key]) || {};
    if (st.anim && st.anim !== "none") {
      el.dataset.anim = st.anim;
    } else {
      delete el.dataset.anim;
    }
  });
}

function renderSocials() {
  const row = $("#socialsRow");
  row.innerHTML = "";
  Object.entries(settings.socials).forEach(([key, val]) => {
    if (!val.enabled || !val.handle) return;
    const meta = SOCIAL_META[key];
    const badge = document.createElement("div");
    badge.className = "social-badge";

    const dot = document.createElement("span");
    dot.className = "dot-icon";
    dot.style.background = meta.color;
    if (meta.icon) {
      dot.innerHTML = `<svg viewBox="0 0 24 24" fill="${meta.iconFill || "#000"}">${meta.icon}</svg>`;
    } else {
      dot.textContent = meta.mono;
    }
    badge.appendChild(dot);

    const text = document.createElement("span");
    text.textContent = val.handle;
    badge.appendChild(text);

    row.appendChild(badge);
  });
}

function restartTickerAnimation() {
  const el = $("#tickerText");
  if (!settings.ticker) return;
  const wrapWidth = $("#tickerWrap").clientWidth || 1;
  const textWidth = el.scrollWidth || 1;
  const distance = wrapWidth + textWidth;
  const pxPerSecond = 70;
  const duration = Math.max(6, distance / pxPerSecond);
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = `tickerScroll ${duration}s linear infinite`;
}

/* ---------- Geri sayım ---------- */

function pad(n) { return String(Math.max(0, n)).padStart(2, "0"); }

function updateCountdown() {
  const countdownWrap = $("#countdownWrap");
  const liveBadge = $("#liveBadge");

  // Çıkış ekranında tarih yoksa rozet her zaman görünür (teşekkür / görüşürüz).
  if (!settings.targetDate) {
    countdownWrap.classList.add("hidden");
    if (IS_OUTRO) {
      liveBadge.classList.remove("hidden");
    } else {
      liveBadge.classList.add("hidden");
    }
    return;
  }

  const target = new Date(settings.targetDate).getTime();
  if (isNaN(target)) {
    countdownWrap.classList.add("hidden");
    if (IS_OUTRO) {
      liveBadge.classList.remove("hidden");
    } else {
      liveBadge.classList.add("hidden");
    }
    return;
  }

  const diff = target - Date.now();

  if (diff <= 0) {
    countdownWrap.classList.add("hidden");
    liveBadge.classList.remove("hidden");
    return;
  }

  liveBadge.classList.add("hidden");
  countdownWrap.classList.remove("hidden");

  const totalSeconds = Math.floor(diff / 1000);
  const minutesLeft = Math.floor(totalSeconds / 60);
  const secondsLeft = totalSeconds % 60;
  $("#cdMinutes").textContent = pad(minutesLeft);
  $("#cdSeconds").textContent = pad(secondsLeft);
}

/* ---------- Ayarlar formu <-> state ---------- */

function fillFormFromSettings() {
  $("#sEyebrow").value = settings.eyebrow;
  $("#sTitle").value = settings.title;
  $("#sSub").value = settings.sub;
  $("#sTicker").value = settings.ticker;
  $("#sLiveText").value = settings.liveText;
  $("#sTargetDate").value = settings.targetDate;
  $("#sAccent").value = settings.accent;
  $("#sTextColor").value = settings.textColor;
  $("#sEyebrowColor").value = settings.eyebrowColor;
  $("#sSubColor").value = settings.subColor;
  $("#sCountdownColor").value = settings.countdownColor;
  $("#sTickerColor").value = settings.tickerColor;
  $("#sFont").value = settings.font;
  $("#sBgStyle").value = settings.bgStyle;
  $("#sYoutubeUrl").value = settings.youtubeUrl;
  $("#sYoutubeStart").value = settings.youtubeStart || 0;
  $("#sYoutubeEnd").value = settings.youtubeEnd || "";
  updateYtTrimUI();
  $("#sBgVideoStart").value = settings.bgVideoStart || 0;
  $("#sBgVideoEnd").value = settings.bgVideoEnd || "";
  updateVidTrimUI();
  $("#sParticles").checked = settings.particles;
  $("#particleShapesWrap").classList.toggle("hidden", !settings.particles);
  renderParticleShapeControls();
  $("#sTransparent").checked = settings.transparent;
  $("#sVideoSound").checked = settings.videoSound;
  $("#sVideoVolume").value = settings.videoVolume;
  $("#sVideoVolumeVal").textContent = `${settings.videoVolume}%`;
  $("#videoVolumeRow").classList.toggle("hidden", !settings.videoSound);
  $("#sLogoFit").checked = settings.logoFit !== false;
  $("#sLogoFrame").checked = settings.logoFrame !== false;
  $("#logoZoom").value = settings.logoZoom;
  $("#logoZoomVal").textContent = `${settings.logoZoom}%`;
  $("#logoPanX").value = settings.logoPanX;
  $("#logoPanXVal").textContent = settings.logoPanX;
  $("#logoPanY").value = settings.logoPanY;
  $("#logoPanYVal").textContent = settings.logoPanY;
  fillSizeInputs();
  fillVisibilityInputs();
  fillTextStyleInputs();

  $all(".social-edit").forEach(row => {
    const key = row.dataset.key;
    const val = settings.socials[key] || { enabled: false, handle: "" };
    row.querySelector(".soc-enabled").checked = val.enabled;
    row.querySelector(".soc-handle").value = val.handle;
  });
}

const SIZE_KEYS = ["logo", "title", "countdown", "socials", "ticker"];

function fillSizeInputs() {
  SIZE_KEYS.forEach(key => {
    const input = $(`#sz${capitalize(key)}`);
    const label = $(`#sz${capitalize(key)}Val`);
    const value = settings.sizes[key];
    if (input) input.value = value;
    if (label) label.textContent = `${value}%`;
  });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * Parçacık şekli onay kutularını ve boyut kaydırıcılarını, assets/particles/
 * klasöründe o an bulunan dosyalara göre baştan oluşturur. Yeni bir görsel
 * eklendiğinde (sayfa yenilenince) burada otomatik olarak bir satır belirir —
 * HTML'de sabit id'ler tutmaya gerek kalmaz.
 */
function renderParticleShapeControls() {
  const checkboxWrap = $("#particleShapeCheckboxes");
  const sizeWrap = $("#particleShapeSizes");
  if (!checkboxWrap || !sizeWrap) return;
  checkboxWrap.innerHTML = "";
  sizeWrap.innerHTML = "";

  PARTICLE_TYPE_KEYS.forEach(key => {
    const label = particleLabelFromKey(key);

    const cbLabel = document.createElement("label");
    cbLabel.className = "switch-row";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!settings.particleTypes[key];
    cb.addEventListener("change", () => {
      settings.particleTypes[key] = cb.checked;
      persistAndRender();
    });
    const cbSpan = document.createElement("span");
    cbSpan.textContent = label;
    cbLabel.append(cb, cbSpan);
    checkboxWrap.appendChild(cbLabel);

    const sizeRow = document.createElement("div");
    sizeRow.className = "size-row";
    const sizeLabel = document.createElement("label");
    sizeLabel.textContent = label;
    const sizeInput = document.createElement("input");
    sizeInput.type = "range";
    sizeInput.min = "50";
    sizeInput.max = "400";
    sizeInput.step = "5";
    const currentSize = settings.particleSizes[key] || 100;
    sizeInput.value = String(currentSize);
    const sizeVal = document.createElement("span");
    sizeVal.className = "size-value";
    sizeVal.textContent = `${currentSize}%`;
    sizeInput.addEventListener("input", () => {
      const value = Number(sizeInput.value);
      settings.particleSizes[key] = value;
      sizeVal.textContent = `${value}%`;
      applyParticleSizes();
      saveSettings(settings);
    });
    sizeRow.append(sizeLabel, sizeInput, sizeVal);
    sizeWrap.appendChild(sizeRow);
  });
}

const TEXT_STYLE_KEYS = ["eyebrow", "title", "sub", "countdown", "ticker"];

function fillTextStyleInputs() {
  TEXT_STYLE_KEYS.forEach(key => {
    const st = settings.textStyles[key];
    const cap = capitalize(key);
    const fontSel = $(`#txFont${cap}`);
    const effectSel = $(`#txEffect${cap}`);
    const animSel = $(`#txAnim${cap}`);
    const sizeInput = $(`#txSize${cap}`);
    const sizeLabel = $(`#txSize${cap}Val`);
    if (fontSel) fontSel.value = st.font || "";
    if (effectSel) effectSel.value = st.effect || "none";
    if (animSel) animSel.value = st.anim || "none";
    if (sizeInput) sizeInput.value = st.size;
    if (sizeLabel) sizeLabel.textContent = `${st.size}%`;
  });
}

function fillVisibilityInputs() {
  SIZE_KEYS.forEach(key => {
    const input = $(`#vis${capitalize(key)}`);
    if (input) input.checked = settings.visible[key] !== false;
  });
}

function setBgStyle(style) {
  settings.bgStyle = style;
  $("#sBgStyle").value = style;
}

function bindFormEvents() {
  const textFields = [
    ["#sEyebrow", "eyebrow"], ["#sTitle", "title"], ["#sSub", "sub"],
    ["#sTicker", "ticker"], ["#sLiveText", "liveText"], ["#sTargetDate", "targetDate"],
    ["#sAccent", "accent"], ["#sTextColor", "textColor"],
    ["#sEyebrowColor", "eyebrowColor"], ["#sSubColor", "subColor"],
    ["#sCountdownColor", "countdownColor"], ["#sTickerColor", "tickerColor"],
    ["#sFont", "font"],
  ];
  textFields.forEach(([sel, key]) => {
    $(sel).addEventListener("input", () => {
      settings[key] = $(sel).value;
      persistAndRender();
    });
  });

  function applyCountdownMinutes() {
    const minutes = Number($("#sCountdownMinutes").value);
    if (!minutes || minutes <= 0) {
      showToast("Geçerli bir dakika değeri girin");
      return;
    }
    const target = new Date(Date.now() + minutes * 60000);
    settings.targetDate = toLocalDateTimeInputValue(target);
    $("#sTargetDate").value = settings.targetDate;
    $("#sCountdownMinutes").value = "";
    persistAndRender();
    showToast(`Geri sayım ${minutes} dakikaya ayarlandı`);
  }
  $("#btnSetCountdownMinutes").addEventListener("click", applyCountdownMinutes);
  $("#sCountdownMinutes").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyCountdownMinutes();
  });

  $("#sBgStyle").addEventListener("input", () => {
    settings.bgStyle = $("#sBgStyle").value;
    persistAndRender();
  });

  function applyYoutubeUrlField() {
    const value = $("#sYoutubeUrl").value.trim();
    if (value && !extractYoutubeId(value)) {
      showToast("Geçerli bir YouTube video linki/ID'si girin");
      return;
    }
    if (value === settings.youtubeUrl) return;
    settings.youtubeUrl = value;
    if (value) setBgStyle("youtube");
    persistAndRender();
  }
  let ytUrlDebounce = null;
  $("#sYoutubeUrl").addEventListener("input", () => {
    clearTimeout(ytUrlDebounce);
    ytUrlDebounce = setTimeout(applyYoutubeUrlField, 600);
  });
  $("#sYoutubeUrl").addEventListener("change", () => {
    clearTimeout(ytUrlDebounce);
    applyYoutubeUrlField();
  });
  $("#sYoutubeUrl").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(ytUrlDebounce);
      applyYoutubeUrlField();
      e.target.blur();
    }
  });

  $("#sYoutubeStart").addEventListener("change", () => {
    settings.youtubeStart = Math.max(0, Number($("#sYoutubeStart").value) || 0);
    updateYtTrimUI();
    persistAndRender();
  });
  $("#sYoutubeEnd").addEventListener("change", () => {
    settings.youtubeEnd = Math.max(0, Number($("#sYoutubeEnd").value) || 0);
    updateYtTrimUI();
    persistAndRender();
  });

  $("#sBgVideoStart").addEventListener("change", () => {
    settings.bgVideoStart = Math.max(0, Number($("#sBgVideoStart").value) || 0);
    updateVidTrimUI();
    persistAndRender();
  });
  $("#sBgVideoEnd").addEventListener("change", () => {
    settings.bgVideoEnd = Math.max(0, Number($("#sBgVideoEnd").value) || 0);
    updateVidTrimUI();
    persistAndRender();
  });

  $("#sBgImage").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      settings.bgImage = reader.result;
      setBgStyle("custom");
      persistAndRender();
    };
    reader.readAsDataURL(file);
  });

  $("#sBgVideo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const sizeMb = file.size / 1024 / 1024;
    showToast(sizeMb > 20 ? `Video ${sizeMb.toFixed(0)}MB yükleniyor ve optimize ediliyor, biraz sürebilir...` : "Video yükleniyor ve optimize ediliyor...");
    try {
      const res = await fetch(UPLOAD_VIDEO_API, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      settings.bgVideo = data.url;
      settings.bgVideoStart = 0;
      settings.bgVideoEnd = 0;
      bgVideoDuration = 0;
      $("#sBgVideoStart").value = 0;
      $("#sBgVideoEnd").value = "";
      setBgStyle("video");
      persistAndRender();
      showToast("Video yüklendi");
    } catch (err) {
      showToast("Video yüklenemedi, tekrar deneyin");
    }
  });

  $("#sParticles").addEventListener("change", () => {
    settings.particles = $("#sParticles").checked;
    $("#particleShapesWrap").classList.toggle("hidden", !settings.particles);
    persistAndRender();
  });

  $("#sTransparent").addEventListener("change", () => {
    settings.transparent = $("#sTransparent").checked;
    persistAndRender();
  });

  $("#sVideoSound").addEventListener("change", () => {
    settings.videoSound = $("#sVideoSound").checked;
    $("#videoVolumeRow").classList.toggle("hidden", !settings.videoSound);
    applyYtSoundState();
    persistAndRender();
  });

  $("#sVideoVolume").addEventListener("input", () => {
    const value = Number($("#sVideoVolume").value);
    settings.videoVolume = value;
    $("#sVideoVolumeVal").textContent = `${value}%`;
    applyYtSoundState();
    const videoEl = $("#bgVideo");
    videoEl.volume = value / 100;
    saveSettings(settings);
  });

  $("#sLogo").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      settings.logo = await resizeImageDataUrl(reader.result, 300);
      persistAndRender();
    };
    reader.readAsDataURL(file);
  });

  $("#sLogoFrame").addEventListener("change", () => {
    settings.logoFrame = $("#sLogoFrame").checked;
    persistAndRender();
  });

  $("#sLogoFit").addEventListener("change", () => {
    settings.logoFit = $("#sLogoFit").checked;
    persistAndRender();
  });

  $("#logoZoom").addEventListener("input", () => {
    const value = Number($("#logoZoom").value);
    settings.logoZoom = value;
    $("#logoZoomVal").textContent = `${value}%`;
    document.documentElement.style.setProperty("--logo-zoom", value / 100);
    saveSettings(settings);
  });
  $("#logoPanX").addEventListener("input", () => {
    const value = Number($("#logoPanX").value);
    settings.logoPanX = value;
    $("#logoPanXVal").textContent = value;
    document.documentElement.style.setProperty("--logo-pan-x", `${value}%`);
    saveSettings(settings);
  });
  $("#logoPanY").addEventListener("input", () => {
    const value = Number($("#logoPanY").value);
    settings.logoPanY = value;
    $("#logoPanYVal").textContent = value;
    document.documentElement.style.setProperty("--logo-pan-y", `${value}%`);
    saveSettings(settings);
  });
  $("#btnResetLogoCrop").addEventListener("click", () => {
    settings.logoZoom = 100;
    settings.logoPanX = 0;
    settings.logoPanY = 0;
    fillFormFromSettings();
    persistAndRender();
    showToast("Logo kırpması sıfırlandı");
  });

  $all(".social-edit").forEach(row => {
    const key = row.dataset.key;
    row.querySelector(".soc-enabled").addEventListener("change", (e) => {
      settings.socials[key].enabled = e.target.checked;
      persistAndRender();
    });
    row.querySelector(".soc-handle").addEventListener("input", (e) => {
      settings.socials[key].handle = e.target.value;
      persistAndRender();
    });
  });

  $("#btnResetPositions").addEventListener("click", resetPositions);

  SIZE_KEYS.forEach(key => {
    const input = $(`#sz${capitalize(key)}`);
    const label = $(`#sz${capitalize(key)}Val`);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      settings.sizes[key] = value;
      label.textContent = `${value}%`;
      applySizes();
      saveSettings(settings);
    });
  });

  TEXT_STYLE_KEYS.forEach(key => {
    const cap = capitalize(key);
    const fontSel = $(`#txFont${cap}`);
    const effectSel = $(`#txEffect${cap}`);
    const animSel = $(`#txAnim${cap}`);
    const sizeInput = $(`#txSize${cap}`);
    const sizeLabel = $(`#txSize${cap}Val`);
    if (fontSel) {
      fontSel.addEventListener("change", () => {
        settings.textStyles[key].font = fontSel.value;
        persistAndRender();
      });
    }
    if (effectSel) {
      effectSel.addEventListener("change", () => {
        settings.textStyles[key].effect = effectSel.value;
        persistAndRender();
      });
    }
    if (animSel) {
      animSel.addEventListener("change", () => {
        settings.textStyles[key].anim = animSel.value;
        persistAndRender();
      });
    }
    if (sizeInput) {
      sizeInput.addEventListener("input", () => {
        const value = Number(sizeInput.value);
        settings.textStyles[key].size = value;
        if (sizeLabel) sizeLabel.textContent = `${value}%`;
        applyTextStyles();
        saveSettings(settings);
      });
    }
  });

  $("#btnResetTextStyles").addEventListener("click", () => {
    settings.textStyles = defaultSettings().textStyles;
    fillTextStyleInputs();
    persistAndRender();
    showToast("Yazı ayarları sıfırlandı");
  });

  SIZE_KEYS.forEach(key => {
    const input = $(`#vis${capitalize(key)}`);
    input.addEventListener("change", () => {
      settings.visible[key] = input.checked;
      applyVisibility();
      saveSettings(settings);
    });
  });
  $("#btnResetSizes").addEventListener("click", resetSizes);

  $("#btnPullFromMain").addEventListener("click", () => {
    try {
      const raw = localStorage.getItem(MAIN_DRAFT_KEY);
      if (!raw) { showToast("Ana araçta kayıtlı taslak bulunamadı"); return; }
      const draft = JSON.parse(raw);
      if (draft.title) settings.title = draft.title;
      if (!IS_OUTRO && draft.scheduledAt) settings.targetDate = draft.scheduledAt;
      fillFormFromSettings();
      persistAndRender();
      showToast(IS_OUTRO ? "Başlık ana araçtan alındı" : "Başlık ve tarih ana araçtan alındı");
    } catch (e) {
      showToast("Ana araç verisi okunamadı");
    }
  });

  $("#btnResetObs").addEventListener("click", () => {
    const label = IS_OUTRO ? "çıkış" : "giriş";
    if (!confirm(`Tüm ${label} ekranı ayarları sıfırlansın mı?`)) return;
    settings = defaultSettings();
    localStorage.removeItem(OBS_STORAGE_KEY);
    fillFormFromSettings();
    persistAndRender();
    showToast("Ayarlar sıfırlandı");
  });

  $("#btnCopyObsUrl").addEventListener("click", async () => {
    const url = buildObsUrl();
    $("#obsUrlBox").value = url;
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      $("#obsUrlBox").select();
      document.execCommand("copy");
    }
    showToast("OBS URL'si kopyalandı");
  });

  $("#settingsFab").addEventListener("click", () => {
    $("#settingsDrawer").classList.remove("hidden");
  });
  $("#drawerClose").addEventListener("click", () => {
    $("#settingsDrawer").classList.add("hidden");
  });
}

function persistAndRender() {
  saveSettings(settings);
  renderContent();
  startBackgroundAnimation();
  const urlBox = $("#obsUrlBox");
  if (urlBox) urlBox.value = buildObsUrl();
}

/* ---------- Başlangıç ---------- */

async function syncFromServer() {
  const meta = await fetchSettingsMeta();
  if (meta && lastKnownMtime !== null && meta.mtime === lastKnownMtime) return;
  const remote = await fetchSettingsFromServer();
  if (!remote) {
    if (meta) lastKnownMtime = meta.mtime;
    return;
  }
  if (meta) lastKnownMtime = meta.mtime;
  settings = mergeWithDefaults(remote);
  lastPushedJson = JSON.stringify(settings);
  renderContent();
  startBackgroundAnimation();
}

async function syncFromServerForEditor() {
  const remote = await fetchSettingsFromServer();
  if (!remote) return;
  settings = mergeWithDefaults(remote);
  lastPushedJson = JSON.stringify(settings);
  fillFormFromSettings();
  renderContent();
  startBackgroundAnimation();
  $("#obsUrlBox").value = buildObsUrl();
}

async function init() {
  await loadParticleManifest();

  if (isObsMode()) {
    $("#settingsFab").remove();
    $("#settingsDrawer").remove();
    syncFromServer();
    setInterval(syncFromServer, 3000);
  } else {
    wrap.classList.add("edit-mode");
    bindFormEvents();
    fillFormFromSettings();
    initDragging();
    initYtTrimDrag();
    initVidTrimDrag();
    $("#obsUrlBox").value = buildObsUrl();
    syncFromServerForEditor();
  }

  renderContent();
  startBackgroundAnimation();
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

document.addEventListener("DOMContentLoaded", init);
