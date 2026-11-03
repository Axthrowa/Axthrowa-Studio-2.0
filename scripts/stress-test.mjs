#!/usr/bin/env node
/**
 * Yayın Yönetim Aracı — canlı sunucu stres testi.
 *
 * Uygulama açıkken çalıştır:
 *   node scripts/stress-test.mjs
 *   node scripts/stress-test.mjs --base http://127.0.0.1:8843 --seconds 20 --workers 24
 *
 * Neyi zorlar:
 *   1. Ayar okuma/yazma/patch yarışı (aynı ekrana eşzamanlı yazma)
 *   2. WebSocket yayın hattı (çok istemci + kopma)
 *   3. Medya Range istekleri (video oynatmanın dayandığı yol)
 *   4. Kötü niyetli girdiler (path traversal, dev query, bozuk JSON)
 * Çıkışta hata varsa kod 1 döner — CI'da doğrudan kullanılabilir.
 */

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf("base", "http://127.0.0.1:8843").replace(/\/$/, "");
const SECONDS = Number(argOf("seconds", "15"));
const WORKERS = Number(argOf("workers", "16"));
const WS_CLIENTS = Number(argOf("ws", "12"));

const stats = {
  ok: 0,
  fail: 0,
  bytes: 0,
  latencies: [],
  errors: new Map(),
};

function note(err) {
  const key = String(err).slice(0, 140);
  stats.errors.set(key, (stats.errors.get(key) || 0) + 1);
  stats.fail += 1;
}

async function timed(label, fn) {
  const t0 = performance.now();
  try {
    const out = await fn();
    stats.latencies.push(performance.now() - t0);
    stats.ok += 1;
    return out;
  } catch (e) {
    note(`${label}: ${e.message}`);
    return null;
  }
}

