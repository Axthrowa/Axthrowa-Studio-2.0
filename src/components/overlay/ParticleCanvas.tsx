import { memo, useEffect, useRef } from "react";
import { API_BASE } from "../../lib/api";
import { usePreviewQuality } from "../../lib/previewQuality";

type Props = {
  accent?: string;
  types?: Record<string, boolean>;
  sizes?: Record<string, number>;
  /** Tip başına vurgu rengi */
  colors?: Record<string, string>;
  /** Tip başına glow (varsayılan true) */
  glow?: Record<string, boolean>;
  /** 20–200, varsayılan 100 */
  density?: number;
  assetsBase?: string;
};

type P = {
  x: number;
  y: number;
  baseR: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
  type: string;
  rot: number;
  spin: number;
};

type ParticleSprite = CanvasImageSource & { width: number; height: number };

function enabledKey(types: Record<string, boolean> | undefined, keys: string[]) {
  const enabled = keys.filter((k) => types?.[k] !== false);
  return (enabled.length ? enabled : keys).slice().sort().join("|");
}

/**
 * İndirilen “transparent” PNG’lerin çoğu aslında beyaz/düz opak arka plan.
 * Gerçek alfa yoksa köşelerden flood-fill ile arka planı siler.
 */
function prepareParticleSprite(img: HTMLImageElement): ParticleSprite {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return img;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const n = w * h;

  let softAlpha = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 250) softAlpha++;
  }
  // Zaten anlamlı şeffaflık varsa dokunma
  if (softAlpha > n * 0.015) {
    return img;
  }

  const px = (x: number, y: number) => (y * w + x) * 4;
  const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
  let br = 0;
  let bg = 0;
  let bb = 0;
  for (const i of corners) {
    br += d[i];
    bg += d[i + 1];
    bb += d[i + 2];
  }
  br = Math.round(br / 4);
  bg = Math.round(bg / 4);
  bb = Math.round(bb / 4);

  const thresh = 42;
  const thresh2 = thresh * thresh;
  const similar = (i: number) => {
    const dr = d[i] - br;
    const dg = d[i + 1] - bg;
    const db = d[i + 2] - bb;
    return dr * dr + dg * dg + db * db <= thresh2;
  };

  const visited = new Uint8Array(n);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (visited[idx]) return;
    if (!similar(idx * 4)) return;
    visited[idx] = 1;
    stack.push(idx);
  };
  push(0, 0);
  push(w - 1, 0);
  push(0, h - 1);
  push(w - 1, h - 1);
  push(Math.floor(w / 2), 0);
  push(Math.floor(w / 2), h - 1);
  push(0, Math.floor(h / 2));
  push(w - 1, Math.floor(h / 2));

  while (stack.length) {
    const idx = stack.pop()!;
    d[idx * 4 + 3] = 0;
    const x = idx % w;
    const y = (idx / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // Kenar yumuşatma: şeffafa komşu, arka plana yakın pikseller
  const soft2 = (thresh + 28) * (thresh + 28);
  const alphaCopy = new Uint8Array(n);
  for (let i = 0; i < n; i++) alphaCopy[i] = d[i * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (alphaCopy[idx] === 0) continue;
      const i = idx * 4;
      const dr = d[i] - br;
      const dg = d[i + 1] - bg;
      const db = d[i + 2] - bb;
      const dist2 = dr * dr + dg * dg + db * db;
      if (dist2 > soft2) continue;
      const nearClear =
        alphaCopy[idx - 1] === 0 ||
        alphaCopy[idx + 1] === 0 ||
        alphaCopy[idx - w] === 0 ||
        alphaCopy[idx + w] === 0;
      if (!nearClear) continue;
      const t = Math.min(1, Math.sqrt(dist2) / (thresh + 28));
      d[i + 3] = Math.round(255 * t * t);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** Poisson-disk style scatter — particles stay apart at spawn */
function scatterPoints(count: number, w: number, h: number, minDist: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const maxTries = count * 50;
  let tries = 0;
  while (pts.length < count && tries < maxTries) {
    tries++;
    const x = Math.random() * w;
    const y = Math.random() * h;
    let ok = true;
    for (const p of pts) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < minDist * minDist) {
        ok = false;
        break;
      }
    }
    if (ok) pts.push({ x, y });
  }
  while (pts.length < count) {
    pts.push({ x: Math.random() * w, y: Math.random() * h });
  }
  return pts;
}

function ParticleCanvas({
  accent = "#7c5cff",
  types = {},
  sizes = {},
  colors = {},
  glow = {},
  density = 100,
  assetsBase = `${API_BASE}/assets/particles`,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const accentRef = useRef(accent);
  const sizesRef = useRef(sizes);
  const typesRef = useRef(types);
  const colorsRef = useRef(colors);
  const glowRef = useRef(glow);
  const densityRef = useRef(density);
  const keysRef = useRef<string[]>([]);
  const imagesRef = useRef<Record<string, ParticleSprite>>({});
  const particlesRef = useRef<P[]>([]);
  const rafRef = useRef(0);
  const enabledSigRef = useRef("");
  const readyRef = useRef(false);
  const logicalRef = useRef({ w: 1, h: 1 });
  const bufScaleRef = useRef(1);
  const resizeRef = useRef<(() => void) | null>(null);
  const quality = usePreviewQuality();
  const qualityRef = useRef(quality);
  qualityRef.current = quality;

  accentRef.current = accent;
  sizesRef.current = sizes;
  typesRef.current = types;
  colorsRef.current = colors;
  glowRef.current = glow;
  densityRef.current = density;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/particles`, { cache: "no-store" });
        const files: string[] = res.ok ? await res.json() : [];
        const nextKeys = files.map((f) => f.replace(/\.(png|webp)$/i, ""));
        const imgs: Record<string, ParticleSprite> = {};
        await Promise.all(
          files.map(
            (file, i) =>
              new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  try {
                    imgs[nextKeys[i]] = prepareParticleSprite(img);
                  } catch {
                    imgs[nextKeys[i]] = img;
                  }
                  resolve();
                };
                img.onerror = () => resolve();
                img.src = `${assetsBase}/${file}`;
              })
          )
        );
        if (cancelled) return;
        imagesRef.current = imgs;
        keysRef.current = nextKeys;
        enabledSigRef.current = "";
        readyRef.current = true;
      } catch {
        if (!cancelled) {
          keysRef.current = [];
          readyRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetsBase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const activeTypes = () => {
      const keys = keysRef.current;
      const enabled = keys.filter((k) => typesRef.current?.[k] !== false);
      return enabled.length ? enabled : keys;
    };

    const rebuildParticles = () => {
      const active = activeTypes();
      const { w: logW, h: logH } = logicalRef.current;
      const dens = Math.max(0.15, Math.min(2.5, (densityRef.current || 100) / 100));
      const densKey = Math.round(dens * 100);
      const sig = active.slice().sort().join("|") + `@${logW}x${logH}@d${densKey}`;
      if (sig === enabledSigRef.current && particlesRef.current.length) return;
      enabledSigRef.current = sig;
      if (!active.length || logW < 2) {
        particlesRef.current = [];
        return;
      }
      const area = logW * logH;
      const REF_W = 1920;
      const REF_H = 1080;
      const speedScale = Math.max(0.35, logH / REF_H);
      const sizeScale = Math.max(0.45, Math.min(1.35, logH / REF_H));
      const base = Math.round((REF_W * REF_H) / 42000);
      const count = Math.min(90, Math.max(4, Math.round(base * dens)));
      const minDist = Math.max(36 * sizeScale, Math.sqrt(area / (count * 1.35)));
      const pts = scatterPoints(count, logW, logH, minDist);
      particlesRef.current = pts.map((pt) => {
        const type = active[Math.floor(Math.random() * active.length)];
        const baseR = (2.0 + Math.random() * 1.8) * sizeScale;
        const mul = (sizesRef.current?.[type] || 100) / 100;
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.06 + Math.random() * 0.22) * speedScale;
        return {
          x: pt.x,
          y: pt.y,
          baseR,
          r: baseR * mul,
          vx: Math.cos(angle) * speed * 0.35,
          vy: -speed,
          a: 0.25 + Math.random() * 0.55,
          type,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.008,
        };
      });
    };

    const resize = () => {
      const w = Math.max(1, canvas.clientWidth || window.innerWidth);
      const h = Math.max(1, canvas.clientHeight || window.innerHeight);
      const q = qualityRef.current.scale;
      const bufW = Math.max(1, Math.round(w * q));
      const bufH = Math.max(1, Math.round(h * q));
      const oldW = logicalRef.current.w;
      const oldH = logicalRef.current.h;
      const sameLogical = oldW === w && oldH === h;
      const sameBuffer = canvas.width === bufW && canvas.height === bufH;
      if (sameLogical && sameBuffer) return;

      const had = particlesRef.current.length > 0 && oldW > 1 && oldH > 1;
      canvas.width = bufW;
      canvas.height = bufH;
      logicalRef.current = { w, h };
      ctx.setTransform(bufW / w, 0, 0, bufH / h, 0, 0);
      bufScaleRef.current = bufH / h;
      if (sameLogical) return;

      if (had) {
        const sx = w / oldW;
        const sy = h / oldH;
        for (const p of particlesRef.current) {
          p.x *= sx;
          p.y *= sy;
          p.vx *= sy;
          p.vy *= sy;
          p.baseR *= sy;
        }
        const active = activeTypes();
        const dens = Math.max(0.15, Math.min(2.5, (densityRef.current || 100) / 100));
        enabledSigRef.current =
          active.slice().sort().join("|") + `@${w}x${h}@d${Math.round(dens * 100)}`;
      } else {
        enabledSigRef.current = "";
        rebuildParticles();
      }
    };

    let frameParity = 0;
    let lastTs = 0;
    const separate = (list: P[]) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy;
          const min = (a.r + b.r) * 5 + 36;
          if (dist2 > 0 && dist2 < min * min) {
            const dist = Math.sqrt(dist2) || 0.01;
            const pushAmt = ((min - dist) / min) * 0.18;
            dx = (dx / dist) * pushAmt;
            dy = (dy / dist) * pushAmt;
            a.x -= dx;
            a.y -= dy;
            b.x += dx;
            b.y += dy;
          }
        }
      }
    };

    const spriteSize = (img: ParticleSprite) => {
      if (img instanceof HTMLImageElement) {
        return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
      }
      if (img instanceof HTMLCanvasElement) {
        return { w: img.width, h: img.height };
      }
      const any = img as { width?: number; height?: number };
      return { w: any.width || 1, h: any.height || 1 };
    };

    const draw = (p: P) => {
      const img = imagesRef.current[p.type];
      const mul = (sizesRef.current?.[p.type] || 100) / 100;
      const color = colorsRef.current?.[p.type] || accentRef.current;
      const useGlow = glowRef.current?.[p.type] !== false;
      p.r = p.baseR * mul;
      if (img) {
        const { w: nw, h: nh } = spriteSize(img);
        if (nw > 0 && nh > 0) {
          const aspect = nw / nh;
          const targetLong = p.r * 8;
          const width = aspect >= 1 ? targetLong : targetLong * aspect;
          const height = aspect >= 1 ? targetLong / aspect : targetLong;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.a;
          if (useGlow) {
            ctx.shadowColor = color;
            ctx.shadowBlur = p.r * 1.8 * bufScaleRef.current;
          } else {
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
          }
          ctx.drawImage(img, -width / 2, -height / 2, width, height);
          ctx.restore();
          return;
        }
      }
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = p.a;
      if (useGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = p.r * 2 * bufScaleRef.current;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const recycleX = (w: number, list: P[], exclude: P) => {
      for (let t = 0; t < 12; t++) {
        const x = Math.random() * w;
        let ok = true;
        for (const o of list) {
          if (o === exclude) continue;
          const dx = o.x - x;
          const dy = o.y - (exclude.y < 0 ? exclude.y + 80 : exclude.y);
          if (dx * dx + dy * dy < 48 * 48) {
            ok = false;
            break;
          }
        }
        if (ok) return x;
      }
      return Math.random() * w;
    };

    let lastDraw = 0;
    const tick = (now: number) => {
      const fps = qualityRef.current.maxFps;
      if (fps > 0 && lastDraw && now - lastDraw < 1000 / fps - 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastDraw = now;

      const { w, h } = logicalRef.current;
      if (readyRef.current) {
        const dens = Math.max(0.15, Math.min(2.5, (densityRef.current || 100) / 100));
        const sig =
          enabledKey(typesRef.current, keysRef.current) +
          `@${w}x${h}@d${Math.round(dens * 100)}`;
        if (sig !== enabledSigRef.current) rebuildParticles();
      }

      const dt = lastTs ? Math.min(2.5, (now - lastTs) / (1000 / 60)) : 1;
      lastTs = now;

      ctx.clearRect(0, 0, w, h);
      const list = particlesRef.current;
      for (const p of list) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        if (p.y < -50) {
          p.y = h + 40;
          p.x = recycleX(w, list, p);
        } else if (p.y > h + 50) {
          p.y = -40;
          p.x = recycleX(w, list, p);
        }
        if (p.x < -50) p.x = w + 40;
        if (p.x > w + 50) p.x = -40;
      }
      frameParity ^= 1;
      if (frameParity === 0) separate(list);
      for (const p of list) draw(p);
      rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    resizeRef.current = resize;
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(tick);

    const onVisibility = () => {
      cancelAnimationFrame(rafRef.current);
      if (!document.hidden) rafRef.current = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeRef.current = null;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    resizeRef.current?.();
  }, [quality.scale]);

  return <canvas id="bgCanvas" ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

export default memo(ParticleCanvas);
