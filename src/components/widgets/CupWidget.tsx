/**
 * Cup Widget — Matter.js kap çeşitleri + bağış ağırlığı + SFX.
 */

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { useSearchParams } from "react-router-dom";
import type { WidgetSyncEvent } from "../../lib/widgets/useWidgetSync";
import { useWidgetSync } from "../../lib/widgets/useWidgetSync";
import {
  playWidgetSfx,
  resolveSfx,
  volFromConfig,
} from "../../lib/widgets/widgetBus";

type Props = { config: Record<string, unknown> };
type SpawnKind = "coin" | "gem" | "logo" | "sub" | "emoji";

const FILL: Record<SpawnKind, string> = {
  coin: "#fbbf24",
  gem: "#22d3ee",
  logo: "#ff8a5b",
  sub: "#a78bfa",
  emoji: "#f8fafc",
};

type SpawnOpts = { kind: SpawnKind; label?: string; radius?: number; density?: number };

export default function CupWidget({ config }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const spawnRef = useRef<(opts: SpawnOpts) => void>(() => {});
  const startedRef = useRef(false);
  const [sp] = useSearchParams();
  const demo = sp.get("demo") === "1" || sp.get("preview") === "1";

  const width = Math.max(180, Number(config.cupWidth) || 320);
  const height = Math.max(220, Number(config.cupHeight) || 420);
  const gravity = Number(config.gravity) || 1;
  const maxBodies = Number(config.maxBodies) || 120;
  const opacity = Number(config.opacity ?? 1);
  const vessel = String(config.vessel || "cup").toLowerCase();
  const weightFromAmount = config.weightFromAmount !== false;
  const smallTh = Number(config.smallTipThreshold) || 10;
  const bigTh = Number(config.bigTipThreshold) || 100;
  const smallCount = Number(config.smallTipCount) || 12;
  const bigScale = Number(config.bigTipScale) || 2.2;

  const { subscribe, connected } = useWidgetSync({
    kinds: ["tip", "sub", "bits", "donation", "chat"],
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    startedRef.current = true;

    const { Engine, Render, Runner, Bodies, Composite, Body, Events } = Matter;
    const engine = Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y =
      vessel === "blackhole" ? -0.35 * gravity : 0.9 * gravity;

    const render = Render.create({
      element: host,
      engine,
      options: {
        width,
        height,
        wireframes: false,
        background: "transparent",
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        showAngleIndicator: false,
      },
    });

    const canvas = render.canvas;
    canvas.style.background = "transparent";
    canvas.style.display = "block";
    const ctx = render.context;
    const onBeforeRender = () => ctx.clearRect(0, 0, width, height);
    Events.on(render, "beforeRender", onBeforeRender);

    const wallStyle = {
      isStatic: true,
      friction: 0.4,
      restitution: 0.05,
      render: {
        fillStyle: "rgba(255,255,255,0.18)",
        strokeStyle: "rgba(255,255,255,0.35)",
        lineWidth: 1,
      },
    } as const;

    const wallT = 18;
    const parts: Matter.Body[] = [];

    if (vessel === "box") {
      parts.push(
        Bodies.rectangle(width * 0.12, height * 0.55, wallT, height * 0.7, wallStyle),
        Bodies.rectangle(width * 0.88, height * 0.55, wallT, height * 0.7, wallStyle),
        Bodies.rectangle(width * 0.5, height * 0.9, width * 0.78, 22, {
          ...wallStyle,
          chamfer: { radius: 4 },
        })
      );
    } else if (vessel === "jar") {
      const left = Bodies.rectangle(width * 0.22, height * 0.55, wallT, height * 0.68, {
        ...wallStyle,
        chamfer: { radius: 10 },
      });
      const right = Bodies.rectangle(width * 0.78, height * 0.55, wallT, height * 0.68, {
        ...wallStyle,
        chamfer: { radius: 10 },
      });
      Body.rotate(left, 0.08);
      Body.rotate(right, -0.08);
      parts.push(
        left,
        right,
        Bodies.rectangle(width * 0.5, height * 0.88, width * 0.55, 24, {
          ...wallStyle,
          chamfer: { radius: 12 },
        }),
        Bodies.rectangle(width * 0.5, height * 0.18, width * 0.28, 14, wallStyle)
      );
    } else if (vessel === "blackhole") {
      parts.push(
        Bodies.circle(width * 0.5, height * 0.55, Math.min(width, height) * 0.08, {
          isStatic: true,
          isSensor: true,
          render: { fillStyle: "rgba(0,0,0,0.85)", strokeStyle: "#3ecfcf", lineWidth: 2 },
        })
      );
    } else {
      const left = Bodies.rectangle(width * 0.2, height * 0.52, wallT, height * 0.72, {
        ...wallStyle,
        chamfer: { radius: 6 },
      });
      const right = Bodies.rectangle(width * 0.8, height * 0.52, wallT, height * 0.72, {
        ...wallStyle,
        chamfer: { radius: 6 },
      });
      Body.rotate(left, 0.16);
      Body.rotate(right, -0.16);
      parts.push(
        left,
        right,
        Bodies.rectangle(width * 0.5, height * 0.9, width * 0.62, 26, {
          ...wallStyle,
          chamfer: { radius: 8 },
        })
      );
    }

    parts.push(
      Bodies.rectangle(width * 0.5, height - 4, width * 0.95, 10, {
        isStatic: true,
        render: { visible: false },
      })
    );
    Composite.add(engine.world, parts);

    let bodyCount = 0;
    const pruneOldest = () => {
      const dynamics = Composite.allBodies(engine.world).filter((b) => !b.isStatic);
      if (dynamics[0]) {
        Composite.remove(engine.world, dynamics[0]);
        bodyCount = Math.max(0, bodyCount - 1);
      }
    };

    const spawn = (opts: SpawnOpts) => {
      while (bodyCount >= maxBodies) pruneOldest();
      const kind = opts.kind;
      const x = width * 0.32 + Math.random() * width * 0.36;
      const baseR =
        kind === "gem" ? 10 : kind === "logo" ? 15 : kind === "emoji" ? 14 : 12;
      const r = Math.max(4, opts.radius ?? baseR);
      const ball = Bodies.circle(x, vessel === "blackhole" ? height * 0.85 : 18 + Math.random() * 12, r, {
        restitution: Number(config.restitution ?? 0.32),
        friction: Number(config.friction ?? 0.2),
        frictionAir: Number(
          config.frictionAir ?? (vessel === "blackhole" ? 0.04 : 0.01)
        ),
        mass: Number(config.mass ?? 1) * (opts.density ? opts.density / 0.0025 : 1),
        label: opts.label || kind,
        render: {
          fillStyle: FILL[kind],
          strokeStyle: "rgba(255,255,255,0.45)",
          lineWidth: 1.5,
        },
      });
      const impulse = Number(config.spawnImpulse ?? 1);
      Body.setVelocity(ball, {
        x: (Math.random() - 0.5) * 3.5 * impulse,
        y: (0.5 + Math.random() * 2) * impulse,
      });
      Body.setAngularVelocity(ball, (Math.random() - 0.5) * 0.25 * impulse);
      ball.torque += (Math.random() - 0.5) * 0.03 * impulse;
      if (vessel === "blackhole") {
        Body.applyForce(ball, ball.position, {
          x: (width * 0.5 - ball.position.x) * 0.00002 * impulse,
          y: -0.004 * impulse,
        });
      }
      Composite.add(engine.world, ball);
      bodyCount += 1;
    };
    spawnRef.current = spawn;

    const onAfterRender = () => {
      const g = render.context;
      g.save();
      g.strokeStyle =
        vessel === "blackhole"
          ? "rgba(62,207,207,0.55)"
          : vessel === "jar"
            ? "rgba(255,200,120,0.5)"
            : "rgba(255,255,255,0.55)";
      g.lineWidth = 3;
      g.lineJoin = "round";
      g.beginPath();
      if (vessel === "box") {
        g.rect(width * 0.14, height * 0.2, width * 0.72, height * 0.7);
      } else if (vessel === "jar") {
        g.moveTo(width * 0.35, height * 0.16);
        g.lineTo(width * 0.28, height * 0.84);
        g.quadraticCurveTo(width * 0.5, height * 0.96, width * 0.72, height * 0.84);
        g.lineTo(width * 0.65, height * 0.16);
        g.closePath();
      } else if (vessel === "blackhole") {
        g.arc(width * 0.5, height * 0.55, Math.min(width, height) * 0.22, 0, Math.PI * 2);
      } else {
        g.moveTo(width * 0.3, height * 0.16);
        g.lineTo(width * 0.16, height * 0.84);
        g.quadraticCurveTo(width * 0.5, height * 0.98, width * 0.84, height * 0.84);
        g.lineTo(width * 0.7, height * 0.16);
      }
      g.stroke();
      g.restore();

      for (const b of Composite.allBodies(engine.world)) {
        if (b.isStatic) continue;
        const text = String(b.label || "");
        if (!text || ["coin", "gem", "logo", "sub"].includes(text)) continue;
        g.save();
        g.translate(b.position.x, b.position.y);
        g.rotate(b.angle);
        g.font = "16px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text.slice(0, 2), 0, 0);
        g.restore();
      }
    };
    Events.on(render, "afterRender", onAfterRender);

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    spawn({ kind: "coin" });
    spawn({ kind: "gem" });
    spawn({ kind: "logo" });

    let demoTimer: number | undefined;
    if (demo) {
      demoTimer = window.setInterval(() => {
        const kinds: SpawnKind[] = ["coin", "gem", "logo", "sub", "emoji"];
        const k = kinds[Math.floor(Math.random() * kinds.length)];
        spawn({ kind: k, label: k === "emoji" ? "✨" : undefined });
      }, 900);
    }

    return () => {
      if (demoTimer) window.clearInterval(demoTimer);
      spawnRef.current = () => {};
      try {
        Events.off(render, "beforeRender", onBeforeRender);
        Events.off(render, "afterRender", onAfterRender);
      } catch {
        /* */
      }
      try {
        Render.stop(render);
        Runner.stop(runner);
      } catch {
        /* */
      }
      try {
        Composite.clear(engine.world, false);
        Engine.clear(engine);
      } catch {
        /* */
      }
      try {
        if (render.canvas?.parentNode) {
          render.canvas.parentNode.removeChild(render.canvas);
        }
      } catch {
        /* */
      }
      while (host.firstChild) host.removeChild(host.firstChild);
      startedRef.current = false;
    };
  }, [width, height, gravity, maxBodies, demo, vessel]);

  useEffect(() => {
    return subscribe((ev: WidgetSyncEvent) => {
      const sfx = resolveSfx(config, "sfxOnDrop", "preset:coin");
      playWidgetSfx(sfx, volFromConfig(config, 0.65));

      if (ev.kind === "chat") {
        const m = (ev.text || "").match(/\p{Extended_Pictographic}/u);
        if (m) spawnRef.current({ kind: "emoji", label: m[0] });
        return;
      }
      if (ev.kind === "sub") {
        spawnRef.current({ kind: "sub", radius: 14, density: 0.004 });
        spawnRef.current({ kind: "coin" });
        return;
      }
      if (ev.kind === "bits") {
        spawnRef.current({ kind: "gem", density: 0.0035 });
        return;
      }

      const amt = typeof ev.amount === "number" ? ev.amount : Number(ev.amount);
      if (weightFromAmount && Number.isFinite(amt) && amt > 0 && amt < smallTh) {
        for (let i = 0; i < smallCount; i++) {
          spawnRef.current({
            kind: "coin",
            radius: 5 + Math.random() * 3,
            density: 0.0012,
          });
        }
        return;
      }
      if (weightFromAmount && Number.isFinite(amt) && amt >= bigTh) {
        spawnRef.current({
          kind: "logo",
          radius: 14 * bigScale,
          density: 0.008 * bigScale,
        });
        spawnRef.current({ kind: "gem", radius: 12 * bigScale, density: 0.006 });
        spawnRef.current({ kind: "coin", radius: 10 * bigScale });
        return;
      }

      spawnRef.current({ kind: "coin" });
      spawnRef.current({ kind: Math.random() > 0.45 ? "logo" : "gem" });
      if (Number.isFinite(amt) && amt >= 25) {
        spawnRef.current({ kind: "gem" });
        spawnRef.current({ kind: "coin" });
      }
    });
  }, [subscribe, config, weightFromAmount, smallTh, bigTh, smallCount, bigScale]);

  return (
    <div
      className="relative flex yya-widget-root flex-col items-center justify-end bg-transparent pb-2"
      style={{ opacity }}
    >
      <div ref={hostRef} className="relative" style={{ width, height }} />
      {(demo || sp.get("debug") === "1") && (
        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white/80">
          {vessel} · ws {connected ? "ON" : "OFF"}
        </p>
      )}
    </div>
  );
}
