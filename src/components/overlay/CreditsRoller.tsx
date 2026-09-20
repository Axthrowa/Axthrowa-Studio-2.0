import { useEffect, useRef, CSSProperties } from "react";
import { FONT_STACKS, TextStyle } from "../../lib/textStyles";

export type CreditSection = {
  title: string;
  lines: string[];
  titleStyle?: TextStyle;
  bodyStyle?: TextStyle;
};

type Props = {
  sections: CreditSection[];
  speedSec?: number;
  gapSec?: number;
  fallbackStyle?: TextStyle;
  fallbackFont?: string;
};

function styleFrom(st: TextStyle | undefined, fallbackFont?: string): CSSProperties {
  const fontId = st?.font || fallbackFont || "system";
  const style: CSSProperties = {};
  if (fontId && FONT_STACKS[fontId]) style.fontFamily = FONT_STACKS[fontId];
  if (st?.size) style.fontSize = `${(st.size / 100) * 1.15}em`;
  if (st?.color) style.color = st.color;
  if (st?.accentColor) (style as any)["--accent"] = st.accentColor;
  return style;
}

function mergeStyle(local?: TextStyle, fallback?: TextStyle): TextStyle {
  return {
    font: local?.font || fallback?.font,
    size: local?.size ?? fallback?.size,
    effect: local?.effect && local.effect !== "none" ? local.effect : fallback?.effect,
    anim: local?.anim && local.anim !== "none" ? local.anim : fallback?.anim,
    color: local?.color || fallback?.color,
    accentColor: local?.accentColor || fallback?.accentColor,
  };
}

/** Tek geçiş → bekle → tekrar */
export default function CreditsRoller({
  sections,
  speedSec = 40,
  gapSec = 3,
  fallbackStyle,
  fallbackFont,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    let cancelled = false;
    let timer = 0;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    const run = async () => {
      while (!cancelled) {
        const wh = wrap.clientHeight || 1;
        const ih = inner.scrollHeight || 1;
        inner.style.transition = "none";
        inner.style.transform = `translateY(${wh}px)`;
        void inner.offsetHeight;
        const duration = Math.max(8, speedSec) * 1000;
        inner.style.transition = `transform ${duration}ms linear`;
        inner.style.transform = `translateY(${-ih}px)`;
        await sleep(duration);
        if (cancelled) break;
        await sleep(Math.max(0.5, gapSec) * 1000);
      }
    };

    void run();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sections, speedSec, gapSec]);

  const fb = fallbackStyle || {};

  return (
    <div className="credits-scroll" ref={wrapRef}>
      <div
        className="credits-inner credits-js"
        ref={innerRef}
        style={styleFrom(fb, fallbackFont)}
        data-fx={fb.effect && fb.effect !== "none" ? fb.effect : undefined}
      >
        {sections.map((sec, si) => {
          const ts = mergeStyle(sec.titleStyle, fb);
          const bs = mergeStyle(sec.bodyStyle, fb);
          return (
            <div className="credits-section" key={si}>
              {sec.title ? (
                <p
                  className="credits-title"
                  style={styleFrom(ts, fallbackFont)}
                  data-fx={ts.effect && ts.effect !== "none" ? ts.effect : undefined}
                  data-anim={ts.anim && ts.anim !== "none" ? ts.anim : undefined}
                >
                  {sec.title}
                </p>
              ) : null}
              {(sec.lines || []).map((line, li) =>
                line.trim() ? (
                  <p
                    key={li}
                    className="credits-line"
                    style={styleFrom(bs, fallbackFont)}
                    data-fx={bs.effect && bs.effect !== "none" ? bs.effect : undefined}
                    data-anim={bs.anim && bs.anim !== "none" ? bs.anim : undefined}
                  >
                    {line}
                  </p>
                ) : (
                  <p key={li} className="credits-spacer">
                    &nbsp;
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function sectionsFromSettings(settings: {
  creditsSections?: CreditSection[];
  credits?: string[];
}): CreditSection[] {
  if (Array.isArray(settings.creditsSections) && settings.creditsSections.length) {
    return settings.creditsSections;
  }
  const lines = (settings.credits || []).map((l) => String(l));
  if (!lines.length) {
    return [
      { title: "Destekçiler", lines: [] },
      { title: "Yeni Aboneler", lines: [] },
      { title: "Yeni Takipçiler", lines: [] },
    ];
  }
  const sections: CreditSection[] = [];
  let cur: CreditSection | null = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (cur) sections.push(cur);
      cur = null;
      continue;
    }
    const hash = line.match(/^#\s*(.+)$/);
    const looksTitle =
      !!hash ||
      (/^[A-ZÇĞİÖŞÜ0-9\s\W]{2,40}$/.test(line) && line === line.toUpperCase() && line.length < 40);
    if (looksTitle) {
      if (cur) sections.push(cur);
      cur = { title: hash ? hash[1].trim() : line.trim(), lines: [] };
    } else {
      if (!cur) cur = { title: "", lines: [] };
      cur.lines.push(line);
    }
  }
  if (cur) sections.push(cur);
  return sections.length ? sections : [{ title: "", lines }];
}
