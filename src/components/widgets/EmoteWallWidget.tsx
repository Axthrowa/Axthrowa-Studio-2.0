/** Emote Wall — Matter.js fizik: rastgele velocity + force ile patlama/fırlama. */

import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { useWidgetSync, type WidgetSyncEvent } from "../../lib/widgets/useWidgetSync";
import { isLocalBotUser } from "../../lib/sohbetBot/botIdentity";
import {
  playWidgetSfx,
  resolveSfx,
  volFromConfig,
  subscribeWidgetBus,
} from "../../lib/widgets/widgetBus";

type Props = { config: Record<string, unknown> };

const EMOJI_RE =
  /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|:\w+:)/gu;

function extractTokens(text: string): string[] {
  if (text.trim().startsWith("!")) return [];
  const found = text.match(EMOJI_RE) || [];
  if (found.length) return found.slice(0, 8);
  const word = text.trim().slice(0, 3);
  return word ? [word] : ["✨"];
}

type Meta = { text: string; size: number; born: number; life: number };

export default function EmoteWallWidget({ config }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWidgetSync({ kinds: ["chat"] });
  const maxOnScreen = Math.min(Number(config.maxOnScreen) || 12, 16);
  const minSize = Number(config.minSize) || 32;
  const maxSize = Number(config.maxSize) || 96;
  const lifetimeMs = Number(config.lifetimeMs) || 6000;
  const opacity = Number(config.opacity ?? 1);
  const gravity = Number(config.gravity ?? 0.55);
  const engineRef = useRef<Matter.Engine | null>(null);
  const metaRef = useRef<Map<number, Meta>>(new Map());
  const labelsRef = useRef<Map<number, HTMLSpanElement>>(new Map());
  const spawnRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const { Engine, World, Bodies, Body, Runner } = Matter;
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    const engine = Engine.create({ gravity: { x: 0, y: gravity * 0.0012, scale: 0.001 } });
    engineRef.current = engine;

    const floor = Bodies.rectangle(w / 2, h + 40, w + 200, 80, { isStatic: true });
    const wallL = Bodies.rectangle(-40, h / 2, 80, h * 2, { isStatic: true });
    const wallR = Bodies.rectangle(w + 40, h / 2, 80, h * 2, { isStatic: true });
    World.add(engine.world, [floor, wallL, wallR]);

    const runner = Runner.create();
    Runner.run(runner, engine);

    spawnRef.current = (text: string) => {
      if (metaRef.current.size >= maxOnScreen) {
        // en eskiyi sil
        let oldestId = 0;
        let oldest = Infinity;
        metaRef.current.forEach((m, id) => {
          if (m.born < oldest) {
            oldest = m.born;
            oldestId = id;
          }
        });
        const body = engine.world.bodies.find((b) => b.id === oldestId);
        if (body) World.remove(engine.world, body);
        labelsRef.current.get(oldestId)?.remove();
        labelsRef.current.delete(oldestId);
        metaRef.current.delete(oldestId);
      }
      const size = minSize + Math.random() * (maxSize - minSize);
      const x = w * (0.15 + Math.random() * 0.7);
      const y = h * (0.75 + Math.random() * 0.15);
      const body = Bodies.circle(x, y, size * 0.42, {
        restitution: Number(config.restitution ?? 0.82),
        friction: Number(config.friction ?? 0.02),
        frictionAir: Number(config.frictionAir ?? 0.012),
        mass: Number(config.mass ?? 1),
      });
      const impulse = Number(config.burstImpulse ?? 1);
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 14 * impulse,
        y: (-6 - Math.random() * 10) * impulse,
      });
      Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.07 * impulse,
        y: (-0.03 - Math.random() * 0.05) * impulse,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.25 * impulse);
      body.torque += (Math.random() - 0.5) * 0.04 * impulse;
      World.add(engine.world, body);

      const el = document.createElement("span");
      el.textContent = text;
      el.style.cssText = `position:absolute;left:0;top:0;font-size:${size}px;pointer-events:none;user-select:none;will-change:transform;filter:drop-shadow(0 2px 8px rgba(0,0,0,.45));`;
      host.appendChild(el);
      labelsRef.current.set(body.id, el);
      metaRef.current.set(body.id, {
        text,
        size,
        born: performance.now(),
        life: lifetimeMs * (0.85 + Math.random() * 0.3),
      });
    };

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      for (const body of [...engine.world.bodies]) {
        if (body.isStatic) continue;
        const meta = metaRef.current.get(body.id);
        const el = labelsRef.current.get(body.id);
        if (!meta || !el) continue;
        const age = now - meta.born;
        if (age > meta.life || body.position.y > h + 120) {
          World.remove(engine.world, body);
          el.remove();
          labelsRef.current.delete(body.id);
          metaRef.current.delete(body.id);
          continue;
        }
        const fade = age > meta.life - 800 ? Math.max(0, 1 - (age - (meta.life - 800)) / 800) : 1;
        el.style.opacity = String(fade);
        el.style.transform = `translate(${body.position.x - meta.size / 2}px, ${body.position.y - meta.size / 2}px) rotate(${body.angle}rad)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      Runner.stop(runner);
      Engine.clear(engine);
      labelsRef.current.forEach((el) => el.remove());
      labelsRef.current.clear();
      metaRef.current.clear();
      engineRef.current = null;
    };
  }, [gravity, maxOnScreen, minSize, maxSize, lifetimeMs]);

  useEffect(() => {
    return subscribe((ev: WidgetSyncEvent) => {
      if (ev.bot || isLocalBotUser(ev.user || "")) return;
      const tokens = extractTokens(ev.text || "");
      for (const t of tokens) spawnRef.current(t);
    });
  }, [subscribe]);

  useEffect(() => {
    const burstOnHype = config.burstOnHypeLevel !== false;
    const listenGoal = config.listenGoalComplete !== false;
    const count = Math.min(Number(config.burstCount) || 8, 12);
    const emojis = ["🔥", "✨", "💎", "🚀", "💜", "⚡", "🎉", "💥"];
    return subscribeWidgetBus((ev) => {
      const burst =
        (burstOnHype &&
          (ev.action === "hypetrain.level" || ev.action === "emotewall.burst")) ||
        (listenGoal && ev.action === "goal.complete") ||
        ev.action === "chat.hype";
      if (!burst) return;
      playWidgetSfx(
        resolveSfx(config, "sfxUrl", "preset:sparkle"),
        volFromConfig(config, 0.65)
      );
      for (let i = 0; i < count; i++) {
        window.setTimeout(() => {
          spawnRef.current(emojis[i % emojis.length]);
        }, i * 35);
      }
    });
  }, [config]);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none relative studio-widget-root overflow-hidden bg-transparent"
      style={{ opacity }}
    />
  );
}