async function expectStatus(label, url, opts, allowed) {
  const res = await fetch(url, opts);
  if (!allowed.includes(res.status)) {
    throw new Error(`${label} beklenmeyen HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  stats.bytes += buf.byteLength;
  return res;
}

const SCREENS = ["starting", "ending", "brb", "chat"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function botaxtSessionRoundTrip() {
  const prefix = "/api/botaxt";
  const res = await fetch(`${BASE}${prefix}/dashboard`, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok || !text.trimStart().startsWith("{")) {
    note("botaxt: dashboard JSON yok");
    return;
  }

  await timed("botaxt dashboard", async () => {
    const res = await fetch(`${BASE}${prefix}/dashboard`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j || typeof j !== "object") throw new Error("dashboard nesne değil");
    return j;
  });

  let sessionId = null;
  await timed("botaxt session start", async () => {
    const res = await fetch(`${BASE}${prefix}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "stress" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j?.id) throw new Error("session id yok");
    sessionId = j.id;
    return j;
  });

  if (sessionId) {
    await timed("botaxt session end", async () => {
      const res = await fetch(`${BASE}${prefix}/sessions/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }
}

/* ------------------------------------------------------------ senaryolar */

async function settingsRoundTrip() {
  const screen = pick(SCREENS);
  await timed("settings GET", async () => {
    const res = await fetch(`${BASE}/api/settings?screen=${screen}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (typeof json !== "object" || json === null) throw new Error("nesne değil");
    return json;
  });

  await timed("settings PATCH", async () => {
    const res = await fetch(`${BASE}/api/settings/patch?screen=${screen}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        __stress: { at: Date.now(), nested: { deep: Math.random() } },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const merged = await res.json();
    // Derin birleştirme dokunulmamış alanları korumalı
    if (!merged.__stress) throw new Error("patch kaybedildi");
    if (screen !== "chat" && merged.positions === undefined) {
      throw new Error("patch mevcut alanları sildi");
    }
    return merged;
  });
}

async function badInputs() {
  // Bilinmeyen ekran → 400
  await timed("bad screen", () =>
    expectStatus("bad screen", `${BASE}/api/settings?screen=yokboyle`, {}, [400])
  );
  // Path traversal → 400
  await timed("traversal", () =>
    expectStatus(
      "traversal",
      `${BASE}/media/file?path=${encodeURIComponent("../../../../Windows/win.ini")}`,
      {},
      [400]
    )
  );
  // Göreli yol → 400
  await timed("relative path", () =>
    expectStatus("relative", `${BASE}/media/file?path=video.mp4`, {}, [400])
  );
  // Bozuk JSON gövdesi → 4xx, sunucu ayakta kalmalı
  await timed("bozuk JSON", () =>
    expectStatus(
      "bozuk JSON",
      `${BASE}/api/settings?screen=chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bu json değil",
      },
      [400, 415, 422]
    )
  );
  // Boş slug → hata ama çökme yok
  await timed("boş kick slug", () =>
    expectStatus("kick", `${BASE}/api/kick/chatroom?slug=`, {}, [200, 400, 502])
  );
  // Geçersiz videoId → 502/400
  await timed("kötü videoId", () =>
    expectStatus("yt", `${BASE}/api/youtube/chat?video_id=xx`, {}, [400, 502])
  );
}

async function libraryListing() {
  for (const kind of ["videos", "music", "logos", "backgrounds", "particles"]) {
    await timed(`list ${kind}`, async () => {
      const res = await fetch(`${BASE}/api/${kind}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      if (!Array.isArray(list)) throw new Error("dizi değil");
      return list;
    });
  }
}

/** Video oynatmanın dayandığı yol: Range istekleri tutarlı olmalı. */
async function mediaRanges(videoName) {
  if (!videoName) return;
  const url = `${BASE}/assets/videos/${encodeURIComponent(videoName)}`;

  const head = await timed("media ilk GET", async () => {
    const res = await fetch(url);
    if (res.status !== 200 && res.status !== 206) throw new Error(`HTTP ${res.status}`);
    // KRİTİK: Range başlığı yokken 206 dönmemeli — <video> bunu bozuk sayar
    if (res.status === 206) throw new Error("Range yokken 206 döndü (video oynatılamaz)");
    if (res.headers.get("accept-ranges") !== "bytes") {
      throw new Error("Accept-Ranges: bytes yok");
    }
    const len = Number(res.headers.get("content-length"));
    await res.arrayBuffer();
    return len;
  });

  if (!head) return;

  await timed("media Range", async () => {
    const res = await fetch(url, { headers: { Range: "bytes=0-1023" } });
    if (res.status !== 206) throw new Error(`Range için HTTP ${res.status}`);
    const cr = res.headers.get("content-range") || "";
    if (!/^bytes 0-\d+\/\d+$/.test(cr)) throw new Error(`bozuk Content-Range: ${cr}`);
    const body = await res.arrayBuffer();
    stats.bytes += body.byteLength;
    if (body.byteLength !== 1024) throw new Error(`1024 bekleniyordu, ${body.byteLength} geldi`);
  });

  await timed("media açık uçlu Range", async () => {
    const res = await fetch(url, { headers: { Range: "bytes=0-" } });
    if (res.status !== 206) throw new Error(`HTTP ${res.status}`);
    const body = await res.arrayBuffer();
    stats.bytes += body.byteLength;
  });

  await timed("media geçersiz Range", async () => {
    const res = await fetch(url, { headers: { Range: "bytes=999999999999-" } });
    if (![206, 416].includes(res.status)) throw new Error(`HTTP ${res.status}`);
    await res.arrayBuffer();
  });
}

/** WebSocket yayın hattı: çok istemci bağlanır, snapshot alır, kopar. */
async function wsStorm(count, ms) {
  const wsUrl = `${BASE.replace(/^http/, "ws")}/ws/overlay-sync`;
  let snapshots = 0;
  const sockets = [];

  await Promise.all(
    Array.from({ length: count }, () => {
      return new Promise((resolve) => {
        let settled = false;
        const done = (err) => {
          if (settled) return;
          settled = true;
          if (err) note(`ws: ${err}`);
          else stats.ok += 1;
          resolve();
        };
        try {
          const ws = new WebSocket(wsUrl);
          sockets.push(ws);
          const timeout = setTimeout(() => done("snapshot 5 sn içinde gelmedi"), 5000);
          ws.onmessage = (ev) => {
            try {
              const msg = JSON.parse(ev.data);
              if (msg.type === "snapshot") {
                snapshots += 1;
                clearTimeout(timeout);
                done();
              }
            } catch (e) {
              clearTimeout(timeout);
              done(`geçersiz JSON: ${e.message}`);
            }
          };
          ws.onerror = () => {
            clearTimeout(timeout);
            done("bağlantı hatası");
          };
        } catch (e) {
          done(e.message);
        }
      });
    })
  );

  // Yayın gerçekten ulaşıyor mu? Bir patch at, dinleyicilerde görülsün.
  let broadcasts = 0;
  for (const ws of sockets) {
    ws.onmessage = (ev) => {
      try {
        if (JSON.parse(ev.data).type === "settings") broadcasts += 1;
      } catch {
        /* */
      }
    };
  }
  await fetch(`${BASE}/api/settings/patch?screen=chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ __stressBroadcast: Date.now() }),
  });
  await new Promise((r) => setTimeout(r, Math.min(1500, ms)));

  for (const ws of sockets) {
    try {
      ws.close();
    } catch {
      /* */
    }
  }
  return { snapshots, broadcasts, clients: count };
}

/* ---------------------------------------------------------------- sürücü */

async function worker(deadline, videoName) {
  while (performance.now() < deadline) {
    const roll = Math.random();
    if (roll < 0.45) await settingsRoundTrip();
    else if (roll < 0.65) await libraryListing();
    else if (roll < 0.85) await mediaRanges(videoName);
    else await badInputs();
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function main() {
  process.stdout.write(`Hedef: ${BASE}\n`);

  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`\n✖ Sunucuya ulaşılamadı: ${BASE}\n  Uygulamayı açıp tekrar dene.\n`);
    process.exit(2);
  }

  const videos = await fetch(`${BASE}/api/videos`)
    .then((r) => r.json())
    .catch(() => []);
  const videoName = Array.isArray(videos) && videos.length ? videos[0] : null;
  process.stdout.write(
    videoName
      ? `Medya testi için video: ${videoName}\n`
      : "assets/videos boş — medya Range testleri atlanıyor\n"
  );
  process.stdout.write(`${WORKERS} işçi × ${SECONDS} sn + ${WS_CLIENTS} WebSocket istemcisi\n\n`);

  const t0 = performance.now();
  const deadline = t0 + SECONDS * 1000;

  const wsResult = await wsStorm(WS_CLIENTS, 1500);
  // Önce oturum API’sini bir kez doğrula (profil hatası regresyonu)
  await botaxtSessionRoundTrip();
  await Promise.all(Array.from({ length: WORKERS }, () => worker(deadline, videoName)));

  const elapsed = (performance.now() - t0) / 1000;
  const sorted = stats.latencies.slice().sort((a, b) => a - b);
  const total = stats.ok + stats.fail;

  process.stdout.write("──────── SONUÇ ────────\n");
  process.stdout.write(`Süre          : ${elapsed.toFixed(1)} sn\n`);
  process.stdout.write(`İstek         : ${total} (${(total / elapsed).toFixed(0)}/sn)\n`);
  process.stdout.write(`Başarılı      : ${stats.ok}\n`);
  process.stdout.write(`Hatalı        : ${stats.fail}\n`);
  process.stdout.write(`Aktarılan     : ${(stats.bytes / 1024 / 1024).toFixed(1)} MB\n`);
  process.stdout.write(
    `Gecikme       : p50 ${percentile(sorted, 50).toFixed(1)} ms · ` +
      `p95 ${percentile(sorted, 95).toFixed(1)} ms · ` +
      `p99 ${percentile(sorted, 99).toFixed(1)} ms\n`
  );
  process.stdout.write(
    `WebSocket     : ${wsResult.snapshots}/${wsResult.clients} snapshot · ` +
      `${wsResult.broadcasts} yayın mesajı\n`
  );

  if (wsResult.snapshots < wsResult.clients) {
    note(`ws: ${wsResult.clients - wsResult.snapshots} istemci snapshot alamadı`);
  }
  if (wsResult.broadcasts < wsResult.clients) {
    note(`ws: yayın ${wsResult.broadcasts}/${wsResult.clients} istemciye ulaştı`);
  }

  // Sunucu hâlâ ayakta mı?
  const after = await fetch(`${BASE}/api/health`).catch(() => null);
  process.stdout.write(`Test sonrası  : ${after && after.ok ? "sunucu ayakta ✓" : "SUNUCU DÜŞTÜ ✖"}\n`);
  if (!after || !after.ok) note("sunucu stres sonrası yanıt vermiyor");

  if (stats.errors.size) {
    process.stdout.write("\n──────── HATALAR ────────\n");
    for (const [msg, count] of [...stats.errors].sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${String(count).padStart(5)}×  ${msg}\n`);
    }
  }

  const failRate = total ? stats.fail / total : 1;
  process.stdout.write(`\n${stats.fail === 0 ? "✓ TEMİZ" : `✖ ${stats.fail} hata`}\n`);
  process.exit(failRate > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
